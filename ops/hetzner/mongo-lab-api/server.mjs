import { createHash, timingSafeEqual } from "node:crypto";
import { createServer } from "node:http";
import { MongoClient } from "mongodb";

const PORT = Number(process.env.PORT || 8081);
const MONGO_HOST = process.env.MONGO_LAB_HOST || "mongo-lab";
const MONGO_PORT = Number(process.env.MONGO_LAB_PORT || 27017);
const MONGO_ADMIN_USER = process.env.MONGO_LAB_ADMIN_USER || "root";
const MONGO_ADMIN_PASSWORD = process.env.MONGO_LAB_ADMIN_PASSWORD || "";
const SERVICE_TOKEN = process.env.GIMMEJOB_AI_SERVICE_TOKEN || "";
const WORKSPACE_COUNT = 4;
const FIXTURE_VERSION = 1;
const BASE_DATABASE = "gimmejob_lab";
const MARKER_COLLECTION = "__gimmejob_meta";
const MAX_QUERY_CHARS = 20_000;
const MAX_BODY_BYTES = 32_000;
const MAX_OUTPUT_BYTES = 512 * 1024;
const MAX_ROWS = 200;
const MAX_ACTIVE_REQUESTS = 4;
const MAX_TIME_MS = 6_000;
const workspacePromises = new Map();
let activeRequests = 0;
let clientPromise;

class LabError extends Error {
  constructor(message, status = 500) {
    super(message);
    this.status = status;
  }
}

function json(payload, status = 200) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: {
      "cache-control": "no-store",
      "content-type": "application/json; charset=utf-8",
      "x-content-type-options": "nosniff",
      "x-robots-tag": "noindex, nofollow, noarchive",
    },
  });
}

function safeEqual(left, right) {
  const a = Buffer.from(left);
  const b = Buffer.from(right);
  return a.length === b.length && timingSafeEqual(a, b);
}

function authorized(request) {
  if (!SERVICE_TOKEN) return false;
  const header = request.headers.get("authorization") || "";
  if (!header.startsWith("Bearer ")) return false;
  const supplied = header.slice(7).trim();
  return supplied.length > 0 && safeEqual(supplied, SERVICE_TOKEN);
}

function validSessionId(value) {
  return typeof value === "string" && value.length >= 8 && value.length <= 200 && /^[A-Za-z0-9_-]+$/.test(value);
}

function workspaceFor(sessionId) {
  const digest = createHash("sha256").update(sessionId).digest();
  const shard = digest.readUInt32BE(0) % WORKSPACE_COUNT;
  return { shard, database: `gimmejob_mongo_ws_${shard}` };
}

function connectionUri() {
  const user = encodeURIComponent(MONGO_ADMIN_USER);
  const password = encodeURIComponent(MONGO_ADMIN_PASSWORD);
  return `mongodb://${user}:${password}@${MONGO_HOST}:${MONGO_PORT}/?authSource=admin&directConnection=true`;
}

async function mongoClient() {
  if (!MONGO_ADMIN_PASSWORD) throw new LabError("MongoDB lab administration is not configured.", 503);
  if (!clientPromise) {
    const client = new MongoClient(connectionUri(), {
      connectTimeoutMS: 4_000,
      serverSelectionTimeoutMS: 4_000,
      maxPoolSize: 8,
    });
    clientPromise = client.connect().catch((error) => {
      clientPromise = undefined;
      throw error;
    });
  }
  return clientPromise;
}

function normalize(value) {
  if (value === null || value === undefined) return value ?? null;
  if (value instanceof Date) return value.toISOString();
  if (Array.isArray(value)) return value.map(normalize);
  if (typeof value === "object") {
    if (value._bsontype === "ObjectId" && typeof value.toHexString === "function") return value.toHexString();
    if (value._bsontype === "Decimal128" || value._bsontype === "Long") return value.toString();
    return Object.fromEntries(Object.entries(value).map(([key, entry]) => [key, normalize(entry)]));
  }
  return value;
}

function ensureOutputSize(documents) {
  if (Buffer.byteLength(JSON.stringify(documents), "utf8") > MAX_OUTPUT_BYTES) {
    throw new LabError("Result exceeded the playground output limit. Reduce the result size.", 413);
  }
}

