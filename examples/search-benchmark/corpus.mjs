import { register } from "node:module";
import { register as registerTsx } from "tsx/esm/api";

// Use the production discovery implementation and the same Markdown loader as its tests.
// This experiment must never query D1, private state, or a production search service.
export async function canonicalCorpus() {
  registerTsx();
  register("../../tests/helpers/raw-markdown-loader.mjs", import.meta.url);
  const { staticRagDocuments, ragSourcePath } = await import("../../worker/rag.ts");
  const rows = staticRagDocuments().map((document) => ({
    id: document.id,
    title: document.title,
    body: document.text,
    kind: document.kind,
    route: String(document.metadata.route),
    topic: String(document.metadata.topic ?? ""),
    section: String(document.metadata.section ?? ""),
    path: ragSourcePath(document),
  }));
  // Vectorize upsert is last-write-wins for an ID. Mirror it explicitly and expose
  // conflicts rather than silently dropping records or inventing new public IDs.
  const unique = new Map();
  const collisions = [];
  for (const row of rows) {
    const previous = unique.get(row.id);
    if (previous) collisions.push({ id: row.id, previousTitle: previous.title, retainedTitle: row.title });
    unique.set(row.id, row);
  }
  return { documents: [...unique.values()], sourceRowCount: rows.length, collisions };
}
