import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const catalog = JSON.parse(await readFile(new URL("../content/python-learning/quick-reference.json", import.meta.url), "utf8"));
const guidance = JSON.parse(await readFile(new URL("../content/python-learning/quick-reference-guidance.json", import.meta.url), "utf8"));

const expectedFilters = [
  "All",
  "Syntax",
  "Types",
  "Collections",
  "Strings",
  "Functions",
  "OOP",
  "Typing",
  "Files",
  "Stdlib",
  "Async",
  "Testing",
  "Tooling",
  "Advanced",
  "Gotchas",
];
const allowedTags = new Set(expectedFilters.slice(1));
const requiredExplainedCards = new Set([
  "core-syntax",
  "control-flow",
  "functions",
  "iterators-generators",
  "exceptions",
  "oop",
  "concurrency",
]);

assert.deepEqual(catalog.filters, expectedFilters, "Python quick-reference filters changed unexpectedly.");
assert.equal(catalog.cards.length, 24, "Python API quick reference must keep exactly 24 base concept cards.");
assert.ok(guidance && typeof guidance === "object", "Python quick-reference guidance is missing.");
assert.equal(guidance.theoryCards?.length, 2, "Python quick reference must include the two focused theory cards.");

const ids = new Set();
const titles = new Set();
const baseTerms = new Map();
let referenceCount = 0;
let explainedReferenceCount = 0;

function validateTags(card) {
  assert.ok(Array.isArray(card.tags) && card.tags.length >= 1, `Add at least one tag to ${card.id}`);
  for (const tag of card.tags) {
    assert.ok(allowedTags.has(tag), `Unknown tag ${tag} in ${card.id}`);
  }
}

function registerCard(card) {
  assert.match(card.id, /^[a-z0-9]+(?:-[a-z0-9]+)*$/, `Invalid card id: ${card.id}`);
  assert.ok(!ids.has(card.id), `Duplicate card id: ${card.id}`);
  ids.add(card.id);

  assert.ok(card.title?.trim(), `Missing title for ${card.id}`);
  const normalizedTitle = card.title.trim().toLowerCase();
  assert.ok(!titles.has(normalizedTitle), `Duplicate card title: ${card.title}`);
  titles.add(normalizedTitle);
  validateTags(card);
}

for (const card of catalog.cards) {
  registerCard(card);
  assert.ok(guidance.summaries?.[card.id]?.trim(), `Add a human-friendly summary for ${card.id}.`);
  assert.ok(Array.isArray(card.entries) && card.entries.length >= 7, `${card.id} needs at least 7 primary references.`);
  assert.ok(Array.isArray(card.more) && card.more.length >= 4, `${card.id} needs at least 4 secondary references.`);

  const terms = new Set();
  for (const row of [...card.entries, ...card.more]) {
    assert.ok(row.term?.trim(), `Missing term in ${card.id}`);
    assert.ok(row.detail?.trim(), `Missing detail for ${row.term || "unknown row"} in ${card.id}`);
    const normalizedTerm = row.term.trim().toLowerCase();
    assert.ok(!terms.has(normalizedTerm), `Duplicate term ${row.term} in ${card.id}`);
    terms.add(normalizedTerm);
    referenceCount += 1;
  }
  baseTerms.set(card.id, terms);

  if (requiredExplainedCards.has(card.id)) {
    for (const row of card.entries) {
      assert.ok(guidance.explanations?.[card.id]?.[row.term]?.trim(), `${card.id} primary reference ${row.term} needs a human explanation.`);
    }
  }
}

for (const [cardId, explanations] of Object.entries(guidance.explanations ?? {})) {
  assert.ok(baseTerms.has(cardId), `Guidance references unknown base card ${cardId}.`);
  for (const [term, explanation] of Object.entries(explanations)) {
    assert.ok(baseTerms.get(cardId).has(term.toLowerCase()), `Guidance references unknown term ${term} in ${cardId}.`);
    assert.ok(explanation?.trim(), `Empty explanation for ${term} in ${cardId}.`);
    explainedReferenceCount += 1;
  }
}

for (const card of guidance.theoryCards) {
  registerCard(card);
  assert.ok(baseTerms.has(card.after), `Theory card ${card.id} must be positioned after a real base card.`);
  assert.ok(card.summary?.trim(), `Theory card ${card.id} needs a human-friendly summary.`);
  assert.ok(Array.isArray(card.entries) && card.entries.length >= 7, `${card.id} needs at least 7 primary theory references.`);
  assert.ok(Array.isArray(card.more) && card.more.length >= 4, `${card.id} needs at least 4 secondary theory references.`);

  const terms = new Set();
  for (const row of [...card.entries, ...card.more]) {
    assert.ok(row.term?.trim(), `Missing theory term in ${card.id}`);
    assert.ok(row.meaning?.trim(), `Theory reference ${row.term || "unknown row"} in ${card.id} needs a plain-language meaning.`);
    assert.ok(row.detail?.trim(), `Theory reference ${row.term || "unknown row"} in ${card.id} needs a concrete example.`);
    const normalizedTerm = row.term.trim().toLowerCase();
    assert.ok(!terms.has(normalizedTerm), `Duplicate theory term ${row.term} in ${card.id}`);
    terms.add(normalizedTerm);
    referenceCount += 1;
    explainedReferenceCount += 1;
  }
}

assert.ok(ids.has("mutability-references"), "Python quick reference must explain mutable and immutable objects.");
assert.ok(ids.has("identity-hashing-truthiness"), "Python quick reference must explain identity, hashing, and truthiness.");

for (const tag of allowedTags) {
  assert.ok([...catalog.cards, ...guidance.theoryCards].some((card) => card.tags.includes(tag)), `No Python quick-reference card uses ${tag}.`);
}

assert.equal(ids.size, 26, `Python quick reference must render 26 total concept cards; found ${ids.size}.`);
assert.ok(referenceCount >= 350, `Python quick reference must contain at least 350 reference rows; found ${referenceCount}.`);
assert.ok(explainedReferenceCount >= 100, `Python quick reference needs substantial plain-language coverage; found ${explainedReferenceCount} explained rows.`);

console.log(`Python quick reference validated: ${ids.size} cards, ${referenceCount} reference rows, ${explainedReferenceCount} explained rows.`);
