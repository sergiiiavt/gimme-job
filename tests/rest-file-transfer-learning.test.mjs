import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const projectFile = (path) => new URL(`../${path}`, import.meta.url);

test("HTTP learning explains file transfer as HTTP bytes in both languages", async () => {
  const source = await readFile(projectFile("content/api-integration/http-foundations.ts"), "utf8");
  const ukMarker = "const markdownUk = String.raw`";
  const ukIndex = source.indexOf(ukMarker);
  assert.ok(ukIndex > 0, "Ukrainian HTTP guide is missing");

  const documents = [source.slice(0, ukIndex), source.slice(ukIndex)];
  for (const markdown of documents) {
    assert.match(markdown, /file on disk \(bytes\).*File object.*HTTP request body.*server byte stream/s);
    assert.match(markdown, /multipart\/form-data/);
    assert.match(markdown, /boundary=Boundary42/);
    assert.match(markdown, /Base64/);
    assert.match(markdown, /pre-signed/);
    assert.match(markdown, /object storage/);
    assert.match(markdown, /Content-Disposition/);
    assert.match(markdown, /Range/);
    assert.match(markdown, /MIME type/);
    assert.match(markdown, /zero bytes/);
  }
});

test("HTTP learning owns file-transfer content directly without runtime section replacement", async () => {
  const [catalog, guide] = await Promise.all([
    readFile(projectFile("content/api-integration/catalog.ts"), "utf8"),
    readFile(projectFile("content/api-integration/http-foundations.ts"), "utf8"),
  ]);

  assert.match(catalog, /import httpFoundations from "\.\/http-foundations"/);
  assert.doesNotMatch(catalog, /improveFileTransferGuide/);
  assert.doesNotMatch(catalog, /clarifyBinaryFileMeaning/);
  assert.doesNotMatch(catalog, /normalizeLearningMarkdown/);
  assert.match(guide, /## 7\. Files and multipart requests/);
  assert.match(guide, /## 7\. Files і multipart requests/);
  assert.match(guide, /file does not “become binary”/);
  assert.match(guide, /Файл не “стає binary”/);
});
