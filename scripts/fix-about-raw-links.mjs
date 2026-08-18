import fs from "node:fs/promises";

const path = "app/about-site-enhancements.tsx";
const source = await fs.readFile(path, "utf8");
const next = source.replace(
  'const RAW_REPO_URL = "https://raw.githubusercontent.com/sergiiiavt/gimme-job/main";',
  'const RAW_REPO_URL = `${REPO_URL}/blob/main`;'
);

if (next === source) {
  throw new Error("Expected RAW_REPO_URL declaration was not found.");
}

await fs.writeFile(path, next, "utf8");
