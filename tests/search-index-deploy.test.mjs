import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";

test("bulk indexing cannot consume the later SSH deployment commands", async () => {
  const workflow = await readFile(new URL("../.github/workflows/ai-image.yml", import.meta.url), "utf8");
  // The executable shell command is the IaC contract; run it with an input-consuming process.
  const command = workflow.split("\n").find((line) => line.trimStart().startsWith("docker compose --profile ai run") && line.includes("gimmejob_ai.search"));
  assert.ok(command, "the runtime rollout must index the canonical corpus");
  const directory = await mkdtemp(path.join(os.tmpdir(), "search-ssh-stdin-"));
  try {
    await writeFile(path.join(directory, "docker"), "#!/bin/sh\ncat >/dev/null\n", { mode: 0o755 });
    const result = spawnSync("bash", ["-e"], {
      env: { ...process.env, PATH: `${directory}${path.delimiter}${process.env.PATH}` },
      input: `${command.trim()}\nprintf 'runtime-restart-command-reached'\n`, encoding: "utf8", timeout: 5_000,
    });
    assert.equal(result.status, 0, result.stderr);
    assert.equal(result.stdout, "runtime-restart-command-reached");
  } finally { await rm(directory, { recursive: true, force: true }); }
});
