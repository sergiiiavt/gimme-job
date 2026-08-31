import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const projectFile = (path) => new URL(`../${path}`, import.meta.url);
const readJson = (path) => readFile(projectFile(path), "utf8").then(JSON.parse);

test("HTTP learning chapter is methodic material and covers core API semantics bilingually", async () => {
  const [loader, english, ukrainian, uriEnglish, uriUkrainian] = await Promise.all([
    readFile(projectFile("content/api-integration/http-foundations.ts"), "utf8"),
    readFile(projectFile("content/api-integration/http-foundations.md"), "utf8"),
    readFile(projectFile("content/api-integration/http-foundations.uk.md"), "utf8"),
    readFile(projectFile("content/api-integration/http-uri-addressing.md"), "utf8"),
    readFile(projectFile("content/api-integration/http-uri-addressing.uk.md"), "utf8"),
  ]);

  assert.match(loader, /http-foundations\.md\?raw/);
  assert.match(loader, /http-foundations\.uk\.md\?raw/);
  assert.match(loader, /http-uri-addressing\.md\?raw/);
  assert.match(loader, /http-uri-addressing\.uk\.md\?raw/);
  assert.match(loader, /HTTP_MESSAGES_HEADING/);
  assert.match(loader, /addUriAddressing/);

  const documents = [english, ukrainian];
  for (const markdown of documents) {
    const orderedSections = [
      "## HTTP",
      "## URLs, resources",
      "## HTTP messages",
      "## HTTP methods",
      "## REST",
      "## Headers",
      "## HTTP status codes",
      "## Request bodies",
      "## Cookies",
      "## Caching",
      "## Authentication",
      "## CORS",
      "## Errors",
      "## Sources",
    ];
    let previousIndex = -1;
    for (const heading of orderedSections) {
      const index = markdown.indexOf(heading);
      assert.ok(index > previousIndex, `${heading} must exist in methodic order`);
      previousIndex = index;
    }

    for (const method of ["GET", "HEAD", "POST", "PUT", "PATCH", "DELETE", "OPTIONS", "CONNECT", "TRACE"]) {
      assert.match(markdown, new RegExp(`\\b${method}\\b`), `Missing HTTP method ${method}`);
    }

    for (const code of [
      "100", "101", "103",
      "200", "201", "202", "204", "206",
      "301", "302", "304", "307", "308",
      "400", "401", "403", "404", "405", "409", "412", "413", "415", "422", "429", "451",
      "500", "501", "502", "503", "504", "511",
    ]) {
      assert.match(markdown, new RegExp(`\\b${code}\\b`), `Missing status code ${code}`);
    }

    for (const header of [
      "Accept",
      "Content-Type",
      "Authorization",
      "Origin",
      "Location",
      "Set-Cookie",
      "ETag",
      "If-Match",
      "Retry-After",
      "Access-Control-Allow-Origin",
      "Vary: Origin",
    ]) {
      assert.ok(markdown.includes(header), `Missing HTTP header/concept ${header}`);
    }

    assert.match(markdown, /CRUD/);
    assert.match(markdown, /REST/);
    assert.match(markdown, /safe/i);
    assert.match(markdown, /idempotent/i);
    assert.match(markdown, /Idempotency-Key/);
    assert.match(markdown, /Basic/);
    assert.match(markdown, /Bearer/);
    assert.match(markdown, /OAuth 2\.0/);
    assert.match(markdown, /mTLS/);
    assert.match(markdown, /multipart\/form-data/);
    assert.match(markdown, /pre-signed/);
    assert.match(markdown, /CORS/);
    assert.match(markdown, /same-origin/i);
    assert.match(markdown, /preflight/i);
    assert.match(markdown, /Postman/);
    assert.match(markdown, /curl/);
    assert.match(markdown, /304 Not Modified/);
    assert.match(markdown, /412 Precondition Failed/);

    assert.match(markdown, /GET[\s\S]*no general.*semantics|GET[\s\S]*не визначає general semantics/i);
    assert.match(markdown, /POST[\s\S]*(not required|не вимагає)/i);
    assert.match(markdown, /TRACE[\s\S]*(must not|заборон)/i);
    assert.match(markdown, /session cookie/i);
    assert.match(markdown, /persistent cookie/i);
    assert.match(markdown, /HttpOnly/);
    assert.match(markdown, /SameSite/);
    assert.match(markdown, /no-cache[\s\S]*no-store/i);
    assert.match(markdown, /memory cache/i);
    assert.match(markdown, /disk cache/i);
    assert.match(markdown, /Cache Storage[\s\S]*HTTP cache/i);
    assert.match(markdown, /\[Identity & authorization\]\(\?topic=identity-and-authorization\)/);

    assert.doesNotMatch(markdown, /## \d+\./, "Methodic material must use subject headings instead of numbered learning steps");
    assert.doesNotMatch(markdown, /:::details/, "Status material must stay inline instead of becoming a reference expander");
    assert.doesNotMatch(markdown, /Practical QA|Практичні QA/i);
    assert.doesNotMatch(markdown, /Typical QA question|Why it matters to QA/i);
    assert.doesNotMatch(markdown, /debugging workflow/i);
    assert.doesNotMatch(markdown, /What you should be able to explain/i);
    assert.doesNotMatch(markdown, /memorizing|memorize/i);
  }

  for (const addressing of [uriEnglish, uriUkrainian]) {
    for (const concept of [
      "URI",
      "URL",
      "URN",
      "authority",
      "absolute URI",
      "relative reference",
      "path parameters",
      "query component",
      "fragment",
      "percent-encoding",
      "reserved",
      "unreserved",
      "request target",
      "URI templates",
      "RFC 3986",
      "RFC 6570",
    ]) {
      assert.match(addressing, new RegExp(concept, "i"), `Missing URI addressing concept ${concept}`);
    }
    assert.match(addressing, /fragment.*not.*HTTP request target|Fragment.*не входить.*HTTP request target/is);
    assert.match(addressing, /\+.*space|\+.*проб/i);
  }
});

test("Contracts and schemas is complete methodic material in both languages", async () => {
  const [loader, english, ukrainian] = await Promise.all([
    readFile(projectFile("content/api-integration/contracts-schemas.ts"), "utf8"),
    readFile(projectFile("content/api-integration/contracts-schemas.md"), "utf8"),
    readFile(projectFile("content/api-integration/contracts-schemas.uk.md"), "utf8"),
  ]);

  assert.match(loader, /contracts-schemas\.md\?raw/);
  assert.match(loader, /contracts-schemas\.uk\.md\?raw/);

  for (const markdown of [english, ukrainian]) {
    for (const concept of [
      "OpenAPI",
      "JSON Schema",
      "paths",
      "parameters",
      "request body",
      "responses",
      "components",
      "$ref",
      "required",
      "nullable",
      "enum",
      "allOf",
      "anyOf",
      "oneOf",
      "compatibility",
      "versioning",
      "Deprecation",
      "business validation",
    ]) {
      assert.ok(markdown.toLowerCase().includes(concept.toLowerCase()), `Missing contract concept ${concept}`);
    }
    assert.match(markdown, /OpenAPI Specification 3\.2\.0/);
    assert.match(markdown, /Draft 2020-12/);
    assert.match(markdown, /RFC 9457/);
    assert.doesNotMatch(markdown, /Typical QA question|Why it matters to QA/i);
  }
});

test("Identity and authorization is complete methodic material in both languages", async () => {
  const [loader, english, ukrainian] = await Promise.all([
    readFile(projectFile("content/api-integration/identity-authorization.ts"), "utf8"),
    readFile(projectFile("content/api-integration/identity-authorization.md"), "utf8"),
    readFile(projectFile("content/api-integration/identity-authorization.uk.md"), "utf8"),
  ]);

  assert.match(loader, /identity-authorization\.md\?raw/);
  assert.match(loader, /identity-authorization\.uk\.md\?raw/);

  for (const markdown of [english, ukrainian]) {
    for (const concept of [
      "authentication",
      "authorization",
      "API key",
      "Bearer",
      "JWT",
      "OAuth 2.0",
      "PKCE",
      "Client Credentials",
      "refresh token",
      "OpenID Connect",
      "ID Token",
      "scope",
      "RBAC",
      "ABAC",
      "object-level authorization",
      "multi-tenant",
      "mTLS",
      "401",
      "403",
      "server-side",
    ]) {
      assert.match(markdown, new RegExp(concept, "i"), `Missing identity concept ${concept}`);
    }
    assert.match(markdown, /RFC 9700/);
    assert.match(markdown, /RFC 8725/);
    assert.match(markdown, /Base64.*not encryption|Base64.*не.*encryption/is);
    assert.doesNotMatch(markdown, /Typical QA question|Why it matters to QA/i);
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

test("API and Integration mounts the published learning sources", async () => {
  const [apiCatalog, testingToolsCatalog, interviewCatalog, apiPage, shell] = await Promise.all([
    readFile(projectFile("content/api-integration/catalog.ts"), "utf8"),
    readFile(projectFile("content/testing-tools/catalog.ts"), "utf8"),
    readFile(projectFile("content/interview/catalog.ts"), "utf8"),
    readFile(projectFile("app/learn/api/page.tsx"), "utf8"),
    readFile(projectFile("app/api-integration-page.tsx"), "utf8"),
  ]);

  assert.match(apiCatalog, /\.\/http-foundations/);
  assert.match(apiCatalog, /\.\/contracts-schemas/);
  assert.match(apiCatalog, /\.\/identity-authorization/);
  assert.match(apiCatalog, /\.\/websocket-guide/);
  assert.match(apiCatalog, /title: "API & Integration"/);
  assert.doesNotMatch(apiCatalog, /API & integration testing/);
  assert.doesNotMatch(apiCatalog, /http-api-deep-dive\.json/);
  assert.doesNotMatch(apiCatalog, /improveFileTransferGuide/);
  assert.match(apiCatalog, /HTTP, REST & CORS/);
  assert.match(apiCatalog, /Contracts & schemas/);
  assert.match(apiCatalog, /Identity & authorization/);
  assert.match(apiCatalog, /WebSocket: build, test & debug/);
  assert.doesNotMatch(testingToolsCatalog, /http-api-deep-dive\.json/);
  assert.match(interviewCatalog, /rest-api-qa\.json/);
  assert.match(interviewCatalog, /websocket-qa\.json/);
  assert.match(interviewCatalog, /\.\.\.restApi\.questions/);
  assert.match(interviewCatalog, /\.\.\.websocket\.questions/);
  assert.match(apiPage, /ApiIntegrationPage/);
  assert.match(shell, /secondaryTitle="API & Integration"/);
  assert.match(shell, /reviewRequiredBannerStyle/);
});

test("HTTP presentation keeps methodic material and composes URI detail into the URL section", async () => {
  const [apiCatalog, httpLoader, httpGuide, uriGuide, apiPage] = await Promise.all([
    readFile(projectFile("content/api-integration/catalog.ts"), "utf8"),
    readFile(projectFile("content/api-integration/http-foundations.ts"), "utf8"),
    readFile(projectFile("content/api-integration/http-foundations.md"), "utf8"),
    readFile(projectFile("content/api-integration/http-uri-addressing.md"), "utf8"),
    readFile(projectFile("app/api-integration-page.tsx"), "utf8"),
  ]);

  assert.doesNotMatch(apiCatalog, /trainingOnlyCopy/);
  assert.doesNotMatch(apiCatalog, /makeStatusCodeGroupsExpandable/);
  assert.doesNotMatch(apiCatalog, /normalizeLearningMarkdown/);
  assert.doesNotMatch(apiCatalog, /clarifyBinaryFileMeaning/);
  assert.match(httpLoader, /http-foundations\.md\?raw/);
  assert.match(httpLoader, /http-uri-addressing\.md\?raw/);
  assert.match(httpLoader, /base\.replace/);
  assert.match(httpGuide, /# HTTP, REST & CORS Foundations/);
  assert.match(httpGuide, /## HTTP and HTTPS/);
  assert.match(httpGuide, /## HTTP status codes/);
  assert.match(uriGuide, /### URI, URL and URN/);
  assert.match(uriGuide, /### HTTP request target/);
  assert.doesNotMatch(httpGuide, /:::details/);
  assert.doesNotMatch(apiPage, /Training and practical reference/);
  assert.doesNotMatch(apiPage, /Навчальний і практичний довідник/);
  assert.match(apiPage, /Methodical material/);
  assert.match(apiPage, /Методичний матеріал/);
});

test("Markdown renderer treats tilde fences as code blocks and supports internal topic links", async () => {
  const renderer = await readFile(projectFile("app/qa-markdown.tsx"), "utf8");
  assert.match(renderer, /function parseFence/);
  assert.match(renderer, /~\{3,/);
  assert.match(renderer, /openingFence/);
  assert.match(renderer, /closingFence/);
  assert.match(renderer, /Boolean\(parseFence\(line\)\)/);
  assert.match(renderer, /\\\?|#/);
  assert.match(renderer, /const external = \/\^https\?:/);
  assert.match(renderer, /target=\{external \? "_blank" : undefined\}/);
});

test("API and Integration catalog keeps the requested topic order and placeholders", async () => {
  const apiCatalog = await readFile(projectFile("content/api-integration/catalog.ts"), "utf8");
  const topicIds = [
    "http-foundations",
    "contracts-and-schemas",
    "identity-and-authorization",
    "graphql",
    "grpc-protobuf",
    "soap-xml",
    "websocket",
    "webhooks-callbacks",
    "messaging-and-events",
    "distributed-consistency",
    "failure-resilience",
    "api-gateways",
    "contract-testing",
    "mocks-service-virtualization",
    "integration-observability",
  ];

  let previousIndex = -1;
  for (const id of topicIds) {
    const index = apiCatalog.indexOf(`"${id}"`);
    assert.ok(index > previousIndex, `${id} must exist in catalog order`);
    previousIndex = index;
  }

  for (const placeholderId of [
    "graphql",
    "grpc-protobuf",
    "soap-xml",
    "webhooks-callbacks",
    "messaging-and-events",
    "distributed-consistency",
    "failure-resilience",
    "api-gateways",
    "contract-testing",
    "mocks-service-virtualization",
    "integration-observability",
  ]) {
    assert.match(apiCatalog, new RegExp(`underConstruction\\(\\s*"${placeholderId}"`), `${placeholderId} must remain a placeholder`);
  }

  assert.match(apiCatalog, /status: "under-construction"/);
  assert.match(apiCatalog, /id: "contracts-and-schemas"[\s\S]*?status: "published" as const/);
  assert.match(apiCatalog, /id: "identity-and-authorization"[\s\S]*?status: "published" as const/);
});

test("API presentation shells follow the repository Sonar coverage policy", async () => {
  const sonar = await readFile(projectFile("sonar-project.properties"), "utf8");
  assert.match(sonar, /app\/api-integration-page\.tsx/);
  assert.match(sonar, /app\/learn\/api\/page\.tsx/);
  assert.match(sonar, /sonar\.javascript\.lcov\.reportPaths=coverage\/lcov\.info/);
  assert.match(sonar, /API & integration follows the/);
});
