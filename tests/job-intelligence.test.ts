import assert from "node:assert/strict";
import test from "node:test";
import { register } from "tsx/esm/api";

register();

const {
  adjustResumeWithOpenAi,
  analyzeJobWithOpenAi,
  deterministicAnalysis,
  deterministicResumePackage,
  untrustedListing,
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

test("deterministic analysis covers seniority, contract and language signals", () => {
  const cases = [
    {
      candidate: { ...job, title: "Head of QA", remote: false, location: "Warsaw", description: "Part-time role. English B2. Salary $5000." },
      seniority: "Head/Principal",
      employmentType: "Part-time",
      language: "English B2",
      salary: "Mentioned",
    },
    {
      candidate: { ...job, title: "Senior QA Engineer", description: "Contract B2B. English required." },
      seniority: "Senior",
      employmentType: "Contract/B2B",
      language: "English mentioned",
      salary: "Not disclosed",
    },
    {
      candidate: { ...job, title: "Middle QA Engineer", description: "Full-time web testing." },
      seniority: "Middle",
      employmentType: "Full-time",
      language: "Not specified",
      salary: "Not disclosed",
    },
    {
      candidate: { ...job, title: "Junior QA Engineer", description: "Entry role for web testing." },
      seniority: "Junior",
      employmentType: "Not specified",
      language: "Not specified",
      salary: "Not disclosed",
    },
  ];

  for (const item of cases) {
    const result = deterministicAnalysis(item.candidate, profile);
    assert.equal(result.marketSignals.seniority, item.seniority);
    assert.equal(result.marketSignals.employmentType, item.employmentType);
    assert.equal(result.marketSignals.language, item.language);
    assert.equal(result.marketSignals.salary, item.salary);
  }
});

test("deterministic analysis distinguishes missing location, reservation and blockers", () => {
  const blockedProfile = {
    ...profile,
    preferredSignals: [],
    excludedSignals: ["gambling"],
    locations: ["Kyiv"],
  };
  const candidate = {
    ...job,
    title: "Unrelated Tester",
    remote: false,
    location: "Warsaw",
    description: "Gambling product. Cypress and Java are required.",
    salaryText: "4000 EUR",
  };
  const result = deterministicAnalysis(candidate, blockedProfile);
  assert.equal(result.marketSignals.reservation, "Not mentioned");
  assert.equal(result.marketSignals.salary, "4000 EUR");
  assert.ok(result.missingSkills.includes("Cypress"));
  assert.ok(result.missingSkills.includes("Java"));
  assert.deepEqual(result.hardBlockers, ["Excluded signal found: gambling"]);
  assert.equal(result.recommendation, "Do not apply unless the blocker is resolved.");
});

test("deterministic resume supports form applications and truth warnings", () => {
  const formJob = { ...job, contactEmail: null, description: "General QA role without detected tool keywords." };
  const placeholderProfile = {
    ...profile,
    summary: "Replace Example Company details before sending.",
    facts: [],
    education: ["QA Academy"],
    links: ["https://example.com/profile"],
  };
  const pkg = deterministicResumePackage(formJob, placeholderProfile);
  assert.equal(pkg.applicationDraft.channel, "form");
  assert.equal(pkg.applicationDraft.recipientGuess, null);
  assert.match(pkg.applicationDraft.body, /Replace Example Company/);
  assert.equal(pkg.tailoredResume.truthWarnings.length, 1);
  assert.match(pkg.tailoredResume.markdown, /## Education/);
  assert.match(pkg.tailoredResume.markdown, /https:\/\/example.com\/profile/);
});

test("missing OpenAI key uses deterministic resume too", async () => {
  const result = await adjustResumeWithOpenAi(job, profile, { apiKey: "   " });
  assert.equal(result.mode, "deterministic");
  assert.deepEqual(result.pkg, deterministicResumePackage(job, profile));
});

test("malformed or empty OpenAI structured content falls back safely", async () => {
  let fallbacks = 0;
  const malformed: typeof fetch = async () => Response.json({ choices: [{ message: { content: "{not-json" } }] });
  const malformedResult = await analyzeJobWithOpenAi(job, profile, {
    apiKey: "test-key",
    fetcher: malformed,
    onFallback: () => { fallbacks += 1; },
  });
  assert.equal(malformedResult.mode, "deterministic");

  const empty: typeof fetch = async () => Response.json({ choices: [{ message: {} }] });
  const emptyResult = await analyzeJobWithOpenAi(job, profile, {
    apiKey: "test-key",
    fetcher: empty,
    onFallback: () => { fallbacks += 1; },
  });
  assert.equal(emptyResult.mode, "deterministic");
  assert.equal(fallbacks, 2);
});

test("untrusted listing truncates oversized descriptions before AI input", () => {
  const listing = untrustedListing({ ...job, description: "x".repeat(50_000) });
  assert.equal(listing.description.length, 40_000);
  assert.equal(listing.id, "job-1");
  assert.equal(listing.contactEmail, "hr@example.com");
});