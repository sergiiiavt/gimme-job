/**
 * The self-hosted n8n runtime (n8n.gimme-job.com) is paused while it is down.
 * While paused, every n8n-only Worker route answers 503 before authentication,
 * so n8n cannot read, write, or report anything when it comes back, and the
 * Hetzner n8n runtime workflows run only on manual dispatch.
 * Set to true (and restore those workflows' push triggers) to resume.
 * The email routes stay governed by EMAIL_AUTOMATION_ENABLED as well.
 */
export const N8N_INTEGRATION_ENABLED = false;

const N8N_ROUTE_PREFIX = "/internal/n8n/";

/** The hourly GitHub Actions vacancy sync POSTs here; it does not run through n8n. */
const VACANCY_SYNC_PATH = "/internal/n8n/vacancies-sync";

/** Every `/internal/n8n/*` request except the GitHub Actions vacancy-sync POST. */
export function isN8nOnlyRequest(request: Request): boolean {
  const { pathname } = new URL(request.url);
  if (!pathname.startsWith(N8N_ROUTE_PREFIX)) return false;
  return !(pathname === VACANCY_SYNC_PATH && request.method === "POST");
}

export function n8nIntegrationPausedResponse(request: Request, enabled = N8N_INTEGRATION_ENABLED): Response | null {
  if (enabled || !isN8nOnlyRequest(request)) return null;
  return Response.json(
    { error: "The n8n integration is paused.", code: "n8n_integration_paused" },
    { status: 503, headers: { "cache-control": "no-store", "x-robots-tag": "noindex, nofollow, noarchive" } },
  );
}
