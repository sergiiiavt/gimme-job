type Json = Record<string, unknown>;
type Row = Record<string, unknown>;

type PublicJobsPayload = {
  jobs: Json[];
  generatedAt?: string;
};

export type TenantRequestContext = {
  multiUser: boolean;
  userId: string | null;
  authenticated: boolean;
};

type TenantStateDeps = {
  database: D1Database;
  runtime?: Record<string, unknown>;
  defaultProfile?: Json;
  defaultSources?: Json;
  loadPublicJobs?: () => Promise<PublicJobsPayload>;
};

const INTERVIEW_PROGRESS_STATUSES = new Set(["PLANNED", "LEARNING", "LEARNED"]);
const JOB_STATUSES = new Set(["NEW", "INTERESTED", "APPLIED", "INTERVIEW", "OFFER", "REJECTED", "NOT_INTERESTED", "ARCHIVED"]);
const JOB_FEEDBACK = new Set(["RELEVANT", "NOT_RELEVANT"]);

function now(): string {
  return new Date().toISOString();
}

function parse<T>(value: unknown, fallback: T): T {
  try {
    return JSON.parse(String(value)) as T;
  } catch {
    return fallback;
  }
}

function cleanText(value: unknown, fallback = ""): string {
  return typeof value === "string" ? value.trim().slice(0, 60_000) : fallback;
}

function validQuestionId(value: string): boolean {
  return /^[a-z0-9][a-z0-9-]{0,119}$/.test(value);
}

function countBy(values: string[]): Array<{ name: string; count: number }> {
  const counts = new Map<string, number>();
  for (const value of values.filter(Boolean)) counts.set(value, (counts.get(value) ?? 0) + 1);
  return [...counts]
    .map(([name, count]) => ({ name, count }))
    .sort((left, right) => right.count - left.count || left.name.localeCompare(right.name));
}

function base64ToBytes(value: string): Uint8Array {
  const binary = atob(value);
  return Uint8Array.from(binary, (character) => character.charCodeAt(0));
}

function mapDraft(row: Row): Json {
  return {
    id: String(row.id),
    jobId: String(row.job_id),
    recipient: row.recipient ? String(row.recipient) : null,
    subject: String(row.subject),
    body: String(row.body),
    status: String(row.status),
    approvedAt: row.approved_at ? String(row.approved_at) : null,
    sentAt: row.sent_at ? String(row.sent_at) : null,
    providerMessageId: row.provider_message_id ? String(row.provider_message_id) : null,
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at),
  };
}

export function tenantRequestContext(request: Request): TenantRequestContext {
  const multiUser = request.headers.get("x-gimmejob-auth-mode") === "multi-user";
  const rawUserId = request.headers.get("x-gimmejob-user-id")?.trim() ?? "";
  const userId = rawUserId || null;
  return {
    multiUser,
    userId,
    authenticated: request.headers.get("x-gimmejob-authenticated") === "1" && (!multiUser || Boolean(userId)),
  };
}

export function requireTenantUser(request: Request): string {
  const context = tenantRequestContext(request);
  if (!context.multiUser) throw new Error("Tenant authentication is not enabled for this request.");
  if (!context.userId || !context.authenticated) throw new Error("Authentication required.");
  return context.userId;
}

export function tenantUnavailable(operation: string): Response {
  return Response.json(
    {
      error: `${operation} is temporarily disabled in multi-user mode until its tenant-scoped implementation is enabled.`,
    },
    {
      status: 501,
      headers: { "cache-control": "no-store" },
    },
  );
}

