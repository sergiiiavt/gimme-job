import { mkdirSync } from "node:fs";
import path from "node:path";
import { DatabaseSync, type SQLOutputValue } from "node:sqlite";
import {
  JobAnalysisSchema,
  type ApplicationDraftRecord,
  type DraftStatus,
  type JobInput,
  type JobPackage,
  type MarketReport,
  type MarketRow,
  type StoredJob,
} from "./domain.js";
import { canonicalizeUrl, jobFingerprint, jobId } from "./utils.js";

type DbRow = Record<string, SQLOutputValue>;

function jsonStringify(value: unknown): string {
  try {
    return JSON.stringify(value);
  } catch {
    return JSON.stringify({ serializationError: true });
  }
}

function nullableString(value: SQLOutputValue | undefined): string | null {
  return typeof value === "string" && value.length > 0 ? value : null;
}

function mapJob(row: DbRow): StoredJob {
  return {
    id: String(row.id),
    fingerprint: String(row.fingerprint),
    source: String(row.source),
    externalId: nullableString(row.external_id),
    title: String(row.title),
    company: String(row.company),
    location: String(row.location),
    remote: Number(row.remote) === 1,
    url: String(row.url),
    applyUrl: String(row.apply_url),
    description: String(row.description),
    salaryText: nullableString(row.salary_text),
    postedAt: nullableString(row.posted_at),
    contactEmail: nullableString(row.contact_email),
    discoveredAt: String(row.discovered_at),
    updatedAt: String(row.updated_at),
    status: String(row.status) as StoredJob["status"],
    raw: JSON.parse(String(row.raw_json || "{}")) as unknown,
  };
}

function mapDraft(row: DbRow): ApplicationDraftRecord {
  return {
    id: String(row.id),
    jobId: String(row.job_id),
    recipient: nullableString(row.recipient),
    subject: String(row.subject),
    body: String(row.body),
    status: String(row.status) as DraftStatus,
    approvedAt: nullableString(row.approved_at),
    sentAt: nullableString(row.sent_at),
    providerMessageId: nullableString(row.provider_message_id),
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at),
  };
}

export class JobDatabase {
  private readonly db: DatabaseSync;

  constructor(dbPath: string) {
    if (dbPath !== ":memory:") mkdirSync(path.dirname(dbPath), { recursive: true });
    this.db = new DatabaseSync(dbPath);
    this.db.exec("PRAGMA foreign_keys = ON; PRAGMA journal_mode = WAL;");
    this.migrate();
  }

  close(): void {
    this.db.close();
  }

