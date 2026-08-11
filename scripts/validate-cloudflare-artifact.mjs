import { access, readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

export async function validateCloudflareArtifact() {
  const worker = path.join(projectRoot, "dist", "server", "index.js");
  const wranglerConfig = path.join(projectRoot, "dist", "server", "wrangler.json");
  const clientAssets = path.join(projectRoot, "dist", "client");

  await Promise.all([access(worker), access(wranglerConfig), access(clientAssets)]).catch(() => {
    throw new Error("Missing Cloudflare Worker, generated configuration, or client assets.");
  });

  const config = JSON.parse(await readFile(wranglerConfig, "utf8"));
  if (!config.main) throw new Error("Generated Cloudflare configuration has no Worker entry.");
  if (!Array.isArray(config.d1_databases) || config.d1_databases.every((binding) => binding.binding !== "DB")) {
    throw new Error("Generated Cloudflare configuration has no DB binding.");
  }

  console.log("Validated Cloudflare Worker, client assets and D1 binding.");
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  await validateCloudflareArtifact();
}
