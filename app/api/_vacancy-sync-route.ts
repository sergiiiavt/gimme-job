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

  try {
    const result = await syncVacancies();
    const dashboard = await loadDashboard(request);
    return Response.json({ ok: true, result, dashboard });
  } catch (error) {
    // A sync that collected nothing must not read as success. The per-source
    // reasons are the only diagnostic there is, so they travel to the caller.
    const message = error instanceof Error ? error.message : String(error);
    console.error({
      schemaVersion: 1,
      service: "gimmejob",
      event: "vacancy_sync_request",
      outcome: "failure",
      error: message,
    });
    return Response.json(
      { ok: false, error: message },
      { status: 502, headers: { "cache-control": "no-store" } },
    );
  }
}
