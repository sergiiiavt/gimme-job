import { createHash, createHmac, timingSafeEqual } from "node:crypto";
import { spawn } from "node:child_process";
import { createServer } from "node:http";

const PORT = Number(process.env.PORT || 8080);
const MYSQL_HOST = process.env.MYSQL_LAB_HOST || "mysql-lab";
const MYSQL_PORT = Number(process.env.MYSQL_LAB_PORT || 3306);
const POSTGRES_HOST = process.env.POSTGRES_LAB_HOST || "postgres-lab";
const POSTGRES_PORT = Number(process.env.POSTGRES_LAB_PORT || 5432);
const MYSQL_ADMIN_PASSWORD = process.env.MYSQL_LAB_ROOT_PASSWORD || "";
const POSTGRES_ADMIN_PASSWORD = process.env.POSTGRES_LAB_ADMIN_PASSWORD || "";
const SERVICE_TOKEN = process.env.GIMMEJOB_AI_SERVICE_TOKEN || "";
const WORKSPACE_COUNT = 4;
const MAX_SQL_CHARS = 20_000;
const MAX_BODY_BYTES = 32_000;
const MAX_OUTPUT_BYTES = 512 * 1024;
const MAX_ROWS = 200;
const QUERY_TIMEOUT_MS = 7_000;
const ADMIN_TIMEOUT_MS = 60_000;
const MAX_ACTIVE_REQUESTS = 4;
const workspacePromises = new Map();
let activeRequests = 0;

class LabError extends Error {
  constructor(message, status = 500) {
    super(message);
    this.status = status;
  }
}

function json(response, status = 200) {
  return new Response(JSON.stringify(response), {
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
  return {
    shard,
    label: `Workspace ${shard + 1}/${WORKSPACE_COUNT}`,
    mysqlDatabase: `gimmejob_ws_${shard}`,
    mysqlUser: `gjws_${shard}`,
    postgresSchema: `ws_${shard}`,
    postgresUser: `gjws_${shard}`,
  };
}

function workspacePassword(engine, shard) {
  const digest = createHmac("sha256", SERVICE_TOKEN).update(`${engine}:${shard}`).digest("hex");
  return `Gj1!${digest.slice(0, 28)}Aa`;
}

function quoteLiteral(value) {
  return String(value).replaceAll("'", "''");
}

function statementKind(sql) {
  const cleaned = sql.replace(/^(?:\s|--[^\n]*\n|\/\*[\s\S]*?\*\/)+/, "").trim();
  const first = cleaned.match(/^([A-Za-z]+)/)?.[1]?.toUpperCase();
  return first || "SQL";
}

async function runProcess(command, args, { env = {}, timeoutMs = QUERY_TIMEOUT_MS, input = "" } = {}) {
  return await new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      env: { ...process.env, ...env },
      stdio: ["pipe", "pipe", "pipe"],
    });
    let stdout = "";
    let stderr = "";
    let outputBytes = 0;
    let exceeded = false;
    let timedOut = false;

    const timer = setTimeout(() => {
      timedOut = true;
      child.kill("SIGKILL");
    }, timeoutMs);

    child.on("error", (error) => {
      clearTimeout(timer);
      reject(new LabError(`Database client could not start: ${error.message}`, 503));
    });
    child.stdout.on("data", (chunk) => {
      outputBytes += chunk.length;
      if (outputBytes > MAX_OUTPUT_BYTES) {
        exceeded = true;
        child.kill("SIGKILL");
        return;
      }
      stdout += chunk.toString("utf8");
    });
    child.stderr.on("data", (chunk) => {
      if (stderr.length < 16_000) stderr += chunk.toString("utf8");
    });
    child.on("close", (code) => {
      clearTimeout(timer);
      if (timedOut) return reject(new LabError("Query exceeded the 7 second playground limit.", 408));
      if (exceeded) return reject(new LabError("Result exceeded the playground output limit. Add a LIMIT clause.", 413));
      if (code !== 0) {
        const detail = stderr.trim().replace(/password=[^\s]+/gi, "password=[redacted]");
        return reject(new LabError(detail.slice(0, 2000) || "Database statement failed.", 400));
      }
      resolve({ stdout, stderr });
    });

    child.stdin.end(input);
  });
}