export function createTenantState(deps: TenantStateDeps) {
  const database = deps.database;
  const runtime = deps.runtime ?? {};
  const defaultProfile = deps.defaultProfile ?? {};
  const defaultSources = deps.defaultSources ?? {};
  const loadPublicJobs = deps.loadPublicJobs ?? (async () => ({ jobs: [] }));

  async function setting<T>(userId: string, key: string, fallback: T): Promise<T> {
    const row = await database.prepare("SELECT value_json FROM user_settings WHERE user_id = ? AND key = ?")
      .bind(userId, key)
      .first<Row>();
    return row ? parse(row.value_json, fallback) : fallback;
  }

  async function saveSetting(userId: string, key: string, value: unknown): Promise<void> {
    await database.prepare(`INSERT INTO user_settings (user_id, key, value_json, updated_at) VALUES (?, ?, ?, ?)
      ON CONFLICT(user_id, key) DO UPDATE SET value_json = excluded.value_json, updated_at = excluded.updated_at`)
      .bind(userId, key, JSON.stringify(value), now())
      .run();
  }

  async function connections(userId: string, sourcesOverride?: Json) {
    const sources = sourcesOverride ?? await setting<Json>(userId, "sources", defaultSources);
    const gmail = await database.prepare("SELECT email, status FROM gmail_connections WHERE user_id = ? LIMIT 1")
      .bind(userId)
      .first<Row>();
    return {
      gmail: {
        configured: Boolean(runtime.GOOGLE_OAUTH_CLIENT_ID),
        connected: Boolean(gmail && String(gmail.status) === "ACTIVE"),
        email: gmail?.email ? String(gmail.email) : null,
        enabled: Boolean((sources.gmail as Json | undefined)?.enabled),
      },
      openai: {
        connected: Boolean(runtime.OPENAI_API_KEY),
        model: String(runtime.OPENAI_MODEL ?? "gpt-5.6"),
      },
      boards: {
        rss: Array.isArray(sources.rss) ? sources.rss.length : 0,
        greenhouse: Array.isArray(sources.greenhouse) ? sources.greenhouse.length : 0,
        lever: Array.isArray(sources.lever) ? sources.lever.length : 0,
        ashby: Array.isArray(sources.ashby) ? sources.ashby.length : 0,
        workUa: Array.isArray(sources.workUa) ? sources.workUa.length : 0,
        lobbyX: Array.isArray(sources.lobbyX) ? sources.lobbyX.length : 0,
      },
    };
  }

  async function settingsView(userId: string) {
    const sources = await setting<Json>(userId, "sources", defaultSources);
    return {
      profile: await setting(userId, "profile", defaultProfile),
      sources,
      connections: await connections(userId, sources),
    };
  }

  async function interviewProgress(userId: string) {
    const result = await database.prepare(`SELECT question_id, status, updated_at
      FROM user_interview_progress WHERE user_id = ? ORDER BY updated_at DESC`)
      .bind(userId)
      .all<Row>();
    return {
      progress: result.results.map((row) => ({
        questionId: String(row.question_id),
        status: String(row.status),
        updatedAt: String(row.updated_at),
      })),
    };
  }

  async function updateInterviewProgress(userId: string, questionId: string, input: Json) {
    if (!validQuestionId(questionId)) throw new Error("Unsupported question identifier.");
    if (input.status === null) {
      await database.prepare("DELETE FROM user_interview_progress WHERE user_id = ? AND question_id = ?")
        .bind(userId, questionId)
        .run();
      return { questionId, status: null, updatedAt: null };
    }

    const status = cleanText(input.status).toUpperCase();
    if (!INTERVIEW_PROGRESS_STATUSES.has(status)) throw new Error("Unsupported interview progress status.");
    const updatedAt = now();
    await database.prepare(`INSERT INTO user_interview_progress (user_id, question_id, status, updated_at) VALUES (?, ?, ?, ?)
      ON CONFLICT(user_id, question_id) DO UPDATE SET status = excluded.status, updated_at = excluded.updated_at`)
      .bind(userId, questionId, status, updatedAt)
      .run();
    return { questionId, status, updatedAt };
  }

  async function updateJobTracking(userId: string, jobId: string, input: Json) {
    const job = await database.prepare("SELECT id FROM jobs WHERE id = ? LIMIT 1").bind(jobId).first<Row>();
    if (!job) throw new Error("Job not found.");

    const current = await database.prepare(`SELECT status, status_updated_at, feedback, feedback_at
      FROM job_tracking WHERE user_id = ? AND job_id = ? LIMIT 1`)
      .bind(userId, jobId)
      .first<Row>();

    const hasStatus = Object.prototype.hasOwnProperty.call(input, "status");
    const hasFeedback = Object.prototype.hasOwnProperty.call(input, "feedback");
    if (!hasStatus && !hasFeedback) throw new Error("Provide status or feedback.");

    const currentStatus = current?.status ? String(current.status) : "NEW";
    const nextStatus = hasStatus ? cleanText(input.status).toUpperCase() : currentStatus;
    if (!JOB_STATUSES.has(nextStatus)) throw new Error("Unsupported job status.");

    const currentFeedback = current?.feedback ? String(current.feedback) : null;
    const requestedFeedback = hasFeedback
      ? input.feedback === null || input.feedback === "" ? null : cleanText(input.feedback).toUpperCase()
      : currentFeedback;
    if (requestedFeedback !== null && !JOB_FEEDBACK.has(requestedFeedback)) throw new Error("Unsupported job feedback.");

    const timestamp = now();
    const statusUpdatedAt = nextStatus !== currentStatus
      ? timestamp
      : current?.status_updated_at ? String(current.status_updated_at) : null;
    const feedbackAt = requestedFeedback !== currentFeedback
      ? requestedFeedback ? timestamp : null
      : current?.feedback_at ? String(current.feedback_at) : null;

    await database.prepare(`INSERT INTO job_tracking (
      user_id, job_id, status, status_updated_at, feedback, feedback_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(user_id, job_id) DO UPDATE SET
      status = excluded.status,
      status_updated_at = excluded.status_updated_at,
      feedback = excluded.feedback,
      feedback_at = excluded.feedback_at,
      updated_at = excluded.updated_at`)
      .bind(userId, jobId, nextStatus, statusUpdatedAt, requestedFeedback, feedbackAt, timestamp)
      .run();

    return { id: jobId, status: nextStatus, feedback: requestedFeedback, statusUpdatedAt, feedbackAt };
  }

  async function resumePdf(userId: string, jobId: string): Promise<Uint8Array | null> {
    const row = await database.prepare("SELECT pdf_base64 FROM user_resume_variants WHERE user_id = ? AND job_id = ? LIMIT 1")
      .bind(userId, jobId)
      .first<Row>();
    const pdfBase64 = row?.pdf_base64;
    return pdfBase64 && typeof pdfBase64 === "string" ? base64ToBytes(pdfBase64) : null;
  }

  async function updateDraft(userId: string, id: string, action: string, recipient?: string): Promise<void> {
    const draft = await database.prepare("SELECT * FROM user_application_drafts WHERE user_id = ? AND id = ? LIMIT 1")
      .bind(userId, id)
      .first<Row>();
    if (!draft) throw new Error("Application draft not found.");
    const status = String(draft.status);
    const timestamp = now();

    if (action === "approve") {
      if (!recipient && !draft.recipient) throw new Error("Add a recipient before approval.");
      await database.prepare(`UPDATE user_application_drafts
        SET recipient = ?, status = 'APPROVED', approved_at = ?, updated_at = ?
        WHERE user_id = ? AND id = ?`)
        .bind(recipient || draft.recipient, timestamp, timestamp, userId, id)
        .run();
      return;
    }
    if (action === "reject") {
      if (status === "SENT") throw new Error("A sent application cannot be rejected.");
      await database.prepare(`UPDATE user_application_drafts
        SET status = 'REJECTED', approved_at = NULL, updated_at = ?
        WHERE user_id = ? AND id = ?`)
        .bind(timestamp, userId, id)
        .run();
      return;
    }
    if (action === "send") {
      if (status !== "APPROVED") throw new Error("Approve this application before sending.");
      throw new Error("Cloud Gmail sending is not configured yet. The application remains APPROVED and nothing was sent.");
    }
    throw new Error("Unsupported draft action.");
  }

  async function dashboard(userId: string | null, request?: Request) {
    const publicPayload = await loadPublicJobs();
    const baseJobs = publicPayload.jobs;

    if (!userId) {
      const percent = (count: number) => baseJobs.length ? Math.round(count / baseJobs.length * 100) : 0;
      return {
        jobs: baseJobs.map((job) => ({
          ...job,
          status: "NEW",
          statusUpdatedAt: null,
          feedback: null,
          feedbackAt: null,
          analysis: null,
          resume: null,
          resumePdf: false,
          draft: null,
        })),
        market: {
          totalJobs: baseJobs.length,
          analyzedJobs: 0,
          remoteShare: percent(baseJobs.filter((job) => Boolean(job.remote)).length),
          salaryDisclosureShare: percent(baseJobs.filter((job) => Boolean(job.salaryText)).length),
          reservationMentions: baseJobs.filter((job) => /бронювання|reservation from mobilization/i.test(`${String(job.title ?? "")} ${String(job.description ?? "")}`)).length,
          topSources: countBy(baseJobs.map((job) => String(job.source ?? ""))),
          topRoles: countBy(baseJobs.map((job) => String(job.title ?? ""))),
          topLocations: countBy(baseJobs.map((job) => String(job.location ?? ""))),
          topRequirements: [],
          topCandidateGaps: [],
          verdicts: { strong: 0, possible: 0, weak: 0, reject: 0 },
        },
        statuses: {},
        connections: null,
        authenticated: false,
        generatedAt: now(),
      };
    }

    const [trackingResult, analysisResult, resumeResult, draftResult] = await Promise.all([
      database.prepare("SELECT * FROM job_tracking WHERE user_id = ?").bind(userId).all<Row>(),
      database.prepare("SELECT * FROM user_analyses WHERE user_id = ?").bind(userId).all<Row>(),
      database.prepare("SELECT * FROM user_resume_variants WHERE user_id = ?").bind(userId).all<Row>(),
      database.prepare("SELECT * FROM user_application_drafts WHERE user_id = ?").bind(userId).all<Row>(),
    ]);

    const tracking = new Map(trackingResult.results.map((row) => [String(row.job_id), row]));
    const analyses = new Map(analysisResult.results.map((row) => [String(row.job_id), parse<Json>(row.payload_json, {})]));
    const resumes = new Map(resumeResult.results.map((row) => [String(row.job_id), String(row.markdown)]));
    const resumePdfs = new Set(resumeResult.results.filter((row) => row.pdf_base64).map((row) => String(row.job_id)));
    const drafts = new Map(draftResult.results.map((row) => [String(row.job_id), mapDraft(row)]));

    const jobs = baseJobs.map((job) => {
      const jobId = String(job.id);
      const row = tracking.get(jobId);
      return {
        ...job,
        status: row?.status ? String(row.status) : "NEW",
        statusUpdatedAt: row?.status_updated_at ? String(row.status_updated_at) : null,
        feedback: row?.feedback ? String(row.feedback) : null,
        feedbackAt: row?.feedback_at ? String(row.feedback_at) : null,
        analysis: analyses.get(jobId) ?? null,
        resume: resumes.get(jobId) ?? null,
        resumePdf: resumePdfs.has(jobId),
        draft: drafts.get(jobId) ?? null,
      };
    });

    const analyzed = jobs.filter((job) => job.analysis);
    const requirements = analyzed.flatMap((job) => {
      const analysis = job.analysis as Json | null;
      return Array.isArray(analysis?.requirementKeywords) ? analysis.requirementKeywords.map(String) : [];
    });
    const gaps = analyzed.flatMap((job) => {
      const analysis = job.analysis as Json | null;
      return Array.isArray(analysis?.missingSkills) ? analysis.missingSkills.map(String) : [];
    });
    const verdicts = analyzed.reduce<Record<string, number>>((acc, job) => {
      const analysis = job.analysis as Json | null;
      const verdict = String(analysis?.verdict ?? "weak");
      acc[verdict] = (acc[verdict] ?? 0) + 1;
      return acc;
    }, { strong: 0, possible: 0, weak: 0, reject: 0 });
    const statuses = draftResult.results.reduce<Record<string, number>>((acc, row) => {
      const status = String(row.status);
      acc[status] = (acc[status] ?? 0) + 1;
      return acc;
    }, {});
    const percent = (count: number) => jobs.length ? Math.round(count / jobs.length * 100) : 0;

    return {
      jobs,
      market: {
        totalJobs: jobs.length,
        analyzedJobs: analyzed.length,
        remoteShare: percent(jobs.filter((job) => Boolean(job.remote)).length),
        salaryDisclosureShare: percent(jobs.filter((job) => Boolean(job.salaryText)).length),
        reservationMentions: jobs.filter((job) => /бронювання|reservation from mobilization/i.test(`${String(job.title ?? "")} ${String(job.description ?? "")}`)).length,
        topSources: countBy(jobs.map((job) => String(job.source ?? ""))),
        topRoles: countBy(jobs.map((job) => String(job.title ?? ""))),
        topLocations: countBy(jobs.map((job) => String(job.location ?? ""))),
        topRequirements: countBy(requirements),
        topCandidateGaps: countBy(gaps),
        verdicts,
      },
      statuses,
      connections: await connections(userId),
      authenticated: request ? tenantRequestContext(request).authenticated : true,
      generatedAt: now(),
    };
  }

  return {
    dashboard,
    interviewProgress,
    resumePdf,
    saveSetting,
    settingsView,
    updateDraft,
    updateInterviewProgress,
    updateJobTracking,
  };
}

