import { handleAuthSession, type MultiUserAuthEnv } from "../google-oauth.ts";

async function runtimeEnv(): Promise<MultiUserAuthEnv> {
  return (await import("cloudflare:workers")).env as unknown as MultiUserAuthEnv;
}

export async function GET(request: Request): Promise<Response> {
  return handleAuthSession(request, await runtimeEnv());
}

export async function HEAD(request: Request): Promise<Response> {
  return handleAuthSession(request, await runtimeEnv());
}
