import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { existsSync, writeFileSync } from "node:fs";
import { adjustResume, analyzeJob } from "./src/analyst.js";
import {
  initializeConfig,
  loadEnvironment,
  loadProfile,
  loadSources,
} from "./src/config.js";
import { JobDatabase } from "./src/db.js";
import {
  CandidateProfileSchema,
  JobTrackingUpdateSchema,
  SourcesConfigSchema,
  type JobInput,
  type StoredJob,
} from "./src/domain.js";
import { base64ToBytes, buildResumePdf, bytesToBase64 } from "./src/resume-pdf.js";
import {
  assertAllowedRecipient,
  authorizeGmail,
  sendGmailMessage,
} from "./src/gmail.js";
import { buildMarketReport } from "./src/market.js";
import { buildSources } from "./src/sources/index.js";
import { collectAllSources } from "./src/sources/types.js";
import { localAgentInstanceId } from "./src/identity.js";
import { listenOnAvailablePort } from "./src/port.js";

loadEnvironment();

const paths = initializeConfig();
const db = new JobDatabase(paths.db);
const requestedPort = Number(process.env.JOB_AGENT_PORT ?? "4317");
const agentStartedAt = Date.now();
const agentInstanceId = process.env.JOB_AGENT_INSTANCE_ID
  ?? localAgentInstanceId(process.cwd(), paths.db);
const allowedOrigins = new Set([
  "http://localhost:4173",
  "http://127.0.0.1:4173",
  "http://terminal.local:4173",
]);

type JsonObject = Record<string, unknown>;

function json(
  response: ServerResponse,
  status: number,
  payload: unknown,
): void {
  response.writeHead(status, {
    "access-control-allow-headers": "content-type",
    "access-control-allow-methods": "GET, POST, PUT, PATCH, OPTIONS",
    "cache-control": "no-store",
    "content-type": "application/json; charset=utf-8",
  });
  response.end(JSON.stringify(payload));
}

async function body(request: IncomingMessage): Promise<JsonObject> {
  const chunks: Buffer[] = [];
  let size = 0;
  for await (const chunk of request) {
    const value = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    size += value.length;
    if (size > 2_000_000) throw new Error("Request body is too large.");
    chunks.push(value);
  }
  if (chunks.length === 0) return {};
  const parsed = JSON.parse(Buffer.concat(chunks).toString("utf8")) as unknown;
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new Error("JSON body must be an object.");
  }
  return parsed as JsonObject;
}

function draftForJob(jobId: string) {
  return db.listDrafts(undefined, 500).find((draft) => draft.jobId === jobId) ?? null;
}

function jobView(job: StoredJob) {
  const tracking = db.getJobTracking(job.id);
  return {
    ...job,
    agentStatus: job.status,
    status: tracking?.status ?? (job.status === "ARCHIVED" ? "ARCHIVED" : "NEW"),
    statusUpdatedAt: tracking?.statusUpdatedAt ?? null,
    feedback: tracking?.feedback ?? null,
    feedbackAt: tracking?.feedbackAt ?? null,
    analysis: db.getAnalysis(job.id),
    resume: db.getResume(job.id),
    resumePdf: Boolean(db.getResumePdf(job.id)),
    draft: draftForJob(job.id),
  };
}

function settingsView() {
  const sourceConfig = loadSources(paths.sources);
  return {
    profile: loadProfile(paths.profile),
    sources: sourceConfig,
    connections: {
      gmail: {
        configured: existsSync(paths.googleCredentials),
        connected: existsSync(paths.googleToken),
        enabled: sourceConfig.gmail.enabled,
      },
      openai: {
        connected: Boolean(process.env.OPENAI_API_KEY),
        model: process.env.OPENAI_MODEL ?? "gpt-5.6",
      },
      boards: {
        rss: sourceConfig.rss.length,
        greenhouse: sourceConfig.greenhouse.length,
        lever: sourceConfig.lever.length,
        ashby: sourceConfig.ashby.length,
      },
    },
  };
}

