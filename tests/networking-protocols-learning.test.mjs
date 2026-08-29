import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const projectFile = (path) => new URL(`../${path}`, import.meta.url);

test("protocols curriculum is bilingual, ordered and covers the practical network stack", async () => {
  const source = await readFile(projectFile("content/networking/protocols-guide.ts"), "utf8");
  const ukMarker = "const markdownUk = String.raw`";
  const ukIndex = source.indexOf(ukMarker);
  assert.ok(ukIndex > 0, "Ukrainian protocols guide is missing");

  const documents = [source.slice(0, ukIndex), source.slice(ukIndex)];
  for (const markdown of documents) {
    let previousIndex = -1;
    for (let section = 1; section <= 13; section += 1) {
      const index = markdown.indexOf(`## ${section}.`);
      assert.ok(index > previousIndex, `Section ${section} must exist in learning order`);
      previousIndex = index;
    }
    assert.ok(markdown.indexOf("## Sources") > previousIndex, "Sources must follow the curriculum");

    for (const concept of [
      "TCP", "UDP", "TLS", "DNS", "HTTP/1.1", "HTTP/2", "HTTP/3", "QUIC",
      "WebSocket", "SSE", "gRPC", "MQTT", "AMQP", "SMTP", "IMAP", "POP3",
      "FTP", "FTPS", "SFTP", "SSH",
    ]) {
      assert.ok(markdown.includes(concept), `Missing protocol concept ${concept}`);
    }

    for (const tool of ["curl", "nslookup", "dig", "openssl s_client", "netcat", "grpcurl", "wscat", "Wireshark"]) {
      assert.ok(markdown.includes(tool), `Missing diagnostic tool ${tool}`);
    }

    assert.match(markdown, /REST.*not.*protocol|REST — не.*protocol/i);
    assert.match(markdown, /GraphQL.*not.*transport protocol|GraphQL — не transport protocol/i);
    assert.match(markdown, /JSON/);
    assert.match(markdown, /QoS 0/);
    assert.match(markdown, /QoS 1/);
    assert.match(markdown, /QoS 2/);
    assert.match(markdown, /at least once/i);
    assert.match(markdown, /certificate/i);
    assert.match(markdown, /TTL/);
    assert.match(markdown, /multiplex/i);
    assert.match(markdown, /Practical QA|Практичні QA/);
  }
});

test("networking owns protocols while API stays focused on HTTP API semantics", async () => {
  const [networkingCatalog, networkingPage, networkingRoute, apiCatalog, navigation] = await Promise.all([
    readFile(projectFile("content/networking/catalog.ts"), "utf8"),
    readFile(projectFile("app/networking-page.tsx"), "utf8"),
    readFile(projectFile("app/learn/networking/page.tsx"), "utf8"),
    readFile(projectFile("content/api-integration/catalog.ts"), "utf8"),
    readFile(projectFile("app/navigation-paths.ts"), "utf8"),
  ]);

  assert.match(networkingCatalog, /\.\/protocols-guide/);
  assert.match(networkingCatalog, /id: "protocols-and-transports"/);
  assert.match(networkingCatalog, /status: "published"/);
  assert.match(networkingPage, /activeSection="networking"/);
  assert.match(networkingPage, /protocols-and-transports/);
  assert.match(networkingRoute, /NetworkingPage/);
  assert.match(navigation, /networking: "\/learn\/networking"/);

  assert.doesNotMatch(apiCatalog, /protocols-guide/);
  assert.match(apiCatalog, /Protocol and transport fundamentals live in Networking/);
  assert.match(apiCatalog, /HTTP, REST & CORS foundations/);
});
