import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { createServer } from "vite";
import react from "@vitejs/plugin-react";

const HOOKS_SPECIFIER = "virtual:interview-simulator-test-hooks";
const HOOKS_ID = "\0interview-simulator-test-hooks";
const SIDEBAR_ID = "\0interview-simulator-test-sidebar";
const LINK_ID = "\0interview-simulator-test-link";
const SIMULATOR_SUFFIX = "/app/interview/simulator/interview-simulator.tsx";

const testDoubles = {
  name: "interview-simulator-test-doubles",
  enforce: "pre",
  resolveId(id, importer) {
    if (id === HOOKS_SPECIFIER) return HOOKS_ID;
    if (!importer?.endsWith(SIMULATOR_SUFFIX)) return null;
    if (id === "../../site-navigation") return SIDEBAR_ID;
    if (id === "next/link") return LINK_ID;
    return null;
  },
  async load(id) {
    if (id.endsWith(SIMULATOR_SUFFIX)) {
      const source = await readFile(id, "utf8");
      const original = 'import { useEffect, useMemo, useState } from "react";';
      assert.ok(source.includes(original), "simulator hook import changed unexpectedly");
      return source.replace(
        original,
        `import { useEffect, useMemo, useState } from "${HOOKS_SPECIFIER}";`,
      );
    }
    if (id === HOOKS_ID) {
      return `
        export function useState(initial) {
          const index = globalThis.__interviewStateCursor ?? 0;
          globalThis.__interviewStateCursor = index + 1;
          const overrides = globalThis.__interviewStateOverrides;
          const value = Array.isArray(overrides) && Object.prototype.hasOwnProperty.call(overrides, index)
            ? overrides[index]
            : (typeof initial === "function" ? initial() : initial);
          return [value, () => undefined];
        }
        export function useEffect() {}
        export function useMemo(factory) { return factory(); }
      `;
    }
    if (id === SIDEBAR_ID) return "export function SiteSidebar() { return null; }";
    if (id === LINK_ID) {
      return `
        import { jsx } from "react/jsx-runtime";
        export default function Link({ href, children, ...props }) {
          return jsx("a", { ...props, href, children });
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

const { default: InterviewSimulator } = await server.ssrLoadModule(
  "/app/interview/simulator/interview-simulator.tsx",
);

function renderWith(overrides = []) {
  globalThis.__interviewStateCursor = 0;
  globalThis.__interviewStateOverrides = overrides;
  return renderToStaticMarkup(React.createElement(InterviewSimulator));
}

function state(overrides = {}) {
  const values = [];
  for (const [index, value] of Object.entries(overrides)) values[Number(index)] = value;
  return values;
}

const qaQuestion = {
  id: "q1",
  question: "Explain test isolation.",
  track: "qa",
  category: "Test design",
  level: "Senior",
  prevalence: "Very common",
  kind: "Theory",
};

const pythonQuestion = {
  id: "q2",
  question: "Explain asyncio scheduling.",
  track: "python",
  category: "Async Python",
  level: "Senior",
  prevalence: "Common",
  kind: "Practical",
};

const strongEvaluation = {
  question_id: "q1",
  score: 92,
  rating: "strong",
  feedback: "Clear and technically correct.",
  strengths: ["Explains isolation"],
  gaps: ["Could mention cleanup"],
  follow_up_question: "How would you isolate shared fixtures?",
  recommended_topics: ["Fixture scope"],
  reference_answer: "Keep tests independent and reset shared state.",
  strong_answer_signals: ["independence", "cleanup"],
};

const weakEvaluation = {
  question_id: "q2",
  score: 35,
  rating: "weak",
  feedback: "Important details are missing.",
  strengths: [],
  gaps: [],
  follow_up_question: null,
  recommended_topics: [],
  reference_answer: "The event loop schedules awaitable work cooperatively.",
  strong_answer_signals: [],
};

test.after(async () => {
  delete globalThis.__interviewStateCursor;
  delete globalThis.__interviewStateOverrides;
  await server.close();
});

test("renders setup, auth, errors, progress memory, and recent sessions", () => {
  const html = renderWith(state({
    12: {
      persistent: true,
      areas: [
        { track: "qa", category: "API", attempts: 1, averageScore: 90, lastAttemptedAt: "2026-08-20T06:00:00Z" },
        { track: "python", category: "Async", attempts: 2, averageScore: 70, lastAttemptedAt: "2026-08-20T06:00:00Z" },
        { track: "qa", category: "SQL", attempts: 3, averageScore: 50, lastAttemptedAt: "2026-08-20T06:00:00Z" },
        { track: "python", category: "Typing", attempts: 4, averageScore: 20, lastAttemptedAt: "2026-08-20T06:00:00Z" },
      ],
      recentSessions: [
        { id: "s1", track: "python", language: "en", status: "COMPLETED", totalQuestions: 5, answeredQuestions: 5, averageScore: 81, updatedAt: "2026-08-20T06:00:00Z" },
        { id: "s2", track: "all", language: "uk", status: "ACTIVE", totalQuestions: 10, answeredQuestions: 2, averageScore: null, updatedAt: "not-a-date" },
      ],
    },
    13: false,
    15: "Temporary provider error",
    16: true,
  }));

  assert.match(html, /Configure interview/);
  assert.match(html, /Sign in to run an AI interview/);
  assert.match(html, /Temporary provider error/);
  assert.match(html, /Areas to practice/);
  assert.match(html, /API/);
  assert.match(html, /Python · 2 answers/);
  assert.match(html, /QA \+ Python · 2\/10/);
  assert.match(html, /Saved/);
});

test("renders an unanswered interview question", () => {
  const html = renderWith(state({
    1: "question",
    6: "session_1",
    7: [qaQuestion, pythonQuestion],
    8: 0,
    9: "A test should control and clean shared state.",
    13: false,
  }));

  assert.match(html, /Explain test isolation/);
  assert.match(html, /Your answer/);
  assert.match(html, /Submit answer/);
  assert.match(html, /1 \/ 2/);
});

test("renders full and minimal evaluation feedback branches", () => {
  const full = renderWith(state({
    1: "question",
    6: "session_1",
    7: [qaQuestion],
    10: strongEvaluation,
    11: [strongEvaluation],
    13: false,
  }));
  assert.match(full, /92/);
  assert.match(full, /What was strong/);
  assert.match(full, /Explains isolation/);
  assert.match(full, /Could mention cleanup/);
  assert.match(full, /Likely follow-up/);
  assert.match(full, /Fixture scope/);
  assert.match(full, /Finish interview/);

  const minimal = renderWith(state({
    1: "question",
    2: "python",
    6: "session_2",
    7: [pythonQuestion],
    10: weakEvaluation,
    11: [weakEvaluation],
    13: false,
  }));
  assert.match(minimal, /No clear strength identified yet/);
  assert.match(minimal, /No material gap identified/);
  assert.doesNotMatch(minimal, /Likely follow-up/);
});

test("renders completed interview summaries for mixed, all-strong, and all-weak results", () => {
  const mixed = renderWith(state({
    1: "complete",
    2: "qa",
    7: [qaQuestion, pythonQuestion],
    11: [strongEvaluation, weakEvaluation],
    13: false,
  }));
  assert.match(mixed, /Interview complete/);
  assert.match(mixed, /64/);
  assert.match(mixed, /Strongest areas/);
  assert.match(mixed, /Focus next/);
  assert.match(mixed, /Test design/);
  assert.match(mixed, /Async Python/);

  const allStrong = renderWith(state({
    1: "complete",
    7: [qaQuestion],
    11: [strongEvaluation],
    13: false,
  }));
  assert.match(allStrong, /No weak category in this session/);

  const allWeak = renderWith(state({
    1: "complete",
    2: "python",
    7: [pythonQuestion],
    11: [weakEvaluation],
    13: false,
  }));
  assert.match(allWeak, /No area reached 65% in this session/);
});

test("moves the simulator into the AI Assistant workspace without changing its hook order", async () => {
  const [simulatorSource, assistantNavigation, legacyPage, assistantPage, interviewCatalogPage] = await Promise.all([
    readFile(new URL("../app/interview/simulator/interview-simulator.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/ai-assistant/assistant-navigation.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/interview/simulator/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/ai-assistant/interview/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/interview/interview-domain-page-client.tsx", import.meta.url), "utf8"),
  ]);

  assert.match(simulatorSource, /activeExternalId="ai-assistant"/);
  assert.match(simulatorSource, /activeSubsection=\{INTERACTIVE_INTERVIEW_TOPIC\}/);
  assert.doesNotMatch(simulatorSource, /hideSecondary/);
  assert.ok(
    assistantNavigation.indexOf('label: "Interactive interview"') < assistantNavigation.indexOf('label: "Learning Path Advisor"'),
    "Interactive interview must be the first AI Assistant topic.",
  );
  assert.match(legacyPage, /redirect\("\/ai-assistant\/interview"\)/);
  assert.match(assistantPage, /<InterviewSimulator\/>/);
  assert.doesNotMatch(interviewCatalogPage, /Run AI interview|simulatorLink|interview-page\.module\.css/);
});