  private migrate(): void {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS jobs (
        id TEXT PRIMARY KEY,
        fingerprint TEXT NOT NULL UNIQUE,
        source TEXT NOT NULL,
        external_id TEXT,
        title TEXT NOT NULL,
        company TEXT NOT NULL,
        location TEXT NOT NULL,
        remote INTEGER NOT NULL DEFAULT 0,
        url TEXT NOT NULL,
        apply_url TEXT NOT NULL,
        description TEXT NOT NULL,
        salary_text TEXT,
        posted_at TEXT,
        contact_email TEXT,
        discovered_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'NEW'
          CHECK (status IN ('NEW', 'REVIEWED', 'ARCHIVED')),
        raw_json TEXT NOT NULL
      );

      CREATE INDEX IF NOT EXISTS idx_jobs_status ON jobs(status);
      CREATE INDEX IF NOT EXISTS idx_jobs_discovered_at ON jobs(discovered_at);

      CREATE TABLE IF NOT EXISTS analyses (
        job_id TEXT PRIMARY KEY REFERENCES jobs(id) ON DELETE CASCADE,
        mode TEXT NOT NULL,
        score INTEGER NOT NULL,
        verdict TEXT NOT NULL,
        payload_json TEXT NOT NULL,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS resume_variants (
        id TEXT PRIMARY KEY,
        job_id TEXT NOT NULL UNIQUE REFERENCES jobs(id) ON DELETE CASCADE,
        markdown TEXT NOT NULL,
        changes_json TEXT NOT NULL,
        truth_warnings_json TEXT NOT NULL,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS application_drafts (
        id TEXT PRIMARY KEY,
        job_id TEXT NOT NULL UNIQUE REFERENCES jobs(id) ON DELETE CASCADE,
        recipient TEXT,
        subject TEXT NOT NULL,
        body TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'PENDING_APPROVAL'
          CHECK (status IN ('PENDING_APPROVAL', 'APPROVED', 'REJECTED', 'SENT')),
        approved_at TEXT,
        sent_at TEXT,
        provider_message_id TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );

      CREATE INDEX IF NOT EXISTS idx_application_status ON application_drafts(status);

      CREATE TABLE IF NOT EXISTS market_snapshots (
        id TEXT PRIMARY KEY,
        generated_at TEXT NOT NULL,
        payload_json TEXT NOT NULL
      );
    `);
  }

  upsertJob(input: JobInput): { id: string; inserted: boolean } {
    const now = new Date().toISOString();
    const normalized: JobInput = {
      ...input,
      title: input.title.trim() || "Untitled role",
      company: input.company.trim() || "Unknown",
      location: input.location.trim() || "Unknown",
      url: canonicalizeUrl(input.url),
      applyUrl: canonicalizeUrl(input.applyUrl || input.url),
      description: input.description.trim(),
    };
    const fingerprint = jobFingerprint(normalized);
    const proposedId = jobId(normalized);
    const existing = this.db
      .prepare("SELECT id FROM jobs WHERE fingerprint = ?")
      .get(fingerprint) as DbRow | undefined;
    const id = existing ? String(existing.id) : proposedId;

    this.db
      .prepare(`
        INSERT INTO jobs (
          id, fingerprint, source, external_id, title, company, location, remote,
          url, apply_url, description, salary_text, posted_at, contact_email,
          discovered_at, updated_at, status, raw_json
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'NEW', ?)
        ON CONFLICT(fingerprint) DO UPDATE SET
          source = CASE
            WHEN instr(',' || jobs.source || ',', ',' || excluded.source || ',') = 0
              THEN jobs.source || ',' || excluded.source
            ELSE jobs.source
          END,
          external_id = COALESCE(excluded.external_id, jobs.external_id),
          url = CASE WHEN excluded.url <> '' THEN excluded.url ELSE jobs.url END,
          apply_url = CASE WHEN excluded.apply_url <> '' THEN excluded.apply_url ELSE jobs.apply_url END,
          description = CASE
            WHEN length(excluded.description) > length(jobs.description)
              THEN excluded.description
            ELSE jobs.description
          END,
          salary_text = COALESCE(excluded.salary_text, jobs.salary_text),
          posted_at = COALESCE(excluded.posted_at, jobs.posted_at),
          contact_email = COALESCE(excluded.contact_email, jobs.contact_email),
          remote = MAX(jobs.remote, excluded.remote),
          updated_at = excluded.updated_at,
          raw_json = excluded.raw_json
      `)
      .run(
        id,
        fingerprint,
        normalized.source,
        normalized.externalId,
        normalized.title,
        normalized.company,
        normalized.location,
        normalized.remote ? 1 : 0,
        normalized.url,
        normalized.applyUrl,
        normalized.description,
        normalized.salaryText,
        normalized.postedAt,
        normalized.contactEmail,
        now,
        now,
        jsonStringify(normalized.raw),
      );

    return { id, inserted: !existing };
  }

  getJob(id: string): StoredJob | null {
    const row = this.db.prepare("SELECT * FROM jobs WHERE id = ?").get(id) as
      | DbRow
      | undefined;
    return row ? mapJob(row) : null;
  }

  listJobs(limit = 100, status?: StoredJob["status"]): StoredJob[] {
    const rows = status
      ? this.db
          .prepare("SELECT * FROM jobs WHERE status = ? ORDER BY discovered_at DESC LIMIT ?")
          .all(status, limit)
      : this.db.prepare("SELECT * FROM jobs ORDER BY discovered_at DESC LIMIT ?").all(limit);
    return (rows as DbRow[]).map(mapJob);
  }

  listJobsForAnalysis(limit = 25): StoredJob[] {
    const rows = this.db
      .prepare(`
        SELECT jobs.*
        FROM jobs
        LEFT JOIN analyses ON analyses.job_id = jobs.id
        WHERE jobs.status <> 'ARCHIVED' AND analyses.job_id IS NULL
        ORDER BY jobs.discovered_at DESC
        LIMIT ?
      `)
      .all(limit) as DbRow[];
    return rows.map(mapJob);
  }

  savePackage(jobIdValue: string, pkg: JobPackage, mode: "agent" | "deterministic"): void {
    const now = new Date().toISOString();
    const resumeId = `resume_${jobIdValue.slice(4)}`;
    const draftId = `draft_${jobIdValue.slice(4)}`;

    this.db.exec("BEGIN IMMEDIATE");
    try {
      this.db
        .prepare(`
          INSERT INTO analyses (
            job_id, mode, score, verdict, payload_json, created_at, updated_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?)
          ON CONFLICT(job_id) DO UPDATE SET
            mode = excluded.mode,
            score = excluded.score,
            verdict = excluded.verdict,
            payload_json = excluded.payload_json,
            updated_at = excluded.updated_at
        `)
        .run(
          jobIdValue,
          mode,
          pkg.analysis.score,
          pkg.analysis.verdict,
          jsonStringify(pkg.analysis),
          now,
          now,
        );

      this.db
        .prepare(`
          INSERT INTO resume_variants (
            id, job_id, markdown, changes_json, truth_warnings_json, created_at, updated_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?)
          ON CONFLICT(job_id) DO UPDATE SET
            markdown = excluded.markdown,
            changes_json = excluded.changes_json,
            truth_warnings_json = excluded.truth_warnings_json,
            updated_at = excluded.updated_at
        `)
        .run(
          resumeId,
          jobIdValue,
          pkg.tailoredResume.markdown,
          jsonStringify(pkg.tailoredResume.changes),
          jsonStringify(pkg.tailoredResume.truthWarnings),
          now,
          now,
        );

      this.db
        .prepare(`
          INSERT INTO application_drafts (
            id, job_id, recipient, subject, body, status, created_at, updated_at
          ) VALUES (?, ?, ?, ?, ?, 'PENDING_APPROVAL', ?, ?)
          ON CONFLICT(job_id) DO UPDATE SET
            recipient = CASE
              WHEN application_drafts.status IN ('PENDING_APPROVAL', 'REJECTED')
                THEN COALESCE(excluded.recipient, application_drafts.recipient)
              ELSE application_drafts.recipient
            END,
            subject = CASE
              WHEN application_drafts.status IN ('PENDING_APPROVAL', 'REJECTED')
                THEN excluded.subject
              ELSE application_drafts.subject
            END,
            body = CASE
              WHEN application_drafts.status IN ('PENDING_APPROVAL', 'REJECTED')
                THEN excluded.body
              ELSE application_drafts.body
            END,
            updated_at = excluded.updated_at
        `)
        .run(
          draftId,
          jobIdValue,
          pkg.applicationDraft.recipientGuess,
          pkg.applicationDraft.subject,
          pkg.applicationDraft.body,
          now,
          now,
        );

      this.db
        .prepare("UPDATE jobs SET status = 'REVIEWED', updated_at = ? WHERE id = ?")
        .run(now, jobIdValue);
      this.db.exec("COMMIT");
    } catch (error) {
      this.db.exec("ROLLBACK");
      throw error;
    }
  }

  getAnalysis(jobIdValue: string): ReturnType<typeof JobAnalysisSchema.parse> | null {
    const row = this.db
      .prepare("SELECT payload_json FROM analyses WHERE job_id = ?")
      .get(jobIdValue) as DbRow | undefined;
    return row
      ? JobAnalysisSchema.parse(JSON.parse(String(row.payload_json)) as unknown)
      : null;
  }

  getResume(jobIdValue: string): string | null {
    const row = this.db
      .prepare("SELECT markdown FROM resume_variants WHERE job_id = ?")
      .get(jobIdValue) as DbRow | undefined;
    return row ? String(row.markdown) : null;
  }

  getDraft(id: string): ApplicationDraftRecord | null {
    const row = this.db.prepare("SELECT * FROM application_drafts WHERE id = ?").get(id) as
      | DbRow
      | undefined;
    return row ? mapDraft(row) : null;
  }

  listDrafts(status?: DraftStatus, limit = 100): ApplicationDraftRecord[] {
    const rows = status
      ? this.db
          .prepare(
            "SELECT * FROM application_drafts WHERE status = ? ORDER BY updated_at DESC LIMIT ?",
          )
          .all(status, limit)
      : this.db
          .prepare("SELECT * FROM application_drafts ORDER BY updated_at DESC LIMIT ?")
          .all(limit);
    return (rows as DbRow[]).map(mapDraft);
  }

  listQueue(minScore = 55, limit = 100): Array<{
    draft: ApplicationDraftRecord;
    job: StoredJob;
    score: number;
    verdict: string;
  }> {
    const rows = this.db
      .prepare(`
        SELECT
          application_drafts.id AS draft_id,
          application_drafts.job_id AS draft_job_id,
          application_drafts.recipient,
          application_drafts.subject,
          application_drafts.body,
          application_drafts.status AS draft_status,
          application_drafts.approved_at,
          application_drafts.sent_at,
          application_drafts.provider_message_id,
          application_drafts.created_at AS draft_created_at,
          application_drafts.updated_at AS draft_updated_at,
          analyses.score,
          analyses.verdict,
          jobs.*
        FROM application_drafts
        JOIN analyses ON analyses.job_id = application_drafts.job_id
        JOIN jobs ON jobs.id = application_drafts.job_id
        WHERE application_drafts.status IN ('PENDING_APPROVAL', 'APPROVED')
          AND analyses.score >= ?
        ORDER BY analyses.score DESC, jobs.discovered_at DESC
        LIMIT ?
      `)
      .all(minScore, limit) as DbRow[];

    return rows.map((row) => ({
      draft: {
        id: String(row.draft_id),
        jobId: String(row.draft_job_id),
        recipient: nullableString(row.recipient),
        subject: String(row.subject),
        body: String(row.body),
        status: String(row.draft_status) as DraftStatus,
        approvedAt: nullableString(row.approved_at),
        sentAt: nullableString(row.sent_at),
        providerMessageId: nullableString(row.provider_message_id),
        createdAt: String(row.draft_created_at),
        updatedAt: String(row.draft_updated_at),
      },
      job: mapJob(row),
      score: Number(row.score),
      verdict: String(row.verdict),
    }));
  }

  setDraftRecipient(id: string, recipient: string): boolean {
    const result = this.db
      .prepare(`
        UPDATE application_drafts
        SET recipient = ?, updated_at = ?
        WHERE id = ? AND status <> 'SENT'
      `)
      .run(recipient, new Date().toISOString(), id);
    return Number(result.changes) === 1;
  }

  approveDraft(id: string): boolean {
    const now = new Date().toISOString();
    const result = this.db
      .prepare(`
        UPDATE application_drafts
        SET status = 'APPROVED', approved_at = ?, updated_at = ?
        WHERE id = ? AND status IN ('PENDING_APPROVAL', 'REJECTED')
      `)
      .run(now, now, id);
    return Number(result.changes) === 1;
  }

  rejectDraft(id: string): boolean {
    const now = new Date().toISOString();
    const result = this.db
      .prepare(`
        UPDATE application_drafts
        SET status = 'REJECTED', approved_at = NULL, updated_at = ?
        WHERE id = ? AND status IN ('PENDING_APPROVAL', 'APPROVED')
      `)
      .run(now, id);
    return Number(result.changes) === 1;
  }

  markSent(id: string, providerMessageId: string): boolean {
    const now = new Date().toISOString();
    const result = this.db
      .prepare(`
        UPDATE application_drafts
        SET status = 'SENT', sent_at = ?, provider_message_id = ?, updated_at = ?
        WHERE id = ? AND status = 'APPROVED'
      `)
      .run(now, providerMessageId, now, id);
    return Number(result.changes) === 1;
  }

  marketRows(): MarketRow[] {
    const rows = this.db
      .prepare(`
        SELECT jobs.*, analyses.payload_json AS analysis_json
        FROM jobs
        LEFT JOIN analyses ON analyses.job_id = jobs.id
        WHERE jobs.status <> 'ARCHIVED'
        ORDER BY jobs.discovered_at DESC
      `)
      .all() as DbRow[];

    return rows.map((row) => ({
      job: mapJob(row),
      analysis: row.analysis_json
        ? JobAnalysisSchema.parse(JSON.parse(String(row.analysis_json)) as unknown)
        : null,
    }));
  }

  saveMarketSnapshot(report: MarketReport): void {
    const id = `market_${report.generatedAt.replace(/[^0-9]/g, "").slice(0, 14)}`;
    this.db
      .prepare(`
        INSERT INTO market_snapshots (id, generated_at, payload_json)
        VALUES (?, ?, ?)
        ON CONFLICT(id) DO UPDATE SET payload_json = excluded.payload_json
      `)
      .run(id, report.generatedAt, jsonStringify(report));
  }

  latestMarketSnapshot(): MarketReport | null {
    const row = this.db
      .prepare(
        "SELECT payload_json FROM market_snapshots ORDER BY generated_at DESC LIMIT 1",
      )
      .get() as DbRow | undefined;
    return row ? (JSON.parse(String(row.payload_json)) as MarketReport) : null;
  }
}
