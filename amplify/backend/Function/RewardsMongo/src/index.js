/* eslint-disable no-console */

// ====== DB / Collections (DB: martins) ======
const DB_NAME = "martins";
const REWARDS_COLLECTION = "rewards";
const REDEMPTIONS_COLLECTION = "rewards_redemptions";
const POINTS_BALANCE_COLLECTION = "rewards_points_balance";
const POINTS_LEDGER_COLLECTION = "rewards_points_ledger";
const USERS_COLLECTION = "users";
const BALANCES_COLLECTION = "rewards_points_balance";

// ====== Mongo connection ======
// ✅ CORREÇÃO: Importação do ObjectId adicionada para as funções de update/delete
const { MongoClient, ObjectId } = require("mongodb");

let cachedClient = null;
let cachedDb = null;

function isNonEmptyString(v) {
  return typeof v === "string" && v.trim() !== "";
}

async function getMongoClient() {
  if (cachedClient) return cachedClient;

  const uri = process.env.MONGODB_URI || process.env.MONGO_URI;
  if (!isNonEmptyString(uri)) {
    throw new Error("Missing MongoDB connection string. Set MONGODB_URI (or MONGO_URI).");
  }

  cachedClient = new MongoClient(uri, {
    maxPoolSize: 5,
    serverSelectionTimeoutMS: 15000,
  });

  await cachedClient.connect();
  return cachedClient;
}

async function getDb() {
  if (cachedDb && cachedClient) return cachedDb;

  const uri = process.env.MONGODB_URI || process.env.MONGO_URI;
  if (!isNonEmptyString(uri)) {
    throw new Error("Missing MongoDB connection string. Set MONGODB_URI (or MONGO_URI).");
  }

  cachedClient = new MongoClient(uri, {
    maxPoolSize: 5,
    serverSelectionTimeoutMS: 15000,
  });

  await cachedClient.connect();
  cachedDb = cachedClient.db(DB_NAME);
  return cachedDb;
}

// ✅ CORREÇÃO CRÍTICA: Faz a ponte entre o Cognito (sub) e o Mongo (externalId)
async function resolveInternalUserIdBySub(db, identity) {
  const sub = identity?.sub || identity?.claims?.sub;
  if (!sub) throw new Error("Missing identity sub");

  const usersCol = db.collection(USERS_COLLECTION);
  
  // Busca no campo externalId que é onde fica o sub do Cognito
  const user = await usersCol.findOne({ externalId: String(sub) });
  if (!user) throw new Error(`User not found for cognito sub: ${sub}`);

  // Retorna o UUID string interno do Mongo
  return String(user._id); 
}

// ====== Saldo e Pontos ======

async function mongoMyRewardsBalance(args, identity) {
  try {
    const db = await getDb();
    const cognitoSub = identity?.sub || identity?.claims?.sub;
    const internalUserId = await resolveInternalUserIdBySub(db, identity);

    await ensureBalanceDoc(db, internalUserId);

    const balancesCol = db.collection(BALANCES_COLLECTION);
    const row = await balancesCol.findOne({ userId: internalUserId });

    return {
      // 🔥 A MÁGICA 1: Devolve o Cognito Sub pro front-end em vez do Mongo ID
      userId: cognitoSub, 
      availablePoints: row?.availablePoints || 0,
      lifetimePoints: row?.lifetimePoints || 0,
      redeemedPoints: row?.redeemedPoints || 0,
      levelId: row?.levelId || "NONE",
    };
  } catch (err) {
    console.error("mongoMyRewardsBalance error:", err);
    return {
      userId: identity?.sub || "unknown",
      availablePoints: 0,
      lifetimePoints: 0,
      redeemedPoints: 0,
      levelId: "NONE",
    };
  }
}

