import { base64ToBytes } from "../../agent/src/resume-pdf.js";
import {
  DEFAULT_VACANCY_SOURCES,
  ensureVacancyCatalog,
  publicVacancies,
} from "./_vacancy-intake";
import {
  operationalError,
  safeErrorDetails,
  type OperationalReasonCode,
} from "./_operational-log";

type Json = Record<string, unknown>;
type Row = Record<string, unknown>;
type ObservabilityStatus = "success" | "degraded" | "failure";
type ObservabilityEventName = "job_sync" | "job_source_sync" | "job_import" | "job_analysis" | "resume_generation";
type ObservabilityMode = "agent" | "deterministic" | "mixed";
type ObservabilityEventInput = {
  event: ObservabilityEventName;
  status: ObservabilityStatus;
  source?: string | null;
  mode?: ObservabilityMode | null;
  durationMs?: number | null;
  itemsSeen?: number | null;
  itemsProcessed?: number | null;
  errorCount?: number;
  reasonCode?: OperationalReasonCode | null;
  httpStatus?: number | null;
};

export const DEFAULT_PROFILE = {
  name: "Serhii Yavtushkevych",
  headline: "Lead QA Engineer | Senior QA Engineer | QA Automation Engineer",
  summary: "QA Lead / Test Engineer with 12+ years of experience in comprehensive software testing, primarily web applications and APIs. 4+ years of test automation experience using Python, Selenium, Behave, Pytest, Playwright, and TypeScript.",
  targetRoles: ["Lead QA Engineer", "Senior QA Engineer", "QA Automation Engineer"],
  locations: ["Remote"],
  languages: ["English: Upper-Intermediate", "Ukrainian"],
  skills: ["QA leadership", "Manual testing", "Test automation", "Python", "TypeScript", "Playwright", "Selenium", "Behave", "Pytest", "API testing", "Postman", "SQL", "JMeter", "Jenkins", "Azure", "Docker", "Git", "Scrum", "Mentoring", "AI/LLM testing"],
  mustHaveSignals: ["remote"],
  preferredSignals: ["бронювання", "reservation from mobilization", "flexible", "part-time", "leadership", "automation"],
  excludedSignals: [],
  facts: [
    "12+ years of comprehensive software testing experience across web applications and APIs.",
    "4+ years of test automation experience with Python and TypeScript tooling.",
    "Led a QA team of 12 people, including planning, mentoring, quality processes, and stakeholder communication.",
  ],
  experience: [
    {
      company: "TIETO UKRAINE LTD",
      role: "Lead QA Engineer",
      period: "April 2021 - Present",
      achievements: ["Led a 12-person QA team.", "Planned testing activities and managed priorities and scope.", "Mentored employees and improved QA processes."],
    },
    {
      company: "GlobalLogic",
      role: "Senior QA Automation Engineer",
      period: "January 2019 - May 2021",
      achievements: ["Developed automated tests for web applications.", "Integrated automated tests into CI/CD.", "Performed API and database testing."],
    },
    {
      company: "GlobalLogic",
      role: "Lead QA Engineer",
      period: "January 2014 - June 2019",
      achievements: ["Performed manual testing, requirements analysis, and test design.", "Created test documentation and managed defect tracking.", "Coordinated QA activities across teams."],
    },
  ],
  education: ["Master's Degree, Computer Science - National Technical University of Ukraine, 2008 - 2014", "ISTQB Certified Software Tester - Foundation Level"],
  links: ["https://www.linkedin.com/in/serhii-yavtushkevych/"],
  contact: { email: "sergii.iavt@gmail.com", phone: "", location: "Kyiv, Ukraine" },
};

export const DEFAULT_SOURCES = {
  ...DEFAULT_VACANCY_SOURCES,
  gmail: { enabled: false, query: "label:JobAlerts newer_than:14d", maxResults: 100, allowedSendDomains: [] as string[] },
  manualFiles: [] as string[],
};

async function runtimeEnv() {
  return (await import("cloudflare:workers")).env as unknown as Record<string, unknown> & { DB?: D1Database };
}

async function db(): Promise<D1Database> {
  const runtime = await runtimeEnv();
  if (!runtime.DB) throw new Error("Cloud database is not available.");
  return runtime.DB;
}

function now(): string {
  return new Date().toISOString();
}

function rowText(value: unknown, fallback = ""): string {
  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "boolean" || typeof value === "bigint") return String(value);
  return fallback;
}

function nullableRowText(value: unknown): string | null {
  const text = rowText(value).trim();
  return text || null;
}

function rowNumber(value: unknown): number {
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}

