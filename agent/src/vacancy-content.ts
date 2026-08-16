export type VacancySectionKind = "overview" | "responsibilities" | "requirements" | "nice-to-have" | "benefits" | "conditions" | "about" | "other";

export interface VacancySection {
  kind: VacancySectionKind;
  title: string;
  lines: string[];
}

export interface JobPostingMetadata {
  title: string | null;
  company: string | null;
  description: string | null;
  datePosted: string | null;
}

const SECTION_PATTERNS: Array<{ kind: VacancySectionKind; title: string; pattern: RegExp }> = [
  { kind: "responsibilities", title: "Responsibilities", pattern: /^(?:responsibilities|responsibility|what you(?:'|’)ll do|what you will do|your tasks|tasks|duties|key responsibilities|main responsibilities|обов[’'ʼ]?язки|основні обов[’'ʼ]?язки|задачі|основні задачі|завдання|що робити|чем предстоит заниматься)\s*:?[\s]*$/iu },
  { kind: "requirements", title: "Requirements", pattern: /^(?:requirements|required skills|required skills experience|what we expect|what we are looking for|must have|qualifications|key qualifications|you have|you are|вимоги|основні вимоги|очікування від кандидата|очікуємо|що потрібно|кого ми шукаємо|обов[’'ʼ]?язково|требования)\s*:?[\s]*$/iu },
  { kind: "nice-to-have", title: "Nice to have", pattern: /^(?:nice to have|would be a plus|will be a plus|as a plus|bonus points|preferred|буде плюсом|плюсом буде|бажано|перевагою буде|желательно|будет плюсом)\s*:?[\s]*$/iu },
  { kind: "benefits", title: "What we offer", pattern: /^(?:what we offer|what we provide|benefits|perks|why you(?:'|’)ll love working here|we offer|ми пропонуємо|що ми пропонуємо|на тебе чекають|ми забезпечуємо|переваги|що пропонуємо|что мы предлагаем)\s*:?[\s]*$/iu },
  { kind: "conditions", title: "Conditions", pattern: /^(?:conditions|working conditions|work conditions|employment conditions|compensation and conditions|умови|умови роботи|формат роботи|условия|условия работы)\s*:?[\s]*$/iu },
  { kind: "about", title: "About", pattern: /^(?:about|about us|about the company|about company|company|about the project|project description|про компанію|про нас|про проєкт|опис проєкту|о компании|о проекте)\s*:?[\s]*$/iu },
  { kind: "overview", title: "Overview", pattern: /^(?:overview|job description|about the role|the role|position summary|summary|огляд|опис вакансії|про роль|опис|обзор)\s*:?[\s]*$/iu },
];

function decodeEntities(value: string): string {
  const named: Record<string, string> = { amp: "&", apos: "'", gt: ">", lt: "<", nbsp: " ", quot: '"', hellip: "…", mdash: "—", ndash: "–", laquo: "«", raquo: "»", rsquo: "’", lsquo: "‘", rdquo: "”", ldquo: "“" };
  return value
    .replace(/&#(\d+);/g, (_match, code: string) => String.fromCodePoint(Number.parseInt(code, 10)))
    .replace(/&#x([0-9a-f]+);/gi, (_match, code: string) => String.fromCodePoint(Number.parseInt(code, 16)))
    .replace(/&([a-z]+);/gi, (match, name: string) => named[name.toLowerCase()] ?? match);
}

function stringValue(value: unknown): string {
  return typeof value === "string" ? value : value === null || value === undefined ? "" : String(value);
}

function isTagBoundary(character: string | undefined): boolean {
  return character === undefined || character === ">" || character === "/" || /\s/.test(character);
}

function findTagStart(lowerHtml: string, tagName: string, from: number, closing: boolean): number {
  const needle = `<${closing ? "/" : ""}${tagName}`;
  let cursor = from;
  while (cursor < lowerHtml.length) {
    const index = lowerHtml.indexOf(needle, cursor);
    if (index < 0) return -1;
    if (isTagBoundary(lowerHtml[index + needle.length])) return index;
    cursor = index + needle.length;
  }
  return -1;
}

interface ElementBlock {
  openTag: string;
  body: string;
  start: number;
  end: number;
}

function elementBlocks(html: string, tagName: string): ElementBlock[] {
  const lowerHtml = html.toLowerCase();
  const result: ElementBlock[] = [];
  let cursor = 0;

  while (cursor < html.length) {
    const start = findTagStart(lowerHtml, tagName, cursor, false);
    if (start < 0) break;
    const openEnd = html.indexOf(">", start);
    if (openEnd < 0) break;
    const closeStart = findTagStart(lowerHtml, tagName, openEnd + 1, true);
    if (closeStart < 0) break;
    const closeEnd = html.indexOf(">", closeStart);
    if (closeEnd < 0) break;

    result.push({
      openTag: html.slice(start, openEnd + 1),
      body: html.slice(openEnd + 1, closeStart),
      start,
      end: closeEnd + 1,
    });
    cursor = closeEnd + 1;
  }

  return result;
}

function stripElementBlocks(html: string, tagName: string): string {
  const blocks = elementBlocks(html, tagName);
  if (!blocks.length) return html;
  let output = "";
  let cursor = 0;
  for (const block of blocks) {
    output += html.slice(cursor, block.start);
    output += " ";
    cursor = block.end;
  }
  return output + html.slice(cursor);
}

export function htmlToVacancyText(value: unknown): string {
  const html = stringValue(value);
  if (!html) return "";
  const withoutBlockedElements = stripElementBlocks(stripElementBlocks(html, "script"), "style");
  return decodeEntities(withoutBlockedElements)
    .replace(/<(h[1-6])\b[^>]*>([\s\S]*?)<\/\1\s*>/gi, (_match, _tag, body: string) => `\n\n${body.replace(/<[^>]+>/g, " ").trim()}\n`)
    .replace(/<li\b[^>]*>/gi, "\n- ")
    .replace(/<\/li\s*>/gi, "")
    .replace(/<br\s*\/?\s*>/gi, "\n")
    .replace(/<\/(?:p|div|ul|ol|section|article)\s*>/gi, "\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/\u00a0/g, " ")
    .replace(/[ \t]+/g, " ")
    .replace(/ *\n */g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .replace(/\n\n(?=- )/g, "\n")
    .trim();
}

function cleanLine(line: string): string {
  return line
    .replace(/^[•●▪◦]\s*/, "- ")
    .replace(/^[-–—]\s+(?=\S)/, "- ")
    .replace(/\s+/g, " ")
    .trim();
}

function sectionHeading(line: string): { kind: VacancySectionKind; title: string } | null {
  const candidate = line.trim().replace(/^#{1,6}\s*/, "").trim();
  if (!candidate || candidate.length > 90) return null;
  for (const entry of SECTION_PATTERNS) if (entry.pattern.test(candidate)) return { kind: entry.kind, title: entry.title };
  if (/^[\p{L}\d][\p{L}\d /&+()'’ʼ.,-]{1,60}:$/u.test(candidate)) {
    return { kind: "other", title: candidate.replace(/:$/, "").trim() };
  }
  return null;
}

export function parseVacancySections(value: unknown): VacancySection[] {
  const input = stringValue(value);
  const source = input.includes("<") && /<\/?[a-z][\s\S]*>/i.test(input) ? htmlToVacancyText(input) : decodeEntities(input);
  const lines = source.split(/\r?\n/).map(cleanLine).filter(Boolean);
  const sections: VacancySection[] = [];
  let current: VacancySection = { kind: "overview", title: "Overview", lines: [] };

  const pushCurrent = () => {
    if (!current.lines.length) return;
    const previous = sections.at(-1);
    if (previous?.kind === current.kind && previous.title === current.title) previous.lines.push(...current.lines);
    else sections.push(current);
  };

  for (const line of lines) {
    const heading = sectionHeading(line);
    if (heading) {
      pushCurrent();
      current = { ...heading, lines: [] };
      continue;
    }
    current.lines.push(line);
  }
  pushCurrent();

  if (!sections.length && source.trim()) return [{ kind: "overview", title: "Overview", lines: [source.trim()] }];
  return sections;
}

export function normalizeVacancyDescription(value: unknown): string {
  const sections = parseVacancySections(value);
  if (!sections.length) return "";
  const showOverviewHeading = sections.length > 1;
  return sections.map((section) => {
    const heading = section.kind === "overview" && !showOverviewHeading ? "" : `${section.title}\n`;
    return `${heading}${section.lines.join("\n")}`.trim();
  }).filter(Boolean).join("\n\n");
}

function objects(value: unknown): Record<string, unknown>[] {
  if (Array.isArray(value)) return value.flatMap(objects);
  if (!value || typeof value !== "object") return [];
  const object = value as Record<string, unknown>;
  const graph = Array.isArray(object["@graph"]) ? object["@graph"] : [];
  return [object, ...graph.flatMap(objects)];
}

function isJsonLdScript(openTag: string): boolean {
  return /\btype\s*=\s*["']application\/ld\+json["']/i.test(openTag);
}

export function extractJobPostingMetadata(html: string): JobPostingMetadata | null {
  for (const block of elementBlocks(html, "script")) {
    if (!isJsonLdScript(block.openTag)) continue;
    try {
      const parsed = JSON.parse(decodeEntities(block.body)) as unknown;
      const posting = objects(parsed).find((entry) => {
        const type = entry["@type"];
        return type === "JobPosting" || (Array.isArray(type) && type.includes("JobPosting"));
      });
      if (!posting) continue;
      const organization = posting.hiringOrganization && typeof posting.hiringOrganization === "object"
        ? posting.hiringOrganization as Record<string, unknown>
        : {};
      const text = (value: unknown) => typeof value === "string" ? value.trim() : "";
      return {
        title: text(posting.title) || null,
        company: text(organization.name) || null,
        description: text(posting.description) || null,
        datePosted: text(posting.datePosted) || null,
      };
    } catch {
      // Ignore malformed JSON-LD and continue to the next metadata block.
    }
  }
  return null;
}
