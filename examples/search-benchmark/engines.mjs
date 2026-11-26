import { allowedTypos, normalizer } from "./model.mjs";

export function prepareDocuments(documents, aliases, assisted) {
  const normalize = normalizer(aliases, assisted);
  return { documents: documents.map((document) => ({ ...document,
    title: normalize(document.title), body: normalize(document.body),
  })), normalize };
}

export async function oramaEngine(documents, normalize) {
  const { create, insertMultiple, search, save, load } = await import("@orama/orama");
  const createIndex = () => create({ schema: { title: "string", body: "string" },
    components: { tokenizer: { language: "english",
      // The shared normalization retains Unicode and technical identifiers for both engines.
      tokenize: (text) => [...new Set(text.split(/\s+/u).filter(Boolean))],
    } } });
  let db = createIndex();
  await insertMultiple(db, documents);
  return {
    async search(query) {
      const term = normalize(query, true);
      if (!term) return [];
      const result = await search(db, { term, properties: ["title", "body"],
        boost: { title: 4, body: 1 }, threshold: 0, tolerance: allowedTypos(term), limit: 30 });
      return result.hits.map(({ document }) => document);
    },
    snapshot() { return JSON.stringify(save(db)); },
    unload() { db = null; },
    restore(snapshot) { db = createIndex(); load(db, JSON.parse(snapshot)); },
  };
}

export async function typesenseEngine(documents, normalize, endpoint, key, collection) {
  const request = async (path, options = {}) => {
    const response = await fetch(`${endpoint}${path}`, {
      ...options, headers: { "X-TYPESENSE-API-KEY": key, "Content-Type": "application/json" },
      signal: AbortSignal.timeout(60_000),
    });
    const text = await response.text();
    if (!response.ok) throw new Error(`Typesense ${response.status}: ${text.slice(0, 500)}`);
    return text;
  };
  await request("/collections", { method: "POST", body: JSON.stringify({ name: collection,
    token_separators: [], symbols_to_index: ["_", "-", "'"],
    fields: [{ name: "title", type: "string", infix: true }, { name: "body", type: "string" }],
  }) });
  const imported = await request(`/collections/${collection}/documents/import?action=create`, {
    method: "POST", body: documents.map((document) => JSON.stringify(document)).join("\n"),
  });
  const failures = imported.trim().split("\n").map((line) => JSON.parse(line)).filter((row) => !row.success);
  if (failures.length) throw new Error(`Typesense import failed: ${JSON.stringify(failures.slice(0, 2))}`);
  return {
    async search(query) {
      const q = normalize(query, true);
      if (!q) return [];
      const params = new URLSearchParams({ q, query_by: "title,body", query_by_weights: "4,1",
        prefix: "true,true", num_typos: String(allowedTypos(q)), min_len_1typo: "5", min_len_2typo: "9",
        drop_tokens_threshold: "0", enable_typos_for_numerical_tokens: "false",
        enable_typos_for_alpha_numerical_tokens: "false", per_page: "30",
        infix: q.split(" ").length === 1 && q.length >= 4 ? "always,off" : "off,off",
        exclude_fields: "body", highlight_fields: "none", use_cache: "false",
      });
      const result = JSON.parse(await request(`/collections/${collection}/documents/search?${params}`));
      return result.hits.map(({ document }) => document);
    },
  };
}
