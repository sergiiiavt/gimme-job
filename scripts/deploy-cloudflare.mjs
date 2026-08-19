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
  const hasInput = typeof options.input === "string";
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
    input: options.input,
    stdio: capture ? ["ignore", "pipe", "inherit"] : hasInput ? ["pipe", "inherit", "inherit"] : "inherit",
  });
  if (result.error) throw result.error;
  if (result.status !== 0) throw new Error(`Wrangler failed: ${args.join(" ")}`);
  return result.stdout ?? "";
}

function parseDatabaseList(output) {
  const firstBracket = output.indexOf("[");
  const lastBracket = output.lastIndexOf("]");
  if (firstBracket < 0 || lastBracket < firstBracket) throw new Error("Wrangler did not return a D1 database list as JSON.");
  const value = JSON.parse(output.slice(firstBracket, lastBracket + 1));
  if (!Array.isArray(value)) throw new Error("Unexpected D1 database list response.");
  return value;
}

function listDatabases() {
  return parseDatabaseList(runWrangler(["d1", "list", "--json"], { capture: true }));
}

function findDatabase(databases) {
  return databases.find((database) => database?.name === databaseName) ?? null;
}

function databaseId(database) {
  const value = database?.uuid ?? database?.id;
  return typeof value === "string" && value.length > 0 ? value : null;
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

async function ensureBuildArtifact() {
  await Promise.all([
    access(path.join(projectRoot, "dist", "server", "index.js")),
    access(path.join(projectRoot, "dist", "client")),
    access(artifactConfigPath),
  ]).catch(() => { throw new Error("Production artifact is missing. Run npm run build first."); });
}

async function writeDeployConfig(id, multiUserEnabled = false) {
  const deployConfig = JSON.parse(await readFile(artifactConfigPath, "utf8"));
  deployConfig.name = "gimmejob";
  deployConfig.topLevelName = "gimmejob";
  deployConfig.images = { binding: "IMAGES" };
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
  };
  deployConfig.d1_databases = [{
    binding: "DB",
    database_name: databaseName,
    database_id: id,
    migrations_dir: "../../drizzle",
  }];
  await writeFile(generatedConfigPath, `${JSON.stringify(deployConfig, null, 2)}\n`, { mode: 0o600 });
}

async function writeDeploymentSecrets({ appPassword, grafanaReadToken, n8nIngestToken, googleAuth }) {
  const secrets = {
    APP_PASSWORD: appPassword,
    GRAFANA_READ_TOKEN: grafanaReadToken,
    N8N_INGEST_TOKEN: n8nIngestToken,
  };

  if (googleAuth.configured) {
    secrets.GOOGLE_OAUTH_CLIENT_ID = googleAuth.clientId;
    secrets.GOOGLE_OAUTH_CLIENT_SECRET = googleAuth.clientSecret;
    secrets.GMAIL_TOKEN_ENCRYPTION_KEY = googleAuth.encryptionKey;
  }

  const openAiApiKey = optionalEnvironment("OPENAI_API_KEY");
  if (openAiApiKey) {
    secrets.OPENAI_API_KEY = openAiApiKey;
    const openAiModel = optionalEnvironment("OPENAI_MODEL");
    if (openAiModel) secrets.OPENAI_MODEL = openAiModel;
  }

  await writeFile(deploySecretsPath, `${JSON.stringify(secrets)}\n`, { mode: 0o600 });
}

async function validateConfig() {
  await ensureBuildArtifact();
  try {
    await writeDeployConfig(dryRunDatabaseId, false);
    await writeFile(deploySecretsPath, `${JSON.stringify({
      APP_PASSWORD: "dry-run-app-password",
      GRAFANA_READ_TOKEN: "dry-run-grafana-token",
      N8N_INGEST_TOKEN: "dry-run-n8n-token",
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
  const multiUserSetting = optionalEnvironment("MULTI_USER_ENABLED");
  const multiUserEnabled = multiUserSetting ? enabledEnvironment("MULTI_USER_ENABLED") : true;
  const googleAuth = googleAuthConfiguration();

  if (appPassword.length < 16) throw new Error("APP_PASSWORD must contain at least 16 characters.");
  if (grafanaReadToken.length < 32) throw new Error("GRAFANA_READ_TOKEN must contain at least 32 characters.");
  if (n8nIngestToken.length < 32) throw new Error("N8N_INGEST_TOKEN must contain at least 32 characters.");

  await ensureBuildArtifact();
  let database = findDatabase(listDatabases());
  if (!database) {
    console.log(`Creating D1 database ${databaseName}...`);
    runWrangler(["d1", "create", databaseName]);
    database = findDatabase(listDatabases());
  }
  const id = databaseId(database);
  if (!id) throw new Error(`Could not resolve the ID of D1 database ${databaseName}.`);

  try {
    await writeDeployConfig(id, multiUserEnabled);
    await writeDeploymentSecrets({ appPassword, grafanaReadToken, n8nIngestToken, googleAuth });
    console.log("Applying D1 migrations...");
    runWrangler(["d1", "migrations", "apply", "DB", "--remote", "--config", generatedConfigPath]);
    console.log("Deploying GimmeJob to Cloudflare Workers...");
    runWrangler(["deploy", "--config", generatedConfigPath, "--secrets-file", deploySecretsPath]);
    console.log(`Cloudflare deployment completed. Multi-user password authentication: ${multiUserEnabled ? "enabled" : "disabled"}. Gmail OAuth: ${googleAuth.configured ? "configured" : "optional/not configured"}. Email AI: ${optionalEnvironment("EMAIL_AI_ENABLED") || "true"}, user daily limit: ${optionalEnvironment("EMAIL_AI_DAILY_USER_LIMIT") || "50"}, global daily limit: ${optionalEnvironment("EMAIL_AI_DAILY_GLOBAL_LIMIT") || "500"}.`);
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
