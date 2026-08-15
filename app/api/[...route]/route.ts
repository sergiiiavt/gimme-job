import {
  DEFAULT_PROFILE,
  DEFAULT_SOURCES,
  adjustResumeForJob,
  analyzeJobs,
  dashboard,
  interviewProgress,
  jsonError,
  publicJobs,
  readPayload,
  resumePdf,
  recordObservabilityEvent,
  recordObservabilitySnapshot,
  saveSetting,
  settingsView,
  syncSources,
  updateDraft,
  updateInterviewProgress,
  updateJobTracking,
  upsertJobs,
} from "../_jobpilot";
import {
  newOperationId,
  operationalError,
  operationalInfo,
  safeErrorDetails,
} from "../_operational-log";

type RouteContext = { params: Promise<{ route?: string[] }> | { route?: string[] } };

async function parts(context: RouteContext) {
  return (await Promise.resolve(context.params)).route ?? [];
}

export async function GET(request: Request, context: RouteContext) {
  try {
    const route = await parts(context);
    if (route[0] === "health") return Response.json({ ok: true, service: "jobpilot-cloud" });
    if (route[0] === "public" && route[1] === "jobs") return Response.json(await publicJobs());
    if (route[0] === "interview-progress") return Response.json(await interviewProgress());
    if (route[0] === "dashboard") return Response.json(await dashboard(request));
    if (route[0] === "settings") return Response.json(await settingsView());
    const resumeMatch = route[0] === "resumes" && route[1]?.match(/^(.+)\.pdf$/);
    if (resumeMatch) {
      const pdf = await resumePdf(resumeMatch[1]);
      if (!pdf) return Response.json({ error: "No resume PDF has been generated for this job yet." }, { status: 404 });
      return new Response(pdf, {
        headers: {
          "cache-control": "no-store",
          "content-disposition": `attachment; filename="${resumeMatch[1]}-resume.pdf"`,
          "content-type": "application/pdf",
        },
      });
    }
    return Response.json({ error: "Route not found." }, { status: 404 });
  } catch (error) { return jsonError(error); }
}

export async function PUT(request: Request, context: RouteContext) {
  try {
    const route = await parts(context); const payload = await readPayload(request);
    if (route[0] === "profile") {
      const profile = payload.profile ?? DEFAULT_PROFILE; await saveSetting("profile", profile);
      return Response.json({ ok: true, profile });
    }
    if (route[0] === "sources") {
      const sources = payload.sources ?? DEFAULT_SOURCES; await saveSetting("sources", sources);
      return Response.json({ ok: true, sources });
    }
    return Response.json({ error: "Route not found." }, { status: 404 });
  } catch (error) { return jsonError(error); }
}

export async function POST(request: Request, context: RouteContext) {
  try {
    const route = await parts(context); const payload = await readPayload(request);
    if (route[0] === "import") {
      const jobs = Array.isArray(payload.jobs) ? payload.jobs : [];
      const startedAt = Date.now();
      const operationId = newOperationId("import");
      const trigger = request.headers.get("x-gimmejob-trigger") === "deployment" ? "deployment" : "api_import";
      operationalInfo("job_import", {
        phase: "start",
        operationId,
        trigger,
        itemsSeen: jobs.length,
      });
      let result;
      try {
        result = await upsertJobs(jobs);
      } catch (error) {
        const details = safeErrorDetails(error, "database_error");
        await recordObservabilityEvent({
          event: "job_import",
          status: "failure",
          durationMs: Date.now() - startedAt,
          itemsSeen: jobs.length,
          itemsProcessed: null,
          errorCount: 1,
          reasonCode: details.reasonCode,
          httpStatus: details.httpStatus,
        });
        operationalError("job_import", {
          phase: "complete",
          outcome: "failure",
          operationId,
          trigger,
          stage: "upsert_jobs",
          durationMs: Date.now() - startedAt,
          itemsSeen: jobs.length,
          itemsProcessed: 0,
          ...details,
        });
        throw error;
      }
      await recordObservabilityEvent({
        event: "job_import",
        status: "success",
        durationMs: Date.now() - startedAt,
        itemsSeen: jobs.length,
        itemsProcessed: result.accepted,
        errorCount: 0,
      });
      await recordObservabilitySnapshot();
      operationalInfo("job_import", {
        phase: "complete",
        outcome: "success",
        operationId,
        trigger,
        durationMs: Date.now() - startedAt,
        itemsSeen: jobs.length,
        itemsProcessed: result.accepted,
      });
      return Response.json({ ok: true, result, dashboard: await dashboard(request) });
    }
    if (route[0] === "sync") {
      const result = await syncSources({ trigger: "api_sync" }); return Response.json({ ok: true, result, dashboard: await dashboard(request) });
    }
    if (route[0] === "analyze") {
      const result = await analyzeJobs(typeof payload.jobId === "string" ? payload.jobId : undefined, typeof payload.limit === "number" ? payload.limit : 25, { trigger: "api_analyze" });
      return Response.json({ ok: true, result, dashboard: await dashboard(request) });
    }
    if (route[0] === "analyze-resume") {
      if (typeof payload.jobId !== "string" || !payload.jobId) throw new Error("jobId is required.");
      const result = await adjustResumeForJob(payload.jobId, { trigger: "api_analyze_resume" });
      return Response.json({ ok: true, result, dashboard: await dashboard(request) });
    }
    if (route[0] === "run") {
      const sync = await syncSources({ trigger: "api_run" }); const analysis = await analyzeJobs(undefined, typeof payload.limit === "number" ? payload.limit : 25, { trigger: "api_run" });
      return Response.json({ ok: true, result: { sync, analysis }, dashboard: await dashboard(request) });
    }
    if (route[0] === "drafts" && route[1] && route[2]) {
      await updateDraft(route[1], route[2], typeof payload.recipient === "string" ? payload.recipient.trim() : undefined);
      return Response.json({ ok: true, dashboard: await dashboard(request) });
    }
    if (route[0] === "gmail" && route[1] === "connect") {
      return Response.json({ ok: false, error: "Deploy the cloud app first, then add its URL to a Google Desktop/Web OAuth client. Nothing was changed." }, { status: 409 });
    }
    return Response.json({ error: "Route not found." }, { status: 404 });
  } catch (error) { return jsonError(error); }
}

export async function PATCH(request: Request, context: RouteContext) {
  try {
    const route = await parts(context); const payload = await readPayload(request);
    if (route[0] === "jobs" && route[1]) {
      const job = await updateJobTracking(route[1], payload);
      return Response.json({ ok: true, job, dashboard: await dashboard(request) });
    }
    if (route[0] === "interview-progress" && route[1]) {
      const progress = await updateInterviewProgress(route[1], payload);
      return Response.json({ ok: true, progress });
    }
    return Response.json({ error: "Route not found." }, { status: 404 });
  } catch (error) { return jsonError(error); }
}