function mysqlArgs({ user, database, sql, skipHeaders = false }) {
  const args = [
    "--protocol=TCP",
    `--host=${MYSQL_HOST}`,
    `--port=${MYSQL_PORT}`,
    `--user=${user}`,
    "--batch",
    "--raw",
    "--silent",
    "--local-infile=0",
    "--connect-timeout=3",
    "--default-character-set=utf8mb4",
  ];
  if (skipHeaders) args.push("--skip-column-names");
  if (database) args.push(database);
  args.push("--execute", sql);
  return args;
}

async function mysqlRun({ user, password, database = "", sql, skipHeaders = false, admin = false }) {
  return runProcess("mysql", mysqlArgs({ user, database, sql, skipHeaders }), {
    env: { MYSQL_PWD: password },
    timeoutMs: admin ? ADMIN_TIMEOUT_MS : QUERY_TIMEOUT_MS,
  });
}

function postgresArgs({ user, database, sql }) {
  return [
    "--host", POSTGRES_HOST,
    "--port", String(POSTGRES_PORT),
    "--username", user,
    "--dbname", database,
    "--no-psqlrc",
    "--set", "ON_ERROR_STOP=1",
    "--csv",
    "--quiet",
    "--pset", "footer=off",
    "--command", sql,
  ];
}

async function postgresRun({ user, password, database = "gimmejob_lab", schema = "public", sql, admin = false }) {
  return runProcess("psql", postgresArgs({ user, database, sql }), {
    env: {
      PGPASSWORD: password,
      PGOPTIONS: `-c statement_timeout=${admin ? 55000 : 6000} -c search_path=${schema}`,
    },
    timeoutMs: admin ? ADMIN_TIMEOUT_MS : QUERY_TIMEOUT_MS,
  });
}

async function ensureMysqlWorkspace(workspace) {
  if (!MYSQL_ADMIN_PASSWORD) throw new LabError("MySQL lab administration is not configured.", 503);
  const password = workspacePassword("mysql", workspace.shard);
  const user = workspace.mysqlUser;
  const database = workspace.mysqlDatabase;
  await mysqlRun({
    user: "root",
    password: MYSQL_ADMIN_PASSWORD,
    admin: true,
    sql: `
      CREATE DATABASE IF NOT EXISTS \`${database}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci;
      CREATE USER IF NOT EXISTS '${user}'@'%' IDENTIFIED WITH mysql_native_password BY '${quoteLiteral(password)}';
      ALTER USER '${user}'@'%' IDENTIFIED WITH mysql_native_password BY '${quoteLiteral(password)}';
      ALTER USER '${user}'@'%' WITH MAX_QUERIES_PER_HOUR 3000 MAX_USER_CONNECTIONS 4;
      GRANT SELECT, INSERT, UPDATE, DELETE, CREATE, DROP, ALTER, INDEX, REFERENCES, CREATE VIEW, SHOW VIEW,
        TRIGGER, CREATE TEMPORARY TABLES ON \`${database}\`.* TO '${user}'@'%';
    `,
  });
  const marker = await mysqlRun({
    user: "root",
    password: MYSQL_ADMIN_PASSWORD,
    admin: true,
    skipHeaders: true,
    sql: `SELECT COUNT(*) FROM information_schema.tables WHERE table_schema='${database}' AND table_name='__gimmejob_workspace';`,
  });
  if (Number(marker.stdout.trim()) > 0) return;
  await mysqlRun({
    user: "root",
    password: MYSQL_ADMIN_PASSWORD,
    admin: true,
    sql: `
      DROP TABLE IF EXISTS \`${database}\`.orders, \`${database}\`.products, \`${database}\`.users, \`${database}\`.__gimmejob_workspace;
      CREATE TABLE \`${database}\`.users LIKE gimmejob_lab.users;
      INSERT INTO \`${database}\`.users SELECT * FROM gimmejob_lab.users;
      CREATE TABLE \`${database}\`.products LIKE gimmejob_lab.products;
      INSERT INTO \`${database}\`.products SELECT * FROM gimmejob_lab.products;
      CREATE TABLE \`${database}\`.orders LIKE gimmejob_lab.orders;
      INSERT INTO \`${database}\`.orders SELECT * FROM gimmejob_lab.orders;
      CREATE TABLE \`${database}\`.__gimmejob_workspace (created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP);
      INSERT INTO \`${database}\`.__gimmejob_workspace VALUES (CURRENT_TIMESTAMP);
      ANALYZE TABLE \`${database}\`.users, \`${database}\`.products, \`${database}\`.orders;
    `,
  });
}

