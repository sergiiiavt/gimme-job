const PYODIDE_INDEX_URL = "https://cdn.jsdelivr.net/pyodide/v314.0.4/full/";

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

self.onmessage = async (event) => {
  const { id, code } = event.data ?? {};
  if (typeof id !== "number" || typeof code !== "string") return;

  const stdout = [];
  const stderr = [];

  try {
    const pyodide = await getPyodide();
    pyodide.setStdout({ batched: (line) => stdout.push(line) });
    pyodide.setStderr({ batched: (line) => stderr.push(line) });
    self.postMessage({ id, type: "running" });

    const createDict = pyodide.globals.get("dict");
    const globals = createDict();
    createDict.destroy();
    globals.set("__name__", "__main__");

    let result;
    try {
      result = await pyodide.runPythonAsync(code, { globals });
    } finally {
      globals.destroy();
    }

    let expressionResult = "";
    if (result !== undefined && result !== null) {
      try {
        expressionResult = String(result);
      } finally {
        if (typeof result?.destroy === "function") result.destroy();
      }
    }

    const output = [stdout.join("\n"), stderr.join("\n")].filter(Boolean).join("\n") || expressionResult;
    self.postMessage({ id, type: "result", output });
  } catch (error) {
    const errorText = error instanceof Error ? error.message : String(error);
    const output = [stdout.join("\n"), stderr.join("\n")].filter(Boolean).join("\n");
    self.postMessage({ id, type: "result", output, error: errorText });
  }
};
