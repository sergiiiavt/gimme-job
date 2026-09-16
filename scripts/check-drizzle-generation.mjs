import { createHash } from "node:crypto";
import { spawnSync } from "node:child_process";
import { readdir, readFile, stat } from "node:fs/promises";
import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";

const require = createRequire(import.meta.url);

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const trackedRoots = [path.join(projectRoot, "db", "schema.ts"), path.join(projectRoot, "drizzle")];

async function collectFiles(target, files) {
  const targetStat = await stat(target);
  if (targetStat.isDirectory()) {
    const entries = await readdir(target, { withFileTypes: true });
    entries.sort((left, right) => left.name.localeCompare(right.name));
    for (const entry of entries) {
      await collectFiles(path.join(target, entry.name), files);
    }
    return;
  }
  if (targetStat.isFile()) files.push(target);
}

async function snapshot() {
  const files = [];
  for (const target of trackedRoots) await collectFiles(target, files);

  const result = new Map();
  for (const file of files) {
    const relativePath = path.relative(projectRoot, file).split(path.sep).join("/");
    const digest = createHash("sha256").update(await readFile(file)).digest("hex");
    result.set(relativePath, digest);
  }
  return result;
}

function runGeneration() {
  // Run drizzle-kit with this process's own Node binary and an absolute entry
  // point, rather than looking up `npm` on PATH. That keeps the spawn free of
  // PATH resolution, and it sidesteps Windows, where Node refuses to spawn
  // npm's .cmd shim directly (CVE-2024-27980) and `npm run db:generate` failed
  // with EINVAL — leaving `npm run verify` unrunnable there.
  const drizzleKitBin = path.join(path.dirname(require.resolve("drizzle-kit")), "bin.cjs");
  const result = spawnSync(process.execPath, [drizzleKitBin, "generate"], {
    cwd: projectRoot,
    stdio: "inherit",
  });
  if (result.error) throw result.error;
  if (result.status !== 0) process.exit(result.status ?? 1);
}

function changedPaths(before, after) {
  const paths = new Set([...before.keys(), ...after.keys()]);
  return [...paths]
    .filter((file) => before.get(file) !== after.get(file))
    .sort((left, right) => left.localeCompare(right));
}

const before = await snapshot();
runGeneration();
const after = await snapshot();
const changed = changedPaths(before, after);

if (changed.length > 0) {
  console.error("Drizzle generation changed schema or migration files. Inspect and commit the generated changes:");
  for (const file of changed) console.error(`- ${file}`);
  process.exit(1);
}

console.log("Drizzle schema and migration metadata are up to date.");
