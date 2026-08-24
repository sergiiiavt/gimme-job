import { createHash } from "node:crypto";
import { access, readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const APPROVED_LOGO_WIDTH = 600;
const APPROVED_LOGO_HEIGHT = 171;
const APPROVED_LOGO_PIXEL_SHA256 = "713c1322cd53bb7a0e9fb084e6281d0cd5d224245592ddaa034dc8d6a2c6016c";

async function logoPixelSignature(filePath) {
  const { data, info } = await sharp(filePath).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  return {
    width: info.width,
    height: info.height,
    channels: info.channels,
    hash: createHash("sha256").update(data).digest("hex"),
  };
}

function isApprovedLogo(signature) {
  return signature.width === APPROVED_LOGO_WIDTH
    && signature.height === APPROVED_LOGO_HEIGHT
    && signature.channels === 4
    && signature.hash === APPROVED_LOGO_PIXEL_SHA256;
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

  const [sourceSignature, artifactSignature] = await Promise.all([
    logoPixelSignature(sourceLogo),
    logoPixelSignature(logoAsset),
  ]);
  if (!isApprovedLogo(sourceSignature) || !isApprovedLogo(artifactSignature)) {
    throw new Error(`GimmeJob logo pixels do not match the approved artwork. expected=${APPROVED_LOGO_WIDTH}x${APPROVED_LOGO_HEIGHT}/${APPROVED_LOGO_PIXEL_SHA256} source=${sourceSignature.width}x${sourceSignature.height}/${sourceSignature.hash} artifact=${artifactSignature.width}x${artifactSignature.height}/${artifactSignature.hash}`);
  }

  const config = JSON.parse(await readFile(wranglerConfig, "utf8"));
  if (!config.main) throw new Error("Generated Cloudflare configuration has no Worker entry.");
  if (!Array.isArray(config.d1_databases) || config.d1_databases.every((binding) => binding.binding !== "DB")) {
    throw new Error("Generated Cloudflare configuration has no DB binding.");
  }

  console.log("Validated Cloudflare Worker, client assets, exact approved logo pixels and D1 binding.");
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  await validateCloudflareArtifact();
}