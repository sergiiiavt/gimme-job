import assert from "node:assert/strict";
import test from "node:test";
import { resolveEmailEvent } from "../app/internal/n8n/email-events/vacancy-resolver.ts";

type EventRow = {
  id: string;
  user_id: string;
  received_at: string;
  sender_email: string | null;
  subject: string;
  text_excerpt: string | null;
  classification: string;
  classification_confidence: number | null;
  company: string | null;
  job_title: string | null;
  job_id: string | null;
  thread_id: string | null;
};

type CandidateRow = {
  id: string;
  title: string;
  company: string;
  url: string;
  apply_url: string;
  external_id: string | null;
  status: string;
  status_updated_at: string | null;
};

type Scenario = {
  event: EventRow;
  candidateById?: Record<string, CandidateRow>;
  threadJobId?: string | null;
  identifierCandidates?: CandidateRow[];
  fuzzyCandidates?: CandidateRow[];
};

function candidate(overrides: Partial<CandidateRow> = {}): CandidateRow {
  return {
    id: "job-1",
    title: "QA Lead",
    company: "Example",
    url: "https://jobs.example/qa-lead",
    apply_url: "https://jobs.example/qa-lead/apply",
    external_id: "QA-12345",
    status: "APPLIED",
    status_updated_at: "2026-08-18T10:00:00.000Z",
    ...overrides,
  };
}

function event(overrides: Partial<EventRow> = {}): EventRow {
  return {
    id: "evt-1",
    user_id: "user-1",
    received_at: "2026-08-19T10:00:00.000Z",
    sender_email: "recruiter@example.com",
    subject: "QA Lead update",
    text_excerpt: "Update about the QA Lead role.",
    classification: "REJECTION",
    classification_confidence: 0.9,
    company: "Example",
    job_title: "QA Lead",
    job_id: null,
    thread_id: null,
    ...overrides,
  };
}

function scenarioDb(scenario: Scenario) {
  const runs: Array<{ sql: string; values: unknown[] }> = [];
  const database = {
    prepare(sql: string) {
      let values: unknown[] = [];
      const statement = {
        bind(...bound: unknown[]) {
          values = bound;
          return statement;
        },
        async first<T>() {
          if (sql.includes("FROM user_email_events") && sql.includes("WHERE user_id = ? AND id = ?")) {
            return scenario.event as T;
          }
          if (sql.includes("FROM user_email_events") && sql.includes("thread_id = ?")) {
            return scenario.threadJobId ? { job_id: scenario.threadJobId } as T : null;
          }
          if (sql.includes("WHERE jobs.id = ?")) {
            const jobId = String(values[1] ?? "");
            return (scenario.candidateById?.[jobId] ?? null) as T | null;
          }
          return null;
        },
        async all<T>() {
          if (sql.includes("instr(?, lower(jobs.url))")) {
            return { results: (scenario.identifierCandidates ?? []) as T[] };
          }
          if (sql.includes("COALESCE(tracking.status, 'NEW') IN")) {
            return { results: (scenario.fuzzyCandidates ?? []) as T[] };
          }
          return { results: [] as T[] };
        },
        async run() {
          runs.push({ sql, values });
          return { success: true, meta: { changes: 1 } };
        },
      };
      return statement;
    },
  } as unknown as D1Database;
  return { database, runs };
}

test("non hiring-process email is marked not applicable", async () => {
  const { database, runs } = scenarioDb({
    event: event({ classification: "JOB_ALERT", classification_confidence: 1 }),
  });

  const result = await resolveEmailEvent(database, "user-1", "evt-1");
  assert.equal(result.matchStatus, "NOT_APPLICABLE");
  assert.equal(result.statusNote, "not_applicable");
  assert.ok(runs.some((run) => /UPDATE user_email_events/.test(run.sql) && run.values.includes("NOT_APPLICABLE")));
});

