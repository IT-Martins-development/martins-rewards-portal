const { MongoClient, ObjectId } = require("mongodb");

const DB_NAME = process.env.MONGO_DB;
const MONGO_URI = process.env.MONGO_URI;
const COLLECTION = "rewards";

let cachedClient = null;

async function getClient() {
  if (cachedClient) return cachedClient;
  if (!MONGO_URI) throw new Error("Missing env var: MONGO_URI");
  const client = new MongoClient(MONGO_URI);
  await client.connect();
  cachedClient = client;
  return client;
}

function normalizeDeliveryType(v) {
  const s = String(v || "").trim().toUpperCase();
  if (!["EMAIL", "PICKUP", "SHIPPING"].includes(s)) {
    throw new Error(`Invalid deliveryType: ${v}. Use EMAIL | PICKUP | SHIPPING`);
  }
  return s;
}

function toGraph(doc) {
  if (!doc) return null;
  const { _id, ...rest } = doc;
  return { id: String(_id), ...rest };
}

function safeInt(n, def) {
  const v = Number(n);
  if (Number.isNaN(v) || v <= 0) return def;
  return Math.floor(v);
}

// nextToken estilo "cursor" (base64) usando _id
function decodeNextToken(token) {
  if (!token) return null;
  try {
    const json = Buffer.from(token, "base64").toString("utf8");
    const obj = JSON.parse(json);
    return obj?.lastId ? String(obj.lastId) : null;
  } catch {
    return null;
  }
}

function encodeNextToken(lastId) {
  if (!lastId) return null;
  const payload = JSON.stringify({ lastId: String(lastId) });
  return Buffer.from(payload, "utf8").toString("base64");
}

exports.handler = async (event) => {
  const field = event?.info?.fieldName;
  const args = event?.arguments || {};
  const identitySub =
    event?.identity?.sub || event?.identity?.claims?.sub || null;

  const client = await getClient();
  if (!DB_NAME) throw new Error("Missing env var: MONGO_DB");

  const db = client.db(DB_NAME);
  const col = db.collection(COLLECTION);

  switch (field) {
    // B) Query
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

      const filter = {};
      if (activeOnly) filter.active = true;
      if (lastId) filter._id = { $lt: new ObjectId(lastId) };

      const docs = await col
        .find(filter)
        .sort({ _id: -1 })
        .limit(limit)
        .toArray();

      const nextToken =
        docs.length === limit ? encodeNextToken(docs[docs.length - 1]._id) : null;

      return {
        items: docs.map(toGraph),
        nextToken,
      };
    }

    // B) Mutation
    case "mongoRewardCreate": {
      const input = args.input;
      if (!input?.code) throw new Error("code is required");
      if (!input?.title) throw new Error("title is required");
      if (typeof input.pointsCost !== "number")
        throw new Error("pointsCost must be a number");
      if (typeof input.active !== "boolean")
        throw new Error("active must be boolean");

      const now = new Date().toISOString();

      const doc = {
        code: String(input.code).trim(),
        title: input.title,
        description: input.description ?? null,
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
      const id = input?.id;
      if (!id) throw new Error("id is required");

      const update = {};
      const setIf = (k, v) => {
        if (v !== undefined) update[k] = v;
      };

      if (input.code !== undefined) setIf("code", String(input.code).trim());
      setIf("title", input.title);
      setIf("description", input.description);
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

      setIf("updatedAt", new Date().toISOString());

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

    default:
      throw new Error(`Unknown fieldName: ${field}`);
  }
};
