import {
  decryptRefreshToken,
  multiUserEnabled,
  normalizeNextPath,
  readUserSession,
  type MultiUserAuthEnv,
} from "./google-oauth.ts";

const GOOGLE_REVOKE_URL = "https://oauth2.googleapis.com/revoke";

function redirect(location: string): Response {
  return new Response(null, {
    status: 303,
    headers: {
      location,
      "cache-control": "no-store",
      "x-robots-tag": "noindex, nofollow, noarchive",
    },
  });
}

function jsonError(error: string, status: number): Response {
  return Response.json(
    { error },
    {
      status,
      headers: {
        "cache-control": "no-store",
        "x-content-type-options": "nosniff",
        "x-robots-tag": "noindex, nofollow, noarchive",
      },
    },
  );
}

async function revokeGoogleToken(refreshToken: string): Promise<boolean> {
  const response = await fetch(GOOGLE_REVOKE_URL, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ token: refreshToken }),
  });
  return response.ok;
}

export async function handleGmailDisconnect(request: Request, env: MultiUserAuthEnv): Promise<Response> {
  if (!multiUserEnabled(env)) return jsonError("Multi-user authentication is not enabled.", 404);
  if (request.method !== "POST") {
    return new Response("Method not allowed.", {
      status: 405,
      headers: { allow: "POST", "cache-control": "no-store" },
    });
  }
  if (!env.DB) return jsonError("Cloud database is not available.", 503);

  const user = await readUserSession(request, env);
  if (!user) return jsonError("Authentication required.", 401);

  const row = await env.DB.prepare(`SELECT refresh_token_encrypted
    FROM gmail_connections
    WHERE user_id = ? AND status = 'ACTIVE'
    LIMIT 1`).bind(user.id).first<{ refresh_token_encrypted?: string | null }>();

  let revoked = false;
  const encryptedToken = row?.refresh_token_encrypted?.trim();
  const encryptionKey = env.GMAIL_TOKEN_ENCRYPTION_KEY?.trim();
  if (encryptedToken && encryptionKey) {
    try {
      const refreshToken = await decryptRefreshToken(encryptedToken, encryptionKey);
      revoked = await revokeGoogleToken(refreshToken);
    } catch {
      // Local removal still wins: an unusable token must not remain stored simply because
      // best-effort provider revocation failed.
    }
  }

  await env.DB.prepare("DELETE FROM gmail_connections WHERE user_id = ?")
    .bind(user.id)
    .run();

  const url = new URL(request.url);
  const destination = new URL(normalizeNextPath(url.searchParams.get("next")), url.origin);
  destination.searchParams.set("gmail", revoked ? "revoked" : "disconnected");
  return redirect(`${destination.pathname}${destination.search}`);
}
