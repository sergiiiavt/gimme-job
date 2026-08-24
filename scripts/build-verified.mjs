import { spawnSync } from "node:child_process";
import { copyFile } from "node:fs/promises";
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

// The navigation uses the exact approved logo as /gimmejob-logo.png on both
// desktop and mobile. Keep it explicit in the Cloudflare client artifact so a
// framework/public-directory change cannot silently deploy an empty brand slot.
await copyFile(
  path.join(projectRoot, "public", "gimmejob-logo.png"),
  path.join(projectRoot, "dist", "client", "gimmejob-logo.png"),
);

await validateCloudflareArtifact();