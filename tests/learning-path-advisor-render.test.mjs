import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { createServer } from "vite";
import react from "@vitejs/plugin-react";

const SIDEBAR_ID = "\0learning-path-advisor-sidebar";
const LINK_ID = "\0learning-path-advisor-link";
const COMPONENT_SUFFIX = "/app/ai-assistant/learning-path-advisor.tsx";

const testDoubles = {
  name: "learning-path-advisor-test-doubles",
  enforce: "pre",
  resolveId(id, importer) {
    if (!importer?.endsWith(COMPONENT_SUFFIX)) return null;
    if (id === "../site-navigation") return SIDEBAR_ID;
    if (id === "next/link") return LINK_ID;
    return null;
  },
  load(id) {
    if (id === SIDEBAR_ID) {
      return `
        import { jsx } from "react/jsx-runtime";
        export function SiteSidebar(props) {
          return jsx("aside", {
            "data-active-external": props.activeExternalId,
            "data-active-subsection": props.activeSubsection,
            "data-secondary-labels": props.secondaryItems.map((item) => item.label).join("|"),
          });
        }
      `;
    }
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

const advisorModule = await server.ssrLoadModule(COMPONENT_SUFFIX);
const { default: LearningPathAdvisor, LearningPathResponseView, sourcePathToHref } = advisorModule;

const repositoryResult = {
  requestId: "request-1234567890",
  sessionId: "session-1234567890",
  model: "gpt-test",
  langfuseTracing: true,
  orchestration: "langgraph",
  retrievalMode: "repository",
  workflowSteps: [
    { id: "understand", label: "Understand topic", detail: "Normalize the requested skill." },
    { id: "retrieve", label: "Retrieve Git knowledge", detail: "Search repository content." },
    { id: "compose", label: "Build learning map", detail: "Connect concepts and practice." },
  ],
  response: {
    answer: "Start by separating concurrency from true parallel execution.",
    cards: [
      { kind: "learning", title: "Concurrency models", summary: "Compare threads, processes, and asyncio.", sourcePath: "python-learning/advanced-lessons.json" },
      { kind: "interview", title: "Practice the distinction", summary: "Explain the choice for CPU- and I/O-bound work.", sourcePath: "python-interview/concurrency-qa.json" },
    ],
    sources: [
      "python-learning/advanced-lessons.json",
      "python-interview/concurrency-qa.json",
    ],
    suggestedPrompts: ["Compare threading and multiprocessing", "Quiz me on asyncio"],
    learningMap: {
      title: "Python parallelism learning path",
      nodes: [
        { id: "topic", title: "Concurrency vs parallelism", summary: "Learn the vocabulary first.", kind: "topic", sourcePath: "python-learning/taxonomy.json", durationMinutes: 5 },
        { id: "gil", title: "CPython and the GIL", summary: "Understand the default runtime constraint.", kind: "foundation", sourcePath: "python-learning/expert-lessons.json", durationMinutes: 12 },
        { id: "models", title: "Threads, processes, asyncio", summary: "Choose a model from workload behavior.", kind: "concept", sourcePath: "python-interview/concurrency-qa.json", durationMinutes: 15 },
        { id: "practice", title: "Workload decision practice", summary: "Apply the model to real scenarios.", kind: "practice", sourcePath: "python-interview/concurrency-qa.json", durationMinutes: 10 },
      ],
      edges: [
        { source: "topic", target: "gil", label: "establishes" },
        { source: "gil", target: "models", label: "informs" },
        { source: "models", target: "practice", label: "apply with" },
      ],
    },
  },
};

test.after(async () => {
  await server.close();
});

test("renders the AI Assistant shell and source-backed sample prompt", () => {
  const html = renderToStaticMarkup(React.createElement(LearningPathAdvisor));

  assert.match(html, /Learning Path Advisor/);
  assert.match(html, /Python parallelism/);
  assert.match(html, /Ask the Learning Path Advisor/);
  assert.match(html, /data-active-external="ai-assistant"/);
  assert.match(html, /data-active-subsection="learning-path-advisor"/);
  assert.match(html, /Interactive interview\|Learning Path Advisor/);
});

test("renders connected graph evidence, repository sources, and observable execution", () => {
  const html = renderToStaticMarkup(React.createElement(LearningPathResponseView, {
    result: repositoryResult,
    onSuggestedPrompt() {},
  }));

  assert.match(html, /LangGraph/);
  assert.match(html, /Workflow executed/);
  assert.match(html, /Git-backed retrieval/);
  assert.match(html, /LangChain/);
  assert.match(html, /Structured output validated/);
  assert.match(html, /Langfuse/);
  assert.match(html, /Tracing enabled/);
  assert.match(html, /Understand topic/);
  assert.match(html, /Retrieve Git knowledge/);
  assert.match(html, /Python parallelism learning path/);
  assert.match(html, /Concurrency vs parallelism/);
  assert.match(html, /CPython and the GIL/);
  assert.match(html, /establishes/);
  assert.match(html, /informs/);
  assert.match(html, /Relationship list/);
  assert.match(html, /href="\/reference\/programming"/);
  assert.match(html, /href="\/interview\/python"/);
  assert.match(html, /Compare threading and multiprocessing/);
});

test("labels general fallback and an untraced response honestly", () => {
  const generalResult = {
    ...repositoryResult,
    langfuseTracing: false,
    retrievalMode: "general",
    response: { ...repositoryResult.response, sources: [] },
  };
  const html = renderToStaticMarkup(React.createElement(LearningPathResponseView, { result: generalResult }));

  assert.match(html, /General model knowledge/);
  assert.match(html, /Repository match not used/);
  assert.match(html, /Not traced \/ not configured/);
});

test("bounds graph rendering and maps only allowlisted repository prefixes", () => {
  const overflowNodes = Array.from({ length: 9 }, (_, index) => ({
    id: `node-${index + 1}`,
    title: index === 8 ? "Hidden overflow node" : `Visible node ${index + 1}`,
    summary: "Bounded node",
    kind: "concept",
    sourcePath: "python-learning/advanced-lessons.json",
    durationMinutes: null,
  }));
  const overflowResult = {
    ...repositoryResult,
    response: {
      ...repositoryResult.response,
      learningMap: {
        title: "Bounded map",
        nodes: overflowNodes,
        edges: [
          ...Array.from({ length: 12 }, (_, index) => ({
            source: `node-${(index % 7) + 1}`,
            target: `node-${(index % 7) + 2}`,
            label: `edge-${index + 1}`,
          })),
          { source: "node-1", target: "node-1", label: "self-loop-hidden" },
        ],
      },
    },
  };
  const html = renderToStaticMarkup(React.createElement(LearningPathResponseView, { result: overflowResult }));

  assert.doesNotMatch(html, /Hidden overflow node/);
  assert.doesNotMatch(html, /self-loop-hidden/);
  assert.equal(sourcePathToHref("content/python-learning/advanced-lessons.json"), "/reference/programming");
  assert.equal(sourcePathToHref("python-interview/concurrency-qa.json"), "/interview/python");
  assert.equal(sourcePathToHref("../private/secrets.txt"), null);
  assert.equal(sourcePathToHref("https://malicious.example/path"), null);
  assert.equal(sourcePathToHref("unsupported/file.md"), null);
});

test("uses the camelCase learning-path contract and accessible selected subnav state", async () => {
  const [componentSource, sidebarSource] = await Promise.all([
    readFile(new URL("../app/ai-assistant/learning-path-advisor.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/site-navigation.tsx", import.meta.url), "utf8"),
  ]);

  assert.match(componentSource, /fetch\("\/api\/ai\/learning-path"/);
  assert.match(componentSource, /JSON\.stringify\(\{ messages: requestMessages, \.\.\.\(sessionId \? \{ sessionId \} : \{\}\) \}\)/);
  assert.match(componentSource, /value\.requestId/);
  assert.match(componentSource, /payload\.learningMap|value\.response\.learningMap/);
  assert.match(componentSource, /source !== target/);
  assert.match(componentSource, /typed\.status === 401/);
  assert.doesNotMatch(componentSource, /dangerouslySetInnerHTML/);
  assert.match(sidebarSource, /aria-current=\{activeSubsection === item\.id \? "page" : undefined\}/);
  assert.match(sidebarSource, /aria-pressed=\{activeSubsection === item\.id\}/);
  assert.match(sidebarSource, /onClick=\{\(\) => onSelectSubsection\(item\.id\)\}[\s\S]*?type="button"/);
});
