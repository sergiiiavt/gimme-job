import { createElement } from "react";

const LANGUAGE_LABELS: Record<string, string> = {
  bash: "Bash",
  csharp: "C#",
  cs: "C#",
  css: "CSS",
  dockerfile: "Dockerfile",
  gherkin: "Gherkin",
  html: "HTML",
  javascript: "JavaScript",
  js: "JavaScript",
  json: "JSON",
  jsx: "JSX",
  markdown: "Markdown",
  md: "Markdown",
  powershell: "PowerShell",
  ps1: "PowerShell",
  python: "Python",
  py: "Python",
  robot: "Robot Framework",
  shell: "Shell",
  sh: "Shell",
  sql: "SQL",
  text: "Text",
  toml: "TOML",
  ts: "TypeScript",
  tsx: "TSX",
  typescript: "TypeScript",
  xml: "XML",
  yaml: "YAML",
  yml: "YAML",
};

export function staticCodeLanguage(language: string) {
  const normalized = language.trim().toLowerCase() || "text";
  return {
    label: LANGUAGE_LABELS[normalized] ?? normalized.toUpperCase(),
    normalized,
  };
}

export default function StaticCodeBlock({ language, source }: { language: string; source: string }) {
  const metadata = staticCodeLanguage(language);
  return createElement(
    "div",
    { className: "qa-md-static-code", "data-language": metadata.normalized },
    createElement("div", { "aria-hidden": true, className: "qa-md-static-code-label" }, metadata.label),
    createElement(
      "pre",
      { className: "qa-md-code" },
      createElement("code", { className: `language-${metadata.normalized}` }, source),
    ),
  );
}
