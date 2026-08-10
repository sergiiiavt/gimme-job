import {
  DEFAULT_PROFILE,
  DEFAULT_SOURCES,
  analyzeJobs,
  dashboard,
  jsonError,
  readPayload,
  saveSetting,
  settingsView,
  syncSources,
  updateDraft,
  updateJobTracking,
  upsertJobs,
} from "../_jobpilot";

type RouteContext = { params: Promise<{ route?: string[] }> | { route?: string[] } };

async function parts(context: RouteContext) {
  return (await Promise.resolve(context.params)).route ?? [];
}

export async function GET(_request: Request, context: RouteContext) {
  try {
    const route = await parts(context);
    if (route[0] === "health") return Response.json({ ok: true, service: "jobpilot-cloud" });
    if (route[0] === "dashboard") return Response.json(await dashboard());
    if (route[0] === "settings") return Response.json(await settingsView());
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
      return Response.json({ ok: true, result, dashboard: await dashboard() });
    }
    if (route[0] === "sync") {
      const result = await syncSources(); return Response.json({ ok: true, result, dashboard: await dashboard() });
    }
    if (route[0] === "analyze") {
      const result = await analyzeJobs(typeof payload.jobId === "string" ? payload.jobId : undefined, typeof payload.limit === "number" ? payload.limit : 25);
      return Response.json({ ok: true, result, dashboard: await dashboard() });
    }
    if (route[0] === "run") {
      const sync = await syncSources(); const analysis = await analyzeJobs(undefined, typeof payload.limit === "number" ? payload.limit : 25);
      return Response.json({ ok: true, result: { sync, analysis }, dashboard: await dashboard() });
    }
    if (route[0] === "drafts" && route[1] && route[2]) {
      await updateDraft(route[1], route[2], typeof payload.recipient === "string" ? payload.recipient.trim() : undefined);
      return Response.json({ ok: true, dashboard: await dashboard() });
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
      return Response.json({ ok: true, job, dashboard: await dashboard() });
    }
    return Response.json({ error: "Route not found." }, { status: 404 });
  } catch (error) { return jsonError(error); }
}
