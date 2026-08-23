const runnableSqlStart = /^(?:\s|--[^\n]*(?:\n|$)|\/\*[\s\S]*?\*\/)*(?:select|with|values|insert|update|delete|create|drop|alter|explain|begin|commit|rollback)\b/i;

const unsupportedRunnableSqlPatterns = [
  /\battach\s+(?:database\s+)?/i,
  /\bdetach\s+(?:database\s+)?/i,
  /\bvacuum\b/i,
  /\bload_extension\s*\(/i,
];

export function isRunnableSqlSource(language: string, source: string) {
  if (language.toLowerCase() !== "sql") return false;
  const normalized = source.trim();
  if (!normalized || normalized.length > 12_000) return false;
  if (!runnableSqlStart.test(normalized)) return false;
  return !unsupportedRunnableSqlPatterns.some((pattern) => pattern.test(normalized));
}
