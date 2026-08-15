function isTrustedDevelopmentHost(hostname: string): boolean {
  return hostname === "localhost" || hostname === "127.0.0.1" || hostname === "terminal.local";
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const authenticated = request.headers.get("x-gimmejob-authenticated") === "1" || isTrustedDevelopmentHost(url.hostname);
  const userId = request.headers.get("x-gimmejob-user-id")?.trim() || null;

  return Response.json(
    { authenticated, userId: authenticated ? userId : null },
    {
      status: authenticated ? 200 : 401,
      headers: { "cache-control": "no-store" },
    },
  );
}
