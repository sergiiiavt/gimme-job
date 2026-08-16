import assert from "node:assert/strict";
import test from "node:test";
import { register } from "tsx/esm/api";

register();

const {
  adjustResumeWithOpenAi,
  analyzeJobWithOpenAi,
  deterministicAnalysis,
  deterministicResumePackage,
} = await import("../agent/src/job-intelligence.ts");

const profile = {
  name: "QA Candidate",
  headline: "QA Lead",
  summary: "Software QA lead with web and API testing experience.",
  targetRoles: ["QA Lead", "Senior QA Engineer"],
  locations: ["Remote", "Kyiv"],
  languages: ["English: B2"],
  skills: ["QA leadership", "Playwright", "API testing", "SQL", "Test strategy"],
  mustHaveSignals: [],
  preferredSignals: ["remote", "бронювання"],
  excludedSignals: [],
  facts: ["Led a QA team."],
  experience: [{ company: "Example", role: "QA Lead", period: "2022 - Present", achievements: ["Led a QA team."] }],
  education: [],
  links: [],
  contact: { email: "qa@example.com", phone: "", location: "Kyiv, Ukraine" },
};

const job = {
  id: "job-1",
  fingerprint: "fingerprint-1",
  source: "dou",
  externalId: "1",
  title: "QA Lead",
  company: "Product Company",
  location: "Remote",
  remote: true,
  url: "https://example.com/job-1",
  applyUrl: "https://example.com/job-1",
  description: "Lead web and API testing. Playwright, SQL, test strategy. Бронювання.",
  salaryText: null,
  postedAt: "2026-08-16T10:00:00.000Z",
  contactEmail: "hr@example.com",
  raw: {},
  discoveredAt: "2026-08-16T10:00:00.000Z",
  updatedAt: "2026-08-16T10:00:00.000Z",
  status: "NEW" as const,
};

function openAiResponse(value: unknown): Response {
  return Response.json({ choices: [{ message: { content: JSON.stringify(value) } }] });
}

test("deterministic job intelligence is one stable fallback", () => {
  const analysis = deterministicAnalysis(job, profile);
  const pkg = deterministicResumePackage(job, profile);
  assert.equal(analysis.marketSignals.seniority, "Lead/Manager");
  assert.equal(analysis.marketSignals.remotePolicy, "Remote mentioned");
  assert.ok(analysis.matchingSkills.includes("QA leadership"));
  assert.match(pkg.tailoredResume.markdown, /QA Candidate/);
  assert.equal(pkg.applicationDraft.recipientGuess, "hr@example.com");
});

test("missing OpenAI key uses the same deterministic implementation", async () => {
  const direct = deterministicAnalysis(job, profile);
  const result = await analyzeJobWithOpenAi(job, profile, { apiKey: "" });
  assert.equal(result.mode, "deterministic");
  assert.deepEqual(result.analysis, direct);
});

test("OpenAI analysis uses the shared strict schema path", async () => {
  const expected = {
    score: 91,
    verdict: "strong",
    roleFit: "Direct QA leadership match.",
    matchingSkills: ["QA leadership", "Playwright", "API testing", "SQL", "Test strategy"],
    missingSkills: [],
    hardBlockers: [],
    evidence: ["QA Lead title matches."],
    requirements: ["Playwright", "API testing", "SQL", "Test strategy"],
    requirementKeywords: ["Playwright", "API testing", "SQL", "Test strategy"],
    marketSignals: {
      seniority: "Lead/Manager",
      employmentType: "Not specified",
      remotePolicy: "Remote mentioned",
      salary: "Not disclosed",
      reservation: "Mentioned",
      language: "Not specified",
    },
    recommendation: "Apply.",
  };
  let requestBody: Record<string, unknown> | null = null;
  const fetcher: typeof fetch = async (_input, init) => {
    requestBody = JSON.parse(String(init?.body)) as Record<string, unknown>;
    return openAiResponse(expected);
  };
  const result = await analyzeJobWithOpenAi(job, profile, { apiKey: "test-key", model: "test-model", fetcher });
  assert.equal(result.mode, "agent");
  assert.deepEqual(result.analysis, expected);
  assert.equal(requestBody?.model, "test-model");
  assert.deepEqual((requestBody?.response_format as Record<string, unknown>)?.type, "json_schema");
});

test("OpenAI analysis failure falls back instead of creating a second behavior", async () => {
  let fallbacks = 0;
  const fetcher: typeof fetch = async () => new Response("upstream failure", { status: 500 });
  const result = await analyzeJobWithOpenAi(job, profile, {
    apiKey: "test-key",
    fetcher,
    onFallback: () => { fallbacks += 1; },
  });
  assert.equal(result.mode, "deterministic");
  assert.equal(fallbacks, 1);
  assert.deepEqual(result.analysis, deterministicAnalysis(job, profile));
});

test("OpenAI resume uses the same shared path and validates output", async () => {
  const expected = {
    tailoredResume: {
      markdown: "# QA Candidate\n\n## Summary\nRelevant QA Lead resume",
      changes: ["Prioritized QA leadership."],
      truthWarnings: [],
    },
    applicationDraft: {
      channel: "email",
      recipientGuess: "hr@example.com",
      subject: "Application — QA Lead",
      body: "Application body",
    },
  };
  const fetcher: typeof fetch = async () => openAiResponse(expected);
  const result = await adjustResumeWithOpenAi(job, profile, { apiKey: "test-key", fetcher });
  assert.equal(result.mode, "agent");
  assert.deepEqual(result.pkg, expected);
});

test("invalid OpenAI resume falls back to deterministic package", async () => {
  const fetcher: typeof fetch = async () => openAiResponse({ bad: true });
  const result = await adjustResumeWithOpenAi(job, profile, { apiKey: "test-key", fetcher });
  assert.equal(result.mode, "deterministic");
  assert.deepEqual(result.pkg, deterministicResumePackage(job, profile));
});
