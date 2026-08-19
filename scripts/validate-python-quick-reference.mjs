import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const catalog = JSON.parse(await readFile(new URL("../content/python-learning/quick-reference.json", import.meta.url), "utf8"));
const guidance = JSON.parse(await readFile(new URL("../content/python-learning/quick-reference-guidance.json", import.meta.url), "utf8"));
const interview = JSON.parse(await readFile(new URL("../content/python-learning/quick-reference-interview.json", import.meta.url), "utf8"));

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

const requiredInterviewCardIds = new Set([
  "runtime-model",
  "context-managers",
  "decorators",
  "gil-concurrency-models",
  "pytest-fixtures",
  "http-automation",
  "timeout-polling-retry",
  "regex",
  "packaging-environments",
  "memory-performance",
]);

const interviewBands = ["Very common", "Common", "Occasional", "Specialist"];
const interviewBandRank = new Map(interviewBands.map((band, index) => [band, index]));

assert.deepEqual(catalog.filters, expectedFilters, "Python quick-reference filters changed unexpectedly.");
assert.ok(guidance && typeof guidance === "object", "Python quick-reference guidance is missing.");
assert.equal(guidance.theoryCards?.length, 2, "Python quick reference must include the two focused theory cards.");
assert.ok(interview && typeof interview === "object", "Python interview quick-reference layer is missing.");
assert.deepEqual(interview.filters, ["Automation"], "Python interview quick-reference filters changed unexpectedly.");
assert.ok(Array.isArray(interview.cards) && interview.cards.length >= requiredInterviewCardIds.size, "Python interview quick reference needs the required focused cards.");
assert.ok(Array.isArray(interview.priority) && interview.priority.length > 0, "Python interview quick reference needs an ordered priority list.");

const allowedTags = new Set([...expectedFilters.slice(1), ...interview.filters]);
const ids = new Set();
const titles = new Set();
const baseTerms = new Map();
let referenceCount = 0;

function validateTags(card) {
  assert.ok(Array.isArray(card.tags) && card.tags.length >= 1, `Add at least one tag to ${card.id}`);
  for (const tag of card.tags) assert.ok(allowedTags.has(tag), `Unknown tag ${tag} in ${card.id}`);
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

function validateRows(card, { kind, explanations }) {
  assert.ok(Array.isArray(card.entries) && card.entries.length >= 7, `${card.id} needs at least 7 primary ${kind} references.`);
  assert.ok(Array.isArray(card.more) && card.more.length >= 4, `${card.id} needs at least 4 secondary ${kind} references.`);

  const terms = new Set();
  for (const row of [...card.entries, ...card.more]) {
    assert.ok(row.term?.trim(), `Missing ${kind} term in ${card.id}`);
    assert.ok(row.detail?.trim(), `${kind} reference ${row.term || "unknown row"} in ${card.id} needs a concrete example.`);

    const normalizedTerm = row.term.trim().toLowerCase();
    assert.ok(!terms.has(normalizedTerm), `Duplicate ${kind} term ${row.term} in ${card.id}`);
    terms.add(normalizedTerm);

    const meaning = explanations ? explanations[row.term] : row.meaning;
    assert.ok(meaning?.trim(), `${kind} reference ${row.term} in ${card.id} needs a plain-language meaning.`);
    assert.ok(meaning.trim().length >= 20, `${kind} reference ${row.term} in ${card.id} meaning is too terse to be useful.`);
    referenceCount += 1;
  }
  return terms;
}

function validateEmbeddedCard(card, kind) {
  registerCard(card);
  assert.ok(card.summary?.trim() && card.summary.trim().length >= 30, `${card.id} needs a useful ${kind} summary.`);
  validateRows(card, { kind });
}

for (const card of catalog.cards) {
  registerCard(card);
  assert.ok(guidance.summaries?.[card.id]?.trim(), `Add a human-friendly summary for ${card.id}.`);
  const explanations = guidance.explanations?.[card.id];
  assert.ok(explanations && typeof explanations === "object", `${card.id} needs explanations for every reference.`);
  const terms = validateRows(card, { kind: "base", explanations });
  baseTerms.set(card.id, terms);
  for (const term of Object.keys(explanations)) assert.ok(terms.has(term.toLowerCase()), `Guidance references unknown term ${term} in ${card.id}.`);
}

for (const requiredId of requiredCardIds) assert.ok(baseTerms.has(requiredId), `Python quick reference is missing required card ${requiredId}.`);
for (const cardId of Object.keys(guidance.explanations ?? {})) assert.ok(baseTerms.has(cardId), `Guidance references unknown base card ${cardId}.`);

for (const card of guidance.theoryCards) {
  assert.ok(baseTerms.has(card.after), `Theory card ${card.id} must be positioned after a real base card.`);
  validateEmbeddedCard(card, "theory");
}

for (const card of interview.cards) {
  assert.ok(requiredInterviewCardIds.has(card.id), `Unexpected Python interview quick-reference card ${card.id}.`);
  validateEmbeddedCard(card, "interview");
}

for (const requiredId of requiredInterviewCardIds) assert.ok(ids.has(requiredId), `Python quick reference is missing interview card ${requiredId}.`);
assert.ok(ids.has("mutability-references"), "Python quick reference must explain mutable and immutable objects.");
assert.ok(ids.has("identity-hashing-truthiness"), "Python quick reference must explain identity, hashing, and truthiness.");

const allCards = [...catalog.cards, ...guidance.theoryCards, ...interview.cards];
for (const tag of allowedTags) assert.ok(allCards.some((card) => card.tags.includes(tag)), `No Python quick-reference card uses ${tag}.`);

const priorityIds = new Set();
let previousBandRank = -1;
for (const item of interview.priority) {
  assert.match(item.id ?? "", /^[a-z0-9]+(?:-[a-z0-9]+)*$/, "Interview priority contains an invalid card id.");
  assert.ok(ids.has(item.id), `Interview priority references unknown card ${item.id}.`);
  assert.ok(!priorityIds.has(item.id), `Interview priority contains duplicate card ${item.id}.`);
  priorityIds.add(item.id);

  const rank = interviewBandRank.get(item.frequency);
  assert.notEqual(rank, undefined, `Unknown interview frequency ${item.frequency} for ${item.id}.`);
  assert.ok(rank >= previousBandRank, `Interview priority is out of frequency order at ${item.id}.`);
  previousBandRank = rank;
}

assert.equal(priorityIds.size, ids.size, "Every Python quick-reference card must have exactly one interview priority entry.");
for (const id of ids) assert.ok(priorityIds.has(id), `Python quick-reference card ${id} is missing interview priority metadata.`);

assert.ok(catalog.cards.length >= requiredCardIds.size, `Python quick reference must keep all required concept cards; found ${catalog.cards.length}.`);
assert.ok(referenceCount >= 470, `Python quick reference must contain at least 470 explained reference rows after the interview review; found ${referenceCount}.`);

const strings = guidance.explanations?.strings ?? {};
assert.match(strings["f-string"] ?? "", /insert|expression|format/i, "f-string explanation must describe interpolation/formatting.");
assert.match(strings.find ?? "", /-1/i, "find explanation must mention its missing-value behavior.");

console.log(`Python quick reference validated: ${ids.size} cards, ${referenceCount} reference rows, 100% explained and interview-prioritized.`);
