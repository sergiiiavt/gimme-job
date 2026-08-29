import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const projectFile = (path) => new URL(`../${path}`, import.meta.url);

test("API learning explains HTTP file transfer rather than treating REST as a transport protocol", async () => {
  const catalog = await readFile(projectFile("content/api-integration/catalog.ts"), "utf8");

  assert.match(catalog, /REST is not a file-transfer protocol/);
  assert.match(catalog, /REST — це не протокол передачі файлів/);
  assert.match(catalog, /binary bytes in an HTTP body/);
  assert.match(catalog, /binary bytes у HTTP body/);
  assert.match(catalog, /multipart\/form-data/);
  assert.match(catalog, /boundary=Boundary42/);
  assert.match(catalog, /Base64/);
  assert.match(catalog, /33%/);
  assert.match(catalog, /pre-signed upload URL/);
  assert.match(catalog, /object storage/);
  assert.match(catalog, /Content-Disposition: attachment/);
  assert.match(catalog, /Range/);
  assert.match(catalog, /What should an API tester verify/);
  assert.match(catalog, /Що саме тестувати QA/);
});

test("file-transfer guide replaces the old short upload section in both languages", async () => {
  const catalog = await readFile(projectFile("content/api-integration/catalog.ts"), "utf8");

  assert.match(catalog, /function improveFileTransferGuide/);
  assert.match(catalog, /replaceMarkdownSection/);
  assert.match(catalog, /File upload: can a file be sent together with data/);
  assert.match(catalog, /Як передати файл і чи можна разом з іншими даними/);
  assert.match(catalog, /How files are transferred through a REST API/);
  assert.match(catalog, /Як файли передаються через REST API/);
});
