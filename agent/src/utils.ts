import { createHash } from "node:crypto";

export function asArray<T>(value: T | T[] | null | undefined): T[] {
  if (value === null || value === undefined) return [];
  return Array.isArray(value) ? value : [value];
}

export function compactText(value: unknown): string {
  if (value === null || value === undefined) return "";
  if (typeof value === "string" || typeof value === "number") {
    return String(value).replace(/\s+/g, " ").trim();
  }
  if (typeof value === "object" && "#text" in value) {
    return compactText((value as { "#text": unknown })["#text"]);
  }
  return "";
}

export function decodeHtmlEntities(input: string): string {
  const named: Record<string, string> = {
    amp: "&",
    apos: "'",
    gt: ">",
    lt: "<",
    nbsp: " ",
    quot: '"',
    hellip: "…",
    mdash: "—",
    ndash: "–",
    laquo: "«",
    raquo: "»",
    lsquo: "‘",
    rsquo: "’",
    ldquo: "“",
    rdquo: "”",
  };

  return input
    .replace(/&#(\d+);/g, (_match, code: string) =>
      String.fromCodePoint(Number.parseInt(code, 10)),
    )
    .replace(/&#x([0-9a-f]+);/gi, (_match, code: string) =>
      String.fromCodePoint(Number.parseInt(code, 16)),
    )
    .replace(/&([a-z]+);/gi, (match, name: string) => named[name.toLowerCase()] ?? match);
}

export function stripHtml(input: string): string {
  return decodeHtmlEntities(
    input
      .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, " ")
      .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, " ")
      .replace(/<br\s*\/?\s*>/gi, "\n")
      .replace(/<\/p\s*>/gi, "\n")
      .replace(/<[^>]+>/g, " "),
  )
    .replace(/[ \t]+/g, " ")
    .replace(/\n\s+/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

const TRACKING_PARAMS = new Set([
  "fbclid",
  "gclid",
  "mc_cid",
  "mc_eid",
  "trk",
  "trackingId",
  "refId",
]);

export function canonicalizeUrl(rawUrl: string): string {
  if (!rawUrl) return "";
  try {
    const url = new URL(decodeHtmlEntities(rawUrl));

    for (const key of [...url.searchParams.keys()]) {
      if (key.toLowerCase().startsWith("utm_") || TRACKING_PARAMS.has(key)) {
        url.searchParams.delete(key);
      }
    }

    url.hash = "";
    url.hostname = url.hostname.toLowerCase();
    if (url.pathname.length > 1) url.pathname = url.pathname.replace(/\/+$/, "");
    return url.toString();
  } catch {
    return rawUrl.trim();
  }
}

export function unwrapTrackingUrl(rawUrl: string): string {
  try {
    const url = new URL(decodeHtmlEntities(rawUrl));
    const candidates = ["url", "q", "target", "dest", "destination", "redirect"];
    for (const key of candidates) {
      const value = url.searchParams.get(key);
      if (value?.startsWith("http")) return canonicalizeUrl(value);
    }
    return canonicalizeUrl(rawUrl);
  } catch {
    return rawUrl;
  }
}

export function sha256(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

export function normalizeKey(value: string): string {
  return value
    .normalize("NFKD")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}+#.]+/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function jobFingerprint(job: {
  title: string;
  company: string;
  location: string;
}): string {
  return sha256(
    [normalizeKey(job.title), normalizeKey(job.company), normalizeKey(job.location)].join("|"),
  );
}

export function jobId(job: { source: string; externalId: string | null; url: string }): string {
  const stablePart = job.externalId || canonicalizeUrl(job.url) || JSON.stringify(job);
  return `job_${sha256(`${job.source}|${stablePart}`).slice(0, 20)}`;
}

export function isRemoteText(value: string): boolean {
  return /\b(remote|work\s+from\s+home|wfh)\b|віддален|дистанційн|ремоут/iu.test(value);
}

export function safeIsoDate(value: unknown): string | null {
  if (typeof value !== "string" && typeof value !== "number") return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

export function extractEmail(value: string): string | null {
  const match = value.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i);
  if (!match) return null;
  const email = match[0].toLowerCase();
  return /(?:no-?reply|noreply|notifications?)@/i.test(email) ? null : email;
}

export function inferCompany(title: string, fallback = "Unknown"): string {
  const patterns = [
    /\s+(?:at|@)\s+([^|—–]+)$/i,
    /\s+в\s+([^|—–]+)$/iu,
    /\s+[—–]\s+([^|—–]+)$/,
  ];
  for (const pattern of patterns) {
    const match = title.match(pattern);
    if (match?.[1]) return match[1].trim();
  }
  return fallback;
}

export function inferRoleTitle(title: string): string {
  return title
    .replace(/\s+(?:at|@)\s+[^|—–]+$/i, "")
    .replace(/\s+в\s+[^|—–]+$/iu, "")
    .replace(/\s+[—–]\s+[^|—–]+$/, "")
    .trim();
}

export function clamp(value: number, minimum: number, maximum: number): number {
  return Math.min(maximum, Math.max(minimum, value));
}

export function roundShare(numerator: number, denominator: number): number {
  return denominator === 0 ? 0 : Math.round((numerator / denominator) * 1000) / 10;
}
