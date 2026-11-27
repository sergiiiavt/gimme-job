import { registerHooks } from "node:module";
import { readFileSync } from "node:fs";
import { mkdir, writeFile } from "node:fs/promises";
import { register as registerTsx } from "tsx/esm/api";
registerTsx();
registerHooks({
  load(url, context, nextLoad) {
    const path = new URL(url);
    if (path.protocol === "file:" && path.pathname.endsWith(".md")) {
      path.search = "";
      path.hash = "";
      return { format: "module", shortCircuit: true, source: `export default ${JSON.stringify(readFileSync(path, "utf8"))};` };
    }
    return nextLoad(url, context);
  },
});
const { staticRagDocuments } = await import("../worker/rag.ts");
const { searchIndexDocuments, searchCorpusRevision } = await import("../worker/search-corpus.ts");
const documents = staticRagDocuments();
const snapshot = { revision: await searchCorpusRevision(documents), documents: searchIndexDocuments(documents) };
if (new Set(snapshot.documents.map((document) => document.id)).size !== snapshot.documents.length) throw new Error("Search IDs must be unique.");
await mkdir(new URL("../ai-service/", import.meta.url), { recursive: true });
await writeFile(new URL("../ai-service/search-corpus.json", import.meta.url), JSON.stringify(snapshot));
console.log(`Canonical search snapshot: ${snapshot.documents.length} documents, ${snapshot.revision}`);
