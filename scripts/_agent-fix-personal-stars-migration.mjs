import { readFile, writeFile } from "node:fs/promises";

const path = "scripts/_agent-apply-personal-stars-prevalence.mjs";
const source = await readFile(path, "utf8");
const lines = source.split("\n").map((line) =>
  line.includes("assert.match(uiSource") && line.includes("className=") && line.includes("iq-star-filter")
    ? "  assert.match(uiSource, /iq-star-filter/);"
    : line,
);
await writeFile(path, lines.join("\n"));
console.log("Fixed temporary migration quoting.");
