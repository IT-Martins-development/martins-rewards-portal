import { MongoClient, ObjectId } from "mongodb";
import { S3Client, PutObjectCommand, GetObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import crypto from "crypto";

type MongoI18n = {
  pt?: string | null;
  en?: string | null;
  es?: string | null;
};

const COLLECTION = "rewards";
const REDEMPTIONS_COLLECTION = "rewards_redemptions";
const LEDGER_COLLECTION = "rewards_points_ledger";
const BALANCE_COLLECTION = "rewards_points_balance";

function assertEnv(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`Missing env var: ${name}`);
  return v;
}

const MONGO_URI = assertEnv("MONGO_URI");
const DB_NAME = assertEnv("MONGO_DB");

// S3 (manual bucket)
const REWARDS_BUCKET = assertEnv("REWARDS_BUCKET");
const AWS_REGION =
  process.env.AWS_REGION || process.env.AWS_DEFAULT_REGION || "us-east-2";

const s3 = new S3Client({ region: AWS_REGION });

let cachedClient: MongoClient | null = null;

async function getClient() {
  if (cachedClient) return cachedClient;

  const client = new MongoClient(MONGO_URI, {
    serverSelectionTimeoutMS: 10_000,
  });

  await client.connect();
  cachedClient = client;
  return client;
}

function normalizeDeliveryType(v?: string | null) {
  const s = (v || "").trim().toUpperCase();
  if (!["EMAIL", "PICKUP", "SHIPPING"].includes(s)) {
    throw new Error(`Invalid deliveryType: ${v}. Use EMAIL | PICKUP | SHIPPING`);
  }
  return s;
}

function toGraph(doc: any) {
  if (!doc) return null;
  const { _id, ...rest } = doc;
  return { id: _id.toString(), ...rest };
}

function safeInt(n: any, def: number) {
  const v = Number(n);
  if (Number.isNaN(v) || v <= 0) return def;
  return Math.floor(v);
}

// nextToken = base64({"lastId":"<ObjectId>"})
function decodeNextToken(token?: string | null) {
  if (!token) return null;
  try {
    const json = Buffer.from(token, "base64").toString("utf8");
    const obj = JSON.parse(json);
    return obj?.lastId ? String(obj.lastId) : null;
  } catch {
    return null;
  }
}

function encodeNextToken(lastId?: any) {
  if (!lastId) return null;
  const payload = JSON.stringify({ lastId: String(lastId) });
  return Buffer.from(payload, "utf8").toString("base64");
}

function ensureI18n(v: any, fieldName: string): MongoI18n {
  if (!v || typeof v !== "object") throw new Error(`${fieldName} must be an object`);
  return {
    pt: v.pt ?? null,
    en: v.en ?? null,
    es: v.es ?? null,
  };
}

function sanitizeFileName(name: string) {
  const base = (name || "file").split("/").pop()?.split("\\").pop() || "file";
  return base.replace(/[^a-zA-Z0-9._-]/g, "_");
}

function assertContentType(ct: string) {
  const s = (ct || "").trim().toLowerCase();
  const ok = ["image/png", "image/jpeg", "image/jpg", "image/webp", "image/gif"];
  if (!ok.includes(s)) throw new Error(`Invalid contentType: ${ct}`);
  return s;
}

function getIdentitySub(event: any) {
  return (
    event?.identity?.sub ||
    event?.identity?.claims?.sub ||
    event?.identity?.username ||
    null
  );
}

function resolveFieldName(event: any) {
  return (
    event?.info?.fieldName ||
    event?.fieldName ||
    event?.arguments?.fieldName ||
    null
  );
}

/**
 * Status aceitos no Mongo e no front:
 * - REQUESTED  (equivalente ao "PENDING" do front)
 * - PENDING    (aceitamos e normalizamos para REQUESTED)
 * - APPROVED
 * - REJECTED
 */
