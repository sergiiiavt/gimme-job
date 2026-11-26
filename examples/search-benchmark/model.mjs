import { stemmer as english } from "@orama/stemmers/english";
import { stemmer as ukrainian } from "@orama/stemmers/ukrainian";

const STOP_WORDS = new Set("a an the and or of to in for with how why what does do is are can i my when using about мені як чому що це та і у в з для про під час".split(" "));
const PROTECTED = new Map([["c#", "csharp"], ["c++", "cplusplus"], [".net", "dotnet"]]);

export function tokens(text) {
  return text.normalize("NFKC").toLowerCase().replace(/[’ʼ`]/gu, "'")
    .match(/c\+\+|c#|\.net\b|[\p{L}\p{N}]+(?:['_-][\p{L}\p{N}]+)*/gu) ?? [];
}

function stem(token) {
  if (/^[\p{Script=Cyrillic}']+$/u.test(token)) return ukrainian(token);
  // Keep numbers, short acronyms and identifiers unchanged.
  return /^[a-z]{4,}$/u.test(token) ? english(token) : token;
}

export function normalizer(aliases, assisted) {
  const rules = aliases.flatMap(({ canonical, variants }) => variants.map((variant) => ({
    from: tokens(variant).map(stem), to: tokens(canonical).map(stem),
  }))).sort((a, b) => b.from.length - a.from.length);
  return (text, query = false) => {
    let words = tokens(text).map((token) => PROTECTED.get(token) ?? token);
    if (query) words = words.filter((token) => !STOP_WORDS.has(token));
    if (!assisted) return words.join(" ");
    words = words.map(stem);
    const output = [];
    for (let index = 0; index < words.length;) {
      const rule = rules.find(({ from }) => from.every((token, offset) => token === words[index + offset]));
      if (rule) { output.push(...rule.to); index += rule.from.length; }
      else { output.push(words[index]); index += 1; }
    }
    return output.join(" ");
  };
}

export function allowedTypos(query) {
  const words = tokens(query);
  if (!words.length || words.some((word) => /\d/u.test(word) || PROTECTED.has(word) || ["csharp", "cplusplus", "dotnet"].includes(word))) return 0;
  const shortest = Math.min(...words.map((word) => word.length));
  return shortest >= 9 ? 2 : Number(shortest >= 5);
}

export function uniqueHits(hits, limit = 5) {
  const seen = new Set();
  return hits.filter((hit) => {
    if (seen.has(hit.path)) return false;
    seen.add(hit.path);
    return true;
  }).slice(0, limit);
}

export function matchesTarget(document, target) {
  return Object.entries(target).every(([key, value]) => document[key] === value);
}

export function scoreCase(item, hits) {
  const top = uniqueHits(hits);
  const rank = top.findIndex((hit) => item.targets.some((target) => matchesTarget(hit, target))) + 1;
  return { id: item.id, query: item.query, targets: item.targets, category: item.category, language: item.language, split: item.split,
    rank: rank || null, hit: rank > 0, reciprocalRank: rank ? 1 / rank : 0,
    top: top.map(({ id, title, path }) => ({ id, title, path })) };
}

export function percentile(values, fraction) {
  if (!values.length) return null;
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.max(0, Math.ceil(sorted.length * fraction) - 1)];
}

export function summarize(rows) {
  if (!rows.length) return { count: 0, hitAt5: null, mrrAt5: null };
  return { count: rows.length, hitAt5: rows.filter((row) => row.hit).length / rows.length,
    mrrAt5: rows.reduce((sum, row) => sum + row.reciprocalRank, 0) / rows.length };
}

export function validateCases(cases, documents) {
  const ids = new Set();
  for (const item of cases) {
    if (!item.id || ids.has(item.id) || !tokens(item.query).length) throw new Error(`Invalid or duplicate query: ${item.id}`);
    ids.add(item.id);
    if (!item.targets.length || !item.targets.every((target) => Object.keys(target).length && documents.some((document) => matchesTarget(document, target)))) {
      throw new Error(`Missing corpus target: ${item.id}`);
    }
  }
}
