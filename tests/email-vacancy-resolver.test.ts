import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
  scoreVacancyCandidate,
  selectVacancyCandidate,
} from "../app/internal/n8n/email-events/vacancy-resolver.ts";

function candidate(overrides: Partial<{
  id: string;
  title: string;
  company: string;
  url: string;
  apply_url: string;
  external_id: string | null;
  status: string;
  status_updated_at: string | null;
}> = {}) {
  return {
    id: "job-1",
    title: "Lead Test Automation Engineer",
    company: "SoftServe",
    url: "https://example.test/job-1",
    apply_url: "https://example.test/job-1/apply",
    external_id: "REQ-12345",
    status: "APPLIED",
    status_updated_at: "2026-08-18T10:00:00.000Z",
    ...overrides,
  };
}

test("company plus exact title produces a strong composite match", () => {
  const result = scoreVacancyCandidate(
    { company: "SoftServe", job_title: "Lead Test Automation Engineer", sender_email: "recruiter@ats.example" },
    candidate(),
    { exactTitleCount: 2, exactCompanyCount: 2 },
  );
  assert.equal(result.score, 80);
  assert.ok(result.signals.includes("company_exact"));
  assert.ok(result.signals.includes("title_exact"));
});

test("one company with several active vacancies does not match on company alone", () => {
  const result = selectVacancyCandidate(
    { company: "Example", job_title: null, sender_email: "jobs@ats.example" },
    [
      candidate({ id: "job-a", company: "Example", title: "QA Lead" }),
      candidate({ id: "job-b", company: "Example", title: "Senior QA" }),
    ],
  );
  assert.equal(result.matchStatus, "AMBIGUOUS");
  assert.equal(result.selected, null);
});

test("missing company can still match a unique exact active title", () => {
  const result = selectVacancyCandidate(
    { company: null, job_title: "QA System Lead", sender_email: "antonina@teamtailor-mail.com" },
    [
      candidate({ id: "job-a", company: "3Shape", title: "QA System Lead" }),
      candidate({ id: "job-b", company: "Other", title: "Automation QA" }),
    ],
  );
  assert.equal(result.matchStatus, "MATCHED");
  assert.equal(result.selected?.id, "job-a");
  assert.equal(result.selected?.score, 80);
});

test("same title at two companies stays ambiguous when company is missing", () => {
  const result = selectVacancyCandidate(
    { company: null, job_title: "Senior QA Engineer", sender_email: "recruiter@ats.example" },
    [
      candidate({ id: "job-a", company: "Alpha", title: "Senior QA Engineer" }),
      candidate({ id: "job-b", company: "Beta", title: "Senior QA Engineer" }),
    ],
  );
  assert.equal(result.matchStatus, "AMBIGUOUS");
  assert.equal(result.selected, null);
});

test("weak partial title does not auto-update a vacancy", () => {
  const result = selectVacancyCandidate(
    { company: null, job_title: "QA Engineer", sender_email: "jobs@unknown.example" },
    [candidate({ title: "Senior Automation QA Engineer" })],
  );
  assert.notEqual(result.matchStatus, "MATCHED");
});

test("hard external-id matching requires a distinctive identifier, not a generic number", async () => {
  const source = await readFile(new URL("../app/internal/n8n/email-events/vacancy-resolver.ts", import.meta.url), "utf8");
  assert.match(source, /external_id GLOB '\*\[A-Za-z\]\*'/);
});

test("resolution migration stores explainable match state", async () => {
  const sql = await readFile(new URL("../drizzle/0015_email_vacancy_resolution.sql", import.meta.url), "utf8");
  for (const column of [
    "match_status",
    "match_method",
    "match_confidence",
    "match_evidence_json",
    "resolved_at",
    "status_applied_at",
    "status_apply_note",
  ]) {
    assert.ok(sql.includes("ADD COLUMN `" + column + "`"));
  }
  assert.match(sql, /user_email_events_user_match_status_idx/);
});