async function mongoRewardsBalancesList(args, identity) {
  try {
    const db = await getDb();
    const collection = db.collection(BALANCES_COLLECTION);
    const filter = {};

    const groups = identity?.claims?.['cognito:groups'] || [];
    const isAdmin = groups.includes('admin') || groups.includes('AdminRewards');
    const cognitoSub = identity?.sub || identity?.claims?.sub;

    if (!isAdmin && cognitoSub) {
      const internalUserId = await resolveInternalUserIdBySub(db, identity);
      filter.userId = internalUserId;
      await ensureBalanceDoc(db, internalUserId);
    }

    const items = await collection.find(filter).toArray();

    // 🔥 BUSCA OS DADOS COMPLETOS DOS USUÁRIOS
    const userIds = [...new Set(items.map(i => i.userId).filter(Boolean))];
    const usersCol = db.collection(USERS_COLLECTION);
    const users = await usersCol
      .find({ _id: { $in: userIds } })
      // Traz todos os campos que a tela de Admin precisa
      .project({ _id: 1, externalId: 1, fullName: 1, email: 1, phone: 1, userType: 1, type: 1, groupIds: 1 })
      .toArray();

    // Cria um dicionário para achar o usuário rápido
    const userMap = {};
    for (const u of users) {
      userMap[String(u._id)] = u;
    }

    return {
      items: items.map((i) => {
        const u = userMap[i.userId]; // Pega os dados do dono deste saldo
        
        return {
          id: i._id?.toString(),
          userId: u?.externalId || i.userId, // Devolve o Cognito Sub
          availablePoints: i.availablePoints || 0,
          lifetimePoints: i.lifetimePoints || 0,
          redeemedPoints: i.redeemedPoints || 0,
          levelId: i.levelId || "NONE",
          createdAt: i.createdAt || new Date().toISOString(),
          updatedAt: i.updatedAt || new Date().toISOString(),
          
          // 👇 DADOS EXTRAS PARA A TABELA DO ADMIN:
          userName: u?.fullName || null,
          userEmail: u?.email || null,
          userPhone: u?.phone || null,
          // Usa a função normalizeUserType que já existe no seu código
          userType: u ? normalizeUserType(u) : null 
        };
      }),
      nextToken: null
    };
  } catch (err) {
    console.error("mongoRewardsBalancesList error:", err);
    return { items: [], nextToken: null };
  }
}
// ====== CRIAÇÃO DO RESGATE (REDEEM) ======
async function mongoRewardsRedeem(args, identity) {
  const db = await getDb();
  
  // O front-end manda rewardId e userId
  const input = args?.input || {};
  const rewardIdStr = input.rewardId;

  if (!isNonEmptyString(rewardIdStr)) {
    throw new Error("O campo rewardId é obrigatório para o resgate.");
  }

  // 1. Pega a identidade real do usuário logado e converte pro UUID do Mongo
  const internalUserId = await resolveInternalUserIdBySub(db, identity);

  // 2. Busca o prêmio para saber o custo
  const rewardsCol = db.collection(REWARDS_COLLECTION);
  const rewardOid = toObjectIdMaybe(rewardIdStr);
  const reward = await rewardsCol.findOne(rewardOid ? { _id: rewardOid } : { _id: rewardIdStr });
  
  if (!reward) throw new Error("Prêmio não encontrado.");
  if (!reward.active) throw new Error("Este prêmio não está mais ativo.");

  const pointsCost = safeNumber(reward.pointsCost ?? reward.cost, 0);

  // 3. Checa o saldo do usuário
  const balanceCol = db.collection(BALANCES_COLLECTION);
  const balance = await balanceCol.findOne({ userId: internalUserId });
  
  if (!balance || safeNumber(balance.availablePoints, 0) < pointsCost) {
    throw new Error("Pontos insuficientes para este resgate.");
  }

  const session = cachedClient.startSession();
  let newAvail = balance.availablePoints;
  let redemptionId = null;

  try {
    await session.withTransaction(async () => {
      // A) Deduz os pontos do Available (mas NÃO coloca no Redeemed ainda. O admin que fará isso ao aprovar)
      newAvail = balance.availablePoints - pointsCost;
      await balanceCol.updateOne(
        { userId: internalUserId },
        { $set: { availablePoints: newAvail, updatedAt: nowIso() } },
        { session }
      );

      // B) Cria o registro de Resgate com status PENDING (Solicitado)
      const redemptionDoc = {
        userId: internalUserId,
        rewardId: rewardIdStr,
        rewardCode: reward.code ?? reward.rewardCode ?? "",
        pointsCost: pointsCost,
        status: "PENDING", 
        delivery: reward.deliveryType ?? "EMAIL",
        createdAt: nowIso(),
        updatedAt: nowIso(),
      };
      
      const insertRes = await db.collection(REDEMPTIONS_COLLECTION).insertOne(redemptionDoc, { session });
      redemptionId = insertRes.insertedId;

      // C) Cria o extrato (Ledger) do pedido
        await insertLedger(
        db,
        {
          userId: internalUserId,
          type: "REDEEM_REQUESTED", // Evento de pedido
          points: -Math.abs(pointsCost),
          source: "REWARD_REDEEM_REQUEST",
          reference: {
            redemptionId: String(redemptionId),
            rewardId: rewardIdStr,
            rewardCode: redemptionDoc.rewardCode,
            projectId: String(redemptionId) // 👈 ADICIONE ISSO AQUI TAMBÉM!
          },
        },
        session
      );
    });
  } finally {
    await session.endSession();
  }

  // Retorna os dados que a tela (Frontend) está esperando para atualizar sozinha
  return {
    ok: true,
    message: "Resgate solicitado com sucesso!",
    redemptionId: String(redemptionId),
    availablePoints: newAvail,
    redeemedPoints: safeNumber(balance.redeemedPoints, 0),
    levelId: balance.levelId || "NONE"
  };
}

