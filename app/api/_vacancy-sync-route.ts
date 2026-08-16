export type VacancySyncTenant = {
  multiUser: boolean;
  authenticated: boolean;
  userId: string | null;
};

type VacancySyncFn = () => Promise<unknown>;
type DashboardFn = (request: Request) => Promise<unknown>;

function authenticationRequired(): Response {
  return Response.json(
    { ok: false, error: "Authentication required." },
    { status: 401, headers: { "cache-control": "no-store" } },
  );
}

export async function handleVacancySync(
  request: Request,
  tenant: VacancySyncTenant,
  syncVacancies: VacancySyncFn,
  loadDashboard: DashboardFn,
): Promise<Response> {
  if (tenant.multiUser && (!tenant.authenticated || !tenant.userId)) {
    return authenticationRequired();
  }

  const result = await syncVacancies();
  const dashboard = await loadDashboard(request);
  return Response.json({ ok: true, result, dashboard });
}
