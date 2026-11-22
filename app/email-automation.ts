/**
 * Email automation (Gmail forwarding, classification, vacancy linking) is paused
 * while it is unreliable. Set to true to restore the whole pipeline and its UI.
 * Stored email events stay in D1 while paused; nothing is deleted.
 */
export const EMAIL_AUTOMATION_ENABLED = false;

export const EMAIL_AUTOMATION_PAUSED_NOTE = "Email automation is paused while we rework it. Forwarded emails are not processed.";

const PAUSED_PATHS = new Set([
  "/auth/forwarding",
  "/internal/n8n/email-classify",
  "/internal/n8n/email-events",
  "/internal/n8n/email-resolve",
  "/internal/n8n/email-stats",
]);

const READ_METHODS = new Set(["GET", "HEAD"]);

/** Requests that would set up, ingest, classify, link, or report on email. Reading already stored unresolved events stays allowed. */
export function isEmailAutomationRequest(request: Request): boolean {
  const { pathname } = new URL(request.url);
  if (PAUSED_PATHS.has(pathname)) return true;
  return pathname === "/api/email-events/unresolved" && !READ_METHODS.has(request.method);
}

export function emailAutomationPausedResponse(request: Request, enabled = EMAIL_AUTOMATION_ENABLED): Response | null {
  if (enabled || !isEmailAutomationRequest(request)) return null;
  return Response.json(
    { error: "Email automation is paused.", code: "email_automation_paused" },
    { status: 503, headers: { "cache-control": "no-store", "x-robots-tag": "noindex, nofollow, noarchive" } },
  );
}
