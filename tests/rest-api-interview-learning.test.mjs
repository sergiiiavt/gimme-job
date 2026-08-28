import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const projectFile = (path) => new URL(`../${path}`, import.meta.url);
const readJson = (path) => readFile(projectFile(path), "utf8").then(JSON.parse);

test("REST API learning deep dive covers core HTTP topics in both languages", async () => {
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

test("WebSocket learning guide covers build, protocol, testing and scale in both languages", async () => {
  const source = await readFile(projectFile("content/api-integration/websocket-guide.ts"), "utf8");
  const ukMarker = "const markdownUk = String.raw`";
  const ukIndex = source.indexOf(ukMarker);
  assert.ok(ukIndex > 0, "Ukrainian WebSocket guide is missing");

  const documents = [source.slice(0, ukIndex), source.slice(ukIndex)];
  for (const markdown of documents) {
    assert.match(markdown, /WebSocket/);
    assert.match(markdown, /101 Switching Protocols/);
    assert.match(markdown, /Sec-WebSocket-Key/);
    assert.match(markdown, /Ping\/Pong/);
    assert.match(markdown, /1000/);
    assert.match(markdown, /1011/);
    assert.match(markdown, /reconnect/i);
    assert.match(markdown, /backpressure/i);
    assert.match(markdown, /Origin/);
    assert.match(markdown, /concurrent/i);
    assert.match(markdown, /wscat/);
    assert.match(markdown, /websockets\.connect/);
    assert.match(markdown, /WebSocketServer/);
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

test("WebSocket interview collection keeps protocol and QA scenarios explicit", async () => {
  const websocket = await readJson("content/interview/websocket-qa.json");
  assert.equal(websocket.questions.length, 5);

  const byId = new Map(websocket.questions.map((question) => [question.id, question]));
  for (const id of [
    "websocket-purpose-vs-http-sse-polling",
    "websocket-handshake-frames-lifecycle",
    "websocket-how-would-you-test",
    "websocket-heartbeat-close-reconnect",
    "websocket-security-auth-origin-scale",
  ]) {
    assert.ok(byId.has(id), `${id} must remain an explicit WebSocket interview question`);
  }

  for (const question of websocket.questions) {
    assert.equal(question.category, "Web, API and data");
    assert.ok(question.tags.includes("websocket"));
    assert.ok(question.questionUk?.trim());
    assert.ok(question.shortAnswerUk?.trim());
    assert.ok(question.exampleUk?.trim());
  }

  assert.match(byId.get("websocket-handshake-frames-lifecycle").shortAnswer, /101 Switching Protocols/);
  assert.match(byId.get("websocket-how-would-you-test").shortAnswer, /reconnect/i);
  assert.match(byId.get("websocket-security-auth-origin-scale").shortAnswer, /backpressure/i);
});

test("REST and WebSocket learning are mounted under API & integration, not testing tools", async () => {
  const [apiCatalog, testingToolsCatalog, interviewCatalog, apiPage] = await Promise.all([
    readFile(projectFile("content/api-integration/catalog.ts"), "utf8"),
    readFile(projectFile("content/testing-tools/catalog.ts"), "utf8"),
    readFile(projectFile("content/interview/catalog.ts"), "utf8"),
    readFile(projectFile("app/learn/api/page.tsx"), "utf8"),
  ]);

  assert.match(apiCatalog, /http-api-deep-dive\.json/);
  assert.match(apiCatalog, /\.\/websocket-guide/);
  assert.doesNotMatch(apiCatalog, /websocket-guide\.json/);
  assert.match(apiCatalog, /HTTP, REST & CORS foundations/);
  assert.match(apiCatalog, /WebSocket: build, test & debug/);
  assert.doesNotMatch(testingToolsCatalog, /http-api-deep-dive\.json/);
  assert.match(interviewCatalog, /rest-api-qa\.json/);
  assert.match(interviewCatalog, /websocket-qa\.json/);
  assert.match(interviewCatalog, /\.\.\.restApi\.questions/);
  assert.match(interviewCatalog, /\.\.\.websocket\.questions/);
  assert.match(apiPage, /ApiIntegrationPage/);
});

test("API learning presentation is training-only and exposes five status-code class expanders", async () => {
  const [apiCatalog, apiPage] = await Promise.all([
    readFile(projectFile("content/api-integration/catalog.ts"), "utf8"),
    readFile(projectFile("app/api-integration-page.tsx"), "utf8"),
  ]);

  assert.match(apiCatalog, /trainingOnlyCopy/);
  assert.match(apiCatalog, /makeStatusCodeGroupsExpandable/);
  assert.match(apiCatalog, /groups\.length !== 5/);
  assert.match(apiCatalog, /\[1-5\]xx/);
  assert.match(apiCatalog, /:::details \$\{group\.summary\}/);
  assert.doesNotMatch(apiCatalog, /Show full HTTP status code reference/);
  assert.doesNotMatch(apiCatalog, /Показати повний довідник HTTP status codes/);
  assert.match(apiCatalog, /Key takeaways/);
  assert.match(apiCatalog, /Ключові висновки/);
  assert.doesNotMatch(apiPage, /Interview and practical reference/);
  assert.doesNotMatch(apiPage, /співбес/i);
  assert.match(apiPage, /Training and practical reference/);
  assert.match(apiPage, /Навчальний і практичний довідник/);
});

test("Markdown renderer treats tilde fences as code blocks", async () => {
  const renderer = await readFile(projectFile("app/qa-markdown.tsx"), "utf8");
  assert.match(renderer, /function parseFence/);
  assert.match(renderer, /~\{3,/);
  assert.match(renderer, /openingFence/);
  assert.match(renderer, /closingFence/);
  assert.match(renderer, /Boolean\(parseFence\(line\)\)/);
});

test("API under-construction topics remain above all published chapters", async () => {
  const apiCatalog = await readFile(projectFile("content/api-integration/catalog.ts"), "utf8");
  const placeholderIds = [
    "contracts-and-schemas",
    "identity-and-authorization",
    "messaging-and-events",
    "failure-behaviour",
  ];
  const firstPublishedIndex = apiCatalog.indexOf('id: "http-foundations"');
  const websocketIndex = apiCatalog.indexOf('id: "websocket"');

  assert.ok(firstPublishedIndex > -1, "Published HTTP topic is missing");
  assert.ok(websocketIndex > firstPublishedIndex, "WebSocket must remain a published topic after HTTP foundations");
  for (const id of placeholderIds) {
    const placeholderIndex = apiCatalog.indexOf(`"${id}"`);
    assert.ok(placeholderIndex > -1, `${id} placeholder is missing`);
    assert.ok(placeholderIndex < firstPublishedIndex, `${id} must stay above published API topics`);
  }
  assert.match(apiCatalog, /status: "under-construction"/);
});

test("API presentation shells follow the repository Sonar coverage policy", async () => {
  const sonar = await readFile(projectFile("sonar-project.properties"), "utf8");
  assert.match(sonar, /app\/api-integration-page\.tsx/);
  assert.match(sonar, /app\/learn\/api\/page\.tsx/);
  assert.match(sonar, /sonar\.javascript\.lcov\.reportPaths=coverage\/lcov\.info/);
  assert.match(sonar, /API & integration follows the/);
});