async function mongoRewardsBalanceSet(args, identity) {
  const db = await getDb();
  const balanceCol = db.collection(POINTS_BALANCE_COLLECTION);

  // ID que vem da tela (Cognito Sub)
  const incomingUserId = String(args?.userId || "").trim(); 
  const reason = String(args?.reason || "MANUAL_ADJUSTMENT").trim();

  const availablePoints = args?.availablePoints != null ? safeNumber(args.availablePoints, 0) : null;
  const redeemedPoints = args?.redeemedPoints != null ? safeNumber(args.redeemedPoints, 0) : null;

  if (!isNonEmptyString(incomingUserId)) throw new Error("userId is required");
  if (availablePoints == null && redeemedPoints == null) {
    throw new Error("Provide availablePoints and/or redeemedPoints");
  }

  // 🔥 TRADUÇÃO DE ID REVERSA: Pega o Sub do Cognito e acha o ID interno do Mongo
  const usersCol = db.collection(USERS_COLLECTION);
  let internalUserId = incomingUserId; // fallback
  const userDoc = await usersCol.findOne({ externalId: incomingUserId });
  
  if (userDoc) {
    internalUserId = String(userDoc._id); // Acha o UUID f736...
  }

  await getDb();
  const session = cachedClient?.startSession ? cachedClient.startSession() : null;

  const updatedAtIso = nowIso();

  let result = {
    ok: true,
    message: null,
    userId: incomingUserId, 
    availablePoints: 0,
    redeemedPoints: 0,
    totalPoints: 0,
    updatedAt: updatedAtIso,
  };

  const run = async (sess) => {
    // 1) garante doc USANDO O ID INTERNO DO MONGO
    await ensureBalanceDoc(db, internalUserId, sess);

    // 2) before
    const before = await balanceCol.findOne(
      { userId: internalUserId },
      sess ? { session: sess } : undefined
    );
    const beforeAvail = safeNumber(before?.availablePoints, 0);
    const beforeRed = safeNumber(before?.redeemedPoints, 0);

    // 3) novo
    const newAvail = availablePoints == null ? beforeAvail : Math.max(0, availablePoints);
    const newRed = redeemedPoints == null ? beforeRed : Math.max(0, redeemedPoints);

    // 4) update
    await balanceCol.updateOne(
      { userId: internalUserId },
      {
        $set: {
          availablePoints: newAvail,
          redeemedPoints: newRed,
          updatedAt: updatedAtIso,
          updatedBy: identity?.username || identity?.sub || null,
        },
      },
      sess ? { session: sess } : undefined
    );

    // 5) ledger (delta)
    const deltaAvail = newAvail - beforeAvail;
    const deltaRed = newRed - beforeRed;

    await insertLedger(
      db,
      {
        userId: internalUserId, // Salva no ledger com o ID interno
        type: "MANUAL_ADJUSTMENT",
        points: deltaAvail,
        source: "REWARDS_BALANCE_SET",
        reference: {
          reason,
          before: { availablePoints: beforeAvail, redeemedPoints: beforeRed },
          after: { availablePoints: newAvail, redeemedPoints: newRed },
          delta: { availablePoints: deltaAvail, redeemedPoints: deltaRed },
          // Mantendo a trava de segurança que fizemos antes:
          projectId: new ObjectId().toString() 
        },
      },
      sess
    );

    // 6) retorno final
    result = {
      ok: true,
      message: "UPDATED",
      // Devolve o Cognito Sub para a tela atualizar a linha certa da tabela
      userId: incomingUserId, 
      availablePoints: safeNumber(newAvail, 0),
      redeemedPoints: safeNumber(newRed, 0),
      totalPoints: safeNumber(newAvail, 0) + safeNumber(newRed, 0),
      updatedAt: updatedAtIso,
    };
  };

  try {
    if (session) {
      await session.withTransaction(async () => run(session), {
        readConcern: { level: "local" },
        writeConcern: { w: "majority" },
      });
    } else {
      await run(null);
    }
    return result;
  } catch (err) {
    const message = err && typeof err.message === "string" ? err.message : String(err);
    console.error("mongoRewardsBalanceSet ERROR:", message, err);
    throw new Error(message);
  } finally {
    try {
      if (session) await session.endSession();
    } catch (_) {}
  }
}
// ====== Utilitários Gerais ======

function safeNumber(v, fallback = 0) {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (typeof v === "string" && v.trim() !== "" && Number.isFinite(Number(v))) return Number(v);
  return fallback;
}

function toObjectIdMaybe(id) {
  try {
    if (ObjectId.isValid(id)) return new ObjectId(id);
  } catch (_) {}
  return null;
}

function nowIso() {
  return new Date().toISOString();
}