async function ensurePostgresWorkspace(workspace) {
  if (!POSTGRES_ADMIN_PASSWORD) throw new LabError("PostgreSQL lab administration is not configured.", 503);
  const password = workspacePassword("postgres", workspace.shard);
  const role = workspace.postgresUser;
  const schema = workspace.postgresSchema;
  await postgresRun({
    user: "postgres",
    password: POSTGRES_ADMIN_PASSWORD,
    admin: true,
    sql: `
      DO $do$
      BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = '${role}') THEN
          CREATE ROLE ${role} LOGIN PASSWORD '${quoteLiteral(password)}' CONNECTION LIMIT 4;
        ELSE
          ALTER ROLE ${role} WITH LOGIN PASSWORD '${quoteLiteral(password)}' CONNECTION LIMIT 4;
        END IF;
      END
      $do$;
      CREATE SCHEMA IF NOT EXISTS ${schema} AUTHORIZATION ${role};
      ALTER SCHEMA ${schema} OWNER TO ${role};
    `,
  });
  const marker = await postgresRun({
    user: "postgres",
    password: POSTGRES_ADMIN_PASSWORD,
    admin: true,
    sql: `SELECT COUNT(*) FROM information_schema.tables WHERE table_schema='${schema}' AND table_name='__gimmejob_workspace';`,
  });
  if (Number(marker.stdout.trim().split(/\r?\n/).at(-1)) > 0) return;
  await postgresRun({
    user: "postgres",
    password: POSTGRES_ADMIN_PASSWORD,
    admin: true,
    sql: `
      DROP TABLE IF EXISTS ${schema}.orders, ${schema}.products, ${schema}.users, ${schema}.__gimmejob_workspace CASCADE;
      CREATE TABLE ${schema}.users (LIKE public.users INCLUDING ALL);
      INSERT INTO ${schema}.users SELECT * FROM public.users;
      ALTER TABLE ${schema}.users OWNER TO ${role};
      CREATE TABLE ${schema}.products (LIKE public.products INCLUDING ALL);
      INSERT INTO ${schema}.products SELECT * FROM public.products;
      ALTER TABLE ${schema}.products OWNER TO ${role};
      CREATE TABLE ${schema}.orders (LIKE public.orders INCLUDING ALL);
      INSERT INTO ${schema}.orders SELECT * FROM public.orders;
      ALTER TABLE ${schema}.orders OWNER TO ${role};
      CREATE TABLE ${schema}.__gimmejob_workspace (created_at TIMESTAMPTZ NOT NULL DEFAULT now());
      INSERT INTO ${schema}.__gimmejob_workspace DEFAULT VALUES;
      ALTER TABLE ${schema}.__gimmejob_workspace OWNER TO ${role};
      ANALYZE ${schema}.users;
      ANALYZE ${schema}.products;
      ANALYZE ${schema}.orders;
    `,
  });
}

async function ensureWorkspace(engine, workspace) {
  const key = `${engine}:${workspace.shard}`;
  if (!workspacePromises.has(key)) {
    const promise = (engine === "mysql" ? ensureMysqlWorkspace(workspace) : ensurePostgresWorkspace(workspace))
      .catch((error) => {
        workspacePromises.delete(key);
        throw error;
      });
    workspacePromises.set(key, promise);
  }
  await workspacePromises.get(key);
}

async function resetWorkspace(engine, workspace) {
  const key = `${engine}:${workspace.shard}`;
  workspacePromises.delete(key);
  if (engine === "mysql") {
    await mysqlRun({
      user: "root",
      password: MYSQL_ADMIN_PASSWORD,
      admin: true,
      sql: `DROP DATABASE IF EXISTS \`${workspace.mysqlDatabase}\`;`,
    });
  } else {
    await postgresRun({
      user: "postgres",
      password: POSTGRES_ADMIN_PASSWORD,
      admin: true,
      sql: `DROP SCHEMA IF EXISTS ${workspace.postgresSchema} CASCADE;`,
    });
  }
  await ensureWorkspace(engine, workspace);
}

