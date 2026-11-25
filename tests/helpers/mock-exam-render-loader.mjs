import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";

const hooksUrl = "mock-exam-test:hooks";
const markdownUrl = "mock-exam-test:markdown";
const cssUrl = "mock-exam-test:css";
const jsxRuntime = new URL("../../node_modules/react/jsx-runtime.js", import.meta.url).href;

export async function resolve(specifier, context, nextResolve) {
  const resolved = await nextResolve(specifier, context);
  const parent = context.parentURL ? new URL(context.parentURL) : null;
  if (parent?.pathname.endsWith("/app/istqb-ai-mock-exam.tsx")) {
    const path = new URL(resolved.url).pathname;
    if (path.endsWith("/node_modules/react/index.js")) return { shortCircuit: true, url: hooksUrl };
    if (path.endsWith("/app/qa-markdown.tsx")) return { shortCircuit: true, url: markdownUrl };
    if (path.endsWith(".module.css")) return { shortCircuit: true, url: cssUrl };
  }
  return resolved;
}

export async function load(url, context, nextLoad) {
  let source;
  if (url === hooksUrl) {
    source = `
      export function useMemo(factory) { return factory(); }
      export function useState(initial) {
        const index = globalThis.__mockExamStateCursor ?? 0;
        globalThis.__mockExamStateCursor = index + 1;
        const overrides = globalThis.__mockExamStateOverrides;
        const value = Array.isArray(overrides) && Object.prototype.hasOwnProperty.call(overrides, index)
          ? overrides[index]
          : (typeof initial === "function" ? initial() : initial);
        const setter = (next) => {
          const resolved = typeof next === "function" ? next(value) : next;
          globalThis.__mockExamStateWrites ??= [];
          globalThis.__mockExamStateWrites.push({ index, value: resolved });
        };
        return [value, setter];
      }
    `;
  } else if (url === markdownUrl) {
    source = `
      import { jsx } from ${JSON.stringify(jsxRuntime)};
      export default function MarkdownDocument({ markdown }) {
        return jsx("div", { "data-markdown": true, children: markdown });
      }
    `;
  } else if (url === cssUrl) {
    source = "export default {};";
  } else {
    const parsed = new URL(url);
    if (parsed.protocol !== "file:" || !parsed.pathname.endsWith(".md")) return nextLoad(url, context);
    parsed.search = "";
    parsed.hash = "";
    source = `export default ${JSON.stringify(await readFile(fileURLToPath(parsed), "utf8"))};`;
  }
  return { format: "module", shortCircuit: true, source };
}
