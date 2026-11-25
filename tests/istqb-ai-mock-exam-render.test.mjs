import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";
import { renderToStaticMarkup } from "react-dom/server";
import { register } from "tsx/esm/api";
import { register as registerLoader } from "node:module";

register();
registerLoader("./helpers/mock-exam-render-loader.mjs", import.meta.url);

const { default: catalog } = await import("../content/istqb-ai-testing/catalog.ts");
const {
  evaluateIstqbAiMockExam,
  evaluateMockExam,
  mockExamGroupHeadings,
  mockExamCopy,
  ukrainianMockExamEvaluationTexts,
  parseIstqbAiMockExam,
  scoreIstqbAiMockExam,
} = await import("../app/istqb-ai-mock-exam-model.ts");
const mockMarkdown = catalog.taxonomy.find((module) => module.id === "mock-exam")?.markdown ?? "";

const ukMarkdown = await readFile(new URL("../content/istqb-certifications/ctfl/08-mock-exam.uk.md", import.meta.url), "utf8");
const ukProps = { language: "uk", markdown: ukMarkdown };
const ukExam = parseIstqbAiMockExam(ukMarkdown);

// Import the real TSX module through Node so coverage maps to its physical source.
const { default: IstqbAiMockExam } = await import("../app/istqb-ai-mock-exam.tsx");

function state(overrides = {}) {
  const values = [];
  for (const [index, value] of Object.entries(overrides)) values[Number(index)] = value;
  return values;
}

function build(overrides = {}, props = {}) {
  globalThis.__mockExamStateCursor = 0;
  globalThis.__mockExamStateOverrides = state(overrides);
  globalThis.__mockExamStateWrites = [];
  return IstqbAiMockExam({ markdown: mockMarkdown, ...props });
}

function textOf(node) {
  if (node == null || typeof node === "boolean") return "";
  if (typeof node === "string" || typeof node === "number") return String(node);
  if (Array.isArray(node)) return node.map(textOf).join("");
  return textOf(node.props?.children);
}

function findElements(node, predicate, results = []) {
  if (node == null || typeof node !== "object") return results;
  if (Array.isArray(node)) {
    for (const child of node) findElements(child, predicate, results);
    return results;
  }
  if (predicate(node)) results.push(node);
  findElements(node.props?.children, predicate, results);
  return results;
}

function answerMap(parsed, correctCount) {
  return Object.fromEntries(parsed.questions.map((question, index) => {
    if (index < correctCount) return [question.number, question.correctAnswer];
    const wrong = question.options.find((option) => option.key !== question.correctAnswer)?.key ?? "A";
    return [question.number, wrong];
  }));
}

const parsed = parseIstqbAiMockExam(mockMarkdown);

test.after(() => {
  delete globalThis.__mockExamStateCursor;
  delete globalThis.__mockExamStateOverrides;
  delete globalThis.__mockExamStateWrites;
  delete globalThis.document;
  delete globalThis.window;
});

test("parses and scores the complete CT-AI mock exam model", () => {
  assert.equal(parsed.questions.length, 40);
  assert.match(parsed.introduction, /40-question original mock exam/);
  assert.deepEqual(parsed.questions[0].options.map((option) => option.key), ["A", "B", "C", "D"]);
  assert.equal(parsed.questions[0].correctAnswer, "C");
  assert.match(parsed.questions[0].explanation ?? "", /learned behavior/);
  assert.equal(parsed.questions[39].correctAnswer, "B");

  const empty = parseIstqbAiMockExam("");
  assert.equal(empty.introduction, "");
  assert.deepEqual(empty.questions, []);

  assert.equal(scoreIstqbAiMockExam(parsed.questions, answerMap(parsed, 40)), 40);
  assert.equal(scoreIstqbAiMockExam(parsed.questions, answerMap(parsed, 20)), 20);
  assert.equal(scoreIstqbAiMockExam(parsed.questions, answerMap(parsed, 0)), 0);

  assert.equal(evaluateIstqbAiMockExam(36).label, "Strong");
  assert.equal(evaluateIstqbAiMockExam(32).label, "Close");
  assert.equal(evaluateIstqbAiMockExam(28).label, "Material gaps remain");
  assert.equal(evaluateIstqbAiMockExam(27).label, "More preparation needed");
});

