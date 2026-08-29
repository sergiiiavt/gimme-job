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

const pythonBuiltinCallNames = new Set([
  "abs", "all", "any", "bin", "bool", "bytearray", "bytes", "callable", "chr", "classmethod",
  "dict", "divmod", "enumerate", "filter", "float", "format", "frozenset", "getattr", "hasattr",
  "hash", "hex", "id", "int", "isinstance", "issubclass", "iter", "len", "list", "map", "max",
  "memoryview", "min", "next", "object", "oct", "ord", "pow", "print", "property", "range", "repr",
  "reversed", "round", "set", "setattr", "slice", "sorted", "staticmethod", "str", "sum", "super",
  "tuple", "type", "vars", "zip",
  "AssertionError", "AttributeError", "EOFError", "Exception", "IndexError", "KeyError", "LookupError",
  "NotImplementedError", "OSError", "OverflowError", "RuntimeError", "StopIteration", "TimeoutError",
  "TypeError", "ValueError", "ZeroDivisionError",
]);

const pythonCallLikeKeywords = new Set([
  "assert", "case", "class", "def", "del", "elif", "except", "for", "if", "match", "raise", "return",
  "while", "with", "yield",
]);

const injectedRuntimeReceiverNames = new Set([
  "backend", "board", "browser", "context", "desktop", "device", "driver", "editor", "element", "mqtt",
  "network", "page", "power", "sensor_sim", "window",
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

function scrubPythonStringsAndComments(source: string) {
  return source
    .replace(/'''[\s\S]*?'''/g, " ")
    .replace(/"""[\s\S]*?"""/g, " ")
    .replace(/'(?:\\.|[^'\\])*'/g, "''")
    .replace(/"(?:\\.|[^"\\])*"/g, '""')
    .replace(/#.*$/gm, "");
}

function addRegularImportBindings(source: string, bound: Set<string>) {
  for (const match of source.matchAll(/^\s*import\s+([^#\n]+)/gm)) {
    for (const part of match[1].split(",")) {
      const imported = part.trim().match(/^([A-Za-z_]\w*(?:\.[A-Za-z_]\w*)*)(?:\s+as\s+([A-Za-z_]\w*))?$/);
      if (imported) bound.add(imported[2] ?? imported[1].split(".")[0]);
    }
  }
}

function addFromImportBindings(source: string, bound: Set<string>) {
  for (const match of source.matchAll(/^\s*from\s+[A-Za-z_]\w*(?:\.[A-Za-z_]\w*)*\s+import\s+([^#\n]+)/gm)) {
    for (const part of match[1].replace(/[()]/g, "").split(",")) {
      const imported = part.trim().match(/^([A-Za-z_]\w*)(?:\s+as\s+([A-Za-z_]\w*))?$/);
      if (imported) bound.add(imported[2] ?? imported[1]);
    }
  }
}

function addFunctionBindings(source: string, bound: Set<string>, parameters: Set<string>) {
  for (const match of source.matchAll(/^\s*(?:async\s+)?def\s+([A-Za-z_]\w*)\s*\(([^)]*)\)/gm)) {
    bound.add(match[1]);
    addParameterBindings(match[2], bound, parameters);
  }
}

function addParameterBindings(parameterSource: string, bound: Set<string>, parameters: Set<string>) {
  for (const part of parameterSource.split(",")) {
    const parameter = part.trim().replace(/^\*+/, "").match(/^([A-Za-z_]\w*)/);
    if (!parameter) continue;
    bound.add(parameter[1]);
    parameters.add(parameter[1]);
  }
}

function addSingleNameBindings(source: string, bound: Set<string>) {
  const patterns = [
    /^\s*class\s+([A-Za-z_]\w*)\b/gm,
    /^\s*([A-Za-z_]\w*)\s*(?::[^=\n]+)?=(?!=)/gm,
    /\bfor\s+([A-Za-z_]\w*)\s+in\b/g,
    /\bas\s+([A-Za-z_]\w*)\b/g,
  ];

  for (const pattern of patterns) {
    for (const match of source.matchAll(pattern)) bound.add(match[1]);
  }
}

function addTupleAssignmentBindings(source: string, bound: Set<string>) {
  for (const match of source.matchAll(/^\s*([A-Za-z_]\w*(?:\s*,\s*[A-Za-z_]\w*)+)\s*=/gm)) {
    for (const name of match[1].split(",")) bound.add(name.trim());
  }
}

function collectBoundPythonNames(source: string) {
  const bound = new Set<string>();
  const parameters = new Set<string>();
  addRegularImportBindings(source, bound);
  addFromImportBindings(source, bound);
  addFunctionBindings(source, bound, parameters);
  addSingleNameBindings(source, bound);
  addTupleAssignmentBindings(source, bound);
  return { bound, parameters };
}

function isPythonRuntimeReceiver(receiver: string, bound: Set<string>, parameters: Set<string>) {
  if (receiver === "self" || receiver === "cls") return false;
  if (!bound.has(receiver)) return true;
  return parameters.has(receiver) && injectedRuntimeReceiverNames.has(receiver);
}

function hasUnboundDottedReceiver(source: string, bound: Set<string>, parameters: Set<string>) {
  for (const match of source.matchAll(/\b([A-Za-z_]\w*)\s*\./g)) {
    if (isPythonRuntimeReceiver(match[1], bound, parameters)) return true;
  }
  return false;
}

function isKnownPythonCall(name: string, previous: string | undefined, bound: Set<string>) {
  if (previous === ".") return true;
  return bound.has(name) || pythonBuiltinCallNames.has(name) || pythonCallLikeKeywords.has(name);
}

function hasUnboundCall(source: string, bound: Set<string>) {
  for (const match of source.matchAll(/\b([A-Za-z_]\w*)\s*\(/g)) {
    const previous = source.slice(0, match.index).trimEnd().at(-1);
    if (!isKnownPythonCall(match[1], previous, bound)) return true;
  }
  return false;
}

function hasUnboundConstant(source: string, bound: Set<string>) {
  for (const match of source.matchAll(/\b([A-Z][A-Z0-9_]+)\b/g)) {
    const previous = source.slice(0, match.index).trimEnd().at(-1);
    if (previous !== "." && !bound.has(match[1])) return true;
  }
  return false;
}

function hasExternalRuntimeDependency(source: string) {
  const scrubbed = scrubPythonStringsAndComments(source);
  const { bound, parameters } = collectBoundPythonNames(scrubbed);
  return hasUnboundDottedReceiver(scrubbed, bound, parameters)
    || hasUnboundCall(scrubbed, bound)
    || hasUnboundConstant(scrubbed, bound);
}

export function isRunnablePythonSource(language: string, source: string) {
  if (language.toLowerCase() !== "python") return false;
  if (!source.trim() || source.length > 8_000 || hasUnsupportedPythonImport(source)) return false;
  if (unsupportedRunnablePythonPatterns.some((pattern) => pattern.test(source))) return false;
  return !hasExternalRuntimeDependency(source);
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
