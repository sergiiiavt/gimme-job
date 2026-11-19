import assert from "node:assert/strict";
import { register as registerLoader, registerHooks } from "node:module";
import test from "node:test";
import { register as registerTsx } from "tsx/esm/api";

registerTsx();
registerLoader("./helpers/raw-markdown-loader.mjs", import.meta.url);

const cloudflareEnv: Record<string, unknown> = {};
(globalThis as Record<string, unknown>).__gimmejobQuickReferenceDeepLinkEnv = cloudflareEnv;
const cloudflareWorkersModule = `data:text/javascript,${encodeURIComponent("export const env = globalThis.__gimmejobQuickReferenceDeepLinkEnv;")}`;
registerHooks({
  resolve(specifier, context, nextResolve) {
    if (specifier === "cloudflare:workers") return { shortCircuit: true, url: cloudflareWorkersModule };
    return nextResolve(specifier, context);
  },
});

const [{ ragSourcePath, staticRagDocuments }, { referenceCardForTopic }] = await Promise.all([
  import("../worker/rag.ts"),
  import("../app/quick-reference-deep-link.ts"),
]);

type RenderedCard = { id: string; title: string; collapsed: boolean };

const env = {
  MULTI_USER_ENABLED: "true",
  APP_PASSWORD: "quick-reference-deep-link-test",
  DB: { prepare() { throw new Error("Public reference routes must not query tenant storage."); } },
  ASSETS: { fetch: async () => new Response("Not found", { status: 404 }) },
};
const context = { waitUntil() {}, passThroughOnException() {} };
let worker: { fetch(request: Request, env: unknown, context: unknown): Promise<Response> } | undefined;

async function render(path: string): Promise<string> {
  if (!worker) {
    const workerUrl = new URL("../dist/server/index.js", import.meta.url);
    workerUrl.searchParams.set("quick-reference-deep-link-test", `${process.pid}-${Date.now()}`);
    worker = (await import(workerUrl.href)).default;
    Object.assign(cloudflareEnv, env);
  }
  const response = await worker!.fetch(new Request(new URL(path, "https://gimmejob.example")), env, context);
  assert.equal(response.status, 200, path);
  return response.text();
}

function decodeHtml(value: string): string {
  return value
    .replace(/<!--[\s\S]*?-->/g, "")
    .replace(/&quot;/g, "\"")
    .replace(/&#x27;|&#39;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&")
    .trim();
}

/** The cards a rendered reference page opened for its link. */
function openedCards(html: string): RenderedCard[] {
  return [...html.matchAll(/<article\b([^>]*)>([\s\S]*?)<\/article>/g)]
    .filter(([, attributes]) => /\bdata-deep-link-target="true"/.test(attributes))
    .map(([, attributes, body]) => ({
      id: attributes.match(/\bid="([^"]+)"/)?.[1] ?? "",
      title: decodeHtml(body.match(/<h2>([\s\S]*?)<\/h2>/)?.[1] ?? ""),
      collapsed: /aria-expanded="false"/.test(body),
    }));
}

const referenceDocuments = staticRagDocuments().filter((document) =>
  document.kind === "learning" && String(document.metadata.route).startsWith("/reference/"));

test("quick-reference and task catalogs link to the reference page that renders their cards", () => {
  for (const catalog of ["python-quick-reference", "sql-quick-reference", "sql-practical-tasks"]) {
    const documents = staticRagDocuments().filter((document) => document.kind === "learning" && document.metadata.catalog === catalog);
    assert.ok(documents.length > 0, `${catalog} is retrievable`);
    assert.ok(documents.every((document) => referenceDocuments.includes(document)), `${catalog} links to its quick-reference page`);
  }
});

test("every quick-reference retrieval link opens and expands its own card", async () => {
  assert.ok(referenceDocuments.length > 0);
  for (const document of referenceDocuments) {
    const path = ragSourcePath(document);
    const opened = openedCards(await render(path));
    assert.equal(opened.length, 1, `${path} opens exactly one card`);
    assert.equal(opened[0]!.title, document.title, `${path} opens the card retrieval described`);
    assert.equal(opened[0]!.collapsed, false, `${path} shows the whole card`);
  }
});

test("a reference page link without a matching card opens none", async () => {
  for (const path of [
    "/reference/data",
    "/reference/data?topic=unknown-card",
    "/reference/programming?topic=strings&track=csharp",
  ]) {
    assert.deepEqual(openedCards(await render(path)), [], path);
  }
});

test("a topic resolves to a rendered card id, or to a catalog id inside the requested track", () => {
  const cards = [
    { id: "general-strings", sourceId: "strings" },
    { id: "python-strings", sourceId: "strings", track: "python" },
    { id: "csharp-strings", sourceId: "strings", track: "csharp" },
    { id: "csharp-linq", sourceId: "linq", track: "csharp" },
  ];
  assert.equal(referenceCardForTopic(cards, "csharp-strings", "python")?.id, "csharp-strings", "a rendered id is exact");
  assert.equal(referenceCardForTopic(cards, "strings", "python")?.id, "python-strings");
  assert.equal(referenceCardForTopic(cards, "strings", "csharp")?.id, "csharp-strings");
  assert.equal(referenceCardForTopic(cards, "strings")?.id, "general-strings", "without a track the first card wins");
  assert.equal(referenceCardForTopic(cards, "linq", "python"), undefined, "a card outside the requested track stays closed");
  assert.equal(referenceCardForTopic(cards, " ", "python"), undefined);
  assert.equal(referenceCardForTopic(cards, undefined), undefined);
});
