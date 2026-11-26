import { matchesTarget } from "./model.mjs";

// Synthetic controls are separate from the real corpus and its relevance scores.
export const controlDocuments = [
  ["csharp", "C# language"], ["cplusplus", "C++ language"], ["dotnet", ".NET runtime"],
  ["401", "HTTP 401"], ["403", "HTTP 403"],
  ["authentication", "Authentication identity"], ["authorization", "Authorization permissions"],
].map(([id, title]) => ({ id, title, body: title, path: `/control/${id}` }));

export const controlQueries = [
  ...["csharp", "cplusplus", "dotnet", "401", "403", "authentication", "authorization"].map((id) => ({
    query: controlDocuments.find((document) => document.id === id).title.split(" ").slice(0, id === "401" || id === "403" ? 2 : 1).join(" "),
    expected: [id],
  })),
  { query: "HTTP 404", expected: [] },
  { query: "C# PostgreSQL", expected: [] },
  { query: "zxqvnotpresent", expected: [] },
];

export async function checkControls(engine) {
  const rows = [];
  for (const { query, expected } of controlQueries) {
    const hits = await engine.search(query);
    const ids = hits.map(({ id }) => id).sort();
    const passed = ids.length === expected.length && expected.every((id) => hits.some((hit) => matchesTarget(hit, { id })));
    rows.push({ query, expected, actual: ids, passed });
  }
  return rows;
}
