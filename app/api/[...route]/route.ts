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
  saveSetting,
  settingsView,
  syncSources,
  updateDraft,
  updateInterviewProgress,
  updateJobTracking,
  upsertJobs,
} from "../_jobpilot";

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
      const jobs = Array.isArray(payload.jobs) ? payload.jobs : []; const result = await upsertJobs(jobs);
      return Response.json({ ok: true, result, dashboard: await dashboard(request) });
    }
    if (route[0] === "sync") {
      const result = await syncSources(); return Response.json({ ok: true, result, dashboard: await dashboard(request) });
    }
    if (route[0] === "analyze") {
      const result = await analyzeJobs(typeof payload.jobId === "string" ? payload.jobId : undefined, typeof payload.limit === "number" ? payload.limit : 25);
      return Response.json({ ok: true, result, dashboard: await dashboard(request) });
    }
    if (route[0] === "analyze-resume") {
      if (typeof payload.jobId !== "string" || !payload.jobId) throw new Error("jobId is required.");
      const result = await adjustResumeForJob(payload.jobId);
      return Response.json({ ok: true, result, dashboard: await dashboard(request) });
    }
    if (route[0] === "run") {
      const sync = await syncSources(); const analysis = await analyzeJobs(undefined, typeof payload.limit === "number" ? payload.limit : 25);
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