async function ensureWorkspace(workspace) {
  const key = workspace.database;
  if (!workspacePromises.has(key)) {
    const promise = (async () => {
      const client = await mongoClient();
      const target = client.db(workspace.database);
      const marker = await target.collection(MARKER_COLLECTION).findOne({ fixtureVersion: FIXTURE_VERSION });
      if (marker) return;

      await target.dropDatabase();
      const source = client.db(BASE_DATABASE);
      const collections = await source.listCollections({}, { nameOnly: true }).toArray();
      for (const { name } of collections) {
        if (name.startsWith("__gimmejob_")) continue;
        const docs = await source.collection(name).find({}).toArray();
        if (docs.length) await target.collection(name).insertMany(docs, { ordered: false });
        const indexes = await source.collection(name).indexes();
        const secondary = indexes
          .filter((index) => index.name !== "_id_")
          .map((index) => ({
            key: index.key,
            name: index.name,
            ...(index.unique ? { unique: true } : {}),
            ...(index.sparse ? { sparse: true } : {}),
          }));
        if (secondary.length) await target.collection(name).createIndexes(secondary);
      }
      await target.collection(MARKER_COLLECTION).insertOne({ fixtureVersion: FIXTURE_VERSION, createdAt: new Date() });
    })().catch((error) => {
      workspacePromises.delete(key);
      throw error;
    });
    workspacePromises.set(key, promise);
  }
  await workspacePromises.get(key);
}

async function resetWorkspace(workspace) {
  workspacePromises.delete(workspace.database);
  const client = await mongoClient();
  await client.db(workspace.database).dropDatabase();
  await ensureWorkspace(workspace);
}

function findClosingParen(text, openIndex) {
  let depth = 0;
  let quote = "";
  let escaped = false;
  for (let index = openIndex; index < text.length; index += 1) {
    const char = text[index];
    if (quote) {
      if (escaped) escaped = false;
      else if (char === "\\") escaped = true;
      else if (char === quote) quote = "";
      continue;
    }
    if (char === '"' || char === "'") {
      quote = char;
      continue;
    }
    if (char === "(") depth += 1;
    else if (char === ")") {
      depth -= 1;
      if (depth === 0) return index;
    }
  }
  return -1;
}

function splitTopLevel(text) {
  const parts = [];
  let start = 0;
  let braces = 0;
  let brackets = 0;
  let parens = 0;
  let quote = "";
  let escaped = false;
  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];
    if (quote) {
      if (escaped) escaped = false;
      else if (char === "\\") escaped = true;
      else if (char === quote) quote = "";
      continue;
    }
    if (char === '"' || char === "'") quote = char;
    else if (char === "{") braces += 1;
    else if (char === "}") braces -= 1;
    else if (char === "[") brackets += 1;
    else if (char === "]") brackets -= 1;
    else if (char === "(") parens += 1;
    else if (char === ")") parens -= 1;
    else if (char === "," && braces === 0 && brackets === 0 && parens === 0) {
      parts.push(text.slice(start, index).trim());
      start = index + 1;
    }
  }
  const final = text.slice(start).trim();
  if (final || parts.length) parts.push(final);
  return parts;
}

function parseJson(value, fallback) {
  const text = value?.trim();
  if (!text) return fallback;
  try {
    return JSON.parse(text);
  } catch {
    throw new LabError("MongoDB Playground accepts JSON arguments with double-quoted field names and string values.", 400);
  }
}

