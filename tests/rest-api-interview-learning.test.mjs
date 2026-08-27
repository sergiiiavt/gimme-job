import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const projectFile = (path) => new URL(`../${path}`, import.meta.url);
const readJson = (path) => readFile(projectFile(path), "utf8").then(JSON.parse);

test("REST API learning deep dive covers interview-critical HTTP topics in both languages", async () => {
  const deepDive = await readJson("content/testing-tools/http-api-deep-dive.json");

  for (const markdown of [deepDive.markdown, deepDive.markdownUk]) {
    for (const code of [
      "100", "101", "103",
      "200", "201", "202", "204", "206",
      "301", "302", "304", "307", "308",
      "400", "401", "403", "404", "405", "409", "412", "413", "415", "422", "429", "451",
      "500", "501", "502", "503", "504", "511",
    ]) {
      assert.match(markdown, new RegExp(`\\b${code}\\b`), `Missing status code ${code}`);
    }

    for (const method of ["GET", "HEAD", "POST", "PUT", "PATCH", "DELETE", "OPTIONS", "CONNECT", "TRACE"]) {
      assert.match(markdown, new RegExp(`\\b${method}\\b`), `Missing HTTP method ${method}`);
    }

    for (const header of [
      "Content-Type",
      "Authorization",
      "Origin",
      "Location",
      "Set-Cookie",
      "ETag",
      "Retry-After",
      "Access-Control-Allow-Origin",
    ]) {
      assert.ok(markdown.includes(header), `Missing HTTP header ${header}`);
    }

    assert.match(markdown, /Basic/);
    assert.match(markdown, /Bearer/);
    assert.match(markdown, /OAuth 2\.0/);
    assert.match(markdown, /mTLS/);
    assert.match(markdown, /multipart\/form-data/);
    assert.match(markdown, /CORS/);
    assert.match(markdown, /same-origin/i);
    assert.match(markdown, /preflight/i);
  }
});

test("REST API interview collection keeps the requested topics explicit and bilingual", async () => {
  const restApi = await readJson("content/interview/rest-api-qa.json");
  assert.equal(restApi.questions.length, 9);

  const byId = new Map(restApi.questions.map((question) => [question.id, question]));
  for (const id of [
    "http-status-classes-and-concrete-codes",
    "http-success-code-selection",
    "http-client-error-code-differences",
    "http-server-gateway-error-differences",
    "http-request-response-headers-for-testing",
    "api-request-authentication-methods",
    "api-file-upload-with-metadata",
    "http-methods-safe-idempotent-semantics",
    "cors-same-origin-and-preflight",
  ]) {
    assert.ok(byId.has(id), `${id} must remain an explicit interview question`);
  }

  for (const question of restApi.questions) {
    assert.equal(question.category, "Web, API and data");
    assert.ok(question.questionUk?.trim());
    assert.ok(question.shortAnswerUk?.trim());
    assert.ok(question.exampleUk?.trim());
    assert.ok(question.sourceIds.includes("mdn-http"));
  }

  const cors = byId.get("cors-same-origin-and-preflight");
  assert.match(cors.shortAnswer, /OPTIONS/);
  assert.match(cors.shortAnswer, /Access-Control-Allow/);
  assert.match(cors.shortAnswer, /Postman/);

  const upload = byId.get("api-file-upload-with-metadata");
  assert.match(upload.shortAnswer, /multipart\/form-data/);
  assert.match(upload.shortAnswer, /JSON metadata/);
});

test("catalogs include the REST API deep-dive sources", async () => {
  const [learningCatalog, interviewCatalog] = await Promise.all([
    readFile(projectFile("content/testing-tools/catalog.ts"), "utf8"),
    readFile(projectFile("content/interview/catalog.ts"), "utf8"),
  ]);

  assert.match(learningCatalog, /http-api-deep-dive\.json/);
  assert.match(interviewCatalog, /rest-api-qa\.json/);
  assert.match(interviewCatalog, /\.\.\.restApi\.questions/);
});
