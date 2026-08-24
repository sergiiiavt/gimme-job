import { createHash } from "node:crypto";
import { access, readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const APPROVED_LOGO_SHA256 = "bc08029dfcb097c555315bbe79eaaab52bb5fe92671f8a75c6a87d48be707684";

async function sha256(filePath) {
  const content = await readFile(filePath);
  return createHash("sha256").update(content).digest("hex");
}

export async function validateCloudflareArtifact() {
  const worker = path.join(projectRoot, "dist", "server", "index.js");
  const wranglerConfig = path.join(projectRoot, "dist", "server", "wrangler.json");
  const clientAssets = path.join(projectRoot, "dist", "client");
  const sourceLogo = path.join(projectRoot, "public", "gimmejob-logo.png");
  const logoAsset = path.join(clientAssets, "gimmejob-logo.png");

  await Promise.all([access(worker), access(wranglerConfig), access(clientAssets), access(sourceLogo), access(logoAsset)]).catch(() => {
    throw new Error("Missing Cloudflare Worker, generated configuration, client assets, or approved GimmeJob logo.");
  });

  const [sourceLogoHash, deployedLogoHash] = await Promise.all([sha256(sourceLogo), sha256(logoAsset)]);
  if (sourceLogoHash !== APPROVED_LOGO_SHA256 || deployedLogoHash !== APPROVED_LOGO_SHA256) {
    throw new Error("GimmeJob logo does not match the approved artwork.");
  }

  const config = JSON.parse(await readFile(wranglerConfig, "utf8"));
  if (!config.main) throw new Error("Generated Cloudflare configuration has no Worker entry.");
  if (!Array.isArray(config.d1_databases) || config.d1_databases.every((binding) => binding.binding !== "DB")) {
    throw new Error("Generated Cloudflare configuration has no DB binding.");
  }

  console.log("Validated Cloudflare Worker, client assets, exact approved logo and D1 binding.");
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  await validateCloudflareArtifact();
}