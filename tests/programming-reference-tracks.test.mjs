import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const projectFile = (path) => new URL(`../${path}`, import.meta.url);

test("Programming quick reference exposes Python, C# and TypeScript tracks", async () => {
  const overlay = await readFile(projectFile("app/programming-reference-track-overlay.tsx"), "utf8");

  assert.match(overlay, /label:\s*"Python"/);
  assert.match(overlay, /label:\s*"C#"/);
  assert.match(overlay, /href:\s*"\/learn\/programming\?track=csharp"/);
  assert.match(overlay, /label:\s*"TypeScript"/);
  assert.match(overlay, /grid-template-columns:\s*repeat\(3, minmax\(0, 1fr\)\)/);
});

test("C# track overlay is mounted only on the Programming quick reference", async () => {
  const route = await readFile(projectFile("app/reference/[section]/page.tsx"), "utf8");

  assert.match(route, /ProgrammingReferenceTrackOverlay/);
  assert.match(route, /section === "programming"\s*\?\s*<ProgrammingReferenceTrackOverlay\/>/);
});
