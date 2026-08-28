import type { ReactNode } from "react";
import ExecutablePythonBlock from "./executable-python-block";
import ExecutableSqlBlock from "./executable-sql-block";
import { isRunnablePythonSource } from "./interview-python-execution";
import { isRunnableSqlSource } from "./interview-sql-execution";

export interface MarkdownHeading {
  id: string;
  level: number;
  text: string;
}

export type MarkdownUsageFrequency = "common" | "less-common" | "rare";

const usageBadgeLabel: Record<MarkdownUsageFrequency, string> = {
  common: "Common",
  "less-common": "Less common",
  rare: "Rare",
};

function UsageBadge({ usage }: { usage: MarkdownUsageFrequency }) {
  return (
    <span className="qa-md-usage-badge" data-usage={usage}>
      {usageBadgeLabel[usage]}
    </span>
  );
}

function plainText(value: string) {
  return value
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
    .replace(/\*\*([^*]+)\*\*/g, "$1")
    .replace(/\*([^*]+)\*/g, "$1")
    .replace(/`([^`]+)`/g, "$1")
    .trim();
}

export function markdownSlug(value: string) {
  return plainText(value)
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export function extractMarkdownHeadings(markdown: string): MarkdownHeading[] {
  return markdown
    .split(/\r?\n/)
    .map((line) => line.match(/^(#{1,3})\s+(.+)$/))
    .filter((match): match is RegExpMatchArray => Boolean(match))
    .map((match) => ({ level: match[1].length, text: plainText(match[2]), id: markdownSlug(match[2]) }));
}

export function stripMarkdownSection(markdown: string, sectionId: string) {
  const lines = markdown.replace(/\r\n/g, "\n").split("\n");
  const start = lines.findIndex((line) => {
    const match = line.match(/^##\s+(.+)$/);
    return Boolean(match && markdownSlug(match[1]) === sectionId);
  });
  if (start < 0) return markdown;

  let end = start + 1;
  while (end < lines.length && !/^##\s+/.test(lines[end])) end += 1;
  return [...lines.slice(0, start), ...lines.slice(end)].join("\n").trimEnd();
}

function parseInline(value: string): ReactNode[] {
  const pattern = /\*\*(.+?)\*\*|`([^`]+)`|\[([^\]]+)\]\((https?:\/\/[^)]+)\)|\*([^*]+)\*/g;
  const output: ReactNode[] = [];
  let lastIndex = 0;
  let match: RegExpExecArray | null;
  let key = 0;

  while ((match = pattern.exec(value)) !== null) {
    if (match.index > lastIndex) output.push(value.slice(lastIndex, match.index));
    if (match[1]) output.push(<strong key={`strong-${key++}`}>{match[1]}</strong>);
    else if (match[2]) output.push(<code key={`code-${key++}`}>{match[2]}</code>);
    else if (match[3] && match[4]) {
      output.push(
        <a href={match[4]} key={`link-${key++}`} rel="noreferrer" target="_blank">
          {match[3]}
        </a>,
      );
    } else if (match[5]) output.push(<em key={`em-${key++}`}>{match[5]}</em>);
    lastIndex = pattern.lastIndex;
  }

  if (lastIndex < value.length) output.push(value.slice(lastIndex));
  return output;
}

function parseImage(line: string) {
  return line.match(/^!\[([^\]]*)\]\(((?:https:\/\/|\/)[^\s)]+)(?:\s+"([^"]+)")?\)$/);
}

