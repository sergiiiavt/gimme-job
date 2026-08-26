import { tenantRequestContext } from "../../_tenant-state.ts";

type InterviewAiEnv = {
  DB?: D1Database;
  GIMMEJOB_AI_URL?: string;
  GIMMEJOB_AI_SERVICE_TOKEN?: string;
};

type JsonObject = Record<string, unknown>;
type Row = Record<string, unknown>;

type PlannedQuestion = {
  id: string;
  question: string;
  track: "qa" | "python";
  category: string;
  level: string;
  prevalence: string;
  kind: string;
};

const MAX_ANSWER_LENGTH = 20_000;
const MAX_SESSION_ID_LENGTH = 200;
const ALLOWED_TRACKS = new Set(["qa", "python", "all"]);
const ALLOWED_LANGUAGES = new Set(["en", "uk"]);
const ALLOWED_LEVELS = new Set(["Junior", "Middle", "Senior", "Lead"]);

function json(payload: unknown, status = 200): Response {
  return Response.json(payload, {
    status,
    headers: {
      "cache-control": "no-store",
      "x-content-type-options": "nosniff",
      "x-robots-tag": "noindex, nofollow, noarchive",
    },
  });
}

function text(value: unknown, maxLength = 200): string {
  return typeof value === "string" ? value.trim().slice(0, maxLength) : "";
}

function parseJsonObject(value: string): JsonObject {
  try {
    const parsed = JSON.parse(value) as unknown;
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed as JsonObject : {};
  } catch {
    return {};
  }
}

function parseQuestionPlan(value: unknown): PlannedQuestion[] {
  if (typeof value !== "string") return [];
  try {
    const parsed = JSON.parse(value) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.flatMap((item) => {
      if (!item || typeof item !== "object" || Array.isArray(item)) return [];
      const row = item as JsonObject;
      const id = text(row.id);
      const question = text(row.question, 10_000);
      const track = text(row.track) as PlannedQuestion["track"];
      if (!id || !question || (track !== "qa" && track !== "python")) return [];
      return [{
        id,
        question,
        track,
        category: text(row.category, 200) || "General",
        level: text(row.level, 100) || "Unspecified",
        prevalence: text(row.prevalence, 100) || "Unspecified",
        kind: text(row.kind, 100) || "Theory",
      }];
    });
  } catch {
    return [];
  }
}

function aiBaseUrl(env: InterviewAiEnv): URL | null {
  const configured = env.GIMMEJOB_AI_URL?.trim();
  if (!configured) return null;
  try {
    const url = new URL(configured);
    const localDevelopment = url.hostname === "127.0.0.1" || url.hostname === "localhost";
    if (url.protocol !== "https:" && !(localDevelopment && url.protocol === "http:")) return null;
    url.search = "";
    url.hash = "";
    url.pathname = url.pathname.replace(/\/+$/, "") || "/";
    return url;
  } catch {
    return null;
  }
}

async function callAi(env: InterviewAiEnv, path: string, body: JsonObject): Promise<{ status: number; payload: JsonObject }> {
  const base = aiBaseUrl(env);
  const token = env.GIMMEJOB_AI_SERVICE_TOKEN?.trim();
  if (!base || !token) {
    return { status: 503, payload: { error: "AI interview service is not configured." } };
  }

  const endpoint = new URL(path.replace(/^\/+/, ""), base.href.endsWith("/") ? base : new URL(`${base.href}/`));
  if (endpoint.origin !== base.origin) {
    return { status: 503, payload: { error: "AI interview service configuration is invalid." } };
  }

  try {
    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        authorization: `Bearer ${token}`,
        "content-type": "application/json",
      },
      body: JSON.stringify(body),
    });
    const raw = await response.json().catch(() => null) as unknown;
    const payload = raw && typeof raw === "object" && !Array.isArray(raw) ? raw as JsonObject : {};
    if (!response.ok) {
      const detail = text(payload.detail, 500) || text(payload.error, 500) || "AI interview request failed.";
      return { status: response.status >= 400 && response.status < 600 ? response.status : 502, payload: { error: detail } };
    }
    return { status: response.status, payload };
  } catch {
    return { status: 502, payload: { error: "AI interview service is temporarily unavailable." } };
  }
}

function validSessionId(value: string): boolean {
  return value.length > 0 && value.length <= MAX_SESSION_ID_LENGTH && /^[A-Za-z0-9_-]+$/.test(value);
}

