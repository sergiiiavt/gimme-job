import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const catalog = JSON.parse(await readFile(new URL("../content/python-learning/quick-reference.json", import.meta.url), "utf8"));

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

assert.deepEqual(catalog.filters, expectedFilters, "Python quick-reference filters changed unexpectedly.");
assert.equal(catalog.cards.length, 24, "Python quick reference must keep exactly 24 concept cards.");

const ids = new Set();
const titles = new Set();
let referenceCount = 0;

for (const card of catalog.cards) {
  assert.match(card.id, /^[a-z0-9]+(?:-[a-z0-9]+)*$/, `Invalid card id: ${card.id}`);
  assert.ok(!ids.has(card.id), `Duplicate card id: ${card.id}`);
  ids.add(card.id);

  assert.ok(card.title?.trim(), `Missing title for ${card.id}`);
  const normalizedTitle = card.title.trim().toLowerCase();
  assert.ok(!titles.has(normalizedTitle), `Duplicate card title: ${card.title}`);
  titles.add(normalizedTitle);

  assert.ok(Array.isArray(card.tags) && card.tags.length >= 1, `Add at least one tag to ${card.id}`);
  for (const tag of card.tags) {
    assert.ok(allowedTags.has(tag), `Unknown tag ${tag} in ${card.id}`);
  }

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
}

for (const tag of allowedTags) {
  assert.ok(catalog.cards.some((card) => card.tags.includes(tag)), `No Python quick-reference card uses ${tag}.`);
}

assert.ok(referenceCount >= 300, `Python quick reference must contain at least 300 reference rows; found ${referenceCount}.`);

console.log(`Python quick reference validated: ${catalog.cards.length} cards, ${referenceCount} reference rows.`);