function parseInvocation(query) {
  const trimmed = query.trim().replace(/;\s*$/, "");
  const match = trimmed.match(/^db\.([A-Za-z][A-Za-z0-9_]*)\.([A-Za-z][A-Za-z0-9_]*)\s*\(/);
  if (!match) throw new LabError("Use MongoDB syntax such as db.orders.find({\"status\":\"paid\"}).", 400);
  const collection = match[1];
  if (collection.startsWith("__gimmejob_")) throw new LabError("Internal playground collections are not available.", 403);
  const openIndex = match[0].lastIndexOf("(");
  const closeIndex = findClosingParen(trimmed, openIndex);
  if (closeIndex < 0) throw new LabError("MongoDB command has an unmatched parenthesis.", 400);
  return {
    collection,
    operation: match[2],
    args: splitTopLevel(trimmed.slice(openIndex + 1, closeIndex)),
    tail: trimmed.slice(closeIndex + 1).trim(),
  };
}

function parseChain(tail) {
  const chain = [];
  let remaining = tail;
  while (remaining) {
    const match = remaining.match(/^\.(sort|limit|skip|explain)\s*\(/);
    if (!match) throw new LabError(`Unsupported MongoDB query chain: ${remaining.slice(0, 60)}`, 400);
    const openIndex = match[0].lastIndexOf("(");
    const closeIndex = findClosingParen(remaining, openIndex);
    if (closeIndex < 0) throw new LabError("MongoDB query chain has an unmatched parenthesis.", 400);
    chain.push({ name: match[1], args: splitTopLevel(remaining.slice(openIndex + 1, closeIndex)) });
    remaining = remaining.slice(closeIndex + 1).trim();
  }
  return chain;
}

function containsForbiddenOperator(value) {
  if (!value || typeof value !== "object") return false;
  if (Array.isArray(value)) return value.some(containsForbiddenOperator);
  return Object.entries(value).some(([key, entry]) =>
    ["$where", "$function", "$accumulator", "$out", "$merge"].includes(key) || containsForbiddenOperator(entry));
}

function ensureSafeDocument(value) {
  if (containsForbiddenOperator(value)) {
    throw new LabError("Server-side JavaScript and cross-collection output stages are disabled in the playground.", 403);
  }
}

function mongoType(value) {
  if (value === null) return "null";
  if (Array.isArray(value)) return "array";
  if (value instanceof Date) return "date";
  if (value?._bsontype === "ObjectId") return "objectId";
  if (Number.isInteger(value)) return "integer";
  if (typeof value === "number") return "number";
  return typeof value;
}

function collectFields(document, fields, prefix = "", depth = 0) {
  if (!document || typeof document !== "object" || depth > 2) return;
  for (const [key, value] of Object.entries(document)) {
    const path = prefix ? `${prefix}.${key}` : key;
    if (!fields.has(path)) fields.set(path, new Set());
    fields.get(path).add(mongoType(value));
    if (value && !Array.isArray(value) && typeof value === "object" && !(value instanceof Date) && !value._bsontype) {
      collectFields(value, fields, path, depth + 1);
    } else if (Array.isArray(value)) {
      const objectSample = value.find((item) => item && typeof item === "object" && !Array.isArray(item));
      if (objectSample) collectFields(objectSample, fields, `${path}[]`, depth + 1);
    }
  }
}

async function loadSchema(workspace) {
  const client = await mongoClient();
  const database = client.db(workspace.database);
  const collections = await database.listCollections({}, { nameOnly: true }).toArray();
  const tables = [];
  for (const { name } of collections.sort((a, b) => a.name.localeCompare(b.name))) {
    if (name.startsWith("__gimmejob_")) continue;
    const samples = await database.collection(name).find({}).limit(40).toArray();
    const fields = new Map();
    samples.forEach((document) => collectFields(document, fields));
    const columns = [...fields.entries()].map(([field, types]) => ({
      name: field,
      type: [...types].sort((a, b) => a.localeCompare(b)).join(" | "),
      nullable: true,
      default: null,
      key: field === "_id" ? "PK" : null,
    }));
    tables.push({ name, columns });
  }
  return { engine: "mongodb", tables };
}

function resultPayload(operation, documents, started, { truncated = false, message = null } = {}) {
  const normalized = documents.map(normalize);
  ensureOutputSize(normalized);
  return {
    engine: "mongodb",
    statementType: operation.toUpperCase(),
    columns: normalized.length ? ["document"] : [],
    rows: normalized.map((document) => [JSON.stringify(document)]),
    documents: normalized,
    rowCount: normalized.length,
    truncated,
    durationMs: Math.round((performance.now() - started) * 10) / 10,
    message,
  };
}

async function executeQuery(workspace, query) {
  const started = performance.now();
  const client = await mongoClient();
  const database = client.db(workspace.database);
  const { collection: collectionName, operation, args, tail } = parseInvocation(query);
  const collection = database.collection(collectionName);
  const chain = parseChain(tail);

  if (operation === "find") {
    const filter = parseJson(args[0], {});
    const projection = parseJson(args[1], null);
    ensureSafeDocument(filter);
    ensureSafeDocument(projection);
    let cursor = collection.find(filter, projection ? { projection } : {}).maxTimeMS(MAX_TIME_MS);
    let explainMode = "";
    let requestedLimit = MAX_ROWS + 1;
    for (const item of chain) {
      if (item.name === "sort") cursor = cursor.sort(parseJson(item.args[0], {}));
      else if (item.name === "skip") cursor = cursor.skip(Math.max(0, Math.min(Number(item.args[0]) || 0, 10_000)));
      else if (item.name === "limit") requestedLimit = Math.max(1, Math.min(Number(item.args[0]) || MAX_ROWS + 1, MAX_ROWS + 1));
      else if (item.name === "explain") explainMode = String(parseJson(item.args[0], "executionStats"));
    }
    cursor = cursor.limit(requestedLimit);
    if (explainMode) return resultPayload("explain", [await cursor.explain(explainMode)], started);
    const documents = await cursor.toArray();
    const truncated = documents.length > MAX_ROWS;
    return resultPayload("find", documents.slice(0, MAX_ROWS), started, { truncated });
  }

  if (tail) throw new LabError(`${operation} does not support chained helpers in this playground.`, 400);

  if (operation === "findOne") {
    const filter = parseJson(args[0], {});
    ensureSafeDocument(filter);
    const document = await collection.findOne(filter, { maxTimeMS: MAX_TIME_MS });
    return resultPayload("findOne", document ? [document] : [], started);
  }

  if (operation === "countDocuments") {
    const filter = parseJson(args[0], {});
    ensureSafeDocument(filter);
    const count = await collection.countDocuments(filter, { maxTimeMS: MAX_TIME_MS });
    return resultPayload("countDocuments", [{ count }], started);
  }

  if (operation === "aggregate") {
    const pipeline = parseJson(args[0], []);
    if (!Array.isArray(pipeline)) throw new LabError("aggregate() expects a JSON array pipeline.", 400);
    ensureSafeDocument(pipeline);
    const documents = await collection.aggregate([...pipeline, { $limit: MAX_ROWS + 1 }], { maxTimeMS: MAX_TIME_MS }).toArray();
    const truncated = documents.length > MAX_ROWS;
    return resultPayload("aggregate", documents.slice(0, MAX_ROWS), started, { truncated });
  }

  if (operation === "insertOne") {
    const document = parseJson(args[0], null);
    if (!document || Array.isArray(document) || typeof document !== "object") throw new LabError("insertOne() expects one JSON object.", 400);
    ensureSafeDocument(document);
    const outcome = await collection.insertOne(document);
    return resultPayload("insertOne", [{ acknowledged: outcome.acknowledged, insertedId: outcome.insertedId }], started,
      { message: "Document inserted successfully." });
  }

  if (operation === "updateOne") {
    const filter = parseJson(args[0], {});
    const update = parseJson(args[1], null);
    if (!update || Array.isArray(update) || typeof update !== "object") throw new LabError("updateOne() expects a JSON update object.", 400);
    ensureSafeDocument(filter);
    ensureSafeDocument(update);
    const outcome = await collection.updateOne(filter, update);
    return resultPayload("updateOne", [{ matchedCount: outcome.matchedCount, modifiedCount: outcome.modifiedCount }], started,
      { message: "Update executed successfully." });
  }

  if (operation === "deleteOne") {
    const filter = parseJson(args[0], {});
    ensureSafeDocument(filter);
    const outcome = await collection.deleteOne(filter);
    return resultPayload("deleteOne", [{ deletedCount: outcome.deletedCount }], started,
      { message: "Delete executed successfully." });
  }

  if (operation === "createIndex") {
    const keys = parseJson(args[0], null);
    const options = parseJson(args[1], {});
    if (!keys || Array.isArray(keys) || typeof keys !== "object") throw new LabError("createIndex() expects a JSON key specification.", 400);
    ensureSafeDocument(keys);
    ensureSafeDocument(options);
    const name = await collection.createIndex(keys, options);
    return resultPayload("createIndex", [{ index: name }], started, { message: `Index ${name} created.` });
  }

  if (operation === "getIndexes") {
    const indexes = await collection.indexes();
    return resultPayload("getIndexes", indexes, started);
  }

  throw new LabError(`Unsupported MongoDB operation: ${operation}.`, 400);
}

async function readJson(request) {
  const reader = request.body?.getReader();
  if (!reader) throw new LabError("Request body is required.", 400);
  const chunks = [];
  let bytes = 0;
  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    bytes += value.byteLength;
    if (bytes > MAX_BODY_BYTES) throw new LabError("Request body is too large.", 413);
    chunks.push(value);
  }
  try {
    return JSON.parse(Buffer.concat(chunks.map((chunk) => Buffer.from(chunk))).toString("utf8"));
  } catch {
    throw new LabError("Invalid JSON body.", 400);
  }
}

async function health() {
  if (!SERVICE_TOKEN || !MONGO_ADMIN_PASSWORD) return json({ status: "degraded", mongodb: false }, 503);
  try {
    const client = await mongoClient();
    await client.db("admin").command({ ping: 1 });
    const base = client.db(BASE_DATABASE);
    const [users, products, orders, marker] = await Promise.all([
      base.collection("users").estimatedDocumentCount(),
      base.collection("products").estimatedDocumentCount(),
      base.collection("orders").estimatedDocumentCount(),
      base.collection(MARKER_COLLECTION).findOne({ fixtureVersion: FIXTURE_VERSION }),
    ]);
    if (users !== 1000 || products !== 120 || orders !== 8000 || !marker) throw new Error("MongoDB fixture is stale.");
    return json({ status: "ok", mongodb: true });
  } catch {
    return json({ status: "degraded", mongodb: false }, 503);
  }
}

async function handleAction(request, pathname) {
  const input = await readJson(request);
  if (input?.engine !== "mongodb") throw new LabError("Unsupported database engine.", 400);
  if (!validSessionId(input?.sessionId)) throw new LabError("Invalid database lab session.", 400);
  const workspace = workspaceFor(input.sessionId);
  await ensureWorkspace(workspace);

  if (pathname === "/v1/reset") {
    await resetWorkspace(workspace);
    return json({ ok: true, engine: "mongodb" });
  }
  if (pathname === "/v1/schema") return json(await loadSchema(workspace));

  const query = typeof input.query === "string" ? input.query.trim() : typeof input.sql === "string" ? input.sql.trim() : "";
  if (!query || query.length > MAX_QUERY_CHARS || query.includes("\u0000")) {
    throw new LabError("MongoDB query must be between 1 and 20,000 characters.", 400);
  }
  return json(await executeQuery(workspace, query));
}

async function handle(request, pathname = new URL(request.url).pathname) {
  if (request.method === "GET" && pathname === "/health") return health();
  if (request.method !== "POST" || !["/v1/query", "/v1/schema", "/v1/reset"].includes(pathname)) {
    return json({ error: "Not found." }, 404);
  }
  if (!authorized(request)) return json({ error: "Unauthorized." }, 401);
  if (activeRequests >= MAX_ACTIVE_REQUESTS) return json({ error: "Database lab is busy. Retry shortly." }, 429);
  activeRequests += 1;
  try {
    return await handleAction(request, pathname);
  } catch (error) {
    const status = error instanceof LabError ? error.status : 500;
    const message = error instanceof Error ? error.message : "MongoDB lab request failed.";
    return json({ error: message }, status);
  } finally {
    activeRequests -= 1;
  }
}

function createLabServer() {
  return createServer(async (request, response) => {
    const body = request.method === "GET" || request.method === "HEAD" ? undefined : request;
    const pathname = (request.url || "/").split("?", 1)[0];
    const webRequest = new Request("https://ai.gimme-job.com/", {
      method: request.method,
      headers: request.headers,
      body,
      duplex: body ? "half" : undefined,
    });
    const webResponse = await handle(webRequest, pathname);
    response.writeHead(webResponse.status, Object.fromEntries(webResponse.headers));
    response.end(Buffer.from(await webResponse.arrayBuffer()));
  });
}

if (process.argv[1] && import.meta.url === new URL(`file://${process.argv[1]}`).href) {
  if (!SERVICE_TOKEN) throw new Error("GIMMEJOB_AI_SERVICE_TOKEN is required");
  createLabServer().listen(PORT, "0.0.0.0", () => {
    console.log(`MongoDB lab API listening on :${PORT}`);
  });
}

export { handle, parseInvocation, parseChain, splitTopLevel, workspaceFor };