function questionPlanFromProvider(payload: JsonObject): PlannedQuestion[] {
  if (!Array.isArray(payload.questions)) return [];
  return payload.questions.flatMap((item) => {
    if (!item || typeof item !== "object" || Array.isArray(item)) return [];
    const row = item as JsonObject;
    const id = text(row.id);
    const question = text(row.question, 10_000);
    const track = text(row.track) as PlannedQuestion["track"];
    if (!id || !question || (track !== "qa" && track !== "python")) return [];
    return [{
      id,
      question,
      track,
      category: text(row.category) || "General",
      level: text(row.level, 100) || "Unspecified",
      prevalence: text(row.prevalence, 100) || "Unspecified",
      kind: text(row.kind, 100) || "Theory",
    }];
  });
}

async function saveSession(database: D1Database, userId: string, payload: JsonObject): Promise<void> {
  const sessionId = text(payload.session_id, MAX_SESSION_ID_LENGTH);
  const questions = questionPlanFromProvider(payload);
  if (!validSessionId(sessionId) || questions.length === 0) throw new Error("Invalid interview session returned by AI service.");
  const trackSet = new Set(questions.map((question) => question.track));
  const track = trackSet.size === 1 ? questions[0].track : "all";
  const language = text(payload.language, 10) || "en";
  const timestamp = new Date().toISOString();
  await database.prepare(`INSERT INTO user_interview_sessions (
      user_id, id, track, language, status, question_plan_json, total_questions, created_at, updated_at
    ) VALUES (?, ?, ?, ?, 'ACTIVE', ?, ?, ?, ?)`)
    .bind(userId, sessionId, track, language, JSON.stringify(questions), questions.length, timestamp, timestamp)
    .run();
}

async function startInterview(request: JsonObject, env: InterviewAiEnv, userId: string | null): Promise<Response> {
  const track = text(request.track, 20) || "qa";
  const language = text(request.language, 10) || "en";
  const requestedCount = Number(request.questionCount ?? 10);
  const questionCount = Number.isInteger(requestedCount) ? Math.min(20, Math.max(1, requestedCount)) : 10;
  const levels = Array.isArray(request.levels)
    ? request.levels.map((value) => text(value, 50)).filter((value) => ALLOWED_LEVELS.has(value)).slice(0, 5)
    : [];
  const categories = Array.isArray(request.categories)
    ? request.categories.map((value) => text(value, 100)).filter(Boolean).slice(0, 20)
    : [];

  if (!ALLOWED_TRACKS.has(track) || !ALLOWED_LANGUAGES.has(language)) return json({ error: "Unsupported interview setup." }, 400);

  const upstream = await callAi(env, "/v1/interviews/start", {
    track,
    language,
    question_count: questionCount,
    levels,
    categories,
  });
  if (upstream.status >= 400) return json(upstream.payload, upstream.status);

  const sessionId = text(upstream.payload.session_id, MAX_SESSION_ID_LENGTH);
  const questions = questionPlanFromProvider(upstream.payload);
  if (!validSessionId(sessionId) || questions.length === 0) return json({ error: "AI interview service returned an invalid session." }, 502);

  if (userId && env.DB) {
    try {
      await saveSession(env.DB, userId, { ...upstream.payload, language });
    } catch {
      return json({ error: "Interview started, but its progress could not be saved. Please retry." }, 500);
    }
  }

  return json({
    sessionId,
    questions,
    selectedCount: questions.length,
    persistent: Boolean(userId && env.DB),
  });
}

async function loadOwnedSession(database: D1Database, userId: string, sessionId: string): Promise<Row | null> {
  return database.prepare(`SELECT id, track, language, status, question_plan_json, total_questions, created_at, updated_at, completed_at
      FROM user_interview_sessions WHERE user_id = ? AND id = ? LIMIT 1`)
    .bind(userId, sessionId)
    .first<Row>();
}

