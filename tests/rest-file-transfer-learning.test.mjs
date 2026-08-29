import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const projectFile = (path) => new URL(`../${path}`, import.meta.url);

test("API learning explains HTTP file transfer rather than treating REST as a transport protocol", async () => {
  const guide = await readFile(projectFile("content/api-integration/file-transfer-guide.ts"), "utf8");

  assert.match(guide, /REST is not a file-transfer protocol/);
  assert.match(guide, /REST — це не протокол передачі файлів/);
  assert.match(guide, /binary bytes in an HTTP body/);
  assert.match(guide, /binary bytes у HTTP body/);
  assert.match(guide, /multipart\/form-data/);
  assert.match(guide, /boundary=Boundary42/);
  assert.match(guide, /Base64/);
  assert.match(guide, /33%/);
  assert.match(guide, /pre-signed upload URL/);
  assert.match(guide, /object storage/);
  assert.match(guide, /Content-Disposition: attachment/);
  assert.match(guide, /Range/);
  assert.match(guide, /What should an API tester verify/);
  assert.match(guide, /Що саме тестувати QA/);
});

test("file-transfer guide replaces the old short upload section in both languages", async () => {
  const [catalog, guide] = await Promise.all([
    readFile(projectFile("content/api-integration/catalog.ts"), "utf8"),
    readFile(projectFile("content/api-integration/file-transfer-guide.ts"), "utf8"),
  ]);

  assert.match(catalog, /import \{ improveFileTransferGuide \} from "\.\/file-transfer-guide"/);
  assert.match(catalog, /improveFileTransferGuide\(trainingOnlyCopy\(httpApiDeepDive\.markdown\), "en"\)/);
  assert.match(catalog, /improveFileTransferGuide\(trainingOnlyCopy\(httpApiDeepDive\.markdownUk\), "uk"\)/);
  assert.match(guide, /File upload: can a file be sent together with data/);
  assert.match(guide, /Як передати файл і чи можна разом з іншими даними/);
  assert.match(guide, /CORS: what it is and how it arises/);
  assert.match(guide, /CORS: що це і як виникає/);
  assert.match(guide, /How files are transferred through a REST API/);
  assert.match(guide, /Як файли передаються через REST API/);
});

test("published file-transfer learning explains that drag-and-drop does not convert a file to binary", async () => {
  const catalog = await readFile(projectFile("content/api-integration/catalog.ts"), "utf8");

  assert.match(catalog, /function clarifyBinaryFileMeaning/);
  assert.match(catalog, /A file does not become binary in the browser/);
  assert.match(catalog, /Файл не стає binary у browser/);
  assert.match(catalog, /already exists on disk as bytes/);
  assert.match(catalog, /вже лежить на диску як bytes/);
  assert.match(catalog, /JavaScript .*File.* object/);
  assert.match(catalog, /File object → HTTP body → server bytes/);
  assert.match(catalog, /File object → HTTP body → server bytes → stored file/);
  assert.match(catalog, /FF D8 FF E0/);
  assert.match(catalog, /Binary does not mean .*encrypted/);
  assert.match(catalog, /Binary не означає .*зашифрований/);
  assert.match(catalog, /text file those bytes are interpreted using an encoding/);
  assert.match(catalog, /text file ці bytes інтерпретуються через encoding/);
});

test("four-hash file-transfer subsections are normalized into rendered titles", async () => {
  const catalog = await readFile(projectFile("content/api-integration/catalog.ts"), "utf8");

  assert.match(catalog, /function normalizeLearningMarkdown/);
  assert.match(catalog, /replace\(\/\^####\\s\+\/gm, "### "\)/);
  assert.match(catalog, /normalizeLearningMarkdown\(clarifyBinaryFileMeaning/);
});