function normalizeStatus(status) {
  const s = String(status || "").trim().toUpperCase();
  if (s === "APPROVE" || s === "APPROVED") return "APPROVED";
  if (s === "REJECT" || s === "REJECTED") return "REJECTED";
  if (s === "REQUESTED") return "PENDING";
  if (s === "PENDING") return "PENDING";
  return s;
}

function connection(items, nextToken = null) {
  return {
    items: Array.isArray(items) ? items : [],
    nextToken: nextToken ?? null,
  };
}

function pickLangText(v, lang) {
  if (typeof v === "string") return v;
  if (v && typeof v === "object") {
    const l = (lang || "PT").toUpperCase();
    const candidates = [
      l === "PT" ? "pt" : "en",
      l === "PT" ? "PT" : "EN",
      "pt",
      "en",
      "PT",
      "EN",
      "value",
      "text",
      "label",
      "name",
    ];
    for (const k of candidates) {
      if (typeof v[k] === "string" && v[k].trim() !== "") return v[k];
    }
  }
  return "";
}

function encodeNextToken(obj) {
  try {
    return Buffer.from(JSON.stringify(obj), "utf8").toString("base64");
  } catch {
    return null;
  }
}

function decodeNextToken(token) {
  try {
    return JSON.parse(Buffer.from(String(token), "base64").toString("utf8"));
  } catch {
    return null;
  }
}

// ====== Rewards mapping ======
// ====== Rewards mapping ======
function mapRewardDoc(r, lang) {
  const title = pickLangText(r.title ?? r.titleText ?? r.title_pt ?? r.titlePT ?? r.name, lang);
  const description = pickLangText(
    r.description ?? r.descriptionText ?? r.description_pt ?? r.descriptionPT ?? r.details,
    lang
  );

  const tags = Array.isArray(r.tags)
    ? r.tags
    : isNonEmptyString(r.tags)
      ? String(r.tags).split(",").map((x) => x.trim()).filter(Boolean)
      : [];

  // Pega o link da imagem de qualquer lugar que o banco tenha salvo
  const finalImage = r.imageUrl ?? r.imageURL ?? r.image ?? r.image_path ?? null;

  return {
    id: String(r._id),
    code: r.code ?? r.rewardCode ?? r.reward_id ?? r.rewardId ?? "",
    pointsCost: safeNumber(r.pointsCost ?? r.points_cost ?? r.cost ?? r.points, 0),
    deliveryType: r.deliveryType ?? r.delivery_type ?? r.delivery ?? "EMAIL",
    category: r.category ?? "",
    tags,
    offerStartAt: r.offerStartAt ?? r.offerStart ?? r.offer_start ?? r.startAt ?? r.startDate ?? null,
    offerEndAt: r.offerEndAt ?? r.offerEnd ?? r.offer_end ?? r.endAt ?? r.endDate ?? null,
    active: typeof r.active === "boolean" ? r.active : !!r.isActive,
    
    // 👇 A SOLUÇÃO: Envia a mesma imagem com os dois nomes
    imageUrl: finalImage, 
    image: finalImage,    
    
    title: { pt: title, en: "" },
    description: { pt: description, en: "" },
    createdAt: r.createdAt ?? null,
    updatedAt: r.updatedAt ?? null,
    createdBy: r.createdBy ?? null,
  };
}

// ====== Balance & Ledger Helpers ======
async function ensureBalanceDoc(db, userId, session) {
  const col = db.collection(POINTS_BALANCE_COLLECTION);
  // Garante tratamento como String UUID
  const existing = await col.findOne({ userId: String(userId) }, session ? { session } : undefined);
  if (existing) return existing;

  const doc = {
    userId: String(userId),
    availablePoints: 0,
    redeemedPoints: 0,
    createdAt: nowIso(),
    updatedAt: nowIso(),
  };

  await col.insertOne(doc, session ? { session } : undefined);
  return doc;
}

async function insertLedger(db, { userId, type, points, source, reference }, session) {
  const col = db.collection(POINTS_LEDGER_COLLECTION);
  const doc = {
    userId: String(userId),
    type,
    points,
    source,
    reference: reference || {},
    createdAt: nowIso(),
  };
  await col.insertOne(doc, session ? { session } : undefined);
  return doc;
}

// helper: busca usuários (map)
async function loadUsersMap(db, { name, userType } = {}, session) {
  const col = db.collection(USERS_COLLECTION);
  const q = { $or: [{ deletedAt: null }, { deletedAt: { $exists: false } }] };
  
  if (name && typeof name === "string" && name.trim()) {
    q.fullName = { $regex: name.trim(), $options: "i" };
  }
  if (userType && typeof userType === "string" && userType.trim()) {
    q.userType = userType.trim().toUpperCase();
  }

  const docs = await col
    .find(q, session ? { session } : undefined)
    .project({ _id: 1, fullName: 1, userType: 1, email: 1, phone: 1 })
    .limit(5000)
    .toArray();

  const map = new Map();
  for (const u of docs) {
    map.set(String(u._id), {
      userName: u.fullName || null,
      userType: u.userType || null,
      userEmail: u.email || null,
      userPhone: u.phone || null,
    });
  }
  return map;
}

