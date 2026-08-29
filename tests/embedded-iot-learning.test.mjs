import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const projectFile = (path) => new URL(`../${path}`, import.meta.url);

const chapterFiles = [
  "foundations.ts",
  "hardware-interfaces.ts",
  "can-industrial.ts",
  "wireless-connectivity.ts",
  "iot-protocols-cloud.ts",
  "firmware-lifecycle-security.ts",
  "sensors-timing-power.ts",
  "debugging-hil-testing.ts",
];

const expectedTopicIds = [
  "foundations",
  "hardware-interfaces",
  "can-industrial",
  "wireless-connectivity",
  "iot-protocols-cloud",
  "firmware-lifecycle-security",
  "sensors-timing-power",
  "debugging-hil-testing",
];

test("embedded and IoT curriculum is bilingual, source-backed and complete", async () => {
  for (const file of chapterFiles) {
    const source = await readFile(projectFile(`content/embedded-iot/${file}`), "utf8");
    const ukMarker = "const markdownUk = String.raw`";
    const ukIndex = source.indexOf(ukMarker);
    assert.ok(ukIndex > 0, `${file} must include Ukrainian content`);

    const documents = [source.slice(0, ukIndex), source.slice(ukIndex)];
    for (const markdown of documents) {
      assert.match(markdown, /## 1\./, `${file} must begin a numbered learning sequence`);
      assert.match(markdown, /## Practice|## \d+\. Practice/, `${file} must include practice`);
      assert.match(markdown, /## Quick testing lens|## (?:\d+\. )?QA quick reference/, `${file} must keep testing guidance separate`);
      assert.match(markdown, /## Sources/, `${file} must include sources`);
      assert.ok(markdown.indexOf("## Sources") > markdown.indexOf("## 1."), `${file} sources must follow learning content`);
    }
  }
});

test("embedded curriculum covers the stack without flattening protocol layers", async () => {
  const all = (await Promise.all(chapterFiles.map((file) => readFile(projectFile(`content/embedded-iot/${file}`), "utf8")))).join("\n");

  for (const concept of [
    "MCU", "MPU", "RTOS", "interrupt", "watchdog", "DMA",
    "GPIO", "ADC", "PWM", "UART", "I²C", "SPI", "USB", "RS-485",
    "CAN FD", "LIN", "Modbus RTU", "Modbus TCP",
    "Bluetooth", "BLE", "GATT", "Wi-Fi", "Zigbee", "Thread", "Matter", "LoRaWAN", "NB-IoT",
    "MQTT", "QoS 0", "QoS 1", "QoS 2", "CoAP", "LwM2M",
    "secure boot", "OTA", "A/B", "rollback", "provisioning",
    "calibration", "sampling", "brown-out", "sleep",
    "JTAG", "SWD", "oscilloscope", "logic analyzer", "SIL", "HIL", "DAQ",
  ]) {
    assert.ok(all.toLowerCase().includes(concept.toLowerCase()), `Missing embedded/IoT concept ${concept}`);
  }

  assert.match(all, /UART.*RS-232.*RS-485[\s\S]*different|UART.*RS-232.*RS-485[\s\S]*різн/i);
  assert.match(all, /802\.15\.4.*Zigbee.*Thread.*Matter.*not.*synonym|802\.15\.4.*Zigbee.*Thread.*Matter.*не.*synonym/is);
  assert.match(all, /Matter.*application-layer|Matter.*application layer/i);
  assert.match(all, /Thread.*IPv6/i);
  assert.match(all, /QoS 1[\s\S]*duplicates/i);
  assert.match(all, /DAQ.*not automatically a full HIL|DAQ alone.*complete HIL/i);
});

test("embedded catalog publishes all eight layered chapters in learning order", async () => {
  const catalog = await readFile(projectFile("content/embedded-iot/catalog.ts"), "utf8");

  let previousIndex = -1;
  for (const topicId of expectedTopicIds) {
    const index = catalog.indexOf(`id: "${topicId}"`);
    assert.ok(index > previousIndex, `${topicId} must exist in catalog order`);
    previousIndex = index;
  }

  assert.equal((catalog.match(/status: "published"/g) ?? []).length, expectedTopicIds.length);
  assert.doesNotMatch(catalog, /underConstruction\(/);
  assert.match(catalog, /title: "Embedded & IoT"/);
  assert.match(catalog, /MQTT QoS\/sessions\/retained state/);
  assert.match(catalog, /JTAG\/SWD/);
});

test("embedded route uses the shared topic learning shell and remains separate from Networking", async () => {
  const [page, route, navigation, networking] = await Promise.all([
    readFile(projectFile("app/embedded-iot-page.tsx"), "utf8"),
    readFile(projectFile("app/learn/embedded/page.tsx"), "utf8"),
    readFile(projectFile("app/navigation-paths.ts"), "utf8"),
    readFile(projectFile("content/networking/catalog.ts"), "utf8"),
  ]);

  assert.match(page, /TopicLearningPage/);
  assert.match(page, /activeSection="embedded"/);
  assert.match(page, /defaultTopicId="foundations"/);
  assert.match(route, /EmbeddedIotPage/);
  assert.match(navigation, /embedded: "\/learn\/embedded"/);
  assert.match(networking, /Embedded & IoT kept as a separate scope/);
  assert.doesNotMatch(networking, /QoS 0|QoS 1|QoS 2/);
});
