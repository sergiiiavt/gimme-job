const DEFAULT_EXCERPT_LENGTH = 4_000;
const MAX_MIME_DEPTH = 8;
const BLOCK_TAGS = new Set(["blockquote", "div", "h1", "h2", "h3", "h4", "h5", "h6", "li", "p", "tr"]);
const LINE_BREAK_TAGS = new Set(["br", "hr"]);
const SKIPPED_CONTENT_TAGS = new Set(["script", "style"]);

function splitHeaderBody(entity: string): { headerBlock: string; body: string } {
  const crlfIndex = entity.indexOf("\r\n\r\n");
  const lfIndex = entity.indexOf("\n\n");
  const index = crlfIndex >= 0 && (lfIndex < 0 || crlfIndex <= lfIndex) ? crlfIndex : lfIndex;
  if (index < 0) return { headerBlock: "", body: entity };
  const separatorLength = index === crlfIndex ? 4 : 2;
  return { headerBlock: entity.slice(0, index), body: entity.slice(index + separatorLength) };
}

function parseHeaders(headerBlock: string): Map<string, string> {
  const headers = new Map<string, string>();
  const unfolded = headerBlock.replace(/\r?\n[ \t]+/g, " ");
  for (const line of unfolded.split(/\r?\n/)) {
    const colon = line.indexOf(":");
    if (colon <= 0) continue;
    const key = line.slice(0, colon).trim().toLowerCase();
    const value = line.slice(colon + 1).trim();
    if (!key) continue;
    headers.set(key, headers.has(key) ? `${headers.get(key)}, ${value}` : value);
  }
  return headers;
}

function contentType(headers: Map<string, string>): { mime: string; boundary: string | null } {
  const value = headers.get("content-type") ?? "text/plain";
  const mime = value.split(";", 1)[0]?.trim().toLowerCase() || "text/plain";
  const quoted = /(?:^|;)\s*boundary\s*=\s*"([^"]+)"/i.exec(value)?.[1];
  const bare = /(?:^|;)\s*boundary\s*=\s*([^;\s]+)/i.exec(value)?.[1];
  return { mime, boundary: (quoted ?? bare ?? "").trim() || null };
}

function base64Bytes(value: string): Uint8Array {
  const normalized = value.replace(/\s+/g, "");
  if (!normalized) return new Uint8Array();
  try {
    const binary = atob(normalized);
    const bytes = new Uint8Array(binary.length);
    for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.codePointAt(index) ?? 0;
    return bytes;
  } catch {
    return new TextEncoder().encode(value);
  }
}

function quotedPrintableBytes(value: string): Uint8Array {
  const source = value.replace(/=\r?\n/g, "");
  const bytes: number[] = [];
  for (let index = 0; index < source.length; index += 1) {
    if (source[index] === "=" && /^[0-9a-f]{2}$/i.test(source.slice(index + 1, index + 3))) {
      bytes.push(Number.parseInt(source.slice(index + 1, index + 3), 16));
      index += 2;
      continue;
    }
    const codePoint = source.codePointAt(index) ?? 0;
    const encoded = new TextEncoder().encode(String.fromCodePoint(codePoint));
    bytes.push(...encoded);
    if (codePoint > 0xffff) index += 1;
  }
  return Uint8Array.from(bytes);
}

function decodedBody(body: string, encoding: string): string {
  const normalized = encoding.trim().toLowerCase();
  try {
    if (normalized === "base64") return new TextDecoder("utf-8", { fatal: false }).decode(base64Bytes(body));
    if (normalized === "quoted-printable") return new TextDecoder("utf-8", { fatal: false }).decode(quotedPrintableBytes(body));
  } catch {
    // Fall through to the original text; malformed MIME must not break email ingestion.
  }
  return body;
}

function decodeHtmlEntities(value: string): string {
  const named: Record<string, string> = {
    amp: "&",
    apos: "'",
    gt: ">",
    hellip: "…",
    lt: "<",
    nbsp: " ",
    quot: '"',
  };
  return value.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (match, entity: string) => {
    const lower = entity.toLowerCase();
    if (lower.startsWith("#x")) {
      const code = Number.parseInt(lower.slice(2), 16);
      return Number.isFinite(code) ? String.fromCodePoint(code) : match;
    }
    if (lower.startsWith("#")) {
      const code = Number.parseInt(lower.slice(1), 10);
      return Number.isFinite(code) ? String.fromCodePoint(code) : match;
    }
    return named[lower] ?? match;
  });
}

function tagEnd(value: string, start: number): number {
  let quote: '"' | "'" | null = null;
  for (let index = start + 1; index < value.length; index += 1) {
    const character = value[index];
    if (quote) {
      if (character === quote) quote = null;
      continue;
    }
    if (character === '"' || character === "'") {
      quote = character;
      continue;
    }
    if (character === ">") return index;
  }
  return -1;
}