async function buildUserNameMap(db, userIds) {
  const ids = Array.from(new Set((userIds || []).filter(isNonEmptyString)));
  if (ids.length === 0) return {};

  const usersCol = db.collection(USERS_COLLECTION);

  const docs = await usersCol
    .find({ _id: { $in: ids } })
    .project({ _id: 1, fullName: 1 })
    .toArray();

  const map = {};
  for (const u of docs) {
    map[String(u._id)] = (u.fullName || "").trim();
  }
  return map;
}

// ====== Resolvers (Queries) ======

async function mongoRewardsList(args, identity) {
  const db = await getDb();
  const col = db.collection(REWARDS_COLLECTION);

  const limit = args && args.limit != null ? safeNumber(args.limit, 50) : 50;
  const activeOnly = !!(args && args.activeOnly);
  const search = isNonEmptyString(args?.search) ? args.search.trim() : null;

  const filter = {};
  if (activeOnly) filter.active = true;

  if (search) {
    filter.$or = [
      { code: { $regex: search, $options: "i" } },
      { rewardCode: { $regex: search, $options: "i" } },
      { category: { $regex: search, $options: "i" } },
      { "title.pt": { $regex: search, $options: "i" } },
      { "title.en": { $regex: search, $options: "i" } },
      { title: { $regex: search, $options: "i" } },
    ];
  }

  const lang = identity?.claims?.locale || identity?.claims?.["custom:lang"] || args?.lang || "PT";

  const docs = await col
    .find(filter)
    .sort({ _id: -1 })
    .limit(Math.max(1, Math.min(limit, 500)))
    .toArray();

  return connection(docs.map((r) => mapRewardDoc(r, lang)));
}

async function mongoRewardRedemptionsList(args) {
  const db = await getDb();
  const col = db.collection(REDEMPTIONS_COLLECTION);

  const status = normalizeStatus(args?.status);
  const limit = args && args.limit != null ? safeNumber(args.limit, 50) : 50;

  const filter = {};
  if (isNonEmptyString(status)) filter.status = status;

  const docs = await col
    .find(filter)
    .sort({ createdAt: -1, _id: -1 })
    .limit(Math.max(1, Math.min(limit, 1000)))
    .toArray();

  const userIds = Array.from(
    new Set(docs.map((d) => d.userId).filter((x) => typeof x === "string" && x.trim() !== ""))
  );

  let userMap = {};
  if (userIds.length) {
    const usersCol = db.collection(USERS_COLLECTION);
    const users = await usersCol
      .find({ _id: { $in: userIds }, deletedAt: null })
      .project({ _id: 1, fullName: 1 })
      .toArray();

    userMap = users.reduce((acc, u) => {
      acc[String(u._id)] = u.fullName || "";
      return acc;
    }, {});
  }

  const items = docs.map((d) => ({
    id: String(d._id),
    userId: d.userId ?? null,
    userName: (d.userId && userMap[d.userId]) ? userMap[d.userId] : null,
    rewardCode: d.rewardCode ?? "",
    pointsCost: safeNumber(d.pointsCost, 0),
    status: d.status ?? "",
    delivery: d.delivery || null,
    createdAt: d.createdAt || null,
    updatedAt: d.updatedAt || null,
  }));

  return connection(items);
}

// ====== Resolvers (Mutations) ======

