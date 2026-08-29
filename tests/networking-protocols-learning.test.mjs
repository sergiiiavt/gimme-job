import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const projectFile = (path) => new URL(`../${path}`, import.meta.url);

test("protocols curriculum is bilingual, ordered and general-purpose", async () => {
  const source = await readFile(projectFile("content/networking/protocols-guide.ts"), "utf8");
  const ukMarker = "const markdownUk = String.raw`";
  const ukIndex = source.indexOf(ukMarker);
  assert.ok(ukIndex > 0, "Ukrainian protocols guide is missing");

  const documents = [source.slice(0, ukIndex), source.slice(ukIndex)];
  for (const markdown of documents) {
    let previousIndex = -1;
    for (let section = 1; section <= 16; section += 1) {
      const index = markdown.indexOf(`## ${section}.`);
      assert.ok(index > previousIndex, `Section ${section} must exist in learning order`);
      previousIndex = index;
    }
    assert.ok(markdown.indexOf("## Embedded & IoT scope boundary") > previousIndex, "Embedded/IoT boundary must follow the general curriculum");
    assert.ok(markdown.indexOf("## Sources") > previousIndex, "Sources must follow the curriculum");

    for (const concept of [
      "IP", "TCP", "UDP", "QUIC", "TLS", "DNS", "HTTP/1.1", "HTTP/2", "HTTP/3",
      "WebSocket", "SSE", "gRPC", "AMQP", "SMTP", "IMAP", "POP3",
      "FTP", "FTPS", "SFTP", "SSH",
    ]) {
      assert.ok(markdown.includes(concept), `Missing protocol concept ${concept}`);
    }

    for (const tool of ["curl", "nslookup", "dig", "openssl s_client", "netcat", "grpcurl", "wscat", "Wireshark"]) {
      assert.ok(markdown.includes(tool), `Missing diagnostic tool ${tool}`);
    }

    assert.match(markdown, /REST.*not a protocol|REST — architectural style/i);
    assert.match(markdown, /GraphQL.*not a transport protocol|GraphQL — query language/i);
    assert.match(markdown, /JSON/);
    assert.match(markdown, /certificate/i);
    assert.match(markdown, /TTL/);
    assert.match(markdown, /multiplex/i);

    const qaSection = markdown.indexOf("## 16. QA quick reference");
    assert.ok(qaSection > 0, "QA material must be a compact separate reference");
    assert.equal(markdown.slice(0, qaSection).includes("QA perspective"), false, "Main curriculum must not be framed from a QA perspective");

    for (const embeddedConcept of [
      "MQTT", "CoAP", "Bluetooth", "BLE", "Zigbee", "Thread", "Matter", "LoRaWAN",
      "CAN", "LIN", "Modbus", "UART", "I²C", "SPI", "USB",
    ]) {
      assert.ok(markdown.includes(embeddedConcept), `Embedded/IoT scope boundary must name ${embeddedConcept}`);
    }
    assert.match(markdown, /MQTT.*moved|MQTT.*переноситься/is);
  }
});

test("networking owns general protocols while API and embedded scopes remain separate", async () => {
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
  assert.match(networkingCatalog, /general learning path/i);
  assert.match(networkingCatalog, /Embedded & IoT kept as a separate scope/);
  assert.match(networkingPage, /activeSection="networking"/);
  assert.match(networkingPage, /protocols-and-transports/);
  assert.match(networkingRoute, /NetworkingPage/);
  assert.match(navigation, /networking: "\/learn\/networking"/);
  assert.match(navigation, /embedded: "\/learn\/embedded"/);

  assert.doesNotMatch(apiCatalog, /protocols-guide/);
  assert.match(apiCatalog, /Protocol and transport fundamentals live in Networking/);
  assert.match(apiCatalog, /HTTP, REST & CORS foundations/);
});
