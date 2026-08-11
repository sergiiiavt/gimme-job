import { createHash } from "node:crypto";
import { realpathSync } from "node:fs";
import path from "node:path";

function canonicalPath(value: string): string {
  let resolved = path.resolve(value);
  try {
    resolved = realpathSync.native(resolved);
  } catch {
    // The database file may not exist yet; its resolved parent is still stable.
  }
  const normalized = path.normalize(resolved).replaceAll("\\", "/");
  return process.platform === "win32" ? normalized.toLowerCase() : normalized;
}

export function localAgentInstanceId(workspaceRoot: string, databasePath: string): string {
  return createHash("sha256")
    .update(`${canonicalPath(workspaceRoot)}\n${canonicalPath(databasePath)}`)
    .digest("hex")
    .slice(0, 24);
}
