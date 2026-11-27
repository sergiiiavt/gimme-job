import type { RagDocument } from "./rag";

/** Reviewed equivalents, never related-but-distinct concepts such as HTTP 401 / 403. */
export const SEARCH_EQUIVALENTS = [
  ["fixture", "fixtures", "фікстура", "фікстури", "фікстурою", "фікстурами", "фікстур"],
  ["parametrize", "parametrization", "parameterization", "параметризація", "параметризації", "параметризацію"],
  ["boundary value analysis", "bva", "аналіз граничних значень"],
  ["equivalence partitioning", "класи еквівалентності"],
  ["postgresql", "postgres"], ["kubernetes", "k8s"],
  ["bluetooth low energy", "ble"], ["continuous integration", "ci"],
  ["decorator", "декоратор", "декоратори"], ["generator", "генератор", "генератори"],
  ["transaction", "транзакція", "транзакції"], ["rebase", "перебазування"],
  ["percentile", "перцентиль", "перцентилі"], ["flaky", "нестабільні тести"],
  ["prompt injection", "ін'єкція промпту", "ін’єкція промпту"],
] as const;

function trimTrailingDots(token: string): string {
  let end = token.length;
  while (end > 0 && token[end - 1] === ".") end -= 1;
  return token.slice(0, end);
}

export function searchTokens(text: string): string[] {
  return text.toLocaleLowerCase("en").normalize("NFKC").match(/[\p{L}\p{N}_+#.]+/gu)?.map(trimTrailingDots).filter((token) => /[\p{L}\p{N}]/u.test(token)) ?? [];
}

export function protectedSearchTerms(text: string): string[] {
  const tokens = searchTokens(text);
  return [...new Set(tokens.flatMap((token) => {
    if (token === "c#") return ["csharp"];
    if (token === "c++") return ["cplusplus"];
    if (token === ".net") return ["dotnet"];
    if (/^[1-5]\d{2}$/.test(token)) return [`status${token}`];
    return [];
  }))];
}

export function equivalentTerms(text: string): string {
  const searchable = ` ${searchTokens(text).join(" ")} `;
  return SEARCH_EQUIVALENTS.filter((group) => group.some((term) => searchable.includes(` ${term} `)))
    .flat().join(" ");
}

export type SearchIndexDocument = {
  id: string; title: string; body: string; aliases: string; title_aliases: string; kind: string;
  language: string; parent: string; canonical: string; technical: string[];
};

export function searchIndexDocuments(documents: readonly RagDocument[]): SearchIndexDocument[] {
  return documents.filter((document) => document.kind === "learning" || document.kind === "question").map((document) => ({
    id: document.id, title: document.title, body: document.text,
    title_aliases: equivalentTerms(document.title),
    aliases: equivalentTerms(`${document.title}\n${document.text}`), kind: document.kind,
    language: String(document.metadata.language ?? "en"),
    parent: `${document.metadata.route}:${document.metadata.topic ?? document.refId.split("#")[0]}`,
    canonical: `${document.metadata.catalog}:${document.refId}`,
    technical: protectedSearchTerms(`${document.title}\n${document.text}`),
  }));
}

const revisions = new WeakMap<readonly RagDocument[], Promise<string>>();
/** Same projection and hash in the Worker and image build: mismatched releases fail back safely. */
export function searchCorpusRevision(documents: readonly RagDocument[]): Promise<string> {
  if (typeof __GIMMEJOB_SEARCH_REVISION__ !== "undefined" && __GIMMEJOB_SEARCH_REVISION__) return Promise.resolve(__GIMMEJOB_SEARCH_REVISION__);
  let revision = revisions.get(documents);
  revision ??= crypto.subtle.digest("SHA-256", new TextEncoder().encode(JSON.stringify(searchIndexDocuments(documents))))
    .then((bytes) => Array.from(new Uint8Array(bytes), (byte) => byte.toString(16).padStart(2, "0")).join(""));
  revisions.set(documents, revision);
  return revision;
}
