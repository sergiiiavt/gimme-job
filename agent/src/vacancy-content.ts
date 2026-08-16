export type VacancySectionKind = "overview" | "responsibilities" | "requirements" | "nice-to-have" | "benefits" | "conditions" | "about" | "other";

export interface VacancySection {
  kind: VacancySectionKind;
  title: string;
  lines: string[];
}

const SECTION_PATTERNS: Array<{ kind: VacancySectionKind; title: string; pattern: RegExp }> = [
  { kind: "responsibilities", title: "Responsibilities", pattern: /^(?:responsibilities|responsibility|what you(?:'|’)ll do|what you will do|your tasks|tasks|duties|key responsibilities|main responsibilities|обов[’'ʼ]?язки|основні обов[’'ʼ]?язки|задачі|основні задачі|завдання|що робити|чем предстоит заниматься)\s*:?[\s]*$/iu },
  { kind: "requirements", title: "Requirements", pattern: /^(?:requirements|required skills|what we expect|what we are looking for|must have|qualifications|key qualifications|you have|you are|вимоги|основні вимоги|очікування від кандидата|очікуємо|що потрібно|кого ми шукаємо|обов[’'ʼ]?язково|требования)\s*:?[\s]*$/iu },
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

export function htmlToVacancyText(html: string): string {
  if (!html) return "";
  return decodeEntities(html)
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, " ")
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, " ")
    .replace(/<(h[1-6])\b[^>]*>([\s\S]*?)<\/\1>/gi, (_match, _tag, body: string) => `\n\n${body.replace(/<[^>]+>/g, " ").trim()}\n`)
    .replace(/<li\b[^>]*>/gi, "\n- ")
    .replace(/<\/li\s*>/gi, "")
    .replace(/<br\s*\/?\s*>/gi, "\n")
    .replace(/<\/(?:p|div|ul|ol|section|article)\s*>/gi, "\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/\u00a0/g, " ")
    .replace(/[ \t]+/g, " ")
    .replace(/ *\n */g, "\n")
    .replace(/\n{3,}/g, "\n\n")
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

export function parseVacancySections(value: string): VacancySection[] {
  const source = value.includes("<") && /<\/?[a-z][\s\S]*>/i.test(value) ? htmlToVacancyText(value) : decodeEntities(value);
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

export function normalizeVacancyDescription(value: string): string {
  const sections = parseVacancySections(value);
  if (!sections.length) return "";
  const shouldShowOverviewHeading = sections.length > 1;
  return sections.map((section) => {
    const heading = section.kind === "overview" && !shouldShowOverviewHeading ? "" : `## ${section.title}\n`;
    return `${heading}${section.lines.join("\n")}`.trim();
  }).filter(Boolean).join("\n\n");
}
