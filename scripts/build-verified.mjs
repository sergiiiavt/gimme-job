import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { validateCloudflareArtifact } from "./validate-cloudflare-artifact.mjs";

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const vinextCli = path.join(projectRoot, "node_modules", "vinext", "dist", "cli.js");
const rewildV4Builder = path.join(projectRoot, "scripts", "build-rewild-v4-detail-atlas.mjs");
const timeout = Number.parseInt(process.env.GIMMEJOB_BUILD_TIMEOUT_MS ?? "180000", 10);

console.log("Building Rewild v4 environmental detail atlas...");
const rewildResult = spawnSync(process.execPath, [rewildV4Builder], {
  cwd: projectRoot,
  stdio: "inherit",
  timeout: 30000,
});
if (rewildResult.error) throw rewildResult.error;
if (rewildResult.status !== 0) throw new Error(`Rewild v4 detail atlas build failed with exit code ${rewildResult.status ?? "unknown"}.`);

console.log("Running bounded vinext build...");
const result = spawnSync(process.execPath, [vinextCli, "build"], {
  cwd: projectRoot,
  env: {
    ...process.env,
    WRANGLER_WRITE_LOGS: "false",
    WRANGLER_LOG_PATH: path.join(projectRoot, ".wrangler", "logs"),
    MINIFLARE_REGISTRY_PATH: path.join(projectRoot, ".wrangler", "registry"),
  },
  stdio: "inherit",
  timeout,
});

if (result.error) throw result.error;
if (result.status !== 0) throw new Error(`vinext build failed with exit code ${result.status ?? "unknown"}.`);

await validateCloudflareArtifact();
