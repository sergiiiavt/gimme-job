import {
  DEFAULT_PROFILE,
  DEFAULT_SOURCES,
  dashboard,
  interviewProgress,
  jsonError,
  readPayload,
  resumePdf,
  recordObservabilityEvent,
  recordObservabilitySnapshot,
  saveSetting,
  settingsView,
  updateDraft,
  updateInterviewProgress,
  updateJobTracking,
} from "../_jobpilot";
import { adjustResumeForUser, analyzeJobsForUser } from "../_job-actions";
import { upsertImportedVacancies } from "../_vacancy-import";
import {
  ensureVacancyCatalog,
  mergeVacancySourceDefaults,
  publicVacancies,
  sanitizeDashboardPayload,
  syncVacancySources,
} from "../_vacancy-intake";
import {
  saveTenantSetting,
  tenantDashboard,
  tenantInterviewProgress,
  tenantRequestContext,
  tenantResumePdf,
  tenantSettingsView,
  updateTenantDraft,
  updateTenantInterviewProgress,
  updateTenantJobTracking,
} from "../_tenant-state";
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

function tenantUser(request: Request): { multiUser: boolean; userId: string | null } | Response {
  const context = tenantRequestContext(request);
  if (!context.multiUser) return { multiUser: false, userId: null };
  if (!context.authenticated || !context.userId) {
    return Response.json(
      { ok: false, error: "Authentication required." },
      { status: 401, headers: { "cache-control": "no-store" } },
    );
  }
  return { multiUser: true, userId: context.userId };
}

function multiUserAdminBlocked(): Response {
  return Response.json(
    { ok: false, error: "This shared-catalog operation is not available to tenant users." },
    { status: 403, headers: { "cache-control": "no-store" } },
  );
}

async function currentDashboard(request: Request) {
  const tenant = tenantRequestContext(request);
  const userId = tenant.authenticated ? tenant.userId : null;
  const value = tenant.multiUser ? await tenantDashboard(userId, request) : await dashboard(request);
  return sanitizeDashboardPayload(value);
}