async function runtimeState() {
  const [runtime, jobpilot] = await Promise.all([
    import("cloudflare:workers"),
    import("./_jobpilot"),
  ]);
  const env = runtime.env as unknown as Record<string, unknown> & { DB?: D1Database };
  if (!env.DB) throw new Error("Cloud database is not available.");
  return createTenantState({
    database: env.DB,
    runtime: env,
    defaultProfile: jobpilot.DEFAULT_PROFILE as Json,
    defaultSources: jobpilot.DEFAULT_SOURCES as Json,
    loadPublicJobs: jobpilot.publicJobs,
  });
}

export async function tenantDashboard(userId: string | null, request?: Request) {
  return (await runtimeState()).dashboard(userId, request);
}

export async function tenantSettingsView(userId: string) {
  return (await runtimeState()).settingsView(userId);
}

export async function saveTenantSetting(userId: string, key: string, value: unknown) {
  return (await runtimeState()).saveSetting(userId, key, value);
}

export async function tenantInterviewProgress(userId: string) {
  return (await runtimeState()).interviewProgress(userId);
}

export async function updateTenantInterviewProgress(userId: string, questionId: string, input: Json) {
  return (await runtimeState()).updateInterviewProgress(userId, questionId, input);
}

export async function updateTenantJobTracking(userId: string, jobId: string, input: Json) {
  return (await runtimeState()).updateJobTracking(userId, jobId, input);
}

export async function tenantResumePdf(userId: string, jobId: string) {
  return (await runtimeState()).resumePdf(userId, jobId);
}

export async function updateTenantDraft(userId: string, id: string, action: string, recipient?: string) {
  return (await runtimeState()).updateDraft(userId, id, action, recipient);
}