function parseTsv(text) {
  const lines = text.trimEnd().split(/\r?\n/).filter(Boolean);
  if (lines.length === 0) return { columns: [], rows: [] };
  const columns = lines[0].split("\t");
  const rows = lines.slice(1, MAX_ROWS + 1).map((line) => line.split("\t").map((value) => value === "NULL" ? null : value));
  return { columns, rows, truncated: lines.length - 1 > MAX_ROWS };
}

function parseCsv(text) {
  const records = [];
  let row = [];
  let field = "";
  let quoted = false;
  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];
    if (quoted) {
      if (char === '"' && text[index + 1] === '"') {
        field += '"';
        index += 1;
      } else if (char === '"') {
        quoted = false;
      } else {
        field += char;
      }
      continue;
    }
    if (char === '"') quoted = true;
    else if (char === ",") {
      row.push(field);
      field = "";
    } else if (char === "\n") {
      row.push(field.replace(/\r$/, ""));
      records.push(row);
      row = [];
      field = "";
    } else field += char;
  }
  if (field || row.length) {
    row.push(field.replace(/\r$/, ""));
    records.push(row);
  }
  return records;
}

function postgresGrid(text) {
  const records = parseCsv(text.trim());
  if (records.length === 0) return { columns: [], rows: [], truncated: false };
  if (records.length === 1 && records[0].length === 1 && /^(?:CREATE|ALTER|DROP|INSERT|UPDATE|DELETE|ANALYZE|GRANT|SET)\b/i.test(records[0][0])) {
    return { columns: [], rows: [], truncated: false, command: records[0][0] };
  }
  return {
    columns: records[0],
    rows: records.slice(1, MAX_ROWS + 1),
    truncated: records.length - 1 > MAX_ROWS,
  };
}

async function executeUserQuery(engine, workspace, sql) {
  const started = performance.now();
  const kind = statementKind(sql);
  let result;
  if (engine === "mysql") {
    result = await mysqlRun({
      user: workspace.mysqlUser,
      password: workspacePassword("mysql", workspace.shard),
      database: workspace.mysqlDatabase,
      sql,
    });
    const grid = parseTsv(result.stdout);
    return {
      engine,
      workspace: workspace.label,
      statementType: kind,
      columns: grid.columns,
      rows: grid.rows,
      rowCount: grid.rows.length,
      truncated: Boolean(grid.truncated),
      durationMs: Math.round((performance.now() - started) * 10) / 10,
      message: grid.columns.length ? null : "Statement executed successfully.",
    };
  }

  result = await postgresRun({
    user: workspace.postgresUser,
    password: workspacePassword("postgres", workspace.shard),
    schema: workspace.postgresSchema,
    sql,
  });
  const grid = postgresGrid(result.stdout);
  return {
    engine,
    workspace: workspace.label,
    statementType: kind,
    columns: grid.columns,
    rows: grid.rows,
    rowCount: grid.rows.length,
    truncated: Boolean(grid.truncated),
    durationMs: Math.round((performance.now() - started) * 10) / 10,
    message: grid.command || (grid.columns.length ? null : "Statement executed successfully."),
  };
}

function schemaFromRows(engine, workspace, rows) {
  const tables = [];
  const byName = new Map();
  for (const row of rows) {
    const [tableName, columnName, dataType, nullable, defaultValue, key] = row;
    if (!tableName || String(tableName).startsWith("__gimmejob_")) continue;
    if (!byName.has(tableName)) {
      const table = { name: tableName, columns: [] };
      byName.set(tableName, table);
      tables.push(table);
    }
    byName.get(tableName).columns.push({
      name: columnName,
      type: dataType,
      nullable: nullable === "YES",
      default: defaultValue || null,
      key: key || null,
    });
  }
  return { engine, workspace: workspace.label, tables };
}

