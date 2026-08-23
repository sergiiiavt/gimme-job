const runnableSqlKeywords = new Set([
  "select",
  "with",
  "values",
  "insert",
  "update",
  "delete",
  "create",
  "drop",
  "alter",
  "explain",
  "begin",
  "commit",
  "rollback",
]);

const unsupportedRunnableSqlPatterns = [
  /\battach\s+(?:database\s+)?/i,
  /\bdetach\s+(?:database\s+)?/i,
  /\bvacuum\b/i,
  /\bload_extension\s*\(/i,
  /\b(?:date|timestamp)\s+'[^']+'/i,
  /\binformation_schema\b/i,
  /\bexplain\s*\(/i,
  /\$\d+\b/,
  /\balter\s+table\b[\s\S]*\balter\s+column\b/i,
  /\bcreate\s+table\s+(?:users|orders)\b/i,
  /--\s*session\s+[ab]\b/i,
  /\b(?:source_orders|warehouse_orders|raw_events|dim_customer|test_customers|test_orders|fact_sales|dim_date)\b/i,
];

function skipLeadingSqlTrivia(source: string) {
  let index = 0;

  while (index < source.length) {
    while (index < source.length && /\s/.test(source[index] ?? "")) index += 1;

    if (source.startsWith("--", index)) {
      const lineEnd = source.indexOf("\n", index + 2);
      if (lineEnd === -1) return "";
      index = lineEnd + 1;
      continue;
    }

    if (source.startsWith("/*", index)) {
      const commentEnd = source.indexOf("*/", index + 2);
      if (commentEnd === -1) return "";
      index = commentEnd + 2;
      continue;
    }

    break;
  }

  return source.slice(index);
}

function readLeadingSqlKeyword(source: string) {
  const body = skipLeadingSqlTrivia(source);
  let end = 0;
  while (end < body.length && /[a-z]/i.test(body[end] ?? "")) end += 1;
  return body.slice(0, end).toLowerCase();
}

export function isRunnableSqlSource(language: string, source: string) {
  if (language.toLowerCase() !== "sql") return false;
  const normalized = source.trim();
  if (!normalized || normalized.length > 12_000) return false;
  if (!runnableSqlKeywords.has(readLeadingSqlKeyword(normalized))) return false;
  return !unsupportedRunnableSqlPatterns.some((pattern) => pattern.test(normalized));
}
