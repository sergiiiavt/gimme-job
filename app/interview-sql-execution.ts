const runnableSqlStart = /^(?:\s|--[^\n]*(?:\n|$)|\/\*[\s\S]*?\*\/)*(?:select|with|values|insert|update|delete|create|drop|alter|explain|begin|commit|rollback)\b/i;

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

export function isRunnableSqlSource(language: string, source: string) {
  if (language.toLowerCase() !== "sql") return false;
  const normalized = source.trim();
  if (!normalized || normalized.length > 12_000) return false;
  if (!runnableSqlStart.test(normalized)) return false;
  return !unsupportedRunnableSqlPatterns.some((pattern) => pattern.test(normalized));
}