function normalizeRedemptionStatus(v?: any) {
  const s = String(v ?? "").trim().toUpperCase();
  if (!s) return null;

  // normaliza sinônimos vindos do front
  if (["REQUESTED", "SOLICITADO", "SOLICITADA"].includes(s)) return "PENDING";
  if (["APPROVE", "APPROVED", "APROVADO", "APROVADA"].includes(s)) return "APPROVED";
  if (
    ["REJECT", "REJECTED", "REPROVED", "DENIED", "DECLINED", "CANCELLED", "CANCELED", "REJEITADO", "REJEITADA"]
      .includes(s)
  ) {
    return "REJECTED";
  }

  if (!["PENDING", "APPROVED", "REJECTED"].includes(s)) {
    throw new Error(`Invalid status: ${v}. Use PENDING | APPROVED | REJECTED`);
  }
  return s;
}

function pickUserId(doc: any) {
  return String(doc?.userId ?? doc?.userID ?? doc?.user ?? "").trim();
}

function pickPointsCost(doc: any) {
  const v = Number(doc?.pointsCost ?? doc?.points ?? doc?.cost ?? 0);
  return Number.isFinite(v) ? v : 0;
}

export const handler = async (event: any) => {
  console.log("EVENT:", JSON.stringify(event));

  const field =
    resolveFieldName(event) ||
    event?.info?.parentTypeName ||
    null;

  if (!field) throw new Error("FieldName not resolved");

  const args = event?.arguments || {};
  const identitySub = getIdentitySub(event);

  // ---------- Presigned URL: upload ----------
  if (field === "rewardImageUploadUrl") {
    const fileName = String(args.fileName || "").trim();
    const contentType = assertContentType(String(args.contentType || ""));
    if (!fileName) throw new Error("fileName is required");

    const safeName = sanitizeFileName(fileName);
    const uid = crypto.randomUUID();
    const key = `rewards/${uid}_${safeName}`;

    const cmd = new PutObjectCommand({
      Bucket: REWARDS_BUCKET,
      Key: key,
      ContentType: contentType,
      Metadata: {
        uploadedBy: identitySub ? String(identitySub) : "unknown",
      },
    });

    const uploadUrl = await getSignedUrl(s3, cmd, { expiresIn: 60 * 5 });
    return { key, uploadUrl };
  }

  // ---------- Presigned URL: read ----------
  if (field === "rewardImageUrl") {
    const key = String(args.key || "").trim();
    if (!key) throw new Error("key is required");

    const cmd = new GetObjectCommand({
      Bucket: REWARDS_BUCKET,
      Key: key,
    });

    const url = await getSignedUrl(s3, cmd, { expiresIn: 60 * 10 });
    return { url };
  }

  // ---------- Mongo CRUD ----------
  const client = await getClient();
  const db = client.db(DB_NAME);
  const col = db.collection(COLLECTION);

  try {
    await col.createIndex({ createdAt: -1 });
  } catch {}

  switch (field) {
    case "mongoRewardGet": {
      const id = args.id;
      if (!id) throw new Error("id is required");
      const doc = await col.findOne({ _id: new ObjectId(id) });
      return toGraph(doc);
    }

    case "mongoRewardsList": {
      const limit = safeInt(args.limit, 20);
      const activeOnly = !!args.activeOnly;

      const lastId = decodeNextToken(args.nextToken);

      const filter: any = {};
      if (activeOnly) filter.active = true;
      if (lastId) filter._id = { $lt: new ObjectId(lastId) };

      const docs = await col
        .find(filter)
        .sort({ _id: -1 })
        .limit(limit)
        .toArray();

      const nextToken =
        docs.length === limit
          ? encodeNextToken(docs[docs.length - 1]._id)
          : null;

      return {
        items: docs.map(toGraph),
        nextToken,
      };
    }

    case "mongoRewardCreate": {
      const input = args.input;
      if (!input) throw new Error("input is required");

      if (!input.code) throw new Error("code is required");
      if (!input.title) throw new Error("title is required");
      if (input.pointsCost === undefined || input.pointsCost === null)
        throw new Error("pointsCost is required");
      if (input.active === undefined || input.active === null)
        throw new Error("active is required");
      if (!input.deliveryType) throw new Error("deliveryType is required");

      const now = new Date().toISOString();

      const doc = {
        code: String(input.code).trim(),
        title: ensureI18n(input.title, "title"),
        description: input.description
          ? ensureI18n(input.description, "description")
          : null,
        category: input.category ?? null,
        tags: Array.isArray(input.tags) ? input.tags : [],
        pointsCost: Number(input.pointsCost),
        imageUrl: input.imageUrl ?? null,
        deliveryType: normalizeDeliveryType(input.deliveryType),
        active: !!input.active,
        offerStartAt: input.offerStartAt ?? null,
        offerEndAt: input.offerEndAt ?? null,
        createdAt: now,
        updatedAt: now,
        createdBy: identitySub,
      };

      const res = await col.insertOne(doc);
      return toGraph({ _id: res.insertedId, ...doc });
    }

    case "mongoRewardUpdate": {
      const input = args.input;
      if (!input) throw new Error("input is required");

      const id = input.id;
      if (!id) throw new Error("id is required");

      const update: any = {};
      const setIf = (k: string, v: any) => {
        if (v !== undefined) update[k] = v;
      };

      if (input.code !== undefined) setIf("code", String(input.code).trim());
      if (input.title !== undefined)
        setIf("title", ensureI18n(input.title, "title"));
      if (input.description !== undefined)
        setIf(
          "description",
          input.description ? ensureI18n(input.description, "description") : null
        );

      setIf("category", input.category);
      if (input.tags !== undefined)
        setIf("tags", Array.isArray(input.tags) ? input.tags : []);
      if (input.pointsCost !== undefined)
        setIf("pointsCost", Number(input.pointsCost));
      setIf("imageUrl", input.imageUrl);

      if (input.deliveryType !== undefined)
        setIf("deliveryType", normalizeDeliveryType(input.deliveryType));

      if (input.active !== undefined) setIf("active", !!input.active);
      setIf("offerStartAt", input.offerStartAt);
      setIf("offerEndAt", input.offerEndAt);

      update.updatedAt = new Date().toISOString();

      await col.updateOne({ _id: new ObjectId(id) }, { $set: update });

      const doc = await col.findOne({ _id: new ObjectId(id) });
      return toGraph(doc);
    }

    case "mongoRewardDelete": {
      const id = args.id;
      if (!id) throw new Error("id is required");

      const res = await col.deleteOne({ _id: new ObjectId(id) });
      return res.deletedCount === 1;
    }

    // -------------------------
    // REDEMPTIONS (Approvals)
    // -------------------------
    case "mongoRewardRedemptionsList": {
      const limit = safeInt(args.limit, 50);

      // se não vier status, assume REQUESTED (tela de aprovações)
      const status = normalizeRedemptionStatus(args.status) || "REQUESTED";

      const lastId = decodeNextToken(args.nextToken);

      const filter: any = { status };
      if (lastId) filter._id = { $lt: new ObjectId(lastId) };

      const rcol = db.collection(REDEMPTIONS_COLLECTION);

      try {
        await rcol.createIndex({ status: 1, _id: -1 });
        await rcol.createIndex({ createdAt: -1 });
      } catch {}

      const docs = await rcol
        .find(filter)
        .sort({ _id: -1 })
        .limit(limit)
        .toArray();

      const nextToken =
        docs.length === limit
          ? encodeNextToken(docs[docs.length - 1]._id)
          : null;

      return { items: docs.map(toGraph), nextToken };
    }

    /**
     * ✅ Atualiza status + escreve ledger + ajusta balance
     * Idempotente: se já existir ledger para (redemptionId + type), não duplica.
     */
case "mongoRewardRedemptionUpdateStatus": {
  // ✅ Aceita args.id/status ou args.input.id/status (front às vezes envia dentro de input)
  const rawId =
    (args?.id ?? args?.input?.id ?? args?.input?.redemptionId ?? "").toString().trim();

  const rawStatus =
    (args?.status ?? args?.input?.status ?? args?.input?.newStatus ?? "").toString().trim();

  const newStatus = normalizeRedemptionStatus(rawStatus);

  if (!rawId) throw new Error("id is required");
  if (!newStatus) throw new Error("status is required (PENDING | APPROVED | REJECTED)");

  const rcol = db.collection(REDEMPTIONS_COLLECTION);
  const ledgerCol = db.collection(LEDGER_COLLECTION);
  const balanceCol = db.collection(BALANCE_COLLECTION);

  const nowIso = new Date().toISOString();

  // Carrega o resgate atual
  const current = await rcol.findOne({ _id: new ObjectId(rawId) });
  if (!current) throw new Error("redemption not found");

  const currentStatus = String(current.status || "").trim().toUpperCase();
  const pointsCost = Number(current.pointsCost ?? current.points ?? 0);
  const userId = String(current.userId ?? current.userID ?? current.user ?? "").trim();
  const rewardCode = String(current.rewardCode ?? "").trim();

  if (!userId) throw new Error("redemption.userId missing");
  if (!pointsCost || Number.isNaN(pointsCost)) throw new Error("redemption.pointsCost missing");

  // ✅ idempotência: se já está no mesmo status final, retorna
  if (currentStatus === newStatus) return toGraph(current);

  // ✅ se já finalizou (APPROVED/REJECTED), não deixa mudar
  if (["APPROVED", "REJECTED"].includes(currentStatus)) return toGraph(current);

  // Atualiza status do resgate
  const update: any = { status: newStatus, updatedAt: nowIso };
  if (identitySub) update.updatedBy = identitySub;
  await rcol.updateOne({ _id: new ObjectId(rawId) }, { $set: update });

  // -------------------------
  // REGRAS DE NEGÓCIO
  // -------------------------

  // ✅ APPROVE: NÃO mexe no balance (já foi descontado no REQUEST)
  // Apenas grava ledger de confirmação (opcional, mas recomendado)
  if (newStatus === "APPROVED") {
    // evita duplicar
    const exists = await ledgerCol.findOne({
      "reference.redemptionId": rawId,
      type: "REDEEM",
      source: "REWARD_REDEEM",
    });

    if (!exists) {
      await ledgerCol.insertOne({
        userId,
        type: "REDEEM",
        points: -Math.abs(pointsCost),
        source: "REWARD_REDEEM",
        reference: { redemptionId: rawId, rewardCode },
        note: `Redeem approved: -${pointsCost} (${rewardCode})`,
        createdAt: nowIso,
        createdBy: identitySub || "system",
      });
    }

    const doc = await rcol.findOne({ _id: new ObjectId(rawId) });
    return toGraph(doc);
  }

  // ✅ REJECT: estorna balance + grava ledger de estorno
  if (newStatus === "REJECTED") {
    const refundExists = await ledgerCol.findOne({
      "reference.redemptionId": rawId,
      type: "REDEEM_REFUND",
      source: "REWARD_REDEEM_REFUND",
    });

    if (!refundExists) {
      await ledgerCol.insertOne({
        userId,
        type: "REDEEM_REFUND",
        points: Math.abs(pointsCost),
        source: "REWARD_REDEEM_REFUND",
        reference: { redemptionId: rawId, rewardCode },
        note: `Redeem rejected (refund): +${pointsCost} (${rewardCode})`,
        createdAt: nowIso,
        createdBy: identitySub || "system",
      });

      const res = await balanceCol.updateOne(
        { userId },
        [
          {
            $set: {
              availablePoints: { $add: ["$availablePoints", Math.abs(pointsCost)] },
              // você usa redeemedPoints no relatório -> precisa voltar também
              redeemedPoints: {
                $max: [0, { $subtract: ["$redeemedPoints", Math.abs(pointsCost)] }],
              },
              updatedAt: nowIso,
            },
          },
        ]
      );

      if (res.matchedCount === 0) {
        throw new Error(`balance not found for userId=${userId}`);
      }
    }

    const doc = await rcol.findOne({ _id: new ObjectId(rawId) });
    return toGraph(doc);
  }

  // PENDING (se quiser permitir voltar pra PENDING, aqui você decide)
  const doc = await rcol.findOne({ _id: new ObjectId(rawId) });
  return toGraph(doc);
}

    default:
      throw new Error(`Unknown fieldName: ${field}`);
  }
};