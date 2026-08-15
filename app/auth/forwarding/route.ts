import { readUserSession, type MultiUserAuthEnv } from "../google-oauth.ts";
import { ensureForwardingAlias } from "../password-auth.ts";
import { forwardingAddress } from "../../../worker/email-forwarding.ts";

async function runtimeEnv(): Promise<MultiUserAuthEnv> {
  return (await import("cloudflare:workers")).env as unknown as MultiUserAuthEnv;
}

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
  return Response.json({ address: forwardingAddress(token) }, {
    headers: {
      "cache-control": "no-store",
      "x-content-type-options": "nosniff",
      "x-robots-tag": "noindex, nofollow, noarchive",
    },
  });
}