function dashboard() {
  const jobs = db.listJobs(500).map(jobView);
  const queue = db.listQueue(0, 500);
  const market = buildMarketReport(db.marketRows(), new Date(), null);
  const statuses = db.listDrafts(undefined, 500).reduce<Record<string, number>>(
    (accumulator, draft) => {
      accumulator[draft.status] = (accumulator[draft.status] ?? 0) + 1;
      return accumulator;
    },
    {},
  );
  return {
    jobs,
    queue,
    market,
    statuses,
    connections: settingsView().connections,
    // Local dev is always the owner's machine; there is no password wall to check.
    authenticated: true,
    generatedAt: new Date().toISOString(),
  };
}

async function syncJobs(manualOnly = false) {
  const config = loadSources(paths.sources);
  const sources = await buildSources(config, paths, process.cwd(), { manualOnly });
  const results = await collectAllSources(sources);
  let inserted = 0;
  let seen = 0;
  const errors: Array<{ source: string; error: string }> = [];
  for (const result of results) {
    if (result.error) {
      errors.push({ source: result.source, error: result.error });
      continue;
    }
    for (const job of result.jobs) {
      seen += 1;
      if (db.upsertJob(job).inserted) inserted += 1;
    }
  }
  return { inserted, seen, errors };
}

async function analyzeJobs(options: { jobId?: string; limit?: number }) {
  const profile = loadProfile(paths.profile);
  const jobs = options.jobId
    ? [db.getJob(options.jobId)].filter((job): job is StoredJob => job !== null)
    : db.listJobsForAnalysis(Math.min(Math.max(options.limit ?? 25, 1), 100));
  if (options.jobId && jobs.length === 0) throw new Error("Job not found.");

  const completed: Array<{ id: string; score: number; verdict: string; mode: string }> = [];
  for (const job of jobs) {
    const { analysis, mode } = await analyzeJob(job, profile);
    db.saveAnalysis(job.id, analysis, mode);
    completed.push({ id: job.id, score: analysis.score, verdict: analysis.verdict, mode });
  }
  return completed;
}

async function adjustResumeForJob(jobIdValue: string) {
  const profile = loadProfile(paths.profile);
  const job = db.getJob(jobIdValue);
  if (!job) throw new Error("Job not found.");

  const { pkg, mode } = await adjustResume(job, profile);
  const pdfBytes = await buildResumePdf(pkg.tailoredResume.markdown);
  db.saveResumePackage(job.id, pkg, bytesToBase64(pdfBytes));
  return { id: job.id, mode };
}

function normalizeImportedJob(value: unknown, index: number): JobInput {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error(`Imported job ${index + 1} must be an object.`);
  }
  const job = value as Record<string, unknown>;
  const required = (key: string): string => {
    const result = typeof job[key] === "string" ? job[key].trim() : "";
    if (!result) throw new Error(`Imported job ${index + 1} is missing ${key}.`);
    return result;
  };
  const url = required("url");
  return {
    source: typeof job.source === "string" ? job.source : "manual:web",
    externalId: typeof job.externalId === "string" ? job.externalId : null,
    title: required("title"),
    company: required("company"),
    location: typeof job.location === "string" ? job.location : "Unknown",
    remote: Boolean(job.remote),
    url,
    applyUrl: typeof job.applyUrl === "string" ? job.applyUrl : url,
    description: typeof job.description === "string" ? job.description : "",
    salaryText: typeof job.salaryText === "string" ? job.salaryText : null,
    postedAt: typeof job.postedAt === "string" ? job.postedAt : null,
    contactEmail: typeof job.contactEmail === "string" ? job.contactEmail : null,
    raw: job,
  };
}

