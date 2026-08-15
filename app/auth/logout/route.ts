import { handleLogout, type MultiUserAuthEnv } from "../google-oauth.ts";

async function runtimeEnv(): Promise<MultiUserAuthEnv> {
  return (await import("cloudflare:workers")).env as unknown as MultiUserAuthEnv;
}

export async function POST(request: Request): Promise<Response> {
  return handleLogout(request, await runtimeEnv());
}