async function mongoRewardRedemptionUpdateStatus(args, identity) {
  const db = await getDb();
  const redemptionsCol = db.collection(REDEMPTIONS_COLLECTION);

  const redemptionIdStr = args?.id;
  const desiredStatus = normalizeStatus(args?.status);

  if (!isNonEmptyString(redemptionIdStr)) throw new Error("id is required");
  if (desiredStatus !== "APPROVED" && desiredStatus !== "REJECTED") {
    throw new Error(`Invalid status: ${args?.status}. Expected APPROVED or REJECTED.`);
  }

  const redemptionOid = toObjectIdMaybe(redemptionIdStr);
  const findQuery = redemptionOid ? { _id: redemptionOid } : { _id: redemptionIdStr };

  const current = await redemptionsCol.findOne(findQuery);
  if (!current) throw new Error(`Redemption not found: ${redemptionIdStr}`);

  const currentStatus = normalizeStatus(current.status);

  if (currentStatus === desiredStatus) {
    const userNameMap = await buildUserNameMap(db, [current.userId]);
    return {
      id: String(current._id),
      userId: current.userId ?? null,
      rewardCode: current.rewardCode ?? "",
      pointsCost: safeNumber(current.pointsCost, 0),
      status: current.status ?? "",
      createdAt: current.createdAt || null,
      updatedAt: current.updatedAt || null,
      userName: userNameMap[current.userId] || null,
    };
  }

  if (currentStatus !== "PENDING") {
    throw new Error(`Cannot change redemption from ${current.status} to ${desiredStatus}`);
  }

  const userId = current.userId;
  const rewardCode = current.rewardCode;
  const pointsCost = safeNumber(current.pointsCost, 0);

  if (!isNonEmptyString(userId)) throw new Error("Redemption is missing userId");
  if (!isNonEmptyString(rewardCode)) throw new Error("Redemption is missing rewardCode");

  const session = cachedClient.startSession();
  let updatedDoc = null;

  try {
    await session.withTransaction(async () => {
      const updateRes = await redemptionsCol.findOneAndUpdate(
        findQuery,
        {
          $set: {
            status: desiredStatus,
            updatedAt: nowIso(),
            updatedBy: identity?.username || identity?.sub || null,
          },
        },
        { returnDocument: "after", session }
      );
      updatedDoc = updateRes.value;

      const balanceCol = db.collection(POINTS_BALANCE_COLLECTION);
      await ensureBalanceDoc(db, userId, session);

      const isApprove = desiredStatus === "APPROVED";

if (isApprove) {
        await insertLedger(
          db,
          {
            userId,
            type: "REDEEM_APPROVED",
            points: -Math.abs(pointsCost),
            source: "REWARD_REDEEM_APPROVE",
            reference: { 
              redemptionId: String(current._id), 
              rewardCode, 
              pointsCost, 
              status: desiredStatus,
              projectId: String(current._id) // 👈 A SOLUÇÃO: Passa o ID do resgate para não dar conflito!
            },
          },
          session
        );

        await balanceCol.updateOne(
          { userId },
          { $inc: { redeemedPoints: Math.abs(pointsCost) }, $set: { updatedAt: nowIso() } },
          { session }
        );
      } else {
        await insertLedger(
          db,
          {
            userId,
            type: "REDEEM_REJECTED",
            points: Math.abs(pointsCost),
            source: "REWARD_REDEEM_REJECT",
            reference: { 
              redemptionId: String(current._id), 
              rewardCode, 
              pointsCost, 
              status: desiredStatus,
              projectId: String(current._id) // 👈 AQUI TAMBÉM!
            },
          },
          session
        );

        await balanceCol.updateOne(
          { userId },
          { $inc: { availablePoints: Math.abs(pointsCost) }, $set: { updatedAt: nowIso() } },
          { session }
        );
      }

      });
  
      const userNameMap = await buildUserNameMap(db, [updatedDoc.userId]);
  
      return {
        id: String(updatedDoc._id),
        userId: updatedDoc.userId ?? null,
        rewardCode: updatedDoc.rewardCode ?? "",
        pointsCost: safeNumber(updatedDoc.pointsCost, 0),
        status: updatedDoc.status ?? "",
        createdAt: updatedDoc.createdAt || null,
        updatedAt: updatedDoc.updatedAt || null,
        userName: userNameMap[updatedDoc.userId] || null,
      };
    } catch (err) {
      console.error("mongoRewardRedemptionUpdateStatus error:", err);
      throw err;
    } finally {
      await session.endSession();
    }
  }


async function mongoRewardCreate(args) {
  const db = await getDb();
  const col = db.collection(REWARDS_COLLECTION);

  const input = args?.input || args || {};
  const code = String(input?.code || "").trim();
  if (!code) throw new Error("code is required");

  const doc = {
    code,
    title: input.title || { pt: "" },
    description: input.description || { pt: "" },
    category: input.category || "",
    tags: Array.isArray(input.tags) ? input.tags : [],
    pointsCost: safeNumber(input.pointsCost, 0),
    imageUrl: input.imageUrl || null,
    deliveryType: input.deliveryType || "EMAIL",
    active: typeof input.active === "boolean" ? input.active : true,
    offerStartAt: input.offerStartAt || null,
    offerEndAt: input.offerEndAt || null,
    createdAt: nowIso(),
    updatedAt: nowIso(),
  };

  await col.insertOne(doc);
  return mapRewardDoc(doc, "PT");
}