async function route(request: IncomingMessage, response: ServerResponse) {
  const origin = request.headers.origin;
  if (origin && !allowedOrigins.has(origin)) {
    json(response, 403, { ok: false, error: "Origin is not allowed." });
    return;
  }
  response.setHeader("access-control-allow-origin", origin ?? "http://localhost:4173");
  response.setHeader("vary", "origin");
  if (request.method === "OPTIONS") {
    json(response, 204, null);
    return;
  }
  const requestUrl = new URL(request.url ?? "/", `http://localhost:${port}`);
  const routePath = requestUrl.pathname;

  if (request.method === "GET" && routePath === "/api/health") {
    json(response, 200, {
      ok: true,
      service: "job-search-agent",
      apiVersion: 1,
      instanceId: agentInstanceId,
      startedAt: agentStartedAt,
    });
    return;
  }
  if (request.method === "GET" && routePath === "/api/dashboard") {
    json(response, 200, dashboard());
    return;
  }
  if (request.method === "GET" && routePath === "/api/settings") {
    json(response, 200, settingsView());
    return;
  }
  if (request.method === "PUT" && routePath === "/api/profile") {
    const payload = await body(request);
    const profile = CandidateProfileSchema.parse(payload.profile);
    writeFileSync(paths.profile, JSON.stringify(profile, null, 2));
    json(response, 200, { ok: true, profile });
    return;
  }
  if (request.method === "PUT" && routePath === "/api/sources") {
    const payload = await body(request);
    const sources = SourcesConfigSchema.parse(payload.sources);
    writeFileSync(paths.sources, JSON.stringify(sources, null, 2));
    json(response, 200, { ok: true, sources });
    return;
  }
  if (request.method === "POST" && routePath === "/api/sync") {
    const payload = await body(request);
    const result = await syncJobs(Boolean(payload.manualOnly));
    json(response, 200, { ok: true, result, dashboard: dashboard() });
    return;
  }
  if (request.method === "POST" && routePath === "/api/analyze") {
    const payload = await body(request);
    const result = await analyzeJobs({
      jobId: typeof payload.jobId === "string" ? payload.jobId : undefined,
      limit: typeof payload.limit === "number" ? payload.limit : undefined,
    });
    json(response, 200, { ok: true, result, dashboard: dashboard() });
    return;
  }
  if (request.method === "POST" && routePath === "/api/analyze-resume") {
    const payload = await body(request);
    if (typeof payload.jobId !== "string" || !payload.jobId) throw new Error("jobId is required.");
    const result = await adjustResumeForJob(payload.jobId);
    json(response, 200, { ok: true, result, dashboard: dashboard() });
    return;
  }
  if (request.method === "POST" && routePath === "/api/run") {
    const payload = await body(request);
    const sync = await syncJobs(Boolean(payload.manualOnly));
    const analysis = await analyzeJobs({
      limit: typeof payload.limit === "number" ? payload.limit : 25,
    });
    const market = buildMarketReport(db.marketRows(), new Date(), db.latestMarketSnapshot());
    db.saveMarketSnapshot(market);
    json(response, 200, { ok: true, sync, analysis, dashboard: dashboard() });
    return;
  }
  if (request.method === "POST" && routePath === "/api/import") {
    const payload = await body(request);
    if (!Array.isArray(payload.jobs)) throw new Error("jobs must be an array.");
    let inserted = 0;
    payload.jobs.forEach((value, index) => {
      if (db.upsertJob(normalizeImportedJob(value, index)).inserted) inserted += 1;
    });
    json(response, 200, { ok: true, inserted, dashboard: dashboard() });
    return;
  }
  if (request.method === "POST" && routePath === "/api/gmail/connect") {
    const payload = await body(request);
    await authorizeGmail(paths.googleCredentials, paths.googleToken, Boolean(payload.force));
    json(response, 200, { ok: true, connections: settingsView().connections });
    return;
  }

  const resumePdfMatch = routePath.match(/^\/api\/resumes\/([^/]+)\.pdf$/);
  if (request.method === "GET" && resumePdfMatch) {
    const jobIdValue = decodeURIComponent(resumePdfMatch[1] ?? "");
    const pdfBase64 = db.getResumePdf(jobIdValue);
    if (!pdfBase64) {
      json(response, 404, { ok: false, error: "No resume PDF has been generated for this job yet." });
      return;
    }
    response.writeHead(200, {
      "access-control-allow-headers": "content-type",
      "access-control-allow-methods": "GET, POST, PUT, PATCH, OPTIONS",
      "cache-control": "no-store",
      "content-disposition": `attachment; filename="${jobIdValue}-resume.pdf"`,
      "content-type": "application/pdf",
    });
    response.end(Buffer.from(base64ToBytes(pdfBase64)));
    return;
  }

  const jobMatch = routePath.match(/^\/api\/jobs\/([^/]+)$/);
  if (request.method === "PATCH" && jobMatch) {
    const jobIdValue = decodeURIComponent(jobMatch[1] ?? "");
    const update = JobTrackingUpdateSchema.parse(await body(request));
    const job = db.updateJobTracking(jobIdValue, update);
    json(response, 200, { ok: true, job, dashboard: dashboard() });
    return;
  }

  const draftMatch = routePath.match(/^\/api\/drafts\/([^/]+)\/(approve|reject|recipient|send)$/);
  if (request.method === "POST" && draftMatch) {
    const [, rawId, action] = draftMatch;
    const draftId = decodeURIComponent(rawId ?? "");
    const payload = await body(request);
    if (action === "recipient") {
      const recipient = typeof payload.recipient === "string" ? payload.recipient.trim() : "";
      if (!recipient) throw new Error("Recipient is required.");
      if (!db.setDraftRecipient(draftId, recipient)) throw new Error("Draft not found or already sent.");
    } else if (action === "approve") {
      if (typeof payload.recipient === "string" && payload.recipient.trim()) {
        db.setDraftRecipient(draftId, payload.recipient.trim());
      }
      if (!db.approveDraft(draftId)) throw new Error("Draft cannot be approved from its current state.");
    } else if (action === "reject") {
      if (!db.rejectDraft(draftId)) throw new Error("Draft cannot be rejected from its current state.");
    } else {
      const draft = db.getDraft(draftId);
      if (!draft) throw new Error("Draft not found.");
      if (draft.status !== "APPROVED") {
        throw new Error(`Sending blocked: status is ${draft.status}, not APPROVED.`);
      }
      if (!draft.recipient) throw new Error("Set a recipient before sending.");
      const config = loadSources(paths.sources);
      assertAllowedRecipient(draft.recipient, config.gmail.allowedSendDomains);
      const auth = await authorizeGmail(paths.googleCredentials, paths.googleToken);
      const messageId = await sendGmailMessage(auth, {
        to: draft.recipient,
        subject: draft.subject,
        body: draft.body,
      });
      if (!db.markSent(draftId, messageId)) {
        throw new Error("Gmail sent the message, but the local status update failed.");
      }
    }
    json(response, 200, { ok: true, dashboard: dashboard() });
    return;
  }

  json(response, 404, { ok: false, error: "Route not found." });
}

const server = createServer((request, response) => {
  route(request, response).catch((error: unknown) => {
    const message = error instanceof Error ? error.message : String(error);
    console.error(message);
    if (!response.headersSent) json(response, 400, { ok: false, error: message });
    else response.end();
  });
});

let port = requestedPort;
let serverStarted = false;

server.on("error", (error) => {
  if (serverStarted) console.error("Local agent server error:", error);
});

async function startServer() {
  try {
    port = await listenOnAvailablePort(server, requestedPort, "127.0.0.1");
    serverStarted = true;

    if (db.listJobs(1).length === 0) {
      try {
        await syncJobs(true);
        await analyzeJobs({ limit: 5 });
      } catch (error) {
        console.warn("Starter data could not be loaded:", error);
      }
    }
    console.log(`Job Search API ready at http://127.0.0.1:${port}`);
  } catch (error) {
    console.error("Failed to start local agent server:", error);
    process.exit(1);
  }
}

void startServer();

function shutdown() {
  server.close(() => {
    db.close();
    process.exit(0);
  });
}

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