test("mock exam bands and rail headings scale with the number of questions", () => {
  assert.equal(evaluateMockExam(27, 30).label, "Strong");
  assert.equal(evaluateMockExam(26, 30).label, "Close");
  assert.equal(evaluateMockExam(21, 30).label, "Material gaps remain");
  assert.equal(evaluateMockExam(20, 30).label, "More preparation needed");

  const texts = { strong: "s", close: "c", gaps: "g", more: "m" };
  assert.equal(evaluateMockExam(40, 40, texts).text, "s");

  assert.deepEqual(mockExamGroupHeadings(40).map(({ id }) => id), [
    "questions-1-10", "questions-11-20", "questions-21-30", "questions-31-40",
  ]);
  assert.deepEqual(mockExamGroupHeadings(25), [
    { id: "questions-1-10", text: "Questions 1–10" },
    { id: "questions-11-20", text: "Questions 11–20" },
    { id: "questions-21-25", text: "Questions 21–25" },
  ]);
});

test("renders selectable questions with progress before submission", () => {
  const html = renderToStaticMarkup(build({ 0: { 1: "C", 2: "B" } }));

  assert.match(html, /<strong>2<\/strong> \/ 40 answered/);
  assert.match(html, /type="radio"/);
  assert.match(html, /Check score/);
  assert.doesNotMatch(html, /Practice score/);
  assert.doesNotMatch(html, /correct answer:/i);
});

test("selecting an answer updates answer state and clears validation", () => {
  const tree = build({ 0: { 1: "C" }, 1: true, 2: "old validation" });
  const inputs = findElements(tree, (element) => element.type === "input");
  assert.equal(inputs.length, 160);

  inputs.find((input) => input.props.name === "mock-question-2" && input.props.value === "A")?.props.onChange();

  const writes = globalThis.__mockExamStateWrites;
  assert.deepEqual(writes[0], { index: 0, value: { 1: "C", 2: "A" } });
  assert.deepEqual(writes[1], { index: 2, value: "" });
  assert.deepEqual(writes[2], { index: 1, value: false });
});

test("check score rejects an incomplete exam and scrolls to the first unanswered question", () => {
  let scrolledId = "";
  globalThis.document = {
    getElementById(id) {
      return { scrollIntoView() { scrolledId = id; } };
    },
  };

  const tree = build({ 0: { 1: "C" } });
  const button = findElements(tree, (element) => element.type === "button" && textOf(element) === "Check score")[0];
  button.props.onClick();

  assert.equal(scrolledId, "mock-question-2");
  assert.match(globalThis.__mockExamStateWrites.at(-1).value, /39 remaining/);
});

test("check score submits a complete exam and scrolls to results", () => {
  let scrolledId = "";
  globalThis.document = {
    getElementById(id) {
      return { scrollIntoView() { scrolledId = id; } };
    },
  };
  globalThis.window = { setTimeout(callback) { callback(); } };

  const tree = build({ 0: answerMap(parsed, 40) });
  const button = findElements(tree, (element) => element.type === "button" && textOf(element) === "Check score")[0];
  button.props.onClick();

  assert.deepEqual(globalThis.__mockExamStateWrites[0], { index: 2, value: "" });
  assert.deepEqual(globalThis.__mockExamStateWrites[1], { index: 1, value: true });
  assert.equal(scrolledId, "exam-results");
});

test("renders all diagnostic score bands and answer review", () => {
  const strong = renderToStaticMarkup(build({ 0: answerMap(parsed, 40), 1: true }));
  assert.match(strong, /40<small> \/ 40<\/small>/);
  assert.match(strong, /100%/);
  assert.match(strong, /Strong/);
  assert.match(strong, /Correct/);

  const close = renderToStaticMarkup(build({ 0: answerMap(parsed, 34), 1: true }));
  assert.match(close, /Close/);
  assert.match(close, /Incorrect · correct answer:/);

  const material = renderToStaticMarkup(build({ 0: answerMap(parsed, 30), 1: true }));
  assert.match(material, /Material gaps remain/);

  const weak = renderToStaticMarkup(build({ 0: answerMap(parsed, 0), 1: true }));
  assert.match(weak, /More preparation needed/);
});

