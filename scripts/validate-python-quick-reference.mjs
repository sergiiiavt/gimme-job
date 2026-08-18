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

const requiredCardIds = new Set([
  "core-syntax",
  "control-flow",
  "strings",
  "numbers",
  "collections",
  "comprehensions",
  "functions",
  "iterators-generators",
  "exceptions",
  "oop",
  "dataclasses-enum",
  "dunder-methods",
  "typing",
  "modules-imports",
  "files-pathlib",
  "data-formats",
  "datetime",
  "stdlib-toolbox",
  "os-cli",
  "logging-debugging",
  "concurrency",
  "testing",
  "sqlite",
  "internals-gotchas",
]);

const allowedTags = new Set(expectedFilters.slice(1));

assert.deepEqual(catalog.filters, expectedFilters, "Python quick-reference filters changed unexpectedly.");
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
  const explanations = guidance.explanations?.[card.id];
  assert.ok(explanations && typeof explanations === "object", `${card.id} needs explanations for every reference.`);

  for (const row of [...card.entries, ...card.more]) {
    assert.ok(row.term?.trim(), `Missing term in ${card.id}`);
    assert.ok(row.detail?.trim(), `Missing detail for ${row.term || "unknown row"} in ${card.id}`);

    const normalizedTerm = row.term.trim().toLowerCase();
    assert.ok(!terms.has(normalizedTerm), `Duplicate term ${row.term} in ${card.id}`);
    terms.add(normalizedTerm);

    const explanation = explanations[row.term];
    assert.ok(explanation?.trim(), `${card.id} reference ${row.term} needs a concise human-friendly explanation.`);
    assert.ok(explanation.trim().length >= 20, `${card.id} reference ${row.term} explanation is too terse to be useful.`);

    referenceCount += 1;
    explainedReferenceCount += 1;
  }

  baseTerms.set(card.id, terms);

  for (const term of Object.keys(explanations)) {
    assert.ok(terms.has(term.toLowerCase()), `Guidance references unknown term ${term} in ${card.id}.`);
  }
}

for (const requiredId of requiredCardIds) {
  assert.ok(baseTerms.has(requiredId), `Python quick reference is missing required card ${requiredId}.`);
}

for (const cardId of Object.keys(guidance.explanations ?? {})) {
  assert.ok(baseTerms.has(cardId), `Guidance references unknown base card ${cardId}.`);
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
    assert.ok(row.meaning.trim().length >= 20, `Theory reference ${row.term} in ${card.id} meaning is too terse to be useful.`);
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

assert.ok(catalog.cards.length >= requiredCardIds.size, `Python quick reference must keep all required concept cards; found ${catalog.cards.length}.`);
assert.ok(referenceCount >= 350, `Python quick reference must contain at least 350 reference rows; found ${referenceCount}.`);
assert.equal(explainedReferenceCount, referenceCount, "Every Python quick-reference row must have a human-friendly explanation.");

const strings = guidance.explanations?.strings ?? {};
assert.match(strings["f-string"] ?? "", /insert|expression|format/i, "f-string explanation must describe interpolation/formatting.");
assert.match(strings.find ?? "", /-1/i, "find explanation must mention its missing-value behavior.");

console.log(`Python quick reference validated: ${ids.size} cards, ${referenceCount} reference rows, 100% explained.`);
