import { readUserSession, type MultiUserAuthEnv } from "../google-oauth.ts";
import { ensureForwardingAlias } from "../password-auth.ts";
import { forwardingAddress } from "../../../worker/email-forwarding.ts";

async function runtimeEnv(): Promise<MultiUserAuthEnv> {
  return (await import("cloudflare:workers")).env as unknown as MultiUserAuthEnv;
}

type VerificationRow = {
  verification_url?: string | null;
  confirmation_code?: string | null;
  expires_at?: string | null;
};

export async function GET(request: Request): Promise<Response> {
  const env = await runtimeEnv();
  const user = await readUserSession(request, env);
  if (!user || !env.DB) {
    return Response.json({ error: "Authentication required." }, {
      status: 401,
      headers: { "cache-control": "no-store" },
    });
  }

  const token = await ensureForwardingAlias(env.DB, user.id);
  const verification = await env.DB.prepare(`SELECT verification_url, confirmation_code, expires_at
    FROM email_forwarding_verifications WHERE user_id = ? LIMIT 1`)
    .bind(user.id)
    .first<VerificationRow>();
  const active = Boolean(verification?.expires_at && Date.parse(verification.expires_at) > Date.now());

  return Response.json({
    address: forwardingAddress(token),
    verificationUrl: active ? verification?.verification_url ?? null : null,
    confirmationCode: active ? verification?.confirmation_code ?? null : null,
  }, {
    headers: {
      "cache-control": "no-store",
      "x-content-type-options": "nosniff",
      "x-robots-tag": "noindex, nofollow, noarchive",
    },
  });
}
