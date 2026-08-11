import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { validateCloudflareArtifact } from "./validate-cloudflare-artifact.mjs";

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const vinextCli = path.join(projectRoot, "node_modules", "vinext", "dist", "cli.js");
const timeout = Number.parseInt(process.env.GIMMEJOB_BUILD_TIMEOUT_MS ?? "180000", 10);

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
