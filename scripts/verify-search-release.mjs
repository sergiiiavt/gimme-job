import { readFile } from "node:fs/promises";
import { setTimeout } from "node:timers/promises";
const snapshot = JSON.parse(await readFile(new URL("../ai-service/search-corpus.json", import.meta.url), "utf8"));
const origin = process.env.GIMMEJOB_AI_URL;
const token = process.env.GIMMEJOB_AI_SERVICE_TOKEN;
if (!origin || !token) throw new Error("Search release verification requires the configured private gateway.");
async function verifyQueries() {
  const documents = new Map(snapshot.documents.map((document) => [document.id, document]));
  const cases = [
    { query: "How do I supply multiple input sets to a single pytest test?", accepts: (document) => /parametriz|parameteriz|параметриз/i.test(document.title) },
    { query: "Як повернути Git до попереднього коміту, залишивши зміни у файлах?", accepts: (document) => document.parent.startsWith("/learn/git:") },
  ];
  for (const item of cases) {
    const response = await fetch(new URL("/v1/search", origin), {
      method: "POST", headers: { authorization: `Bearer ${token}`, "content-type": "application/json" },
      body: JSON.stringify({ query: item.query, revision: snapshot.revision, semantic: true, limit: 12 }),
      signal: AbortSignal.timeout(25_000),
    });
    if (!response.ok) throw new Error(`Live semantic acceptance request failed: ${response.status}`);
    const result = await response.json();
    const hits = result.candidates.map((candidate) => documents.get(candidate.id)).filter(Boolean);
    if (result.mode !== "hybrid" || !hits.some(item.accepts)) throw new Error(`Live semantic acceptance failed for: ${item.query}`);
    console.log(`Semantic acceptance: ${item.query} → ${hits.slice(0, 3).map((document) => document.title).join(" | ")}`);
  }
  const publicResponse = await fetch("https://gimme-job.com/api/public/search?q=k8s", { signal: AbortSignal.timeout(15_000) });
  if (!publicResponse.ok) throw new Error(`Public search transport failed: ${publicResponse.status}`);
  const publicResult = await publicResponse.json();
  if (publicResult.mode !== "typesense" || !publicResult.results.length) throw new Error("Public search did not reach the current Typesense index.");
  console.log("Anonymous public search transport verified.");
}
for (let attempt = 1; attempt <= 80; attempt += 1) {
  let health;
  try {
    const response = await fetch(new URL("/v1/search/health", origin), { headers: { authorization: `Bearer ${token}` }, signal: AbortSignal.timeout(5_000) });
    if (response.ok) health = await response.json();
  } catch { /* The image rollout is independent; bounded polling covers its restart. */ }
  if (health?.revision === snapshot.revision && health.count === snapshot.documents.length && health.semanticAvailable === true) {
    await verifyQueries();
    console.log(`Current lexical and semantic search index verified: ${health.count} documents.`);
    process.exit(0);
  }
  console.log(`Waiting for the current search index (${attempt}/80)...`);
  await setTimeout(10_000);
}
throw new Error("The production search index did not reach the current canonical revision with semantic retrieval enabled.");
