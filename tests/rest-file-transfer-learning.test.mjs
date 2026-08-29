import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const projectFile = (path) => new URL(`../${path}`, import.meta.url);

test("HTTP methodic material explains file transfer directly in both languages", async () => {
  const [english, ukrainian] = await Promise.all([
    readFile(projectFile("content/api-integration/http-foundations.md"), "utf8"),
    readFile(projectFile("content/api-integration/http-foundations.uk.md"), "utf8"),
  ]);

  for (const markdown of [english, ukrainian]) {
    assert.match(markdown, /## Request bodies, forms/);
    assert.match(markdown, /### Raw binary content/);
    assert.match(markdown, /file bytes/);
    assert.match(markdown, /Content-Type: application\/pdf/);
    assert.match(markdown, /multipart\/form-data/);
    assert.match(markdown, /boundary=Boundary42/);
    assert.match(markdown, /Content-Disposition/);
    assert.match(markdown, /Base64/);
    assert.match(markdown, /pre-signed/);
    assert.match(markdown, /object storage/);
    assert.doesNotMatch(markdown, /## \d+\. Files/);
    assert.doesNotMatch(markdown, /Typical QA question|Why it matters to QA/i);
  }
});

test("HTTP learning owns file-transfer material directly without runtime section replacement", async () => {
  const [catalog, loader, english, ukrainian] = await Promise.all([
    readFile(projectFile("content/api-integration/catalog.ts"), "utf8"),
    readFile(projectFile("content/api-integration/http-foundations.ts"), "utf8"),
    readFile(projectFile("content/api-integration/http-foundations.md"), "utf8"),
    readFile(projectFile("content/api-integration/http-foundations.uk.md"), "utf8"),
  ]);

  assert.match(catalog, /import httpFoundations from "\.\/http-foundations"/);
  assert.doesNotMatch(catalog, /improveFileTransferGuide/);
  assert.doesNotMatch(catalog, /clarifyBinaryFileMeaning/);
  assert.doesNotMatch(catalog, /normalizeLearningMarkdown/);
  assert.match(loader, /http-foundations\.md\?raw/);
  assert.match(loader, /http-foundations\.uk\.md\?raw/);
  assert.match(english, /## Request bodies, forms and files/);
  assert.match(ukrainian, /## Request bodies, forms та files/);
});
