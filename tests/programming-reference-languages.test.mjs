import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const reference = JSON.parse(readFileSync("content/programming-reference/quick-reference.json", "utf8"));
const page = readFileSync("app/quick-reference-page.tsx", "utf8");
const learning = readFileSync("app/programming-learning-page.tsx", "utf8");
const csharpLearning = readFileSync("content/csharp-learning/catalog.ts", "utf8");
const python = JSON.parse(readFileSync("content/python-learning/quick-reference.json", "utf8"));

test("General and C# references are separate from the existing Python catalog", () => {
  assert.ok(reference.general.length >= 5);
  assert.ok(reference.csharp.length >= 12);
  assert.ok(python.cards.length >= 25);
  assert.match(page, /\.\.\.pythonReferenceCards/);
  assert.match(page, /\.\.\.programmingReferenceCatalog\.general\.map/);
  assert.match(page, /\.\.\.programmingReferenceCatalog\.csharp\.map/);
  assert.match(page, /languages: \["Python"\]/);
  assert.match(page, /languages: \["General"\]/);
  assert.match(page, /languages: \["C#"\]/);
});

test("C# quick reference covers all published programming C# modules", () => {
  const published = [...csharpLearning.matchAll(/id: "(csharp-[a-z-]+)",\s*\n\s*label: /g)]
    .map((match) => match[1]);
  assert.equal(published.length, 10);
  const covered = new Set(reference.csharp.map((card) => card.moduleId));
  for (const moduleId of published) {
    assert.ok(covered.has(moduleId), `Missing C# quick reference for ${moduleId}`);
  }
  assert.match(learning, /id: "csharp", label: "C#", available: true/);
  assert.match(learning, /id: "typescript", label: "TypeScript", available: false/);
});

test("Cards have unique IDs, meaningful examples, and registered filters", () => {
  const ids = new Set();
  const topics = new Set([...python.filters, ...reference.topicFilters]);
  for (const [group, cards] of Object.entries({general: reference.general, csharp: reference.csharp})) {
    for (const card of cards) {
      assert.ok(!ids.has(`${group}-${card.id}`));
      ids.add(`${group}-${card.id}`);
      assert.ok(card.title.length > 4 && card.summary.length > 25);
      assert.ok(card.topics.length > 0 && card.topics.every((topic) => topics.has(topic)), card.id);
      assert.ok(card.entries.length >= 4, card.id);
      assert.ok(card.entries.concat(card.more).every((row) => row.term && row.meaning && row.detail), card.id);
      if (group === "general") assert.equal(card.moduleId, null, card.id);
      else assert.match(card.moduleId, /^csharp-/);
    }
  }
});

test("Programming language filter mirrors SQL portable-dialect semantics", () => {
  assert.match(page, /referenceId === "programming" \? \["All", "General", "Python", "C#"\]/);
  assert.match(page, /aria-label=\{referenceId === "programming" \? "Programming language" : "SQL dialect"\}/);
  assert.match(page, /language === "All" \|\| card\.languages\?\.includes\(language\) \|\| \(language !== "General" && card\.languages\?\.includes\("General"\)\)/);
  assert.match(page, /matchesProgrammingLanguage\(card, dialect\)/);
  assert.match(page, /setDialect\(item\); setScope\("All"\);/);
  assert.match(page, /availableTopics\.has\(filter\)/);
  assert.match(page, /programmingLanguage === "C#"/);
  assert.match(page, /dialect === "C#" \? "csharp" : "python"/);
});

test("SQL dialect and non-programming reference behavior stays intact", () => {
  assert.match(page, /sqlReferenceCatalog\.dialectFilters/);
  assert.match(page, /dialect !== "Portable" && card\.dialects\?\.includes\("Portable"\)/);
  assert.match(page, /qaReferenceCatalog\.filters/);
  assert.match(page, /referenceId === "data" \? "sql" : undefined/);
});