async function mongoRewardUpdate(args) {
  const db = await getDb();
  const col = db.collection(REWARDS_COLLECTION);

  // 1. Busca o ID seja na raiz do args ou dentro do input
  const input = args?.input || args || {};
  const idStr = args?.id || input?.id; 

  if (!isNonEmptyString(idStr)) throw new Error("id is required");

  const oid = toObjectIdMaybe(idStr);
  const q = oid ? { _id: oid } : { _id: idStr };

  const $set = { updatedAt: nowIso() };

  // ... (Mantenha os seus IFs exatamente como estão) ...
  if (input.code != null) $set.code = String(input.code).trim();
  if (input.pointsCost != null) $set.pointsCost = safeNumber(input.pointsCost, 0);
  if (input.deliveryType != null) $set.deliveryType = input.deliveryType;
  if (input.category != null) $set.category = input.category;
  if (input.tags != null) $set.tags = Array.isArray(input.tags) ? input.tags : [];
  if (input.offerStartAt !== undefined) $set.offerStartAt = input.offerStartAt;
  if (input.offerEndAt !== undefined) $set.offerEndAt = input.offerEndAt;
  if (input.active != null) $set.active = !!input.active;
  if (input.imageUrl !== undefined) $set.imageUrl = input.imageUrl;
  if (input.title !== undefined) $set.title = input.title;
  if (input.description !== undefined) $set.description = input.description;

  const res = await col.findOneAndUpdate(q, { $set }, { returnDocument: "after" });
  
  // 2. Suporta tanto o MongoDB Driver antigo (res.value) quanto o novo (res)
  const updatedDoc = res?.value || res;

  // Se o documento retornado não tiver _id, o item realmente não foi encontrado
  if (!updatedDoc || !updatedDoc._id) {
    throw new Error(`Reward not found: ${idStr}`);
  }

  return mapRewardDoc(updatedDoc, "PT");
}

async function mongoRewardDelete(args) {
  const db = await getDb();
  const col = db.collection(REWARDS_COLLECTION);

  const idStr = args?.id;
  if (!isNonEmptyString(idStr)) throw new Error("id is required");

  const oid = toObjectIdMaybe(idStr);
  const q = oid ? { _id: oid } : { _id: idStr };

  const doc = await col.findOne(q);
  if (!doc) throw new Error(`Reward not found: ${idStr}`);

  await col.deleteOne(q);
  return true;
}

// ====== Relatórios ======

function normalizeUserType(u) {
  const direct = u?.userType || u?.type || u?.profile?.type || u?.role || u?.user_role;
  if (typeof direct === "string") {
    const t = direct.toUpperCase();
    if (t.includes("BROKER") || t.includes("CORRETOR")) return "BROKER";
    if (t.includes("PARTNER") || t.includes("PARCEIRO")) return "PARTNER";
    return "CLIENT";
  }

  const groups = Array.isArray(u?.groupIds) ? u.groupIds.map(String) : [];
  const g = groups.map((x) => x.toUpperCase());

  if (g.some((x) => x.includes("BROKER") || x.includes("CORRETOR"))) return "BROKER";
  if (g.some((x) => x.includes("PARTNER") || x.includes("PARCEIRO"))) return "PARTNER";

  return "CLIENT";
}

