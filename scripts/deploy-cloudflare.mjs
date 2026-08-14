import { spawnSync } from "node:child_process";
import { access, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { fetchDouJobs } from "./rss-jobs.mjs";

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const wranglerCli = path.join(projectRoot, "node_modules", "wrangler", "bin", "wrangler.js");
const artifactConfigPath = path.join(projectRoot, "dist", "server", "wrangler.json");
const generatedConfigPath = path.join(projectRoot, "dist", "server", "wrangler.generated.json");
const wranglerRuntimePath = path.join(projectRoot, ".wrangler");
const databaseName = "gimmejob-db";
const dryRunDatabaseId = "00000000-0000-4000-8000-000000000000";
const productionUrl = "https://gimmejob.gimmejob.workers.dev";

function requiredEnvironment(name) {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`${name} is required for Cloudflare deployment.`);
  return value;
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
    stdio: capture
      ? ["ignore", "pipe", "inherit"]
      : hasInput
        ? ["pipe", "inherit", "inherit"]
        : "inherit",
  });

  if (result.error) throw result.error;

  if (result.status !== 0) {
    throw new Error(`Wrangler failed: ${args.join(" ")}`);
  }

  return result.stdout ?? "";
}

function parseDatabaseList(output) {
  const firstBracket = output.indexOf("[");
  const lastBracket = output.lastIndexOf("]");

  if (firstBracket < 0 || lastBracket < firstBracket) {
    throw new Error("Wrangler did not return a D1 database list as JSON.");
  }

  const value = JSON.parse(output.slice(firstBracket, lastBracket + 1));

  if (!Array.isArray(value)) {
    throw new Error("Unexpected D1 database list response.");
  }

  return value;
}

function listDatabases() {
  return parseDatabaseList(
    runWrangler(["d1", "list", "--json"], { capture: true }),
  );
}

function findDatabase(databases) {
  return databases.find((database) => database?.name === databaseName) ?? null;
}

function databaseId(database) {
  const value = database?.uuid ?? database?.id;
  return typeof value === "string" && value.length > 0 ? value : null;
}

async function ensureBuildArtifact() {
  await Promise.all([
    access(path.join(projectRoot, "dist", "server", "index.js")),
    access(path.join(projectRoot, "dist", "client")),
    access(artifactConfigPath),
  ]).catch(() => {
    throw new Error("Production artifact is missing. Run npm run build first.");
  });
}

async function writeDeployConfig(id) {
  const deployConfig = JSON.parse(
    await readFile(artifactConfigPath, "utf8"),
  );

  deployConfig.name = "gimmejob";
  deployConfig.topLevelName = "gimmejob";
  deployConfig.images = { binding: "IMAGES" };

  deployConfig.d1_databases = [
    {
      binding: "DB",
      database_name: databaseName,
      database_id: id,
      migrations_dir: "../../drizzle",
    },
  ];

  await writeFile(
    generatedConfigPath,
    `${JSON.stringify(deployConfig, null, 2)}\n`,
    {
      mode: 0o600,
    },
  );
}

async function validateConfig() {
  await ensureBuildArtifact();
  await writeDeployConfig(dryRunDatabaseId);

  try {
    runWrangler([
      "deploy",
      "--dry-run",
      "--config",
      generatedConfigPath,
    ]);
  } finally {
    await rm(generatedConfigPath, { force: true });
  }
}

async function importCurrentJobs(appPassword) {
  const jobs = await fetchDouJobs();

  const authorization = Buffer.from(
    `gimmejob:${appPassword}`,
    "utf8",
  ).toString("base64");

  for (let attempt = 1; attempt <= 4; attempt += 1) {
    const response = await fetch(`${productionUrl}/api/import`, {
      method: "POST",
      headers: {
        authorization: `Basic ${authorization}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({ jobs }),
      signal: AbortSignal.timeout(30_000),
    });

    if (response.ok) {
      const payload = await response.json();

      console.log(
        `Imported ${payload.result?.accepted ?? jobs.length} current jobs into D1.`,
      );

      return;
    }

    if (![401, 503].includes(response.status) || attempt === 4) {
      throw new Error(
        `Cloud job import returned HTTP ${response.status}.`,
      );
    }

    await new Promise((resolve) => setTimeout(resolve, 2_000));
  }
}

async function main() {
  await mkdir(
    path.join(wranglerRuntimePath, "xdg-config"),
    { recursive: true },
  );

  if (process.argv.includes("--dry-run")) {
    await validateConfig();
    return;
  }

  if (process.env.GITHUB_ACTIONS !== "true") {
    throw new Error(
      "Production deployment is restricted to the GitHub Actions → Cloudflare workflow.",
    );
  }

  requiredEnvironment("CLOUDFLARE_API_TOKEN");
  requiredEnvironment("CLOUDFLARE_ACCOUNT_ID");

  const appPassword = requiredEnvironment("APP_PASSWORD");
  const grafanaReadToken = requiredEnvironment("GRAFANA_READ_TOKEN");

  if (appPassword.length < 16) {
    throw new Error(
      "APP_PASSWORD must contain at least 16 characters.",
    );
  }

  if (grafanaReadToken.length < 32) {
    throw new Error(
      "GRAFANA_READ_TOKEN must contain at least 32 characters.",
    );
  }

  await ensureBuildArtifact();

  let database = findDatabase(listDatabases());

  if (!database) {
    console.log(`Creating D1 database ${databaseName}...`);

    runWrangler([
      "d1",
      "create",
      databaseName,
    ]);

    database = findDatabase(listDatabases());
  }

  const id = databaseId(database);

  if (!id) {
    throw new Error(
      `Could not resolve the ID of D1 database ${databaseName}.`,
    );
  }

  await writeDeployConfig(id);

  try {
    console.log("Applying D1 migrations...");

    runWrangler([
      "d1",
      "migrations",
      "apply",
      "DB",
      "--remote",
      "--config",
      generatedConfigPath,
    ]);

    console.log("Deploying GimmeJob to Cloudflare Workers...");

    runWrangler([
      "deploy",
      "--config",
      generatedConfigPath,
    ]);

    console.log("Updating the private app password...");

    runWrangler(
      [
        "secret",
        "put",
        "APP_PASSWORD",
        "--config",
        generatedConfigPath,
      ],
      {
        input: `${appPassword}\n`,
      },
    );

    console.log("Updating the Grafana read token...");

    runWrangler(
      [
        "secret",
        "put",
        "GRAFANA_READ_TOKEN",
        "--config",
        generatedConfigPath,
      ],
      {
        input: `${grafanaReadToken}\n`,
      },
    );

    if (process.env.OPENAI_API_KEY) {
      console.log("Updating the OpenAI API key...");

      runWrangler(
        [
          "secret",
          "put",
          "OPENAI_API_KEY",
          "--config",
          generatedConfigPath,
        ],
        {
          input: `${process.env.OPENAI_API_KEY}\n`,
        },
      );

      if (process.env.OPENAI_MODEL) {
        runWrangler(
          [
            "secret",
            "put",
            "OPENAI_MODEL",
            "--config",
            generatedConfigPath,
          ],
          {
            input: `${process.env.OPENAI_MODEL}\n`,
          },
        );
      }
    }

    console.log("Importing the current DOU job feed...");

    await importCurrentJobs(appPassword);

    console.log("Cloudflare deployment completed.");
  } finally {
    await rm(generatedConfigPath, { force: true });
  }
}

main().catch((error) => {
  console.error(
    error instanceof Error
      ? error.message
      : String(error),
  );

  process.exitCode = 1;
});