export async function GET(request: Request, context: RouteContext) {
  try {
    const route = await parts(context);
    const tenant = tenantRequestContext(request);
    if (route[0] === "health") return Response.json({ ok: true, service: "jobpilot-cloud" });
    if (route[0] === "public" && route[1] === "jobs") {
      await ensureVacancyCatalog();
      return Response.json(await publicVacancies());
    }
    if (route[0] === "dashboard") {
      await ensureVacancyCatalog();
      return Response.json(await currentDashboard(request));
    }
    if (route[0] === "interview-progress") {
      if (!tenant.multiUser) return Response.json(await interviewProgress());
      if (!tenant.authenticated || !tenant.userId) {
        return Response.json({ ok: false, error: "Authentication required." }, { status: 401, headers: { "cache-control": "no-store" } });
      }
      return Response.json(await tenantInterviewProgress(tenant.userId));
    }
    if (route[0] === "settings") {
      if (!tenant.multiUser) return Response.json(mergeVacancySourceDefaults(await settingsView()));
      if (!tenant.authenticated || !tenant.userId) {
        return Response.json({ ok: false, error: "Authentication required." }, { status: 401, headers: { "cache-control": "no-store" } });
      }
      return Response.json(mergeVacancySourceDefaults(await tenantSettingsView(tenant.userId)));
    }
    const resumeMatch = route[0] === "resumes" && route[1]?.match(/^(.+)\.pdf$/);
    if (resumeMatch) {
      let pdf: Uint8Array | null;
      if (tenant.multiUser) {
        if (!tenant.authenticated || !tenant.userId) {
          return Response.json({ ok: false, error: "Authentication required." }, { status: 401, headers: { "cache-control": "no-store" } });
        }
        pdf = await tenantResumePdf(tenant.userId, resumeMatch[1]);
      } else {
        pdf = await resumePdf(resumeMatch[1]);
      }
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
    const tenant = tenantUser(request);
    if (tenant instanceof Response) return tenant;
    if (route[0] === "profile") {
      const profile = payload.profile ?? DEFAULT_PROFILE;
      if (tenant.multiUser && tenant.userId) await saveTenantSetting(tenant.userId, "profile", profile);
      else await saveSetting("profile", profile);
      return Response.json({ ok: true, profile });
    }
    if (route[0] === "sources") {
      const sources = payload.sources ?? DEFAULT_SOURCES;
      if (tenant.multiUser && tenant.userId) await saveTenantSetting(tenant.userId, "sources", sources);
      else await saveSetting("sources", sources);
      return Response.json({ ok: true, sources });
    }
    return Response.json({ error: "Route not found." }, { status: 404 });
  } catch (error) { return jsonError(error); }
}

export async function POST(request: Request, context: RouteContext) {
  try {
    const route = await parts(context); const payload = await readPayload(request);
    const tenant = tenantRequestContext(request);
    const userId = tenant.authenticated ? tenant.userId : null;
    if (route[0] === "import") {
      if (tenant.multiUser) return multiUserAdminBlocked();
      const jobs = Array.isArray(payload.jobs) ? payload.jobs : [];
      const startedAt = Date.now();
      const operationId = newOperationId("import");
      const trigger = request.headers.get("x-gimmejob-trigger") === "deployment" ? "deployment" : "api_import";
      operationalInfo("job_import", { phase: "start", operationId, trigger, itemsSeen: jobs.length });
      let result;
      try {
        result = await upsertImportedVacancies(jobs);
      } catch (error) {
        const details = safeErrorDetails(error, "database_error");
        await recordObservabilityEvent({ event: "job_import", status: "failure", durationMs: Date.now() - startedAt, itemsSeen: jobs.length, itemsProcessed: null, errorCount: 1, reasonCode: details.reasonCode, httpStatus: details.httpStatus });
        operationalError("job_import", { phase: "complete", outcome: "failure", operationId, trigger, stage: "upsert_jobs", durationMs: Date.now() - startedAt, itemsSeen: jobs.length, itemsProcessed: 0, ...details });
        throw error;
      }
      await recordObservabilityEvent({ event: "job_import", status: "success", durationMs: Date.now() - startedAt, itemsSeen: jobs.length, itemsProcessed: result.accepted, errorCount: 0 });
      await recordObservabilitySnapshot();
      operationalInfo("job_import", { phase: "complete", outcome: "success", operationId, trigger, durationMs: Date.now() - startedAt, itemsSeen: jobs.length, itemsProcessed: result.accepted, rejected: result.rejected, duplicates: result.duplicates });
      return Response.json({ ok: true, result, dashboard: await currentDashboard(request) });
    }
    if (route[0] === "sync") {
      if (tenant.multiUser) return multiUserAdminBlocked();
      const result = await syncVacancySources();
      return Response.json({ ok: true, result, dashboard: await currentDashboard(request) });
    }
    if (route[0] === "analyze") {
      if (tenant.multiUser && !userId) {
        return Response.json({ ok: false, error: "Authentication required." }, { status: 401, headers: { "cache-control": "no-store" } });
      }
      const result = await analyzeJobsForUser(userId, typeof payload.jobId === "string" ? payload.jobId : undefined, typeof payload.limit === "number" ? payload.limit : 25);
      return Response.json({ ok: true, result, dashboard: await currentDashboard(request) });
    }
    if (route[0] === "analyze-resume") {
      if (tenant.multiUser && !userId) {
        return Response.json({ ok: false, error: "Authentication required." }, { status: 401, headers: { "cache-control": "no-store" } });
      }
      if (typeof payload.jobId !== "string" || !payload.jobId) throw new Error("jobId is required.");
      const result = await adjustResumeForUser(userId, payload.jobId);
      return Response.json({ ok: true, result, dashboard: await currentDashboard(request) });
    }
    if (route[0] === "run") {
      if (tenant.multiUser) return multiUserAdminBlocked();
      const sync = await syncVacancySources();
      const analysis = await analyzeJobsForUser(null, undefined, typeof payload.limit === "number" ? payload.limit : 25);
      return Response.json({ ok: true, result: { sync, analysis }, dashboard: await currentDashboard(request) });
    }
    if (route[0] === "drafts" && route[1] && route[2]) {
      if (tenant.multiUser) {
        if (!tenant.authenticated || !tenant.userId) {
          return Response.json({ ok: false, error: "Authentication required." }, { status: 401, headers: { "cache-control": "no-store" } });
        }
        await updateTenantDraft(tenant.userId, route[1], route[2], typeof payload.recipient === "string" ? payload.recipient.trim() : undefined);
        return Response.json({ ok: true, dashboard: await currentDashboard(request) });
      }
      await updateDraft(route[1], route[2], typeof payload.recipient === "string" ? payload.recipient.trim() : undefined);
      return Response.json({ ok: true, dashboard: await currentDashboard(request) });
    }
    if (route[0] === "gmail" && route[1] === "connect") {
      if (tenant.multiUser) {
        if (!tenant.authenticated || !tenant.userId) {
          return Response.json({ ok: false, error: "Authentication required." }, { status: 401, headers: { "cache-control": "no-store" } });
        }
        return Response.json({ ok: true, connectUrl: "/auth/google/start?mode=gmail&next=/workspace" });
      }
      return Response.json({ ok: false, error: "Deploy the cloud app first, then add its URL to a Google Desktop/Web OAuth client. Nothing was changed." }, { status: 409 });
    }
    return Response.json({ error: "Route not found." }, { status: 404 });
  } catch (error) { return jsonError(error); }
}

export async function PATCH(request: Request, context: RouteContext) {
  try {
    const route = await parts(context); const payload = await readPayload(request);
    const tenant = tenantUser(request);
    if (tenant instanceof Response) return tenant;
    if (route[0] === "jobs" && route[1]) {
      const job = tenant.multiUser && tenant.userId
        ? await updateTenantJobTracking(tenant.userId, route[1], payload)
        : await updateJobTracking(route[1], payload);
      return Response.json({ ok: true, job, dashboard: await currentDashboard(request) });
    }
    if (route[0] === "interview-progress" && route[1]) {
      const progress = tenant.multiUser && tenant.userId
        ? await updateTenantInterviewProgress(tenant.userId, route[1], payload)
        : await updateInterviewProgress(route[1], payload);
      return Response.json({ ok: true, progress });
    }
    return Response.json({ error: "Route not found." }, { status: 404 });
  } catch (error) { return jsonError(error); }
}