async function mongoRewardsLedgerReport(args, identity) {
  const db = await getDb();

  const ledgerCol = db.collection(POINTS_LEDGER_COLLECTION);
  const usersCol = db.collection(USERS_COLLECTION);
  const rewardsCol = db.collection(REWARDS_COLLECTION);

  const limit = Math.max(1, Math.min(safeNumber(args?.limit, 2000), 5000));
  const nextToken = args?.nextToken ? decodeNextToken(args.nextToken) : null;

  const from = args?.from ? new Date(args.from) : null;
  const to = args?.to ? new Date(args.to) : null;
  const statuses = Array.isArray(args?.statuses) ? args.statuses.map((s) => String(s).toUpperCase()) : null;

  const allowedTypes = ["REDEEM_APPROVED", "REDEEM_REJECTED"];
  const filter = { type: { $in: allowedTypes } };

  if (from || to) {
    filter.createdAt = {};
    if (from && !Number.isNaN(from.getTime())) filter.createdAt.$gte = from.toISOString();
    if (to && !Number.isNaN(to.getTime())) filter.createdAt.$lte = to.toISOString();
    if (Object.keys(filter.createdAt).length === 0) delete filter.createdAt;
  }

  if (statuses && statuses.length) {
    const wantsApproved = statuses.includes("APPROVED");
    const wantsRejected = statuses.includes("REJECTED");
    const wanted = [];
    if (wantsApproved) wanted.push("REDEEM_APPROVED");
    if (wantsRejected) wanted.push("REDEEM_REJECTED");
    if (wanted.length) filter.type = { $in: wanted };
  }

  if (nextToken?.lastId) {
    const lastOid = toObjectIdMaybe(nextToken.lastId);
    if (lastOid) filter._id = { $lt: lastOid };
  }

  const docs = await ledgerCol
    .find(filter)
    .sort({ _id: -1 })
    .limit(limit)
    .toArray();

  const userIds = [...new Set(docs.map((d) => d.userId).filter(isNonEmptyString))];
  const rewardCodes = [
    ...new Set(
      docs
        .map((d) => d?.reference?.rewardCode || d?.reference?.reward_id || d?.reference?.rewardId || null)
        .filter(isNonEmptyString)
    ),
  ];

  const users = await usersCol
    .find({ _id: { $in: userIds } })
    .project({ _id: 1, fullName: 1, email: 1, phone: 1, groupIds: 1, userType: 1, type: 1 })
    .toArray();

  const userMap = new Map(users.map((u) => [String(u._id), u]));

  const rewards = await rewardsCol
    .find({ $or: [{ code: { $in: rewardCodes } }, { rewardCode: { $in: rewardCodes } }] })
    .toArray();

  const rewardMap = new Map();
  for (const r of rewards) {
    const c = r.code ?? r.rewardCode ?? "";
    if (isNonEmptyString(c)) rewardMap.set(String(c), r);
  }

  const lang = identity?.claims?.locale || identity?.claims?.["custom:lang"] || args?.lang || "PT";

  const items = docs.map((d) => {
    const rewardCode = d?.reference?.rewardCode || d?.reference?.reward_id || d?.reference?.rewardId || "";
    const rdoc = rewardMap.get(String(rewardCode));
    const udoc = userMap.get(String(d.userId));
    const status = d.type === "REDEEM_APPROVED" ? "APPROVED" : "REJECTED";
    const rewardName = rdoc ? pickLangText(rdoc.title ?? rdoc.name, lang) : null;
    const deliveryType = rdoc ? (rdoc.deliveryType ?? rdoc.delivery_type ?? null) : null;

    return {
      id: String(d._id),
      userId: d.userId ?? null,
      rewardId: String(rewardCode || ""),
      pointsSpent: Math.abs(safeNumber(d.points, 0)),
      status,
      createdAt: d.createdAt ?? null,
      updatedAt: d.createdAt ?? null,
      rewardName,
      deliveryType,
      userName: udoc?.fullName ?? null,
      userEmail: udoc?.email ?? null,
      userPhone: udoc?.phone ?? null,
      userType: udoc ? normalizeUserType(udoc) : null,
    };
  });

  const last = docs[docs.length - 1];
  const outNextToken = docs.length === limit && last?._id ? encodeNextToken({ lastId: String(last._id) }) : null;

  return connection(items, outNextToken);
}

// ====== Handler Principal ======

// ====== Handler Principal ======

exports.handler = async (event) => {
  try {
    console.log("EVENT:", JSON.stringify(event, null, 2));

    // A MÁGICA ESTÁ AQUI: Tenta pegar da raiz do evento; se não tiver, pega do objeto 'info'
    const typeName = event.typeName || event.info?.parentTypeName;
    const fieldName = event.fieldName || event.info?.fieldName || event.field;
    
    // Opcional: Garante que os argumentos nunca sejam null
    const args = event.arguments || {};
    const identity = event.identity || {};

    if (!typeName) {
        throw new Error(`Não foi possível determinar o typeName. Evento recebido: ${JSON.stringify(event)}`);
    }

    if (typeName === "Query") {
      switch (fieldName) {
        case "mongoRewardsList":
          return await mongoRewardsList(args, identity);
        case "mongoRewardsLedgerReport":
          return await mongoRewardsLedgerReport(args, identity);
        case "mongoRewardRedemptionsList":
          return await mongoRewardRedemptionsList(args, identity);
        case "mongoRewardsBalancesList":
          return await mongoRewardsBalancesList(args, identity);
        case "mongoMyRewardsBalance":
          return await mongoMyRewardsBalance(args, identity);
        default:
          throw new Error(`Unsupported Query field: ${fieldName}`);
      }
    }

    if (typeName === "Mutation") {
      switch (fieldName) {
        case "mongoRewardRedemptionUpdateStatus":
          return await mongoRewardRedemptionUpdateStatus(args, identity);
        case "mongoRewardCreate":
          return await mongoRewardCreate(args, identity);
        case "mongoRewardUpdate":
          return await mongoRewardUpdate(args, identity);
        case "mongoRewardDelete":
          return await mongoRewardDelete(args, identity);
        case "mongoRewardsBalanceSet":
          return await mongoRewardsBalanceSet(args, identity);
        // ADICIONE ESTA LINHA ABAIXO PARA O RESGATE FUNCIONAR!
        case "mongoRewardsRedeem":
        case "MongoRewardsRedeem":
          return await mongoRewardsRedeem(args, identity);
        default:
          throw new Error(`Unsupported Mutation field: ${fieldName}`);
      }
    }

    throw new Error(`Unsupported resolver typeName: ${typeName}`);
  } catch (err) {
    const message = err && typeof err.message === "string" ? err.message : String(err);
    console.error("ERROR:", message, err);
    throw new Error(message);
  }
};