function parsedTagName(source: string): { name: string; closing: boolean } {
  const trimmed = source.trim();
  let cursor = 0;
  const closing = trimmed.startsWith("/");
  if (closing) cursor += 1;
  while (cursor < trimmed.length && (trimmed[cursor] === " " || trimmed[cursor] === "\t" || trimmed[cursor] === "\r" || trimmed[cursor] === "\n")) cursor += 1;
  const start = cursor;
  while (cursor < trimmed.length) {
    const character = trimmed[cursor];
    if (character === " " || character === "\t" || character === "\r" || character === "\n" || character === "/") break;
    cursor += 1;
  }
  return { name: trimmed.slice(start, cursor).toLowerCase(), closing };
}

type HtmlTagTransition = { skippedTag: string | null; lineBreak: boolean };

function transitionHtmlTag(
  tag: { name: string; closing: boolean },
  skippedTag: string | null,
): HtmlTagTransition {
  if (skippedTag) {
    return {
      skippedTag: tag.closing && tag.name === skippedTag ? null : skippedTag,
      lineBreak: false,
    };
  }
  if (!tag.closing && SKIPPED_CONTENT_TAGS.has(tag.name)) {
    return { skippedTag: tag.name, lineBreak: false };
  }
  return {
    skippedTag: null,
    lineBreak: BLOCK_TAGS.has(tag.name) || LINE_BREAK_TAGS.has(tag.name),
  };
}

function htmlToText(value: string): string {
  let output = "";
  let skippedTag: string | null = null;

  for (let index = 0; index < value.length;) {
    if (value.startsWith("<!--", index)) {
      const commentEnd = value.indexOf("-->", index + 4);
      index = commentEnd < 0 ? value.length : commentEnd + 3;
      continue;
    }

    if (value[index] !== "<") {
      output += skippedTag ? "" : value[index];
      index += 1;
      continue;
    }

    const end = tagEnd(value, index);
    if (end < 0) {
      output += skippedTag ? "" : value.slice(index);
      break;
    }

    const transition = transitionHtmlTag(parsedTagName(value.slice(index + 1, end)), skippedTag);
    skippedTag = transition.skippedTag;
    if (transition.lineBreak) output += "\n";
    index = end + 1;
  }

  return decodeHtmlEntities(output);
}

type MimeText = { plain: string[]; html: string[] };

function removeLeadingLineBreak(value: string): string {
  if (value.startsWith("\r\n")) return value.slice(2);
  if (value.startsWith("\n")) return value.slice(1);
  return value;
}

function removeTrailingLineBreak(value: string): string {
  if (value.endsWith("\r\n")) return value.slice(0, -2);
  if (value.endsWith("\n")) return value.slice(0, -1);
  return value;
}

function mimeParts(body: string, boundary: string): string[] {
  const marker = `--${boundary}`;
  return body
    .split(marker)
    .slice(1)
    .map(removeLeadingLineBreak)
    .filter((part) => part && !part.startsWith("--"))
    .map(removeTrailingLineBreak);
}

function collectMimeText(entity: string, depth = 0): MimeText {
  if (depth > MAX_MIME_DEPTH) return { plain: [], html: [] };
  const { headerBlock, body } = splitHeaderBody(entity);
  const headers = parseHeaders(headerBlock);
  const { mime, boundary } = contentType(headers);

  if (mime.startsWith("multipart/") && boundary) {
    const collected: MimeText = { plain: [], html: [] };
    for (const part of mimeParts(body, boundary)) {
      const nested = collectMimeText(part, depth + 1);
      collected.plain.push(...nested.plain);
      collected.html.push(...nested.html);
    }
    return collected;
  }

  if (mime === "message/rfc822") return collectMimeText(body, depth + 1);

  const decoded = decodedBody(body, headers.get("content-transfer-encoding") ?? "");
  if (mime === "text/plain") return { plain: [decoded], html: [] };
  if (mime === "text/html") return { plain: [], html: [htmlToText(decoded)] };
  return { plain: [], html: [] };
}

function cleanExcerpt(value: string, maxLength: number): string | null {
  const clean = value
    .replace(/\r/g, "")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n[ \t]+/g, "\n")
    .replace(/[ \t]{2,}/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
  if (!clean) return null;
  if (clean.length <= maxLength) return clean;
  return `${clean.slice(0, Math.max(0, maxLength - 1)).trimEnd()}…`;
}

export function extractEmailTextExcerpt(rawMessage: string, maxLength = DEFAULT_EXCERPT_LENGTH): string | null {
  const boundedLength = Math.min(Math.max(Math.trunc(maxLength), 1), 20_000);
  const collected = collectMimeText(rawMessage);
  const preferred = collected.plain.map((value) => value.trim()).filter(Boolean);
  const fallback = collected.html.map((value) => value.trim()).filter(Boolean);
  return cleanExcerpt((preferred.length ? preferred : fallback).join("\n\n"), boundedLength);
}
