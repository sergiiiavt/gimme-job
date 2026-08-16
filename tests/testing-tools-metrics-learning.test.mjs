import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

test("new learning paths are ordered and route through standalone document pages", async () => {
  const navigation = await read("app/site-navigation.tsx");
  const automation = navigation.indexOf('label: "Test automation"');
  const tools = navigation.indexOf('label: "Testing & diagnostic tools"');
  const api = navigation.indexOf('label: "API & integration"');
  assert.ok(automation >= 0 && tools > automation && api > tools, "Testing tools must follow Test automation");

  const standards = navigation.indexOf('label: "Standards & compliance"');
  const metrics = navigation.indexOf('label: "QA metrics & estimation"');
  const strategy = navigation.indexOf('label: "Strategy & leadership"');
  assert.ok(standards >= 0 && metrics > standards && strategy > metrics, "Metrics & estimation must sit between Standards and Strategy");

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
  assert.equal(metricsConcepts.length, 68);
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
