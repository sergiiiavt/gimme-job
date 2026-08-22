import { spawnSync } from "node:child_process";
import { access, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const wranglerCli = path.join(projectRoot, "node_modules", "wrangler", "bin", "wrangler.js");
const artifactConfigPath = path.join(projectRoot, "dist", "server", "wrangler.json");
const generatedConfigPath = path.join(projectRoot, "dist", "server", "wrangler.generated.json");
const wranglerRuntimePath = path.join(projectRoot, ".wrangler");
const deploySecretsPath = path.join(wranglerRuntimePath, "deploy-secrets.json");
const databaseName = "gimmejob-db";
const vectorIndexName = "gimmejob-rag";
const dryRunDatabaseId = "00000000-0000-4000-8000-000000000000";

function requiredEnvironment(name) {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`${name} is required for Cloudflare deployment.`);
  return value;
}

function optionalEnvironment(name) {
  return process.env[name]?.trim() || "";
}

function enabledEnvironment(name) {
  return optionalEnvironment(name).toLowerCase() === "true";
}

function runWrangler(args, options = {}) {
  const capture = options.capture === true;
  const result = spawnSync(process.execPath, [wranglerCli, ...args], {
    cwd: projectRoot,
    encoding: "utf8",
    env: {
      ...process.env,
      XDG_CONFIG_HOME: path.join(wranglerRuntimePath, "xdg-config"),
      WRANGLER_LOG_PATH: path.join(wranglerRuntimePath, "wrangler.log"),
      WRANGLER_SEND_METRICS: "false",
      WRANGLER_WRITE_LOGS: "false",
    },
    stdio: capture ? ["ignore", "pipe", "inherit"] : "inherit",
  });
  if (result.error) throw result.error;
  if (result.status !== 0) throw new Error(`Wrangler failed: ${args.join(" ")}`);
  return result.stdout ?? "";
}

function parseJsonList(output, resourceName) {
  const firstBracket = output.indexOf("[");
  const lastBracket = output.lastIndexOf("]");
  if (firstBracket < 0 || lastBracket < firstBracket) throw new Error(`Wrangler did not return a ${resourceName} list as JSON.`);
  const value = JSON.parse(output.slice(firstBracket, lastBracket + 1));
  if (!Array.isArray(value)) throw new Error(`Unexpected ${resourceName} list response.`);
  return value;
}

function listDatabases() {
  return parseJsonList(runWrangler(["d1", "list", "--json"], { capture: true }), "D1 database");
}

function findDatabase(databases) {
  return databases.find((database) => database?.name === databaseName) ?? null;
}

function databaseId(database) {
  const value = database?.uuid ?? database?.id;
  return typeof value === "string" && value.length > 0 ? value : null;
}

function listVectorIndexes() {
  return parseJsonList(runWrangler(["vectorize", "list", "--json"], { capture: true }), "Vectorize index");
}

function vectorIndexExists(indexes) {
  return indexes.some((index) => index?.name === vectorIndexName);
}

function ensureVectorIndex() {
  if (vectorIndexExists(listVectorIndexes())) return;
  console.log(`Creating Vectorize index ${vectorIndexName}...`);
  runWrangler(["vectorize", "create", vectorIndexName, "--dimensions", "1024", "--metric", "cosine"]);
  if (!vectorIndexExists(listVectorIndexes())) throw new Error(`Could not verify Vectorize index ${vectorIndexName}.`);
}

function googleAuthConfiguration() {
  const values = {
    clientId: optionalEnvironment("GOOGLE_OAUTH_CLIENT_ID"),
    clientSecret: optionalEnvironment("GOOGLE_OAUTH_CLIENT_SECRET"),
    encryptionKey: optionalEnvironment("GMAIL_TOKEN_ENCRYPTION_KEY"),
  };
  const configuredCount = Object.values(values).filter(Boolean).length;
  if (configuredCount > 0 && configuredCount < 3) {
    throw new Error("GOOGLE_OAUTH_CLIENT_ID, GOOGLE_OAUTH_CLIENT_SECRET, and GMAIL_TOKEN_ENCRYPTION_KEY must be configured together.");
  }
  if (values.encryptionKey) {
    const decoded = Buffer.from(values.encryptionKey, "base64");
    if (decoded.byteLength !== 32) throw new Error("GMAIL_TOKEN_ENCRYPTION_KEY must be base64-encoded 32 random bytes.");
  }
  return { ...values, configured: configuredCount === 3 };
}

