import assert from "node:assert/strict";
import test from "node:test";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { register } from "tsx/esm/api";
import { createServer } from "vite";
import react from "@vitejs/plugin-react";

register();

const { default: catalog } = await import("../content/istqb-ai-testing/catalog.ts");
const mockMarkdown = catalog.taxonomy.find((module) => module.id === "mock-exam")?.markdown ?? "";

const HOOKS_SPECIFIER = "virtual:istqb-ai-mock-exam-hooks";
const HOOKS_ID = "\0istqb-ai-mock-exam-hooks";
const MARKDOWN_ID = "\0istqb-ai-mock-exam-markdown";
const COMPONENT_SUFFIX = "/app/istqb-ai-mock-exam.tsx";

const testDoubles = {
  name: "istqb-ai-mock-exam-test-doubles",
  enforce: "pre",
  resolveId(id, importer) {
    if (id === HOOKS_SPECIFIER) return HOOKS_ID;
    if (!importer?.endsWith(COMPONENT_SUFFIX)) return null;
    if (id === "./qa-markdown") return MARKDOWN_ID;
    return null;
  },
  async load(id) {
    if (id.endsWith(COMPONENT_SUFFIX)) {
      const { readFile } = await import("node:fs/promises");
      const source = await readFile(id, "utf8");
      const original = 'import { useMemo, useState } from "react";';
      assert.ok(source.includes(original), "mock exam hook import changed unexpectedly");
      return source.replace(
        original,
        `import { useMemo, useState } from "${HOOKS_SPECIFIER}";`,
      );
    }
    if (id === HOOKS_ID) {
      return `
        export function useMemo(factory) { return factory(); }
        export function useState(initial) {
          const index = globalThis.__mockExamStateCursor ?? 0;
          globalThis.__mockExamStateCursor = index + 1;
          const overrides = globalThis.__mockExamStateOverrides;
          const value = Array.isArray(overrides) && Object.prototype.hasOwnProperty.call(overrides, index)
            ? overrides[index]
            : (typeof initial === "function" ? initial() : initial);
          const setter = (next) => {
            const resolved = typeof next === "function" ? next(value) : next;
            globalThis.__mockExamStateWrites ??= [];
            globalThis.__mockExamStateWrites.push({ index, value: resolved });
          };
          return [value, setter];
        }
      `;
    }
    if (id === MARKDOWN_ID) {
      return `
        import { jsx } from "react/jsx-runtime";
        export default function MarkdownDocument({ markdown }) {
          return jsx("div", { "data-markdown": true, children: markdown });
        }
      `;
    }
    return null;
  },
};

const server = await createServer({
  appType: "custom",
  configFile: false,
  root: process.cwd(),
  logLevel: "silent",
  plugins: [testDoubles, react()],
  server: { middlewareMode: true },
});

const { default: IstqbAiMockExam, parseIstqbAiMockExam } = await server.ssrLoadModule(
  "/app/istqb-ai-mock-exam.tsx",
);

function state(overrides = {}) {
  const values = [];
  for (const [index, value] of Object.entries(overrides)) values[Number(index)] = value;
  return values;
}

function build(overrides = {}) {
  globalThis.__mockExamStateCursor = 0;
  globalThis.__mockExamStateOverrides = state(overrides);
  globalThis.__mockExamStateWrites = [];
  return IstqbAiMockExam({ markdown: mockMarkdown });
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

test.after(async () => {
  delete globalThis.__mockExamStateCursor;
  delete globalThis.__mockExamStateOverrides;
  delete globalThis.__mockExamStateWrites;
  delete globalThis.document;
  delete globalThis.window;
  await server.close();
});

test("parses all mock questions, choices, answers, and explanations", () => {
  assert.equal(parsed.questions.length, 40);
  assert.match(parsed.introduction, /40-question original mock exam/);
  assert.deepEqual(parsed.questions[0].options.map((option) => option.key), ["A", "B", "C", "D"]);
  assert.equal(parsed.questions[0].correctAnswer, "C");
  assert.match(parsed.questions[0].explanation ?? "", /learned behavior/);
  assert.equal(parsed.questions[39].correctAnswer, "B");

  const empty = parseIstqbAiMockExam("");
  assert.equal(empty.introduction, "");
  assert.deepEqual(empty.questions, []);
});

test("renders selectable questions with progress before submission", () => {
  const html = renderToStaticMarkup(build({ 0: { 1: "C", 2: "B" } }));

  assert.match(html, /2<!-- --> \/ <!-- -->40<!-- --> answered/);
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
