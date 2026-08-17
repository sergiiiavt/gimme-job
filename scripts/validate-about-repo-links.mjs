import { access, readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const sourceFiles = [
  "app/about-site-content.ts",
  "app/about-site-enhancements.tsx",
];

const referencedPaths = new Set();
const repositoryPathPattern = /\$\{REPO_URL\}\/(?:blob|tree)\/main\/([^`]+)`/g;

for (const sourceFile of sourceFiles) {
  const source = await readFile(path.join(projectRoot, sourceFile), "utf8");
  for (const match of source.matchAll(repositoryPathPattern)) {
    referencedPaths.add(match[1]);
  }
}

if (referencedPaths.size === 0) {
  throw new Error("No About-page repository links were discovered.");
}

const missing = [];
for (const repositoryPath of [...referencedPaths].sort((a, b) => (a < b ? -1 : a > b ? 1 : 0))) {
  try {
    await access(path.join(projectRoot, repositoryPath));
  } catch {
    missing.push(repositoryPath);
  }
}

if (missing.length > 0) {
  throw new Error(`About-page repository links point to missing paths:\n${missing.map((item) => `- ${item}`).join("\n")}`);
}

console.log(`About-page repository links verified: ${referencedPaths.size} local paths exist.`);