test("retry clears the exam state and returns to the first question group", () => {
  let scrolledId = "";
  globalThis.document = {
    getElementById(id) {
      return { scrollIntoView() { scrolledId = id; } };
    },
  };

  const tree = build({ 0: answerMap(parsed, 40), 1: true, 2: "message" });
  const retry = findElements(tree, (element) => element.type === "button" && textOf(element) === "Retry exam")[0];
  retry.props.onClick();

  assert.deepEqual(globalThis.__mockExamStateWrites, [
    { index: 0, value: {} },
    { index: 1, value: false },
    { index: 2, value: "" },
  ]);
  assert.equal(scrolledId, "questions-1-10");
});



test("Ukrainian assessment keeps canonical group anchors and localized progress and validation", () => {
  assert.deepEqual(mockExamGroupHeadings(15, 10, "uk"), [
    { id: "questions-1-10", text: "Запитання 1–10" },
    { id: "questions-11-15", text: "Запитання 11–15" },
  ]);
  const tree = build({ 0: { 1: "A" } }, ukProps);
  const html = renderToStaticMarkup(tree);
  assert.match(html, /aria-label="Прогрес тесту"/);
  assert.match(html, /1<\/strong> \/ 40 відповідей/);
  assert.match(html, /id="questions-1-10"/);
  assert.match(html, /Запитання 1–10/);
  assert.doesNotMatch(html, /Навчальний бал|Неправильно · правильна відповідь:/);
  findElements(tree, (element) => element.type === "button" && textOf(element) === "Перевірити")[0].props.onClick();
  assert.equal(globalThis.__mockExamStateWrites.at(-1).value, "Дайте відповіді на всі 40 запитань. Залишилося: 39.");
});

test("Ukrainian assessment renders every score band, rationale and retry behavior", () => {
  for (const [score, label] of [[40,"Упевнено"],[34,"Близько"],[30,"Залишилися суттєві прогалини"],[0,"Потрібна додаткова підготовка"]]) {
    const tree = build({ 0: answerMap(ukExam, score), 1: true }, ukProps);
    const html = renderToStaticMarkup(tree);
    assert.match(html, /Навчальний бал/);
    assert.ok(html.includes(label));
    assert.match(html, /діагностична навчальна оцінка/);
    assert.match(html, score === 40 ? /Правильно/ : /Неправильно · правильна відповідь:/);
    assert.ok(html.includes(ukExam.questions[0].explanation));
    findElements(tree, (element) => element.type === "button" && textOf(element) === "Повторити")[0].props.onClick();
    assert.deepEqual(globalThis.__mockExamStateWrites, [{ index: 0, value: {} },{ index: 1, value: false },{ index: 2, value: "" }]);
  }
});


test("assessment display copy has complete language parity and localized recommendations", () => {
  assert.deepEqual(Object.keys(mockExamCopy.uk).sort(), Object.keys(mockExamCopy.en).sort());
  assert.equal(mockExamCopy.en.check, "Check score");
  assert.equal(mockExamCopy.uk.check, "Перевірити");
  for (const copy of Object.values(mockExamCopy)) {
    assert.ok(Object.values(copy).every((value) => typeof value === "string" && value.length > 0));
  }
  assert.equal(evaluateMockExam(40, 40, ukrainianMockExamEvaluationTexts).text, ukrainianMockExamEvaluationTexts.strong);
  assert.equal(evaluateMockExam(34, 40, ukrainianMockExamEvaluationTexts).text, ukrainianMockExamEvaluationTexts.close);
  assert.equal(evaluateMockExam(30, 40, ukrainianMockExamEvaluationTexts).text, ukrainianMockExamEvaluationTexts.gaps);
  assert.equal(evaluateMockExam(0, 40, ukrainianMockExamEvaluationTexts).text, ukrainianMockExamEvaluationTexts.more);
});