function aiServiceConfiguration() {
  const url = optionalEnvironment("GIMMEJOB_AI_URL");
  const serviceToken = optionalEnvironment("GIMMEJOB_AI_SERVICE_TOKEN");
  if (Boolean(url) !== Boolean(serviceToken)) {
    throw new Error("GIMMEJOB_AI_URL and GIMMEJOB_AI_SERVICE_TOKEN must be configured together.");
  }
  if (!url) return { configured: false, url: "", serviceToken: "" };
  let parsed;
  try {
    parsed = new URL(url);
  } catch {
    throw new Error("GIMMEJOB_AI_URL must be a valid URL.");
  }
  if (parsed.protocol !== "https:") throw new Error("GIMMEJOB_AI_URL must use HTTPS in production.");
  if (parsed.username || parsed.password || parsed.search || parsed.hash) {
    throw new Error("GIMMEJOB_AI_URL must not contain credentials, query parameters, or a fragment.");
  }
  if (serviceToken.length < 32) throw new Error("GIMMEJOB_AI_SERVICE_TOKEN must contain at least 32 characters.");
  return { configured: true, url: url.replace(/\/+$/, ""), serviceToken };
}

async function ensureBuildArtifact() {
  await Promise.all([
    access(path.join(projectRoot, "dist", "server", "index.js")),
    access(path.join(projectRoot, "dist", "client")),
    access(artifactConfigPath),
  ]).catch(() => { throw new Error("Production artifact is missing. Run npm run build first."); });
}

async function writeDeployConfig(id, multiUserEnabled = false, aiService = { configured: false, url: "" }) {
  const deployConfig = JSON.parse(await readFile(artifactConfigPath, "utf8"));
  deployConfig.name = "gimmejob";
  deployConfig.topLevelName = "gimmejob";
  deployConfig.images = { binding: "IMAGES" };
  deployConfig.ai = { binding: "AI" };
  deployConfig.vectorize = [{ binding: "RAG_INDEX", index_name: vectorIndexName }];
  const existingObservability = deployConfig.observability && typeof deployConfig.observability === "object" ? deployConfig.observability : {};
  const existingLogs = existingObservability.logs && typeof existingObservability.logs === "object" ? existingObservability.logs : {};
  deployConfig.observability = {
    ...existingObservability,
    enabled: true,
    logs: { ...existingLogs, invocation_logs: true, head_sampling_rate: 1 },
  };
  deployConfig.vars = {
    ...(deployConfig.vars && typeof deployConfig.vars === "object" ? deployConfig.vars : {}),
    MULTI_USER_ENABLED: multiUserEnabled ? "true" : "false",
    EMAIL_AI_ENABLED: optionalEnvironment("EMAIL_AI_ENABLED") || "true",
    EMAIL_AI_DAILY_USER_LIMIT: optionalEnvironment("EMAIL_AI_DAILY_USER_LIMIT") || "50",
    EMAIL_AI_DAILY_GLOBAL_LIMIT: optionalEnvironment("EMAIL_AI_DAILY_GLOBAL_LIMIT") || "500",
    ...(aiService.configured ? { GIMMEJOB_AI_URL: aiService.url } : {}),
  };
  deployConfig.d1_databases = [{
    binding: "DB",
    database_name: databaseName,
    database_id: id,
    migrations_dir: "../../drizzle",
  }];
  await writeFile(generatedConfigPath, `${JSON.stringify(deployConfig, null, 2)}\n`, { mode: 0o600 });
}

