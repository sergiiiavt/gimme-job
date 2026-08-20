const PYODIDE_INDEX_URL = "https://cdn.jsdelivr.net/pyodide/v314.0.4/full/";
const MAX_CODE_LENGTH = 8_000;
const MAX_OUTPUT_CHARS = 32_000;

const SECURITY_WRAPPER = String.raw`
import ast as _ast
import builtins as _builtins

_ALLOWED_IMPORTS = {
    "__future__", "asyncio", "base64", "bisect", "collections", "contextlib", "copy",
    "dataclasses", "datetime", "decimal", "enum", "fractions", "functools", "hashlib",
    "heapq", "itertools", "json", "math", "operator", "pprint", "random", "re",
    "statistics", "string", "time", "typing", "uuid",
}
_BLOCKED_CALLS = {
    "__import__", "breakpoint", "compile", "eval", "exec", "getattr", "input", "open",
    "setattr", "delattr", "vars",
}
_BLOCKED_ATTRIBUTES = {
    "connect", "fork", "import_module", "install", "loadPackage", "open_url", "popen",
    "request", "run_sync", "spawn", "system", "urlopen",
}
_BLOCKED_NAMES = {"js", "micropip", "pyodide", "pyodide_js"}


def _safe_import(name, globals=None, locals=None, fromlist=(), level=0):
    root = name.split(".", 1)[0]
    if root not in _ALLOWED_IMPORTS:
        raise ImportError(f"Import '{root}' is disabled in the learning runner.")
    return _builtins.__import__(name, globals, locals, fromlist, level)


def _validate(tree):
    for node in _ast.walk(tree):
        if isinstance(node, _ast.Import):
            for alias in node.names:
                root = alias.name.split(".", 1)[0]
                if root not in _ALLOWED_IMPORTS:
                    raise ImportError(f"Import '{root}' is disabled in the learning runner.")
        elif isinstance(node, _ast.ImportFrom):
            root = (node.module or "").split(".", 1)[0]
            if root not in _ALLOWED_IMPORTS:
                raise ImportError(f"Import '{root or '<relative>'}' is disabled in the learning runner.")
        elif isinstance(node, _ast.Call):
            if isinstance(node.func, _ast.Name) and node.func.id in _BLOCKED_CALLS:
                raise RuntimeError(f"'{node.func.id}' is disabled in the learning runner.")
            if isinstance(node.func, _ast.Attribute) and node.func.attr in _BLOCKED_ATTRIBUTES:
                raise RuntimeError(f"'{node.func.attr}' is disabled in the learning runner.")
        elif isinstance(node, _ast.Attribute) and node.attr.startswith("__"):
            raise RuntimeError("Dunder attribute access is disabled in the learning runner.")
        elif isinstance(node, _ast.Name) and node.id in _BLOCKED_NAMES:
            raise RuntimeError(f"'{node.id}' is unavailable in the learning runner.")


_tree = _ast.parse(__source__, filename="<learning-example>", mode="exec")
_validate(_tree)
_safe_builtins = dict(_builtins.__dict__)
for _name in _BLOCKED_CALLS:
    _safe_builtins.pop(_name, None)
_safe_builtins["__import__"] = _safe_import
_user_globals = {"__name__": "__main__", "__builtins__": _safe_builtins}
_body = _tree.body
_result = None

if _body and isinstance(_body[-1], _ast.Expr):
    _prefix = _ast.Module(body=_body[:-1], type_ignores=[])
    _ast.fix_missing_locations(_prefix)
    if _prefix.body:
        _builtins.exec(_builtins.compile(_prefix, "<learning-example>", "exec"), _user_globals, _user_globals)
    _expression = _ast.Expression(_body[-1].value)
    _ast.fix_missing_locations(_expression)
    _result = _builtins.eval(_builtins.compile(_expression, "<learning-example>", "eval"), _user_globals, _user_globals)
else:
    _builtins.exec(_builtins.compile(_tree, "<learning-example>", "exec"), _user_globals, _user_globals)

_result
`;

let pyodidePromise;

async function getPyodide() {
  if (!pyodidePromise) {
    pyodidePromise = (async () => {
      const { loadPyodide } = await import(`${PYODIDE_INDEX_URL}pyodide.mjs`);
      const pyodide = await loadPyodide({ indexURL: PYODIDE_INDEX_URL });
      pyodide.setStdin({ error: true });
      return pyodide;
    })();
  }

  return pyodidePromise;
}

function limitedCollector() {
  const chunks = [];
  let length = 0;
  let truncated = false;

  return {
    add(value) {
      if (truncated) return;
      const text = String(value);
      const remaining = MAX_OUTPUT_CHARS - length;
      if (remaining <= 0) {
        truncated = true;
        return;
      }
      if (text.length > remaining) {
        chunks.push(text.slice(0, remaining));
        length = MAX_OUTPUT_CHARS;
        truncated = true;
        return;
      }
      chunks.push(text);
      length += text.length + 1;
    },
    text() {
      const output = chunks.join("\n");
      return truncated ? `${output}\n… output truncated …` : output;
    },
  };
}

self.onmessage = async (event) => {
  const { id, code } = event.data ?? {};
  if (typeof id !== "number" || typeof code !== "string") return;
  if (!code.trim()) {
    self.postMessage({ id, type: "result", error: "Enter Python code before running." });
    return;
  }
  if (code.length > MAX_CODE_LENGTH) {
    self.postMessage({ id, type: "result", error: `Code is limited to ${MAX_CODE_LENGTH} characters.` });
    return;
  }

  const stdout = limitedCollector();
  const stderr = limitedCollector();
  let globals;

  try {
    const pyodide = await getPyodide();
    pyodide.setStdout({ batched: (line) => stdout.add(line) });
    pyodide.setStderr({ batched: (line) => stderr.add(line) });
    self.postMessage({ id, type: "running" });

    const createDict = pyodide.globals.get("dict");
    globals = createDict();
    createDict.destroy();
    globals.set("__source__", code);

    const result = await pyodide.runPythonAsync(SECURITY_WRAPPER, { globals });
    let expressionResult = "";
    if (result !== undefined && result !== null) {
      try {
        expressionResult = String(result).slice(0, MAX_OUTPUT_CHARS);
      } finally {
        if (typeof result?.destroy === "function") result.destroy();
      }
    }

    const output = [stdout.text(), stderr.text()].filter(Boolean).join("\n") || expressionResult;
    self.postMessage({ id, type: "result", output });
  } catch (error) {
    const errorText = (error instanceof Error ? error.message : String(error)).slice(0, MAX_OUTPUT_CHARS);
    const output = [stdout.text(), stderr.text()].filter(Boolean).join("\n");
    self.postMessage({ id, type: "result", output, error: errorText });
  } finally {
    globals?.destroy();
  }
};