function parse<T>(value: unknown, fallback: T): T {
  if (typeof value !== "string") return fallback;
  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
}

function cleanText(value: unknown, fallback = ""): string {
  return typeof value === "string" ? value.trim().slice(0, 60_000) : fallback;
}

function nonNegativeInteger(value: number | null | undefined): number | null {
  return typeof value === "number" && Number.isInteger(value) && value >= 0 ? value : null;
}

function safeErrorCount(value: number | null | undefined): number {
  return typeof value === "number" && Number.isInteger(value) && value >= 0 ? value : 0;
}

function safeHttpStatus(value: number | null | undefined): number | null {
  return typeof value === "number" && Number.isInteger(value) && value >= 100 && value <= 599 ? value : null;
}

async function setting<T>(key: string, fallback: T): Promise<T> {
  const row = await (await db()).prepare("SELECT value_json FROM settings WHERE key = ?").bind(key).first<Row>();
  return row ? parse(row.value_json, fallback) : fallback;
}

export async function saveSetting(key: string, value: unknown): Promise<void> {
  await (await db()).prepare(`INSERT INTO settings (key, value_json, updated_at) VALUES (?, ?, ?)
    ON CONFLICT(key) DO UPDATE SET value_json = excluded.value_json, updated_at = excluded.updated_at`)
    .bind(key, JSON.stringify(value), now())
    .run();
}

