import { ragSourcePath, searchRagDocuments, staticRagDocuments, type RagEnv } from "./rag";
import { searchService } from "./search-client";

function stripSearchMarkdown(text: string): string {
  let fenced = false;
  const lines: string[] = [];
  for (const line of text.split("\n")) {
    if (line.trimStart().startsWith("```")) fenced = !fenced;
    else if (!fenced) lines.push(line.replace(/^#{1,6}\s+/, ""));
  }
  const value = lines.join(" ");
  const parts: string[] = [];
  let cursor = 0;
  while (cursor < value.length) {
    const open = value.indexOf("[", cursor);
    if (open < 0) { parts.push(value.slice(cursor)); break; }
    parts.push(value.slice(cursor, open));
    const end = value.indexOf("](", open + 1);
    const close = end < 0 ? -1 : value.indexOf(")", end + 2);
    if (close < 0) { parts.push(value.slice(open)); break; }
    parts.push(value.slice(open + 1, end));
    cursor = close + 1;
  }
  return parts.join("").replace(/[*`>|]/g, "").replace(/\s+/g, " ").trim();
}

export function searchSnippet(text: string, query: string): string {
  const plain = stripSearchMarkdown(text);
  const terms = query.toLowerCase().match(/[\p{L}\p{N}+#.]{3,}/gu) ?? [];
  const first = terms.map((term) => plain.toLowerCase().indexOf(term)).filter((index) => index >= 0).sort((a, b) => a - b)[0] ?? 0;
  const start = Math.max(0, first - 65);
  return `${start ? "…" : ""}${plain.slice(start, start + 280)}${plain.length > start + 280 ? "…" : ""}`;
}

export async function handlePublicSearch(request: Request, env: RagEnv): Promise<Response> {
  const params = new URL(request.url).searchParams;
  const query = (params.get("q") ?? "").trim();
  const kind = params.get("kind") || undefined;
  const language = params.get("language") || undefined;
  if (query.length < 2 || query.length > 240 || (kind && !["learning", "question"].includes(kind))
    || (language && !["en", "uk"].includes(language)) || (params.has("semantic") && !["0", "1"].includes(params.get("semantic")!))) {
    return Response.json({ error: "Use 2–240 characters and supported search filters." }, { status: 400, headers: { "cache-control": "no-store" } });
  }
  const documents = staticRagDocuments();
  const external = await searchService(env, documents, query, { semantic: params.get("semantic") === "1", kind, language, limit: 20 });
  const byId = new Map(documents.map((document) => [document.id, document]));
  let candidates = external?.candidates;
  if (!candidates) {
    const fallback = await searchRagDocuments({ DB: env.DB }, query, kind ? [kind as "learning" | "question"] : ["learning", "question"], 25);
    candidates = fallback.results.map(({ id, score }) => ({ id, score }));
  }
  const seen = new Set<string>();
  const results = candidates.flatMap(({ id }) => {
    const document = byId.get(id);
    if (!document || (kind && document.kind !== kind) || (language && document.metadata.language !== language)) return [];
    const canonical = `${document.metadata.catalog}:${document.refId}`;
    if (seen.has(canonical)) return [];
    seen.add(canonical);
    return [{ id, title: document.title, snippet: searchSnippet(document.text, query), href: ragSourcePath(document),
      kind: document.kind, language: document.metadata.language ?? "en", section: document.metadata.section ?? null,
      category: document.metadata.category ?? document.metadata.catalog }];
  }).slice(0, 20);
  return Response.json({ query, mode: external?.mode ?? "fallback", semanticAvailable: external?.semanticAvailable ?? false, results },
    { headers: { "cache-control": "public, max-age=30", "x-content-type-options": "nosniff" } });
}
