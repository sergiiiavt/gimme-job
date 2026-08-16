import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

test("new learning paths are ordered and route through standalone document pages", async () => {
  const navigation = await read("app/site-navigation.tsx");
  const automation = navigation.indexOf('label: "Test automation"');
  const tools = navigation.indexOf('label: "Testing & diagnostic tools"');
  const api = navigation.indexOf('label: "API & integration"');
  assert.ok(automation >= 0, "Test automation must be present");
  assert.ok(tools > automation, "Testing tools must follow Test automation");
  assert.ok(api > tools, "API & integration must follow Testing tools");

  const standards = navigation.indexOf('label: "Standards & compliance"');
  const metrics = navigation.indexOf('label: "QA metrics & estimation"');
  const strategy = navigation.indexOf('label: "Strategy & leadership"');
  assert.ok(standards >= 0, "Standards & compliance must be present");
  assert.ok(metrics > standards, "Metrics & estimation must follow Standards");
  assert.ok(strategy > metrics, "Metrics & estimation must precede Strategy");

  for (const [path, component] of [
    ["app/learn/testing-tools/page.tsx", "TestingToolsPage"],
    ["app/workspace/learn/testing-tools/page.tsx", "TestingToolsPage"],
    ["app/learn/metrics-estimation/page.tsx", "MetricsEstimationPage"],
    ["app/workspace/learn/metrics-estimation/page.tsx", "MetricsEstimationPage"],
  ]) {
    const route = await read(path);
    assert.match(route, new RegExp(component));
  }
});

test("learning taxonomies stay compact while preserving the full concept scope", async () => {
  const toolsTaxonomy = JSON.parse(await read("content/testing-tools/taxonomy.json"));
  const toolsConcepts = JSON.parse(await read("content/testing-tools/required-concepts.json"));
  assert.equal(toolsTaxonomy.length, 8);
  assert.equal(toolsConcepts.length, 38);

  const metricsTaxonomy = JSON.parse(await read("content/metrics-estimation/taxonomy.json"));
  const metricsConcepts = JSON.parse(await read("content/metrics-estimation/required-concepts.json"));
  assert.equal(metricsTaxonomy.length, 8);
  assert.equal(metricsConcepts.length, 81);
  assert.deepEqual(metricsTaxonomy.map((topic) => topic.id), [
    "measurement-foundations",
    "qa-product-quality-metrics",
    "test-automation-metrics",
    "delivery-production-metrics",
    "estimation-foundations-decomposition",
    "estimation-techniques-sizing",
    "risk-forecasting",
    "calibration-communication",
  ]);
});

test("metrics content uses current DORA terminology and rejects magic universal targets", async () => {
  const delivery = JSON.parse(await read("content/metrics-estimation/chapter-04.en.json")).markdown;
  for (const metric of [
    "Change lead time",
    "Deployment frequency",
    "Failed deployment recovery time",
    "Change fail rate",
    "Deployment rework rate",
  ]) {
    assert.match(delivery, new RegExp(metric, "i"));
  }

  const sizing = JSON.parse(await read("content/metrics-estimation/chapter-06.en.json")).markdown;
  assert.match(sizing, /no single universal conversion to hours/i);

  const quality = JSON.parse(await read("content/metrics-estimation/chapter-02.en.json")).markdown;
  assert.match(quality, /scenario example — not a universal standard/i);
  assert.match(quality, /target: none implied/i);
});

test("document markdown supports compact collapsible practical sections", async () => {
  const renderer = await read("app/qa-markdown.tsx");
  assert.match(renderer, /:::details/);
  assert.match(renderer, /<details/);
  assert.match(renderer, /<summary/);
  assert.match(renderer, /qa-md-details-body/);
});

test("testing-tools practical examples use traceable official flows and real screenshots", async () => {
  const en = JSON.parse(await read("content/testing-tools/practical-examples.en.json"));
  const uk = JSON.parse(await read("content/testing-tools/practical-examples.uk.json"));

  assert.match(en["http-api-tools"], /postman-echo\.com\/get/);
  assert.match(en["http-api-tools"], /Scripts → Post-response/);
  assert.match(en["http-api-tools"], /assets\.postman\.com\/postman-docs\/v12\/send-first-request\.png/);
  assert.match(en["browser-devtools"], /Copy → Copy as cURL/);
  assert.match(en["browser-devtools"], /developer\.chrome\.com\/static\/docs\/devtools\/network\/reference\/image\/request-headers\.png/);
  assert.match(en["interception-proxies"], /localhost:8080/);
  assert.match(en["database-inspection"], /Connection settings → Initialization/);
  assert.match(en["packet-analysis"], /ws-follow-stream\.png/);
  assert.match(en["mobile-diagnostics"], /adb devices -l/);
  assert.match(en["mobile-diagnostics"], /package:mine/);
  assert.match(en["mobile-diagnostics"], /is:crash/);
  assert.match(en["mobile-diagnostics"], /Apple Console User Guide/);

  assert.deepEqual(Object.keys(uk).sort(), Object.keys(en).sort());
  for (const value of Object.values(en)) assert.match(value, /:::details/);
  for (const value of Object.values(uk)) assert.match(value, /:::details/);
});

test("metrics practical examples distinguish published evidence, real observations and baselines", async () => {
  const en = JSON.parse(await read("content/metrics-estimation/practical-examples.en.json"));
  const uk = JSON.parse(await read("content/metrics-estimation/practical-examples.uk.json"));

  assert.match(en["measurement-foundations"], /DORA Quick Check/);
  assert.match(en["measurement-foundations"], /Deployment rework rate/);
  assert.match(en["qa-product-quality-metrics"], /Google SRE Workbook/);
  assert.match(en["qa-product-quality-metrics"], /requests_total\{status=404\}/);
  assert.match(en["test-automation-metrics"], /31951853421/);
  assert.match(en["test-automation-metrics"], /3 min 32 s/);
  assert.match(en["test-automation-metrics"], /One sample cannot establish a distribution/);
  assert.match(en["delivery-production-metrics"], /not automatically a DORA metric/i);

  assert.deepEqual(Object.keys(uk).sort(), Object.keys(en).sort());
});

test("catalogs inject practical examples before their chapter summaries", async () => {
  for (const path of [
    "content/testing-tools/catalog.ts",
    "content/metrics-estimation/catalog.ts",
  ]) {
    const catalog = await read(path);
    assert.match(catalog, /practical-examples\.en\.json/);
    assert.match(catalog, /practical-examples\.uk\.json/);
    assert.match(catalog, /insertPracticalExamples/);
    assert.match(catalog, /## Summary/);
  }
});
