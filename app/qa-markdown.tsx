import type { ReactNode } from "react";

export interface MarkdownHeading {
  id: string;
  level: number;
  text: string;
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
    || /^```/.test(line)
    || /^>\s?/.test(line)
    || /^[-*]\s+/.test(line)
    || /^\d+\.\s+/.test(line)
    || (/\|/.test(line) && isTableDivider(next))
    || /^<!--/.test(line);
}

export default function MarkdownDocument({ markdown }: { markdown: string }) {
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

    const fence = line.match(/^```([\w-]*)\s*$/);
    if (fence) {
      const language = fence[1] || "text";
      const content: string[] = [];
      index += 1;
      while (index < lines.length && !/^```/.test(lines[index])) {
        content.push(lines[index]);
        index += 1;
      }
      index += 1;
      nodes.push(
        <pre className={language === "diagram" ? "qa-md-diagram" : "qa-md-code"} key={`pre-${nodeKey++}`}>
          <code>{content.join("\n")}</code>
        </pre>,
      );
      continue;
    }

    const heading = line.match(/^(#{1,3})\s+(.+)$/);
    if (heading) {
      const level = heading[1].length;
      const id = markdownSlug(heading[2]);
      const content = parseInline(heading[2]);
      if (level === 1) nodes.push(<h1 id={id} key={`h-${nodeKey++}`}>{content}</h1>);
      else if (level === 2) nodes.push(<h2 id={id} key={`h-${nodeKey++}`}>{content}</h2>);
      else nodes.push(<h3 id={id} key={`h-${nodeKey++}`}>{content}</h3>);
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
