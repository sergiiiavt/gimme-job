import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const projectFile = (path) => new URL(`../${path}`, import.meta.url);

test("Programming quick reference exposes Python, C# and TypeScript on the initial render", async () => {
  const page = await readFile(projectFile("app/quick-reference-page.tsx"), "utf8");

  assert.match(page, /id:\s*"python",\s*label:\s*"Python"/);
  assert.match(page, /id:\s*"csharp",\s*label:\s*"C#"/);
  assert.match(page, /id:\s*"typescript",\s*label:\s*"TypeScript"/);
  assert.match(page, /window\.location\.assign\(regularLearningHref\(referenceId, undefined, id\)\)/);
});

test("Programming quick reference uses the shared two-column switcher layout", async () => {
  const styles = await readFile(projectFile("app/globals.css"), "utf8");

  assert.match(styles, /\.kb-subnav-switch\s*\{[\s\S]*grid-template-columns:\s*repeat\(2, minmax\(0, 1fr\)\)/);
  assert.match(styles, /\.kb-subnav-switch > button:last-child:nth-child\(odd\):not\(:first-child\)[\s\S]*grid-column:\s*1 \/ -1[\s\S]*width:\s*calc\(50% - 3px\)/);
});

test("Programming quick reference does not replace the switcher after hydration", async () => {
  const route = await readFile(projectFile("app/reference/[section]/page.tsx"), "utf8");

  assert.doesNotMatch(route, /ProgrammingReferenceTrackOverlay/);
  assert.match(route, /return <QuickReferencePage referenceId=\{section\}\/>;/);
});
