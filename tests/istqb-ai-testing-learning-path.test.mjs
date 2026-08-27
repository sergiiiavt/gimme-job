import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { register } from "tsx/esm/api";

register();

const { default: catalog } = await import("../content/istqb-ai-testing/catalog.ts");
const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

const allMarkdown = () => catalog.taxonomy.map((module) => module.markdown).join("\n");

test("certifications route renders the dedicated ISTQB CT-AI v2 page", async () => {
  const route = await read("app/learn/certifications/page.tsx");

  assert.match(route, /import IstqbAiTestingPage from "\.\.\/\.\.\/istqb-ai-testing-page"/);
  assert.match(route, /learningSectionMetadata\("certifications"\)/);
  assert.match(route, /return <IstqbAiTestingPage\/>/);
});

test("CT-AI curriculum covers all seven official syllabus chapters plus labs and exam review", () => {
  const ids = catalog.taxonomy.map((module) => module.id);

  assert.deepEqual(ids, [
    "exam-plan",
    "ai-foundations",
    "ai-quality",
    "machine-learning",
    "testing-ai-systems",
    "input-data-testing",
    "model-testing",
    "ml-development-testing",
    "hands-on-labs",
    "mock-exam",
    "final-review",
  ]);

  const markdown = allMarkdown();
  for (const expected of [
    "Introduction to Artificial Intelligence",
    "AI quality & acceptance criteria",
    "Machine Learning",
    "Testing AI-Based Systems",
    "Input Data Testing",
    "Model Testing",
    "ML Development & Deployment Testing",
  ]) {
    assert.match(markdown, new RegExp(expected.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i"));
  }
});

test("exam map uses current CT-AI v2 exam structure and version distinction", () => {
  const exam = catalog.taxonomy.find((module) => module.id === "exam-plan")?.markdown ?? "";

  assert.match(exam, /40 multiple-choice questions/);
  assert.match(exam, /Total points:\*\* 44/);
  assert.match(exam, /Pass score:\*\* 29 points/);
  assert.match(exam, /60 minutes/);
  assert.match(exam, /25% additional time/);
  assert.match(exam, /CTFL/);
  assert.match(exam, /17 April 2026/);
  assert.match(exam, /CT-GenAI/);
  assert.match(exam, /1,170 minutes \(19\.5 hours\)/);
});

test("classification section contains worked calculations and model-testing techniques", () => {
  const markdown = allMarkdown();

  for (const concept of [
    "Precision",
    "Recall / sensitivity",
    "F1",
    "data leakage",
    "Metamorphic testing",
    "Adversarial testing",
    "A/B testing",
    "Back-to-back testing",
    "Data drift",
    "Overfitting",
    "underfitting",
    "red teaming",
    "test-oracle problem",
  ]) {
    assert.match(markdown, new RegExp(concept.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i"));
  }

  assert.match(markdown, /TP=36, FP=9, FN=4, TN=51/);
  assert.match(markdown, /Accuracy = \(36 \+ 51\) \/ 100 = \*\*0\.87\*\*/);
});

test("curriculum ships practical labs and a complete original 40-question mock", () => {
  const labs = catalog.taxonomy.find((module) => module.id === "hands-on-labs");
  const mock = catalog.taxonomy.find((module) => module.id === "mock-exam");

  assert.equal(labs?.count, 7);
  assert.match(labs?.markdown ?? "", /Lab 1 — Build the ML workflow/);
  assert.match(labs?.markdown ?? "", /Lab 7 — Metamorphic model testing/);
  assert.match(labs?.markdown ?? "", /Capstone — one complete AI test strategy/);

  assert.equal(mock?.count, 40);
  const questionNumbers = [...(mock?.markdown ?? "").matchAll(/\*\*(\d+)\.\*\*/g)].map((match) => Number(match[1]));
  assert.deepEqual(questionNumbers, Array.from({ length: 40 }, (_, index) => index + 1));
  assert.match(mock?.markdown ?? "", /Answer key with explanations/);
  assert.match(mock?.markdown ?? "", /not ISTQB sample questions/i);
});

test("official reference registry contains current syllabus, sample exam, glossary and quality references", () => {
  const ids = new Set(catalog.sources.map((source) => source.id));
  for (const id of [
    "istqb-ctai-page",
    "istqb-ctai-syllabus-v2",
    "istqb-ctai-sample-questions-v22",
    "istqb-ctai-sample-answers-v22",
    "istqb-ctai-faq",
    "istqb-glossary",
    "iso-25059",
    "nist-ai-rmf",
    "nist-genai-profile",
  ]) {
    assert.equal(ids.has(id), true, `missing source ${id}`);
  }

  for (const source of catalog.sources) {
    assert.match(source.url, /^https:\/\//);
    assert.ok(source.role.length > 30);
  }
});

test("learning page injects selected videos through the shared LearningVideo player", async () => {
  const page = await read("app/istqb-ai-testing-page.tsx");
  const modules = await read("content/istqb-ai-testing/modules.ts");

  assert.match(page, /import LearningVideo from "\.\/learning-video"/);
  assert.match(page, /<LearningVideo/);
  assert.match(page, /Recommended videos/);
  for (const videoId of ["06yTuv7jA9k", "Kdsp6soqA7o", "aircAruvnKk", "EuBBz3bI-aA"]) {
    assert.match(modules, new RegExp(videoId));
  }
});
