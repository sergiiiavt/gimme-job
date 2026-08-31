import type { ReactNode } from "react";
import styles from "./assistant-markdown.module.css";

function renderInline(value: string): ReactNode[] {
  const pattern = /\*\*(.+?)\*\*|`([^`]+)`|\[([^\]]+)\]\((https?:\/\/[^)]+)\)|\*([^*]+)\*/g;
  const nodes: ReactNode[] = [];
  let lastIndex = 0;
  let match: RegExpExecArray | null;
  let key = 0;

  while ((match = pattern.exec(value)) !== null) {
    if (match.index > lastIndex) nodes.push(value.slice(lastIndex, match.index));
    if (match[1]) nodes.push(<strong key={`strong-${key++}`}>{match[1]}</strong>);
    else if (match[2]) nodes.push(<code key={`code-${key++}`}>{match[2]}</code>);
    else if (match[3] && match[4]) {
      nodes.push(
        <a href={match[4]} key={`link-${key++}`} rel="noreferrer" target="_blank">
          {match[3]}
        </a>,
      );
    } else if (match[5]) nodes.push(<em key={`em-${key++}`}>{match[5]}</em>);
    lastIndex = pattern.lastIndex;
  }

  if (lastIndex < value.length) nodes.push(value.slice(lastIndex));
  return nodes;
}

function parseFence(line: string) {
  return line.match(/^(`{3,}|~{3,})([\w-]*)\s*$/);
}

function tableCells(line: string) {
  return line.trim().replace(/^\||\|$/g, "").split("|").map((cell) => cell.trim());
}

function isTableDivider(line: string) {
  const cells = tableCells(line);
  return cells.length > 0 && cells.every((cell) => /^:?-{3,}:?$/.test(cell));
}

function isBlockStart(lines: string[], index: number) {
  const line = lines[index] ?? "";
  const next = lines[index + 1] ?? "";
  return !line.trim()
    || /^#{1,6}\s+/.test(line)
    || Boolean(parseFence(line))
    || /^>\s?/.test(line)
    || /^[-*+]\s+/.test(line)
    || /^\d+\.\s+/.test(line)
    || /^---+$/.test(line.trim())
    || (/\|/.test(line) && isTableDivider(next));
}

export default function AssistantMarkdown({ markdown }: Readonly<{ markdown: string }>) {
  const lines = markdown.replace(/\r\n/g, "\n").split("\n");
  const nodes: ReactNode[] = [];
  let index = 0;
  let key = 0;

  while (index < lines.length) {
    const line = lines[index];

    if (!line.trim()) {
      index += 1;
      continue;
    }

    const fence = parseFence(line);
    if (fence) {
      const openingFence = fence[1];
      const fenceCharacter = openingFence[0];
      const closingFence = new RegExp(`^${fenceCharacter}{${openingFence.length},}\\s*$`);
      const source: string[] = [];
      index += 1;
      while (index < lines.length && !closingFence.test(lines[index])) {
        source.push(lines[index]);
        index += 1;
      }
      if (index < lines.length) index += 1;
      nodes.push(<pre key={`pre-${key++}`}><code>{source.join("\n")}</code></pre>);
      continue;
    }

    const heading = line.match(/^(#{1,6})\s+(.+)$/);
    if (heading) {
      const level = heading[1].length;
      const content = renderInline(heading[2]);
      if (level === 1) nodes.push(<h1 key={`heading-${key++}`}>{content}</h1>);
      else if (level === 2) nodes.push(<h2 key={`heading-${key++}`}>{content}</h2>);
      else if (level === 3) nodes.push(<h3 key={`heading-${key++}`}>{content}</h3>);
      else if (level === 4) nodes.push(<h4 key={`heading-${key++}`}>{content}</h4>);
      else if (level === 5) nodes.push(<h5 key={`heading-${key++}`}>{content}</h5>);
      else nodes.push(<h6 key={`heading-${key++}`}>{content}</h6>);
      index += 1;
      continue;
    }

    if (/^---+$/.test(line.trim())) {
      nodes.push(<hr key={`hr-${key++}`}/>);
      index += 1;
      continue;
    }

    if (/^>\s?/.test(line)) {
      const quote: string[] = [];
      while (index < lines.length && /^>\s?/.test(lines[index])) {
        quote.push(lines[index].replace(/^>\s?/, ""));
        index += 1;
      }
      nodes.push(<blockquote key={`quote-${key++}`}>{renderInline(quote.join(" "))}</blockquote>);
      continue;
    }

    if (/^[-*+]\s+/.test(line)) {
      const items: string[] = [];
      while (index < lines.length && /^[-*+]\s+/.test(lines[index])) {
        items.push(lines[index].replace(/^[-*+]\s+/, ""));
        index += 1;
      }
      nodes.push(
        <ul key={`ul-${key++}`}>
          {items.map((item, itemIndex) => <li key={itemIndex}>{renderInline(item)}</li>)}
        </ul>,
      );
      continue;
    }

    if (/^\d+\.\s+/.test(line)) {
      const items: string[] = [];
      while (index < lines.length && /^\d+\.\s+/.test(lines[index])) {
        items.push(lines[index].replace(/^\d+\.\s+/, ""));
        index += 1;
      }
      nodes.push(
        <ol key={`ol-${key++}`}>
          {items.map((item, itemIndex) => <li key={itemIndex}>{renderInline(item)}</li>)}
        </ol>,
      );
      continue;
    }

    if (/\|/.test(line) && isTableDivider(lines[index + 1] ?? "")) {
      const headers = tableCells(line);
      const rows: string[][] = [];
      index += 2;
      while (index < lines.length && lines[index].trim() && /\|/.test(lines[index])) {
        rows.push(tableCells(lines[index]));
        index += 1;
      }
      nodes.push(
        <div className={styles.tableWrap} key={`table-${key++}`}>
          <table>
            <thead><tr>{headers.map((cell, cellIndex) => <th key={cellIndex}>{renderInline(cell)}</th>)}</tr></thead>
            <tbody>
              {rows.map((row, rowIndex) => (
                <tr key={rowIndex}>{headers.map((_, cellIndex) => <td key={cellIndex}>{renderInline(row[cellIndex] ?? "")}</td>)}</tr>
              ))}
            </tbody>
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
    nodes.push(<p key={`p-${key++}`}>{renderInline(paragraph.join(" "))}</p>);
  }

  return <div className={styles.markdown}>{nodes}</div>;
}