function parseFence(line: string) {
  return line.match(/^(`{3,}|~{3,})([\w-]*)\s*$/);
}

function isTableDivider(line: string) {
  const cells = line.trim().replace(/^\||\|$/g, "").split("|").map((cell) => cell.trim());
  return cells.length > 0 && cells.every((cell) => /^:?-{3,}:?$/.test(cell));
}

function tableCells(line: string) {
  return line.trim().replace(/^\||\|$/g, "").split("|").map((cell) => cell.trim());
}

function isBlockStart(lines: string[], index: number) {
  const line = lines[index] ?? "";
  const next = lines[index + 1] ?? "";
  return !line.trim()
    || /^#{1,3}\s+/.test(line)
    || Boolean(parseFence(line))
    || /^:::details\s+/.test(line)
    || /^:::\s*$/.test(line)
    || /^>\s?/.test(line)
    || /^[-*]\s+/.test(line)
    || /^\d+\.\s+/.test(line)
    || (/\|/.test(line) && isTableDivider(next))
    || Boolean(parseImage(line))
    || /^<!--/.test(line);
}

export default function MarkdownDocument({ headingIdOverrides = {}, markdown, usageByHeading = {} }: { headingIdOverrides?: Record<string, string>; markdown: string; usageByHeading?: Record<string, MarkdownUsageFrequency> }) {
  const lines = markdown.replace(/\r\n/g, "\n").split("\n");
  const nodes: ReactNode[] = [];
  let index = 0;
  let nodeKey = 0;

  while (index < lines.length) {
    const line = lines[index];
    if (!line.trim()) {
      index += 1;
      continue;
    }

    if (line.trim().startsWith("<!--")) {
      while (index < lines.length && !lines[index].includes("-->")) index += 1;
      index += 1;
      continue;
    }

    const fence = parseFence(line);
    if (fence) {
      const openingFence = fence[1];
      const language = fence[2] || "text";
      const fenceCharacter = openingFence[0];
      const closingFence = new RegExp(`^${fenceCharacter}{${openingFence.length},}\\s*$`);
      const content: string[] = [];
      index += 1;
      while (index < lines.length && !closingFence.test(lines[index])) {
        content.push(lines[index]);
        index += 1;
      }
      if (index < lines.length) index += 1;
      const source = content.join("\n");
      if (isRunnablePythonSource(language, source)) {
        nodes.push(<ExecutablePythonBlock code={source} key={`python-run-${nodeKey++}`} />);
      } else if (isRunnableSqlSource(language, source)) {
        nodes.push(<ExecutableSqlBlock code={source} key={`sql-run-${nodeKey++}`} />);
      } else {
        nodes.push(
          <pre className={language === "diagram" ? "qa-md-diagram" : "qa-md-code"} key={`pre-${nodeKey++}`}>
            <code>{source}</code>
          </pre>,
        );
      }
      continue;
    }

    const details = line.match(/^:::details\s+(.+?)\s*$/);
    if (details) {
      const content: string[] = [];
      index += 1;
      while (index < lines.length && !/^:::\s*$/.test(lines[index])) {
        content.push(lines[index]);
        index += 1;
      }
      if (index < lines.length) index += 1;
      nodes.push(
        <details
          className="qa-md-details"
          key={`details-${nodeKey++}`}
          style={{ background: "#f8faf7", border: "1px solid #dfe5dc", borderRadius: 10, margin: "20px 0", overflow: "hidden" }}
        >
          <summary
            className="qa-md-details-summary"
            style={{ color: "#2d4036", cursor: "pointer", fontSize: 13, fontWeight: 700, lineHeight: 1.45, padding: "14px 16px" }}
          >
            {parseInline(details[1])}
          </summary>
          <div
            className="qa-md-details-body"
            style={{ borderTop: "1px solid #e3e8e3", color: "#4e5d55", fontSize: 14, lineHeight: 1.7, padding: "16px 18px 4px" }}
          >
            <MarkdownDocument markdown={content.join("\n")} />
          </div>
        </details>,
      );
      continue;
    }

    const heading = line.match(/^(#{1,3})\s+(.+)$/);
    if (heading) {
      const level = heading[1].length;
      const text = plainText(heading[2]);
      const id = headingIdOverrides[text] ?? (markdownSlug(heading[2]) || `section-${nodeKey}`);
      const content = parseInline(heading[2]);
      const usage = usageByHeading[id];
      if (level === 1) nodes.push(<h1 id={id} key={`h-${nodeKey++}`}>{content}</h1>);
      else if (level === 2) nodes.push(<h2 id={id} key={`h-${nodeKey++}`}>{content}{usage && <UsageBadge usage={usage} />}</h2>);
      else nodes.push(<h3 id={id} key={`h-${nodeKey++}`}>{content}{usage && <UsageBadge usage={usage} />}</h3>);
      index += 1;
      continue;
    }

    const image = parseImage(line);
    if (image) {
      const [, alt, src, caption] = image;
      nodes.push(
        <figure key={`image-${nodeKey++}`} style={{ margin: "24px 0" }}>
          <img alt={alt} loading="lazy" referrerPolicy="no-referrer" src={src} style={{ borderRadius: 10, display: "block", height: "auto", maxWidth: "100%" }}/>
          {caption && <figcaption style={{ color: "#728078", fontSize: 11, lineHeight: 1.5, marginTop: 8 }}>{caption}</figcaption>}
        </figure>,
      );
      index += 1;
      continue;
    }

    if (/^>\s?/.test(line)) {
      const quote: string[] = [];
      while (index < lines.length && /^>\s?/.test(lines[index])) {
        quote.push(lines[index].replace(/^>\s?/, ""));
        index += 1;
      }
      nodes.push(<blockquote key={`quote-${nodeKey++}`}>{parseInline(quote.join(" "))}</blockquote>);
      continue;
    }

    if (/^[-*]\s+/.test(line)) {
      const items: string[] = [];
      while (index < lines.length && /^[-*]\s+/.test(lines[index])) {
        items.push(lines[index].replace(/^[-*]\s+/, ""));
        index += 1;
      }
      nodes.push(<ul key={`ul-${nodeKey++}`}>{items.map((item, itemIndex) => <li key={itemIndex}>{parseInline(item)}</li>)}</ul>);
      continue;
    }

    if (/^\d+\.\s+/.test(line)) {
      const items: string[] = [];
      while (index < lines.length && /^\d+\.\s+/.test(lines[index])) {
        items.push(lines[index].replace(/^\d+\.\s+/, ""));
        index += 1;
      }
      nodes.push(<ol key={`ol-${nodeKey++}`}>{items.map((item, itemIndex) => <li key={itemIndex}>{parseInline(item)}</li>)}</ol>);
      continue;
    }

    if (/\|/.test(line) && isTableDivider(lines[index + 1] ?? "")) {
      const headers = tableCells(line);
      index += 2;
      const rows: string[][] = [];
      while (index < lines.length && /\|/.test(lines[index]) && lines[index].trim()) {
        rows.push(tableCells(lines[index]));
        index += 1;
      }
      nodes.push(
        <div className="qa-md-table-wrap" key={`table-${nodeKey++}`}>
          <table>
            <thead><tr>{headers.map((cell, cellIndex) => <th key={cellIndex}>{parseInline(cell)}</th>)}</tr></thead>
            <tbody>{rows.map((row, rowIndex) => <tr key={rowIndex}>{headers.map((_, cellIndex) => <td key={cellIndex}>{parseInline(row[cellIndex] ?? "")}</td>)}</tr>)}</tbody>
          </table>
        </div>,
      );
      continue;
    }

    const paragraph = [line.trim()];
    index += 1;
    while (index < lines.length && !isBlockStart(lines, index)) {
      paragraph.push(lines[index].trim());
      index += 1;
    }
    nodes.push(<p key={`p-${nodeKey++}`}>{parseInline(paragraph.join(" "))}</p>);
  }

  return <>{nodes}</>;
}