async function loadSchema(engine, workspace) {
  if (engine === "mysql") {
    const result = await mysqlRun({
      user: workspace.mysqlUser,
      password: workspacePassword("mysql", workspace.shard),
      database: workspace.mysqlDatabase,
      sql: `SELECT TABLE_NAME, COLUMN_NAME, COLUMN_TYPE, IS_NULLABLE, COALESCE(COLUMN_DEFAULT,''), COLUMN_KEY
        FROM information_schema.columns
        WHERE table_schema = DATABASE()
        ORDER BY TABLE_NAME, ORDINAL_POSITION;`,
    });
    return schemaFromRows(engine, workspace, parseTsv(result.stdout).rows);
  }
  const result = await postgresRun({
    user: workspace.postgresUser,
    password: workspacePassword("postgres", workspace.shard),
    schema: workspace.postgresSchema,
    sql: `SELECT table_name, column_name, data_type, is_nullable, COALESCE(column_default,''), '' AS column_key
      FROM information_schema.columns
      WHERE table_schema = current_schema()
      ORDER BY table_name, ordinal_position;`,
  });
  return schemaFromRows(engine, workspace, postgresGrid(result.stdout).rows);
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
  if (!SERVICE_TOKEN || !MYSQL_ADMIN_PASSWORD || !POSTGRES_ADMIN_PASSWORD) {
    return json({ status: "degraded", mysql: false, postgres: false }, 503);
  }
  try {
    await Promise.all([
      mysqlRun({ user: "root", password: MYSQL_ADMIN_PASSWORD, admin: true, skipHeaders: true, sql: "SELECT 1;" }),
      postgresRun({ user: "postgres", password: POSTGRES_ADMIN_PASSWORD, database: "postgres", admin: true, sql: "SELECT 1;" }),
    ]);
    return json({ status: "ok", mysql: true, postgres: true });
  } catch {
    return json({ status: "degraded", mysql: false, postgres: false }, 503);
  }
}

async function handle(request) {
  const url = new URL(request.url);
  if (request.method === "GET" && url.pathname === "/health") return health();
  if (request.method !== "POST" || !["/v1/query", "/v1/schema", "/v1/reset"].includes(url.pathname)) {
    return json({ error: "Not found." }, 404);
  }
  if (!authorized(request)) return json({ error: "Unauthorized." }, 401);
  if (activeRequests >= MAX_ACTIVE_REQUESTS) return json({ error: "Database lab is busy. Retry shortly." }, 429);
  activeRequests += 1;
  try {
    const input = await readJson(request);
    const engine = input?.engine;
    const sessionId = input?.sessionId;
    if (engine !== "mysql" && engine !== "postgres") throw new LabError("Unsupported database engine.", 400);
    if (!validSessionId(sessionId)) throw new LabError("Invalid database lab session.", 400);
    const workspace = workspaceFor(sessionId);
    await ensureWorkspace(engine, workspace);

    if (url.pathname === "/v1/reset") {
      await resetWorkspace(engine, workspace);
      return json({ ok: true, engine, workspace: workspace.label });
    }
    if (url.pathname === "/v1/schema") return json(await loadSchema(engine, workspace));

    const sql = typeof input.sql === "string" ? input.sql.trim() : "";
    if (!sql || sql.length > MAX_SQL_CHARS || sql.includes("\u0000")) throw new LabError("SQL must be between 1 and 20,000 characters.", 400);
    const kind = statementKind(sql);
    if (["GRANT", "REVOKE", "CREATE USER", "ALTER USER"].includes(kind)) throw new LabError("Account and privilege administration is not available in the playground.", 403);
    return json(await executeUserQuery(engine, workspace, sql));
  } catch (error) {
    const status = error instanceof LabError ? error.status : 500;
    const message = error instanceof Error ? error.message : "Database lab request failed.";
    return json({ error: message }, status);
  } finally {
    activeRequests -= 1;
  }
}

if (process.argv[1] && import.meta.url === new URL(`file://${process.argv[1]}`).href) {
  if (!SERVICE_TOKEN) throw new Error("GIMMEJOB_AI_SERVICE_TOKEN is required");
  createServer(async (request, response) => {
    const body = request.method === "GET" || request.method === "HEAD" ? undefined : request;
    const webRequest = new Request(`http://db-lab-api${request.url || "/"}`, {
      method: request.method,
      headers: request.headers,
      body,
      duplex: body ? "half" : undefined,
    });
    const webResponse = await handle(webRequest);
    response.writeHead(webResponse.status, Object.fromEntries(webResponse.headers));
    response.end(Buffer.from(await webResponse.arrayBuffer()));
  }).listen(PORT, "0.0.0.0", () => {
    console.log(`Database lab API listening on :${PORT}`);
  });
}

export { handle, parseCsv, parseTsv, postgresGrid, statementKind, workspaceFor };
