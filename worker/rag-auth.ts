function constantTimeEqual(left: string, right: string): boolean {
  const length = Math.max(left.length, right.length);
  let difference = left.length ^ right.length;
  for (let index = 0; index < length; index += 1) {
    difference |= (left.charCodeAt(index) || 0) ^ (right.charCodeAt(index) || 0);
  }
  return difference === 0;
}

export function hasRagServiceToken(request: Request, configuredToken: string | undefined): boolean {
  if (!configuredToken) return false;
  const supplied = request.headers.get("x-gimmejob-rag-token")?.trim() ?? "";
  return Boolean(supplied) && constantTimeEqual(supplied, configuredToken);
}

export function ragServiceAuthFailure(configured: boolean): Response {
  return Response.json(
    { error: configured ? "RAG service authentication required." : "RAG service authentication is not configured." },
    {
      status: configured ? 401 : 503,
      headers: { "cache-control": "no-store" },
    },
  );
}
