import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { createServer } from "vite";
import react from "@vitejs/plugin-react";

const SIDEBAR_ID = "\0learning-path-advisor-sidebar";
const COMPONENT_SUFFIX = "/app/ai-assistant/learning-path-advisor.tsx";

const testDoubles = {
  name: "learning-path-advisor-test-doubles",
  enforce: "pre",
  resolveId(id, importer) {
    if (!importer?.endsWith(COMPONENT_SUFFIX)) return null;
    if (id === "../site-navigation") return SIDEBAR_ID;
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
const {
  default: LearningPathAdvisor,
  LearningPathResponseView,
  normalizedLearningPathResponse,
  sourcePathToHref,
} = advisorModule;

const repositoryResult = {
  requestId: "request-1234567890",
  sessionId: "session-1234567890",
  model: "gpt-test",
  langfuseTracing: true,
  langfuseTraceUrl: "https://cloud.langfuse.com/project/demo/traces/trace-123",
  orchestration: "langgraph",
  retrievalMode: "repository",
  totalDurationMs: 842,
  workflowSteps: [
    {
      id: "contextualize",
      label: "Contextualize query",
      detail: "Used the current prompt as the retrieval query.",
      durationMs: 2,
      input: { messageCount: 1 },
      output: { query: "Python parallelism", language: "en" },
      retrievalResults: [],
      tokenUsage: null,
    },
    {
      id: "retrieve",
      label: "Retrieve canonical RAG context",
      detail: "Found 3 canonical RAG materials using vectorize.",
      durationMs: 76,
      input: { query: "Python parallelism", language: "en", limit: 8 },
      output: { strategy: "vectorize", embeddingModel: "@cf/baai/bge-m3", resultCount: 3, topScore: 0.94 },
      retrievalResults: [{
        title: "Python parallelism",
        kind: "question",
        score: 0.94,
        sourcePath: "/interview/python?question=py-parallelism-02",
        excerpt: "Processes provide CPU parallelism while asyncio targets cooperative I/O concurrency.",
      }],
      tokenUsage: null,
    },
    {
      id: "compose_repository",
      label: "Compose grounded path",
      detail: "LangChain produced structured advice from canonical RAG context.",
      durationMs: 754,
      input: { retrievalCount: 3, promptMessages: 3 },
      output: { answerCharacters: 180, cardCount: 2, mapNodeCount: 3 },
      retrievalResults: [],
      tokenUsage: { inputTokens: 520, outputTokens: 190, totalTokens: 710 },
    },
    {
      id: "verify",
      label: "Verify grounding and map",
      detail: "Kept 3 verified GimmeJob source references and a connected map.",
      durationMs: 10,
      input: { retrievalMode: "repository", candidateSourceCount: 3 },
      output: { verifiedSourceCount: 3, connectedMap: true },
      retrievalResults: [],
      tokenUsage: null,
    },
  ],
  response: {
    answer: "Start with the **core concurrency model**, then validate it with interview practice.",
    cards: [
      {
        kind: "learning",
        title: "Concurrency models",
        summary: "Compare threads, processes, and asyncio.",
        sourcePath: "/learn/programming?topic=concurrency-models",
      },
      {
        kind: "interview",
        title: "Practice the distinction",
        summary: "Explain the choice for CPU- and I/O-bound work.",
        sourcePath: "/interview/python?question=py-concurrency-01",
      },
    ],
    suggestedPrompts: ["Compare threading and multiprocessing", "Quiz me on asyncio"],
    learningMap: {
      title: "Python parallelism learning path",
      nodes: [
        {
          id: "topic",
          title: "Concurrency vs parallelism",
          summary: "Learn the vocabulary first.",
          kind: "topic",
          sourcePath: "/learn/programming?topic=concurrency-basics",
          durationMinutes: 5,
        },
        {
          id: "gil",
          title: "CPython and the GIL",
          summary: "Understand the default runtime constraint.",
          kind: "foundation",
          sourcePath: "/learn/programming?topic=gil",
          durationMinutes: 12,
        },
        {
          id: "practice",
          title: "Parallelism interview question",
          summary: "Apply the model to a real interview scenario.",
          kind: "practice",
          sourcePath: "/interview/python?question=py-parallelism-02",
          durationMinutes: 10,
        },
      ],
    },
  },
};

test.after(async () => {
  await server.close();
});

test("renders the public AI Assistant shell, content-first prompt, and runtime inspector", () => {
  const html = renderToStaticMarkup(React.createElement(LearningPathAdvisor));

  assert.match(html, /Learning Path Advisor/);
  assert.match(html, /materials already available on GimmeJob/);
  assert.match(html, /Python parallelism/);
  assert.match(html, /Ask the Learning Path Advisor/);
  assert.match(html, /Execution trace/);
  assert.match(html, /No execution yet/);
  assert.match(html, /data-active-external="ai-assistant"/);
  assert.match(html, /data-active-subsection="learning-path-advisor"/);
  assert.match(html, /Interactive interview\|Learning Path Advisor/);
  assert.match(html, /aria-label="Response language"/);
  assert.match(html, />EN<\/button>/);
  assert.match(html, />UA<\/button>/);
  assert.doesNotMatch(html, /Sign in to continue/);
});

test("renders learning materials first and interview questions second with new-tab deep links", () => {
  const html = renderToStaticMarkup(React.createElement(LearningPathResponseView, {
    result: repositoryResult,
    onSuggestedPrompt() {},
  }));

  assert.match(html, /GimmeJob materials/);
  assert.match(html, /Concurrency vs parallelism/);
  assert.match(html, /CPython and the GIL/);
  assert.match(html, /Interview questions/);
  assert.match(html, /Parallelism interview question/);
  assert.match(html, /href="\/learn\/programming\?topic=concurrency-basics"/);
  assert.match(html, /href="\/interview\/python\?question=py-parallelism-02"/);
  assert.match(html, /target="_blank"/);
  assert.match(html, /rel="noreferrer"/);
  assert.ok(html.indexOf("GimmeJob materials") < html.indexOf("Interview questions"));
  assert.match(html, /Compare threading and multiprocessing/);
});

test("normalizes the real workflow trace returned by the AI proxy", () => {
  const normalized = normalizedLearningPathResponse(repositoryResult);

  assert.ok(normalized);
  assert.equal(normalized.model, "gpt-test");
  assert.equal(normalized.langfuseTracing, true);
  assert.equal(normalized.langfuseTraceUrl, repositoryResult.langfuseTraceUrl);
  assert.equal(normalized.orchestration, "langgraph");
  assert.equal(normalized.retrievalMode, "repository");
  assert.equal(normalized.totalDurationMs, 842);
  assert.deepEqual(normalized.workflowSteps, repositoryResult.workflowSteps);
  assert.equal(normalized.workflowSteps[1].retrievalResults[0].score, 0.94);
  assert.equal(normalized.workflowSteps[2].tokenUsage?.totalTokens, 710);
});

test("rejects a response that has no observable workflow steps", () => {
  const payload = structuredClone(repositoryResult);
  payload.workflowSteps = [];
  assert.equal(normalizedLearningPathResponse(payload), null);
});

test("renders supported bold markdown without exposing markdown markers", () => {
  const html = renderToStaticMarkup(React.createElement(LearningPathResponseView, { result: repositoryResult }));

  assert.match(html, /<strong>core concurrency model<\/strong>/);
  assert.doesNotMatch(html, /\*\*core concurrency model\*\*/);
});

test("deduplicates recommendations that resolve to the same real destination", () => {
  const duplicateResult = structuredClone(repositoryResult);
  duplicateResult.response.cards = [];
  duplicateResult.response.learningMap.nodes = [
    {
      id: "levels",
      title: "Test levels",
      summary: "Where testing happens.",
      kind: "topic",
      sourcePath: "content/qa-fundamentals/testing-levels.json",
      durationMinutes: 10,
    },
    {
      id: "types",
      title: "Test types",
      summary: "What quality or behaviour is evaluated.",
      kind: "concept",
      sourcePath: "content/qa-fundamentals/testing-types.json",
      durationMinutes: 15,
    },
    {
      id: "techniques",
      title: "Design techniques",
      summary: "How coverage is designed.",
      kind: "practice",
      sourcePath: "content/qa-fundamentals/test-design.json",
      durationMinutes: 20,
    },
  ];

  const html = renderToStaticMarkup(React.createElement(LearningPathResponseView, { result: duplicateResult }));
  assert.match(html, />1 topic</);
  assert.equal((html.match(/href="\/reference\/qa-fundamentals"/g) ?? []).length, 1);
  assert.equal((html.match(/>Open topic<\/a>/g) ?? []).length, 1);
});

test("keeps implementation evidence out of the answer body", () => {
  const html = renderToStaticMarkup(React.createElement(LearningPathResponseView, { result: repositoryResult }));

  assert.doesNotMatch(html, /How this answer was built/);
  assert.doesNotMatch(html, /LangGraph/);
  assert.doesNotMatch(html, /LangChain/);
  assert.doesNotMatch(html, /Langfuse/);
  assert.doesNotMatch(html, /Relationship list/);
  assert.doesNotMatch(html, /relationships/);
  assert.doesNotMatch(html, /→/);
});

test("accepts only allow-listed internal content links and keeps legacy sources safe", () => {
  assert.equal(sourcePathToHref("/learn/programming?topic=concurrency"), "/learn/programming?topic=concurrency");
  assert.equal(sourcePathToHref("/interview/python?question=py-concurrency"), "/interview/python?question=py-concurrency");
  assert.equal(sourcePathToHref("/learn/testing-tools?section=fixtures"), "/learn/testing-tools?section=fixtures");
  assert.equal(sourcePathToHref("content/python-learning/advanced-lessons.json"), "/reference/programming");
  assert.equal(sourcePathToHref("python-interview/concurrency-qa.json"), "/interview/python");
  assert.equal(sourcePathToHref("/learn/programming?redirect=https://evil.test"), null);
  assert.equal(sourcePathToHref("/admin?topic=hidden"), null);
  assert.equal(sourcePathToHref("//malicious.example/path"), null);
  assert.equal(sourcePathToHref("../private/secrets.txt"), null);
  assert.equal(sourcePathToHref("https://malicious.example/path"), null);
});

test("uses ephemeral public scope, forwards language, and keeps generated UI free from HTML injection", async () => {
  const [componentSource, sidebarSource] = await Promise.all([
    readFile(new URL("../app/ai-assistant/learning-path-advisor.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/site-navigation.tsx", import.meta.url), "utf8"),
  ]);

  assert.match(componentSource, /fetch\("\/api\/ai\/learning-path"/);
  assert.match(componentSource, /"x-gimmejob-session-scope": "ephemeral"/);
  assert.match(componentSource, /JSON\.stringify\(\{ messages: requestMessages, language, \.\.\.\(sessionId \? \{ sessionId \} : \{\}\) \}\)/);
  assert.match(componentSource, /value\.requestId/);
  assert.match(componentSource, /value\.response\.learningMap/);
  assert.match(componentSource, /value\.workflowSteps/);
  assert.match(componentSource, /ExecutionTrace/);
  assert.match(componentSource, /target="_blank"/);
  assert.doesNotMatch(componentSource, /ExecutionEvidence/);
  assert.doesNotMatch(componentSource, /dangerouslySetInnerHTML/);
  assert.match(sidebarSource, /aria-current=\{activeSubsection === item\.id \? "page" : undefined\}/);
  assert.match(sidebarSource, /aria-pressed=\{activeSubsection === item\.id\}/);
});
