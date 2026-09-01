import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const projectFile = (path) => new URL(`../${path}`, import.meta.url);

test("Programming exposes C# as a separate available track", async () => {
  const source = await readFile(projectFile("app/programming-learning-page.tsx"), "utf8");

  assert.match(source, /id:\s*"python"[\s\S]*available:\s*true/);
  assert.match(source, /id:\s*"csharp"[\s\S]*label:\s*"C#"[\s\S]*available:\s*true/);
  assert.match(source, /id:\s*"typescript"[\s\S]*available:\s*false/);
  assert.match(source, /requestedTrack === "csharp"/);
  assert.match(source, /waitingForReviewBannerStyle/);
});

test("C# material is a focused programming foundation, not an interview-labeled catalog", async () => {
  const source = await readFile(projectFile("content/csharp-learning/catalog.ts"), "utf8");

  assert.doesNotMatch(source, /interview/i);
  assert.match(source, /csharp-language-basics/);
  assert.match(source, /csharp-methods-parameters/);
  assert.match(source, /csharp-classes-objects/);
  assert.match(source, /csharp-oop/);
  assert.match(source, /csharp-abstractions/);
  assert.match(source, /csharp-collections-generics/);
  assert.match(source, /csharp-delegates-linq/);
  assert.match(source, /csharp-exceptions-disposal/);
  assert.match(source, /csharp-async/);
  assert.match(source, /csharp-runtime-memory/);
  assert.match(source, /```csharp/);
});
