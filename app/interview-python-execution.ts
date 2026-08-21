export type PythonInterviewExecution = "python" | "static";

const unsupportedRunnablePythonPatterns = [
  /^\s*>>>/m,
  /\b(?:input|open)\s*\(/,
  /\bPath\s*\(/,
  /\b(?:pytest|unittest|requests|httpx|aiohttp|selenium|playwright)\b/,
  /\b(?:subprocess|multiprocessing|threading|socket|ThreadPoolExecutor|ProcessPoolExecutor)\b/,
  /\b(?:numpy|pandas|matplotlib|sklearn)\b/,
  /^\s*(?:python(?:3)?|pip(?:3)?|pytest|ruff|mypy)\s+/m,
  /^\s*\[(?:tool|project)\./m,
  /^\s*(?:├|└|│)/m,
];

const runnablePythonImports = new Set([
  "__future__", "asyncio", "base64", "bisect", "collections", "contextlib", "copy",
  "dataclasses", "datetime", "decimal", "enum", "fractions", "functools", "hashlib",
  "heapq", "itertools", "json", "logging", "math", "operator", "pprint", "random", "re",
  "statistics", "string", "time", "typing", "uuid",
]);

function hasUnsupportedPythonImport(source: string) {
  for (const match of source.matchAll(/^\s*from\s+([A-Za-z_]\w*)(?:\.[\w.]+)?\s+import\b/gm)) {
    if (!runnablePythonImports.has(match[1])) return true;
  }

  for (const match of source.matchAll(/^\s*import\s+([^#\n]+)/gm)) {
    const importedRoots = match[1]
      .split(",")
      .map((part) => part.trim().split(/\s+as\s+/)[0]?.split(".")[0])
      .filter((name): name is string => Boolean(name));
    if (importedRoots.some((name) => !runnablePythonImports.has(name))) return true;
  }

  return false;
}

export function isRunnablePythonSource(language: string, source: string) {
  if (language.toLowerCase() !== "python") return false;
  if (!source.trim() || source.length > 8_000 || hasUnsupportedPythonImport(source)) return false;
  return !unsupportedRunnablePythonPatterns.some((pattern) => pattern.test(source));
}

export function classifyPythonInterviewExecution(
  language: string,
  source: string,
  requested?: PythonInterviewExecution,
): PythonInterviewExecution {
  if (requested === "static") return "static";
  return isRunnablePythonSource(language, source) ? "python" : "static";
}

export function isRunnablePythonInterviewExample(
  language: string,
  source: string,
  requested?: PythonInterviewExecution,
) {
  return classifyPythonInterviewExecution(language, source, requested) === "python";
}