async function writeDeploymentSecrets({ appPassword, grafanaReadToken, n8nIngestToken, mcpServiceToken, googleAuth, aiService }) {
  const secrets = {
    APP_PASSWORD: appPassword,
    GRAFANA_READ_TOKEN: grafanaReadToken,
    N8N_INGEST_TOKEN: n8nIngestToken,
    MCP_SERVICE_TOKEN: mcpServiceToken,
  };

  if (googleAuth.configured) {
    secrets.GOOGLE_OAUTH_CLIENT_ID = googleAuth.clientId;
    secrets.GOOGLE_OAUTH_CLIENT_SECRET = googleAuth.clientSecret;
    secrets.GMAIL_TOKEN_ENCRYPTION_KEY = googleAuth.encryptionKey;
  }

  if (aiService.configured) secrets.GIMMEJOB_AI_SERVICE_TOKEN = aiService.serviceToken;

  const openAiApiKey = optionalEnvironment("OPENAI_API_KEY");
  if (openAiApiKey) {
    secrets.OPENAI_API_KEY = openAiApiKey;
    const openAiModel = optionalEnvironment("OPENAI_MODEL");
    if (openAiModel) secrets.OPENAI_MODEL = openAiModel;
  }

  await writeFile(deploySecretsPath, `${JSON.stringify(secrets)}\n`, { mode: 0o600 });
}

function sleep(milliseconds) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

async function postRagBatch(url, token, cursor) {
  let lastError = null;
  for (let attempt = 1; attempt <= 8; attempt += 1) {
    try {
      const response = await fetch(url, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-gimmejob-mcp-token": token,
        },
        body: JSON.stringify({ cursor, limit: 32 }),
      });
      const text = await response.text();
      if (!response.ok) throw new Error(`HTTP ${response.status}: ${text}`);
      const payload = JSON.parse(text);
      if (!payload?.ok) throw new Error(payload?.error || "RAG reindex endpoint returned an unsuccessful response.");
      return payload;
    } catch (error) {
      lastError = error;
      if (attempt < 8) await sleep(3_000);
    }
  }
  throw lastError instanceof Error ? lastError : new Error("RAG reindex request failed.");
}

async function rebuildRagIndex(mcpServiceToken) {
  const baseUrl = (optionalEnvironment("GIMMEJOB_PUBLIC_URL") || "https://gimme-job.com").replace(/\/+$/, "");
  const url = `${baseUrl}/internal/rag/reindex`;
  let cursor = 0;
  let indexed = 0;
  let total = null;

  for (let batch = 0; batch < 500; batch += 1) {
    const result = await postRagBatch(url, mcpServiceToken, cursor);
    indexed += Number(result.indexed ?? 0);
    total = Number(result.total ?? total ?? 0);
    if (result.nextCursor === null || result.nextCursor === undefined) {
      console.log(`RAG index refreshed: ${indexed}/${total} documents (${JSON.stringify(result.counts ?? {})}).`);
      return;
    }
    const nextCursor = Number(result.nextCursor);
    if (!Number.isFinite(nextCursor) || nextCursor <= cursor) throw new Error("RAG reindex cursor did not advance.");
    cursor = nextCursor;
  }
  throw new Error("RAG reindex exceeded the maximum batch count.");
}

async function validateConfig() {
  await ensureBuildArtifact();
  try {
    await writeDeployConfig(dryRunDatabaseId, false);
    await writeFile(deploySecretsPath, `${JSON.stringify({
      APP_PASSWORD: "dry-run-app-password",
      GRAFANA_READ_TOKEN: "dry-run-grafana-token",
      N8N_INGEST_TOKEN: "dry-run-n8n-token",
      MCP_SERVICE_TOKEN: "dry-run-mcp-service-token",
    })}\n`, { mode: 0o600 });
    runWrangler(["deploy", "--dry-run", "--config", generatedConfigPath, "--secrets-file", deploySecretsPath]);
  } finally {
    await Promise.all([
      rm(generatedConfigPath, { force: true }),
      rm(deploySecretsPath, { force: true }),
    ]);
  }
}

