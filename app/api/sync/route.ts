import {
  dashboard,
  jsonError,
} from "../_jobpilot";
import {
  sanitizeDashboardPayload,
  syncVacancySources,
} from "../_vacancy-intake";
import {
  tenantDashboard,
  tenantRequestContext,
} from "../_tenant-state";

async function currentDashboard(request: Request) {
  const tenant = tenantRequestContext(request);
  const userId = tenant.authenticated ? tenant.userId : null;
  const value = tenant.multiUser ? await tenantDashboard(userId, request) : await dashboard(request);
  return sanitizeDashboardPayload(value);
}

function authenticationRequired(): Response {
  return Response.json(
    { ok: false, error: "Authentication required." },
    { status: 401, headers: { "cache-control": "no-store" } },
  );
}

export async function POST(request: Request): Promise<Response> {
  try {
    const tenant = tenantRequestContext(request);
    if (tenant.multiUser && (!tenant.authenticated || !tenant.userId)) {
      return authenticationRequired();
    }

    const result = await syncVacancySources();
    return Response.json(
      { ok: true, result, dashboard: await currentDashboard(request) },
      { headers: { "cache-control": "no-store" } },
    );
  } catch (error) {
    return jsonError(error);
  }
}
