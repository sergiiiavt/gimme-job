import { syncVacancySources } from "../../../api/_vacancy-intake";
import { bearerToken, constantTimeEqual } from "../email-events/email-event";

type VacancySyncEnv = { N8N_INGEST_TOKEN?: string };

async function runtimeEnv(): Promise<VacancySyncEnv> {
  return (await import("cloudflare:workers")).env as unknown as VacancySyncEnv;
}

function json(payload: unknown, status = 200): Response {
  return Response.json(payload, {
    status,
    headers: {
      "cache-control": "no-store",
      "x-content-type-options": "nosniff",
      "x-robots-tag": "noindex, nofollow, noarchive",
    },
  });
}

function authorize(request: Request, env: VacancySyncEnv): Response | null {
  const configured = env.N8N_INGEST_TOKEN?.trim() ?? "";
  if (!configured) return json({ error: "Vacancy sync is not configured." }, 503);
  const supplied = bearerToken(request.headers.get("authorization"));
  if (supplied && constantTimeEqual(supplied, configured)) return null;
  return new Response(JSON.stringify({ error: "Authentication required." }), {
    status: 401,
    headers: {
      "cache-control": "no-store",
      "content-type": "application/json; charset=utf-8",
      "www-authenticate": "Bearer",
      "x-content-type-options": "nosniff",
      "x-robots-tag": "noindex, nofollow, noarchive",
    },
  });
}

export async function POST(request: Request): Promise<Response> {
  const env = await runtimeEnv();
  const authError = authorize(request, env);
  if (authError) return authError;
  const startedAt = Date.now();

  try {
    const result = await syncVacancySources();
    console.log({
      schemaVersion: 1,
      service: "gimmejob",
      environment: "production",
      event: "vacancy_sync",
      outcome: result.errors.length ? "degraded" : "success",
      durationMs: Date.now() - startedAt,
      seen: result.seen,
      relevant: result.relevant,
      rejected: result.rejected,
      duplicates: result.duplicates,
      inserted: result.inserted,
      updated: result.updated,
      sourceErrors: result.errors.length,
    });
    return json({ ok: true, result });
  } catch (error) {
    console.error({
      schemaVersion: 1,
      service: "gimmejob",
      environment: "production",
      event: "vacancy_sync",
      outcome: "failure",
      durationMs: Date.now() - startedAt,
      errorType: error instanceof Error ? error.name : "UnknownError",
      error: error instanceof Error ? error.message : String(error),
    });
    return json({ error: "Vacancy synchronization failed." }, 500);
  }
}