async function stopInterview(request: JsonObject, env: InterviewAiEnv, userId: string | null): Promise<Response> {
  const sessionId = text(request.sessionId, MAX_SESSION_ID_LENGTH);
  if (!validSessionId(sessionId)) return json({ error: "Invalid interview session." }, 400);
  if (!userId || !env.DB) return json({ sessionId, stopped: true, persistent: false });

  const session = await loadOwnedSession(env.DB, userId, sessionId);
  if (!session) return json({ error: "Interview session not found." }, 404);
  const status = String(session.status);
  if (status === "STOPPED" || status === "COMPLETED") {
    return json({ sessionId, stopped: status === "STOPPED", persistent: true });
  }

  try {
    await env.DB.prepare(`UPDATE user_interview_sessions SET status = 'STOPPED', updated_at = ? WHERE user_id = ? AND id = ?`)
      .bind(new Date().toISOString(), userId, sessionId)
      .run();
    return json({ sessionId, stopped: true, persistent: true });
  } catch {
    return json({ error: "Interview could not be stopped. Please retry." }, 500);
  }
}

async function evaluateAnswer(request: JsonObject, env: InterviewAiEnv, userId: string | null): Promise<Response> {
  const sessionId = text(request.sessionId, MAX_SESSION_ID_LENGTH);
  const questionId = text(request.questionId, 200);
  const answer = typeof request.answer === "string" ? request.answer.trim() : "";
  if (!validSessionId(sessionId) || !questionId || !answer || answer.length > MAX_ANSWER_LENGTH) {
    return json({ error: "Invalid interview answer." }, 400);
  }

  let planQuestion: PlannedQuestion | undefined;
  let sessionLanguage: "en" | "uk" = "en";
  let totalQuestions = 0;

  if (userId && env.DB) {
    const session = await loadOwnedSession(env.DB, userId, sessionId);
    if (!session) return json({ error: "Interview session not found." }, 404);
    if (String(session.status) !== "ACTIVE") return json({ error: "Interview session is no longer active." }, 409);
    const plan = parseQuestionPlan(session.question_plan_json);
    planQuestion = plan.find((question) => question.id === questionId);
    if (!planQuestion) return json({ error: "Question does not belong to this interview session." }, 400);
    sessionLanguage = String(session.language) === "uk" ? "uk" : "en";
    totalQuestions = Number(session.total_questions) || plan.length;

    const existing = await env.DB.prepare(`SELECT id FROM user_interview_attempts
      WHERE user_id = ? AND session_id = ? AND question_id = ? LIMIT 1`)
      .bind(userId, sessionId, questionId)
      .first<Row>();
    if (existing) return json({ error: "This interview question has already been answered." }, 409);
  }

  const track = planQuestion?.track ?? (text(request.track, 20) === "python" ? "python" : "qa");
  const language = planQuestion ? sessionLanguage : (text(request.language, 10) === "uk" ? "uk" : "en");
  const upstream = await callAi(env, "/v1/interviews/evaluate", {
    session_id: sessionId,
    track,
    language,
    question_id: questionId,
    answer,
  });
  if (upstream.status >= 400) return json(upstream.payload, upstream.status);

  const evaluation = upstream.payload.evaluation;
  if (!evaluation || typeof evaluation !== "object" || Array.isArray(evaluation)) {
    return json({ error: "AI interview service returned an invalid evaluation." }, 502);
  }
  const evaluationObject = evaluation as JsonObject;
  const score = Number(evaluationObject.score);
  if (!Number.isInteger(score) || score < 0 || score > 100) return json({ error: "AI interview service returned an invalid score." }, 502);

  let progress: JsonObject | null = null;
  if (userId && env.DB && planQuestion) {
    const timestamp = new Date().toISOString();
    const attemptId = `attempt_${crypto.randomUUID().replaceAll("-", "")}`;
    try {
      await env.DB.prepare(`INSERT INTO user_interview_attempts (
          user_id, id, session_id, question_id, track, category, level, answer, score, rating, evaluation_json, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
        .bind(
          userId,
          attemptId,
          sessionId,
          questionId,
          planQuestion.track,
          planQuestion.category,
          planQuestion.level,
          answer,
          score,
          text(evaluationObject.rating, 40) || "unknown",
          JSON.stringify(evaluationObject),
          timestamp,
        )
        .run();

      const aggregate = await env.DB.prepare(`SELECT COUNT(*) AS answered, ROUND(AVG(score)) AS average_score
        FROM user_interview_attempts WHERE user_id = ? AND session_id = ?`)
        .bind(userId, sessionId)
        .first<Row>();
      const answered = Number(aggregate?.answered) || 0;
      const averageScore = Number(aggregate?.average_score) || score;
      const complete = totalQuestions > 0 && answered >= totalQuestions;
      await env.DB.prepare(`UPDATE user_interview_sessions
        SET status = ?, updated_at = ?, completed_at = ?
        WHERE user_id = ? AND id = ?`)
        .bind(complete ? "COMPLETED" : "ACTIVE", timestamp, complete ? timestamp : null, userId, sessionId)
        .run();
      progress = { answered, total: totalQuestions, averageScore, complete };
    } catch {
      return json({ error: "Answer was evaluated, but interview progress could not be saved. Please retry." }, 500);
    }
  }

  return json({
    sessionId,
    evaluation: evaluationObject,
    model: upstream.payload.model ?? null,
    langfuseTracing: Boolean(upstream.payload.langfuse_tracing),
    progress,
  });
}

async function progressView(env: InterviewAiEnv, userId: string | null): Promise<Response> {
  if (!userId || !env.DB) return json({ persistent: false, recentSessions: [], areas: [] });
  try {
    const sessions = await env.DB.prepare(`SELECT
        s.id, s.track, s.language, s.status, s.total_questions, s.created_at, s.updated_at, s.completed_at,
        COUNT(a.id) AS answered_questions, ROUND(AVG(a.score)) AS average_score
      FROM user_interview_sessions s
      LEFT JOIN user_interview_attempts a ON a.user_id = s.user_id AND a.session_id = s.id
      WHERE s.user_id = ?
      GROUP BY s.id, s.track, s.language, s.status, s.total_questions, s.created_at, s.updated_at, s.completed_at
      ORDER BY s.updated_at DESC
      LIMIT 10`)
      .bind(userId)
      .all<Row>();
    const areas = await env.DB.prepare(`SELECT track, category, COUNT(*) AS attempts,
        ROUND(AVG(score)) AS average_score, MAX(created_at) AS last_attempted_at
      FROM user_interview_attempts
      WHERE user_id = ?
      GROUP BY track, category
      ORDER BY average_score ASC, attempts DESC, category ASC
      LIMIT 20`)
      .bind(userId)
      .all<Row>();

    return json({
      persistent: true,
      recentSessions: (sessions.results ?? []).map((row) => ({
        id: String(row.id),
        track: String(row.track),
        language: String(row.language),
        status: String(row.status),
        totalQuestions: Number(row.total_questions) || 0,
        answeredQuestions: Number(row.answered_questions) || 0,
        averageScore: row.average_score === null || row.average_score === undefined ? null : Number(row.average_score),
        createdAt: String(row.created_at),
        updatedAt: String(row.updated_at),
        completedAt: row.completed_at ? String(row.completed_at) : null,
      })),
      areas: (areas.results ?? []).map((row) => ({
        track: String(row.track),
        category: String(row.category),
        attempts: Number(row.attempts) || 0,
        averageScore: Number(row.average_score) || 0,
        lastAttemptedAt: String(row.last_attempted_at),
      })),
    });
  } catch {
    return json({ error: "Failed to load interview progress." }, 500);
  }
}

export async function handleInterviewAi(request: Request, env: InterviewAiEnv): Promise<Response> {
  const tenant = tenantRequestContext(request);
  const userId = tenant.multiUser && tenant.authenticated && tenant.userId ? tenant.userId : null;

  if (request.method === "GET") return progressView(env, userId);
  if (request.method !== "POST") return new Response(null, { status: 405, headers: { allow: "GET, POST" } });

  let input: JsonObject;
  try {
    const parsed = await request.json() as unknown;
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return json({ error: "Invalid request body." }, 400);
    input = parsed as JsonObject;
  } catch {
    return json({ error: "Invalid request body." }, 400);
  }

  const action = text(input.action, 20);
  if (action === "start") return startInterview(input, env, userId);
  if (action === "evaluate") return evaluateAnswer(input, env, userId);
  if (action === "stop") return stopInterview(input, env, userId);
  return json({ error: "Unsupported interview action." }, 400);
}

export async function GET(request: Request): Promise<Response> {
  const runtime = await import("cloudflare:workers");
  return handleInterviewAi(request, runtime.env as unknown as InterviewAiEnv);
}

export async function POST(request: Request): Promise<Response> {
  const runtime = await import("cloudflare:workers");
  return handleInterviewAi(request, runtime.env as unknown as InterviewAiEnv);
}