async function main() {
  await mkdir(path.join(wranglerRuntimePath, "xdg-config"), { recursive: true });
  if (process.argv.includes("--dry-run")) {
    await validateConfig();
    return;
  }
  if (process.env.GITHUB_ACTIONS !== "true") throw new Error("Production deployment is restricted to the GitHub Actions → Cloudflare workflow.");

  requiredEnvironment("CLOUDFLARE_API_TOKEN");
  requiredEnvironment("CLOUDFLARE_ACCOUNT_ID");
  const appPassword = requiredEnvironment("APP_PASSWORD");
  const grafanaReadToken = requiredEnvironment("GRAFANA_READ_TOKEN");
  const n8nIngestToken = requiredEnvironment("N8N_INGEST_TOKEN");
  const explicitMcpServiceToken = optionalEnvironment("MCP_SERVICE_TOKEN");
  const mcpServiceToken = explicitMcpServiceToken || appPassword;
  const multiUserSetting = optionalEnvironment("MULTI_USER_ENABLED");
  const multiUserEnabled = multiUserSetting ? enabledEnvironment("MULTI_USER_ENABLED") : true;
  const googleAuth = googleAuthConfiguration();
  const aiService = aiServiceConfiguration();

  if (appPassword.length < 16) throw new Error("APP_PASSWORD must contain at least 16 characters.");
  if (grafanaReadToken.length < 32) throw new Error("GRAFANA_READ_TOKEN must contain at least 32 characters.");
  if (n8nIngestToken.length < 32) throw new Error("N8N_INGEST_TOKEN must contain at least 32 characters.");
  if (explicitMcpServiceToken && explicitMcpServiceToken.length < 32) throw new Error("MCP_SERVICE_TOKEN must contain at least 32 characters when configured separately.");

  await ensureBuildArtifact();
  ensureVectorIndex();
  let database = findDatabase(listDatabases());
  if (!database) {
    console.log(`Creating D1 database ${databaseName}...`);
    runWrangler(["d1", "create", databaseName]);
    database = findDatabase(listDatabases());
  }
  const id = databaseId(database);
  if (!id) throw new Error(`Could not resolve the ID of D1 database ${databaseName}.`);

  try {
    await writeDeployConfig(id, multiUserEnabled, aiService);
    await writeDeploymentSecrets({ appPassword, grafanaReadToken, n8nIngestToken, mcpServiceToken, googleAuth, aiService });
    console.log("Applying D1 migrations...");
    runWrangler(["d1", "migrations", "apply", "DB", "--remote", "--config", generatedConfigPath]);
    console.log("Deploying GimmeJob to Cloudflare Workers...");
    runWrangler(["deploy", "--config", generatedConfigPath, "--secrets-file", deploySecretsPath]);
    console.log("Refreshing the Vectorize RAG corpus...");
    await rebuildRagIndex(mcpServiceToken);
    console.log(`Cloudflare deployment completed. Multi-user password authentication: ${multiUserEnabled ? "enabled" : "disabled"}. MCP service token: ${explicitMcpServiceToken ? "dedicated" : "APP_PASSWORD fallback"}. Gmail OAuth: ${googleAuth.configured ? "configured" : "optional/not configured"}. GimmeJob AI: ${aiService.configured ? "configured" : "optional/not configured"}. Email AI: ${optionalEnvironment("EMAIL_AI_ENABLED") || "true"}, user daily limit: ${optionalEnvironment("EMAIL_AI_DAILY_USER_LIMIT") || "50"}, global daily limit: ${optionalEnvironment("EMAIL_AI_DAILY_GLOBAL_LIMIT") || "500"}.`);
  } finally {
    await Promise.all([
      rm(generatedConfigPath, { force: true }),
      rm(deploySecretsPath, { force: true }),
    ]);
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
