import type { ReactNode } from "react";
import { highlightInterviewCode } from "./interview-code-highlighting";

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

const genericKeywordPattern = /((?:#|\/\/|--)[^\n]*)|("(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'|`(?:\\.|[^`\\])*`)|\b(true|false|null|undefined|const|let|var|function|class|interface|type|enum|public|private|protected|static|readonly|async|await|return|if|else|for|while|switch|case|break|continue|try|catch|finally|throw|new|import|export|from|extends|implements|using|namespace|void|string|number|boolean|int|double|decimal|SELECT|FROM|WHERE|JOIN|LEFT|RIGHT|INNER|OUTER|ON|GROUP|BY|ORDER|HAVING|INSERT|UPDATE|DELETE|CREATE|ALTER|DROP|VALUES|INTO|AS|AND|OR|NOT|NULL)\b|\b(\d+(?:\.\d+)?)\b/gm;

function genericHighlight(source: string): ReactNode[] {
  const output: ReactNode[] = [];
  let lastIndex = 0;
  let tokenIndex = 0;
  let match: RegExpExecArray | null;
  genericKeywordPattern.lastIndex = 0;

  while ((match = genericKeywordPattern.exec(source)) !== null) {
    if (match.index > lastIndex) output.push(source.slice(lastIndex, match.index));
    const color = match[1]
      ? "#6a9955"
      : match[2]
        ? "#ce9178"
        : match[3]
          ? "#569cd6"
          : "#b5cea8";
    output.push(<span key={`static-token-${tokenIndex++}`} style={{ color }}>{match[0]}</span>);
    lastIndex = genericKeywordPattern.lastIndex;
  }

  if (lastIndex < source.length) output.push(source.slice(lastIndex));
  return output;
}

function highlightedSource(source: string, language: string): ReactNode[] {
  const normalized = language.toLowerCase();
  const interviewTokens = highlightInterviewCode(source, normalized);
  const hasSpecializedHighlighting = interviewTokens.some((token) => token.color);
  if (hasSpecializedHighlighting) {
    return interviewTokens.map((token, index) => token.color
      ? <span key={`static-token-${index}`} style={{ color: token.color }}>{token.text}</span>
      : token.text);
  }
  return genericHighlight(source);
}

export default function StaticCodeBlock({ language, source }: { language: string; source: string }) {
  const normalized = language.trim().toLowerCase() || "text";
  const label = LANGUAGE_LABELS[normalized] ?? normalized.toUpperCase();

  return (
    <div
      className="qa-md-static-code"
      data-language={normalized}
      style={{
        background: "#1e1e1e",
        border: "1px solid #303030",
        borderRadius: 10,
        margin: "22px 0",
        overflow: "hidden",
      }}
    >
      <div
        aria-hidden="true"
        style={{
          borderBottom: "1px solid #303030",
          color: "#a7a7a7",
          fontFamily: "ui-monospace, SFMono-Regular, Menlo, Consolas, monospace",
          fontSize: 10,
          fontWeight: 700,
          letterSpacing: ".04em",
          padding: "8px 14px",
        }}
      >
        {label}
      </div>
      <pre
        className="qa-md-code"
        style={{
          background: "#1e1e1e",
          border: 0,
          borderRadius: 0,
          color: "#d4d4d4",
          fontFamily: "ui-monospace, SFMono-Regular, Menlo, Consolas, monospace",
          fontSize: 12,
          lineHeight: 1.65,
          margin: 0,
          overflowX: "auto",
          overflowWrap: "normal",
          padding: "16px 18px",
          whiteSpace: "pre",
        }}
      >
        <code className={`language-${normalized}`}>{highlightedSource(source, normalized)}</code>
      </pre>
    </div>
  );
}