test("existing email vacancy link is reused and a same-status event is a no-op", async () => {
  const linked = candidate({ status: "REJECTED" });
  const { database, runs } = scenarioDb({
    event: event({ job_id: linked.id }),
    candidateById: { [linked.id]: linked },
  });

  const result = await resolveEmailEvent(database, "user-1", "evt-1");
  assert.equal(result.matchStatus, "MATCHED");
  assert.equal(result.matchMethod, "EXISTING_LINK");
  assert.equal(result.statusNote, "already_REJECTED");
  assert.equal(result.statusChange, null);
  assert.ok(!runs.some((run) => /INSERT INTO job_tracking/.test(run.sql)));
});

test("a linked email thread resolves a test-task event without forcing pipeline status", async () => {
  const linked = candidate({ id: "job-thread", status: "APPLIED" });
  const { database } = scenarioDb({
    event: event({
      classification: "TEST_TASK",
      classification_confidence: 0.9,
      thread_id: "root@example.com",
      company: null,
      job_title: null,
    }),
    threadJobId: linked.id,
    candidateById: { [linked.id]: linked },
  });

  const result = await resolveEmailEvent(database, "user-1", "evt-1");
  assert.equal(result.matchStatus, "MATCHED");
  assert.equal(result.jobId, linked.id);
  assert.equal(result.matchMethod, "THREAD");
  assert.equal(result.statusNote, "no_status_change");
  assert.equal(result.statusChange, null);
});

test("one hard identifier resolves the vacancy and applies an allowed offer transition", async () => {
  const identified = candidate({ id: "job-offer", status: "INTERVIEW" });
  const { database, runs } = scenarioDb({
    event: event({
      classification: "OFFER",
      classification_confidence: 0.93,
      subject: `Offer for ${identified.url}`,
    }),
    identifierCandidates: [identified],
  });

  const result = await resolveEmailEvent(database, "user-1", "evt-1");
  assert.equal(result.matchStatus, "MATCHED");
  assert.equal(result.matchMethod, "IDENTIFIER");
  assert.deepEqual(result.statusChange, { before: "INTERVIEW", after: "OFFER" });
  assert.ok(runs.some((run) => /INSERT INTO job_tracking/.test(run.sql) && run.values.includes("OFFER")));
});

test("multiple hard identifier candidates remain ambiguous", async () => {
  const first = candidate({ id: "job-a" });
  const second = candidate({ id: "job-b", title: "Senior QA" });
  const { database, runs } = scenarioDb({
    event: event({ subject: "Application update with duplicated identifier" }),
    identifierCandidates: [first, second],
  });

  const result = await resolveEmailEvent(database, "user-1", "evt-1");
  assert.equal(result.matchStatus, "AMBIGUOUS");
  assert.equal(result.matchMethod, "IDENTIFIER");
  assert.equal(result.statusNote, "multiple_identifier_matches");
  assert.equal(result.jobId, null);
  assert.equal(result.candidates.length, 2);
  assert.ok(!runs.some((run) => /INSERT INTO job_tracking/.test(run.sql)));
});

test("no identifier or composite candidates produces an unresolved event", async () => {
  const { database } = scenarioDb({
    event: event({ company: null, job_title: null, sender_email: "unknown@ats.example" }),
    identifierCandidates: [],
    fuzzyCandidates: [],
  });

  const result = await resolveEmailEvent(database, "user-1", "evt-1");
  assert.equal(result.matchStatus, "UNRESOLVED");
  assert.equal(result.matchMethod, "COMPOSITE");
  assert.equal(result.statusNote, "no_candidate_match");
  assert.equal(result.confidence, null);
});

test("manual linking cannot force an unsupported pipeline transition", async () => {
  const chosen = candidate({ id: "job-manual", status: "OFFER" });
  const { database, runs } = scenarioDb({
    event: event({ classification: "INTERVIEW", classification_confidence: 0.95 }),
    candidateById: { [chosen.id]: chosen },
  });

  const result = await resolveEmailEvent(database, "user-1", "evt-1", {
    forcedJobId: chosen.id,
    actorType: "user",
    actorLabel: "You",
  });
  assert.equal(result.matchStatus, "MATCHED");
  assert.equal(result.matchMethod, "MANUAL");
  assert.equal(result.statusNote, "blocked_OFFER_to_INTERVIEW");
  assert.equal(result.statusChange, null);
  assert.ok(!runs.some((run) => /INSERT INTO job_tracking/.test(run.sql)));
});
