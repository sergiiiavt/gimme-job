import { vacancySyncFreshness, type VacancySyncState } from "./_vacancy-sync-state";

export type VacancySyncTenant = {
  multiUser: boolean;
  authenticated: boolean;
  userId: string | null;
};

type VacancySyncFn = () => Promise<unknown>;
type DashboardFn = (request: Request) => Promise<unknown>;

/**
 * Collecting vacancies is a minutes-long crawl across several job boards, and a
 * browser has no reason to wait for one it does not need. When the caller wires
 * the catalogue marker, a sync that a scheduled run already covered is reported
 * as already-fresh instead of repeated, and a run that is still in flight is
 * never started twice.
 */
export interface VacancySyncGate {
  readState?: () => Promise<VacancySyncState>;
  /** Set by an explicit user request for fresh data. */
  force?: boolean;
  now?: number;
}

export type VacancySyncSkipReason = "fresh" | "running";

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
  gate: VacancySyncGate = {},
): Promise<Response> {
  if (tenant.multiUser && (!tenant.authenticated || !tenant.userId)) {
    return authenticationRequired();
  }

  const state = gate.readState ? await gate.readState() : null;
  if (state) {
    const freshness = vacancySyncFreshness(state, { now: gate.now });
    const skipped: VacancySyncSkipReason | null = freshness.running
      ? "running"
      : (freshness.fresh && !gate.force ? "fresh" : null);
    if (skipped) {
      return Response.json(
        { ok: true, skipped, sync: state, dashboard: await loadDashboard(request) },
        { status: skipped === "running" ? 202 : 200, headers: { "cache-control": "no-store" } },
      );
    }
  }

  try {
    const result = await syncVacancies();
    const dashboard = await loadDashboard(request);
    const payload = state
      ? { ok: true, result, sync: gate.readState ? await gate.readState() : state, dashboard }
      : { ok: true, result, dashboard };
    return Response.json(payload);
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