export async function recordObservabilityEvent(input: ObservabilityEventInput): Promise<void> {
  try {
    await (await db()).prepare(`INSERT INTO observability_events (
      event, status, occurred_at, source, mode, duration_ms, items_seen, items_processed,
      error_count, reason_code, http_status
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
      .bind(
        input.event,
        input.status,
        now(),
        input.source ?? null,
        input.mode ?? null,
        nonNegativeInteger(input.durationMs),
        nonNegativeInteger(input.itemsSeen),
        nonNegativeInteger(input.itemsProcessed),
        safeErrorCount(input.errorCount),
        input.reasonCode ?? null,
        safeHttpStatus(input.httpStatus),
      )
      .run();
  } catch (error) {
    operationalError("observability_storage", {
      phase: "write",
      outcome: "failure",
      target: "event",
      targetEvent: input.event,
      ...safeErrorDetails(error, "database_error"),
    });
  }
}

export async function recordObservabilitySnapshot(): Promise<void> {
  try {
    const database = await db();
    const jobCounts = await database.prepare(`SELECT
      COUNT(*) AS total_jobs,
      SUM(CASE WHEN remote = 1 THEN 1 ELSE 0 END) AS remote_jobs,
      SUM(CASE WHEN (
        instr(COALESCE(title, '') || ' ' || COALESCE(description, ''), 'бронювання') > 0 OR
        instr(COALESCE(title, '') || ' ' || COALESCE(description, ''), 'Бронювання') > 0 OR
        instr(COALESCE(title, '') || ' ' || COALESCE(description, ''), 'БРОНЮВАННЯ') > 0 OR
        lower(COALESCE(title, '') || ' ' || COALESCE(description, '')) LIKE '%reservation from mobilization%'
      ) THEN 1 ELSE 0 END) AS reservation_jobs
      FROM jobs`).first<Row>();
    const analysisCounts = await database.prepare(`WITH combined AS (
        SELECT job_id, verdict, updated_at FROM analyses
        UNION ALL
        SELECT job_id, verdict, updated_at FROM user_analyses
      ), latest AS (
        SELECT combined.job_id, combined.verdict
        FROM combined
        JOIN (SELECT job_id, MAX(updated_at) AS updated_at FROM combined GROUP BY job_id) selected
          ON selected.job_id = combined.job_id AND selected.updated_at = combined.updated_at
        GROUP BY combined.job_id
      )
      SELECT
        COUNT(*) AS analyzed_jobs,
        SUM(CASE WHEN verdict = 'strong' THEN 1 ELSE 0 END) AS strong_jobs,
        SUM(CASE WHEN verdict = 'possible' THEN 1 ELSE 0 END) AS possible_jobs,
        SUM(CASE WHEN verdict = 'weak' THEN 1 ELSE 0 END) AS weak_jobs,
        SUM(CASE WHEN verdict = 'reject' THEN 1 ELSE 0 END) AS rejected_jobs
      FROM latest`).first<Row>();

    await database.prepare(`INSERT INTO observability_snapshots (
      occurred_at, total_jobs, remote_jobs, reservation_jobs, analyzed_jobs,
      strong_jobs, possible_jobs, weak_jobs, rejected_jobs
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`)
      .bind(
        now(),
        rowNumber(jobCounts?.total_jobs),
        rowNumber(jobCounts?.remote_jobs),
        rowNumber(jobCounts?.reservation_jobs),
        rowNumber(analysisCounts?.analyzed_jobs),
        rowNumber(analysisCounts?.strong_jobs),
        rowNumber(analysisCounts?.possible_jobs),
        rowNumber(analysisCounts?.weak_jobs),
        rowNumber(analysisCounts?.rejected_jobs),
      )
      .run();
  } catch (error) {
    operationalError("observability_storage", {
      phase: "write",
      outcome: "failure",
      target: "snapshot",
      ...safeErrorDetails(error, "database_error"),
    });
  }
}

function mapJob(row: Row) {
  return {
    id: rowText(row.id),
    fingerprint: rowText(row.fingerprint),
    source: rowText(row.source),
    externalId: nullableRowText(row.external_id),
    title: rowText(row.title),
    company: rowText(row.company),
    location: rowText(row.location),
    remote: row.remote === 1 || row.remote === true,
    url: rowText(row.url),
    applyUrl: rowText(row.apply_url),
    description: rowText(row.description),
    salaryText: nullableRowText(row.salary_text),
    postedAt: nullableRowText(row.posted_at),
    contactEmail: nullableRowText(row.contact_email),
    discoveredAt: rowText(row.discovered_at),
    updatedAt: rowText(row.updated_at),
    status: rowText(row.status),
    statusUpdatedAt: nullableRowText(row.status_updated_at),
    feedback: nullableRowText(row.feedback),
    feedbackAt: nullableRowText(row.feedback_at),
    raw: parse(row.raw_json, {}),
  };
}

function mapDraft(row: Row) {
  return {
    id: rowText(row.id),
    jobId: rowText(row.job_id),
    recipient: nullableRowText(row.recipient),
    subject: rowText(row.subject),
    body: rowText(row.body),
    status: rowText(row.status),
    approvedAt: nullableRowText(row.approved_at),
    sentAt: nullableRowText(row.sent_at),
    providerMessageId: nullableRowText(row.provider_message_id),
    createdAt: rowText(row.created_at),
    updatedAt: rowText(row.updated_at),
  };
}

function countBy(values: string[]) {
  const counts = new Map<string, number>();
  for (const value of values.filter(Boolean)) counts.set(value, (counts.get(value) ?? 0) + 1);
  return [...counts]
    .map(([name, count]) => ({ name, count }))
    .sort((left, right) => right.count - left.count || left.name.localeCompare(right.name));
}

async function connections() {
  const sources = await setting<Json>("sources", DEFAULT_SOURCES);
  const runtime = await runtimeEnv();
  const gmail = (sources.gmail ?? DEFAULT_SOURCES.gmail) as Json;
  return {
    gmail: {
      configured: Boolean(runtime.GOOGLE_OAUTH_CLIENT_ID),
      connected: false,
      enabled: Boolean(gmail.enabled),
    },
    openai: {
      connected: Boolean(runtime.OPENAI_API_KEY),
      model: rowText(runtime.OPENAI_MODEL, "gpt-5.6"),
    },
    boards: {
      rss: Array.isArray(sources.rss) ? sources.rss.length : 0,
      greenhouse: Array.isArray(sources.greenhouse) ? sources.greenhouse.length : 0,
      lever: Array.isArray(sources.lever) ? sources.lever.length : 0,
      ashby: Array.isArray(sources.ashby) ? sources.ashby.length : 0,
      workUa: Array.isArray(sources.workUa) ? sources.workUa.length : 0,
      robotaUa: Array.isArray(sources.robotaUa) ? sources.robotaUa.length : 0,
      lobbyX: Array.isArray(sources.lobbyX) ? sources.lobbyX.length : 0,
    },
  };
}

export async function publicJobs() {
  await ensureVacancyCatalog();
  return publicVacancies();
}

const INTERVIEW_PROGRESS_STATUSES = new Set(["PLANNED", "LEARNING", "LEARNED"]);

function validQuestionId(value: string): boolean {
  return /^[a-z0-9][a-z0-9-]{0,119}$/.test(value);
}

export async function interviewProgress() {
  const result = await (await db()).prepare(`SELECT question_id, status, updated_at
    FROM interview_progress ORDER BY updated_at DESC`).all<Row>();
  return {
    progress: result.results.map((row) => ({
      questionId: rowText(row.question_id),
      status: rowText(row.status),
      updatedAt: rowText(row.updated_at),
    })),
  };
}

export async function updateInterviewProgress(questionId: string, input: Json) {
  if (!validQuestionId(questionId)) throw new Error("Unsupported question identifier.");
  const database = await db();
  if (input.status === null) {
    await database.prepare("DELETE FROM interview_progress WHERE question_id = ?").bind(questionId).run();
    return { questionId, status: null, updatedAt: null };
  }

  const status = cleanText(input.status).toUpperCase();
  if (!INTERVIEW_PROGRESS_STATUSES.has(status)) throw new Error("Unsupported interview progress status.");
  const updatedAt = now();
  await database.prepare(`INSERT INTO interview_progress (question_id, status, updated_at) VALUES (?, ?, ?)
    ON CONFLICT(question_id) DO UPDATE SET status = excluded.status, updated_at = excluded.updated_at`)
    .bind(questionId, status, updatedAt)
    .run();
  return { questionId, status, updatedAt };
}

export async function settingsView() {
  return {
    profile: await setting("profile", DEFAULT_PROFILE),
    sources: await setting("sources", DEFAULT_SOURCES),
    connections: await connections(),
  };
}

function stringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.map((item) => rowText(item)).filter(Boolean);
}

export async function dashboard(request?: Request) {
  await ensureVacancyCatalog();
  const database = await db();
  const [jobResult, analysisResult, resumeResult, draftResult, conn] = await Promise.all([
    database.prepare("SELECT * FROM jobs ORDER BY COALESCE(posted_at, discovered_at) DESC, discovered_at DESC LIMIT 500").all<Row>(),
    database.prepare("SELECT * FROM analyses").all<Row>(),
    database.prepare("SELECT * FROM resume_variants").all<Row>(),
    database.prepare("SELECT * FROM application_drafts").all<Row>(),
    connections(),
  ]);
  const analyses = new Map(analysisResult.results.map((row) => [rowText(row.job_id), parse<Json>(row.payload_json, {})]));
  const resumes = new Map(resumeResult.results.map((row) => [rowText(row.job_id), rowText(row.markdown)]));
  const resumePdfs = new Set(resumeResult.results.filter((row) => row.pdf_base64).map((row) => rowText(row.job_id)));
  const drafts = new Map(draftResult.results.map((row) => [rowText(row.job_id), mapDraft(row)]));
  const jobs = jobResult.results.map(mapJob).map((job) => ({
    ...job,
    analysis: analyses.get(job.id) ?? null,
    resume: resumes.get(job.id) ?? null,
    resumePdf: resumePdfs.has(job.id),
    draft: drafts.get(job.id) ?? null,
  }));
  const analyzed = jobs.filter((job) => job.analysis);
  const requirements = analyzed.flatMap((job) => stringArray(job.analysis?.requirementKeywords));
  const gaps = analyzed.flatMap((job) => stringArray(job.analysis?.missingSkills));
  const verdicts = analyzed.reduce<Record<string, number>>((acc, job) => {
    const verdict = rowText(job.analysis?.verdict, "weak");
    acc[verdict] = (acc[verdict] ?? 0) + 1;
    return acc;
  }, { strong: 0, possible: 0, weak: 0, reject: 0 });
  const statuses = draftResult.results.reduce<Record<string, number>>((acc, row) => {
    const status = rowText(row.status);
    if (status) acc[status] = (acc[status] ?? 0) + 1;
    return acc;
  }, {});
  const percent = (count: number) => jobs.length ? Math.round(count / jobs.length * 100) : 0;

  return {
    jobs,
    market: {
      totalJobs: jobs.length,
      analyzedJobs: analyzed.length,
      remoteShare: percent(jobs.filter((job) => job.remote).length),
      salaryDisclosureShare: percent(jobs.filter((job) => job.salaryText).length),
      reservationMentions: jobs.filter((job) => /бронювання|reservation from mobilization/i.test(`${job.title} ${job.description}`)).length,
      topSources: countBy(jobs.map((job) => job.source)),
      topRoles: countBy(jobs.map((job) => job.title)),
      topLocations: countBy(jobs.map((job) => job.location)),
      topRequirements: countBy(requirements),
      topCandidateGaps: countBy(gaps),
      verdicts,
    },
    statuses,
    connections: conn,
    authenticated: request?.headers.get("x-gimmejob-authenticated") === "1",
    generatedAt: now(),
  };
}

export async function resumePdf(jobId: string): Promise<Uint8Array | null> {
  const row = await (await db()).prepare("SELECT pdf_base64 FROM resume_variants WHERE job_id = ?").bind(jobId).first<Row>();
  const pdfBase64 = row?.pdf_base64;
  return typeof pdfBase64 === "string" && pdfBase64 ? base64ToBytes(pdfBase64) : null;
}

export async function updateDraft(id: string, action: string, recipient?: string): Promise<void> {
  const database = await db();
  const draft = await database.prepare("SELECT * FROM application_drafts WHERE id = ?").bind(id).first<Row>();
  if (!draft) throw new Error("Application draft not found.");
  const status = rowText(draft.status);
  const currentRecipient = nullableRowText(draft.recipient);
  const timestamp = now();

  if (action === "approve") {
    const nextRecipient = recipient || currentRecipient;
    if (!nextRecipient) throw new Error("Add a recipient before approval.");
    await database.prepare("UPDATE application_drafts SET recipient = ?, status = 'APPROVED', approved_at = ?, updated_at = ? WHERE id = ?")
      .bind(nextRecipient, timestamp, timestamp, id)
      .run();
    return;
  }
  if (action === "reject") {
    if (status === "SENT") throw new Error("A sent application cannot be rejected.");
    await database.prepare("UPDATE application_drafts SET status = 'REJECTED', approved_at = NULL, updated_at = ? WHERE id = ?")
      .bind(timestamp, id)
      .run();
    return;
  }
  if (action === "send") {
    if (status !== "APPROVED") throw new Error("Approve this application before sending.");
    throw new Error("Cloud Gmail sending is not configured yet. The application remains APPROVED and nothing was sent.");
  }
  throw new Error("Unsupported draft action.");
}

const JOB_STATUSES = new Set(["NEW", "INTERESTED", "APPLIED", "INTERVIEW", "OFFER", "REJECTED", "NOT_INTERESTED", "ARCHIVED"]);
const JOB_FEEDBACK = new Set(["RELEVANT", "NOT_RELEVANT"]);

function requestedStatus(input: Json, currentStatus: string, hasStatus: boolean): string {
  return hasStatus ? cleanText(input.status).toUpperCase() : currentStatus;
}

function requestedFeedback(input: Json, currentFeedback: string | null, hasFeedback: boolean): string | null {
  if (!hasFeedback) return currentFeedback;
  if (input.feedback === null || input.feedback === "") return null;
  return cleanText(input.feedback).toUpperCase();
}

function changedAt(changed: boolean, valuePresent: boolean, timestamp: string, previous: unknown): string | null {
  if (!changed) return nullableRowText(previous);
  return valuePresent ? timestamp : null;
}

export async function updateJobTracking(id: string, input: Json) {
  const database = await db();
  const row = await database.prepare("SELECT status, status_updated_at, feedback, feedback_at FROM jobs WHERE id = ?").bind(id).first<Row>();
  if (!row) throw new Error("Job not found.");

  const hasStatus = Object.prototype.hasOwnProperty.call(input, "status");
  const hasFeedback = Object.prototype.hasOwnProperty.call(input, "feedback");
  if (!hasStatus && !hasFeedback) throw new Error("Provide status or feedback.");

  const currentStatus = rowText(row.status);
  const nextStatus = requestedStatus(input, currentStatus, hasStatus);
  if (!JOB_STATUSES.has(nextStatus)) throw new Error("Unsupported job status.");

  const currentFeedback = nullableRowText(row.feedback);
  const nextFeedback = requestedFeedback(input, currentFeedback, hasFeedback);
  if (nextFeedback !== null && !JOB_FEEDBACK.has(nextFeedback)) throw new Error("Unsupported job feedback.");

  const timestamp = now();
  const statusUpdatedAt = changedAt(nextStatus !== currentStatus, true, timestamp, row.status_updated_at);
  const feedbackAt = changedAt(nextFeedback !== currentFeedback, Boolean(nextFeedback), timestamp, row.feedback_at);

  await database.prepare("UPDATE jobs SET status = ?, status_updated_at = ?, feedback = ?, feedback_at = ?, updated_at = ? WHERE id = ?")
    .bind(nextStatus, statusUpdatedAt, nextFeedback, feedbackAt, timestamp, id)
    .run();
  return { id, status: nextStatus, feedback: nextFeedback, statusUpdatedAt, feedbackAt };
}

function errorStatus(message: string): number {
  if (/not found/i.test(message)) return 404;
  if (/requires|limited|allowed|approve|recipient|required|unsupported/i.test(message)) return 400;
  return 500;
}

export function jsonError(error: unknown) {
  const message = error instanceof Error ? error.message : rowText(error, "Unknown error");
  return Response.json({ ok: false, error: message }, { status: errorStatus(message) });
}

export async function readPayload(request: Request) {
  const length = Number(request.headers.get("content-length") ?? 0);
  if (length > 2_000_000) throw new Error("Request body is too large.");
  const value = await request.json() as unknown;
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("JSON body must be an object.");
  return value as Json;
}