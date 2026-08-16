export interface IntakeJob {
  source: string;
  externalId: string | null;
  title: string;
  company: string;
  location: string;
  remote: boolean;
  url: string;
  applyUrl: string;
  description: string;
  salaryText: string | null;
  postedAt: string | null;
  contactEmail: string | null;
  raw?: unknown;
}

export type RelevanceReason =
  | "explicit_software_qa_role"
  | "generic_test_role_with_software_context"
  | "non_software_testing_role"
  | "conflicting_primary_role"
  | "generic_test_role_without_software_context"
  | "no_software_qa_role_signal";

export interface RelevanceDecision {
  accepted: boolean;
  score: number;
  reason: RelevanceReason;
}

export interface DedupeResult<T extends IntakeJob> {
  jobs: T[];
  duplicateCount: number;
}

const EXPLICIT_SOFTWARE_QA_ROLE = /(?:\b(?:senior|sr|middle|mid|junior|jr|lead|principal|staff|manual|automation|automated)\s+qa\b|\bqa\s+(?:engineer|lead|manager|specialist|analyst|tester|automation)\b|\baqa(?:\s+engineer)?\b|\bsdet\b|\bquality\s+assurance\s+(?:engineer|lead|manager|specialist|analyst)\b|\btest\s+automation\s+(?:engineer|specialist|lead)\b|\bautomation\s+test(?:ing)?\s+engineer\b|\bsoftware\s+(?:test(?:ing)?\s+engineer|tester)\b|\bінженер(?:ка)?\s+(?:з|із)\s+тестування\s+(?:пз|програмного\s+забезпечення)\b|\bтестувальник(?:ця|ка)?\s+(?:пз|програмного\s+забезпечення)\b|\bqa[- ]?інженер\b)/iu;

const BARE_QA_TITLE = /^(?:(?:senior|sr|middle|mid|junior|jr|lead|principal|staff|manual|automation)\s+)?qa(?:\s*\/\s*aqa)?$/iu;
const GENERIC_TEST_ROLE = /(?:\btest(?:er|ing)?\s+(?:engineer|specialist|analyst)\b|\btester\b|\btest\s+engineer\b|\bquality\s+engineer\b|\bquality\s+specialist\b|\bтестувальник(?:ця|ка)?\b|\bтестировщик\b|\bінженер(?:ка)?\s+(?:з|із)\s+тестування\b)/iu;

const SOFTWARE_CONTEXT = /(?:\bsoftware\b|\bweb\b|\bmobile\b|\bapi\b|\bbackend\b|\bfront[- ]?end\b|\bapplication(?:s)?\b|\bapp(?:s)?\b|\bqa\b|\baqa\b|\bsdet\b|\btest\s+case(?:s)?\b|\btest\s+plan(?:s)?\b|\bbug(?:s)?\b|\bdefect(?:s)?\b|\bjira\b|\bselenium\b|\bplaywright\b|\bcypress\b|\bappium\b|\bpostman\b|\bswagger\b|\brest\b|\bsql\b|\bci\/?cd\b|\bjenkins\b|\bgithub\s+actions\b|\bpytest\b|\bpython\b|\btypescript\b|\bjavascript\b|\bjava\b|\bandroid\b|\bios\b|\bпрограмн(?:е|ого|ому|им)\s+забезпечення\b|\bвеб\b|\bмобільн(?:ий|і|ого)\b|\bавтоматизац(?:ія|ії|ію)\s+тестування\b|\bтест[- ]?кейс(?:и|ів)?\b|\bдефект(?:и|ів)?\b)/iu;

const NON_SOFTWARE_TITLE = /(?:cosmet|космет|парфум|perfume|fragrance|food\s+tester|дегуст|лаборант|laboratory\s+tester|textile|текстил|quality\s+control\s+inspector|qc\s+inspector|контролер(?:ка)?\s+якості|відділ\s+технічного\s+контролю|\bотк\b|manufactur|виробництв|product\s+tester|тестер\s+продукц)/iu;
const HARDWARE_ONLY_TITLE = /(?:\bhardware\s+(?:qa|test|tester|testing)\b|\belectronics?\s+(?:test|tester|testing)\b|\bелектронік\S*\s+(?:тест|випробув))/iu;
const CONFLICTING_PRIMARY_ROLE = /^(?:technical\s+support|tech\s+support|customer\s+support|support\s+specialist|support\s+engineer|developer|software\s+developer|front[- ]?end\s+developer|back[- ]?end\s+developer|product\s+manager|project\s+manager|business\s+analyst|data\s+analyst|recruiter|sales\s+manager|account\s+manager|маркетолог|менеджер\s+з\s+продаж|рекрутер|служба\s+підтримки)/iu;

const COMPANY_SUFFIXES = /\b(?:llc|ltd|limited|inc|incorporated|corp|corporation|gmbh|plc|company|co|тов|тзов|пат|ат|фоп)\b/giu;
const TITLE_STOP_WORDS = new Set([
  "a", "an", "and", "the", "for", "of", "to", "with", "in", "on", "at",
  "та", "і", "й", "в", "у", "з", "із", "зі", "для", "на",
]);
const DESCRIPTION_STOP_WORDS = new Set([
  ...TITLE_STOP_WORDS,
  "we", "you", "our", "your", "is", "are", "be", "will", "this", "that", "as", "or", "by", "from",
  "ми", "ви", "наш", "ваш", "це", "що", "як", "або", "від", "до", "про", "робота", "роботи",
]);

export function normalizeVacancyText(value: string): string {
  return value
    .normalize("NFKD")
    .toLowerCase()
    .replace(/[’'`]/g, "")
    .replace(/[^\p{L}\p{N}+#.]+/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function classifyJobRelevance(job: Pick<IntakeJob, "title" | "description" | "company" | "location">): RelevanceDecision {
  const title = normalizeVacancyText(job.title);
  const body = normalizeVacancyText(`${job.title}\n${job.description}\n${job.company}\n${job.location}`);
  const explicitQaRole = EXPLICIT_SOFTWARE_QA_ROLE.test(title) || BARE_QA_TITLE.test(title);
  const softwareContext = SOFTWARE_CONTEXT.test(body);

  if ((NON_SOFTWARE_TITLE.test(title) || HARDWARE_ONLY_TITLE.test(title)) && !softwareContext) {
    return { accepted: false, score: 0, reason: "non_software_testing_role" };
  }

  if (CONFLICTING_PRIMARY_ROLE.test(title) && !explicitQaRole) {
    return { accepted: false, score: 5, reason: "conflicting_primary_role" };
  }

  if (explicitQaRole) {
    return { accepted: true, score: 100, reason: "explicit_software_qa_role" };
  }

  if (GENERIC_TEST_ROLE.test(title)) {
    if (softwareContext) {
      return { accepted: true, score: 80, reason: "generic_test_role_with_software_context" };
    }
    return { accepted: false, score: 15, reason: "generic_test_role_without_software_context" };
  }

  return { accepted: false, score: 0, reason: "no_software_qa_role_signal" };
}

function canonicalCompany(value: string): string {
  const normalized = normalizeVacancyText(value).replace(COMPANY_SUFFIXES, " ").replace(/\s+/g, " ").trim();
  return /^(?:unknown|company is hidden|hidden company|невідома компанія)$/.test(normalized) ? "" : normalized;
}

function canonicalTitle(value: string): string {
  return normalizeVacancyText(value)
    .replace(/\bquality assurance\b/g, "qa")
    .replace(/\bsoftware quality assurance\b/g, "qa")
    .replace(/\bautomated\b/g, "automation")
    .replace(/\btest automation\b/g, "automation test")
    .replace(/\bsr\b/g, "senior")
    .replace(/\bmid\b/g, "middle")
    .replace(/\bjr\b/g, "junior")
    .replace(/\s+/g, " ")
    .trim();
}

function tokenSet(value: string, stopWords: Set<string>, limit = 250): Set<string> {
  const result = new Set<string>();
  for (const token of normalizeVacancyText(value).split(" ")) {
    if (token.length < 2 || stopWords.has(token)) continue;
    result.add(token);
    if (result.size >= limit) break;
  }
  return result;
}

function jaccard(left: Set<string>, right: Set<string>): number {
  if (!left.size || !right.size) return 0;
  let intersection = 0;
  for (const token of left) if (right.has(token)) intersection += 1;
  return intersection / (left.size + right.size - intersection);
}

function titleSimilarity(left: string, right: string): number {
  const a = canonicalTitle(left);
  const b = canonicalTitle(right);
  if (a === b) return 1;
  return jaccard(tokenSet(a, TITLE_STOP_WORDS, 30), tokenSet(b, TITLE_STOP_WORDS, 30));
}

function descriptionSimilarity(left: string, right: string): number {
  if (left.length < 40 || right.length < 40) return 0;
  return jaccard(tokenSet(left, DESCRIPTION_STOP_WORDS), tokenSet(right, DESCRIPTION_STOP_WORDS));
}

function canonicalUrl(value: string): string {
  try {
    const url = new URL(value);
    for (const key of [...url.searchParams.keys()]) {
      const normalized = key.toLowerCase();
      if (normalized.startsWith("utm_") || ["fbclid", "gclid", "ref", "refid", "trackingid"].includes(normalized)) {
        url.searchParams.delete(key);
      }
    }
    url.hash = "";
    url.hostname = url.hostname.toLowerCase();
    url.pathname = url.pathname.replace(/\/+$/, "") || "/";
    return url.toString();
  } catch {
    return value.trim();
  }
}

function locationSimilarity(left: IntakeJob, right: IntakeJob): number {
  if (left.remote && right.remote) return 1;
  const a = normalizeVacancyText(left.location);
  const b = normalizeVacancyText(right.location);
  if (!a || !b || a === "unknown" || b === "unknown") return 0.5;
  if (a === b || a.includes(b) || b.includes(a)) return 1;
  return 0;
}

function dateSimilarity(left: string | null, right: string | null): number {
  if (!left || !right) return 0.5;
  const a = Date.parse(left);
  const b = Date.parse(right);
  if (!Number.isFinite(a) || !Number.isFinite(b)) return 0.5;
  const days = Math.abs(a - b) / 86_400_000;
  if (days <= 3) return 1;
  if (days <= 14) return 0.8;
  if (days <= 45) return 0.4;
  return 0;
}

export function duplicateConfidence(left: IntakeJob, right: IntakeJob): number {
  const leftUrl = canonicalUrl(left.url);
  const rightUrl = canonicalUrl(right.url);
  if (leftUrl && rightUrl && leftUrl === rightUrl) return 1;

  const leftCompany = canonicalCompany(left.company);
  const rightCompany = canonicalCompany(right.company);
  if (!leftCompany || !rightCompany || leftCompany !== rightCompany) return 0;

  const title = titleSimilarity(left.title, right.title);
  if (title < 0.67) return 0;

  const description = descriptionSimilarity(left.description, right.description);
  const location = locationSimilarity(left, right);
  const date = dateSimilarity(left.postedAt, right.postedAt);
  const exactTitle = canonicalTitle(left.title) === canonicalTitle(right.title);

  const score = title * 0.45 + description * 0.35 + location * 0.1 + date * 0.1 + (exactTitle ? 0.08 : 0);
  return Math.min(1, score);
}

export function areDuplicateVacancies(left: IntakeJob, right: IntakeJob): boolean {
  return duplicateConfidence(left, right) >= 0.76;
}

function sourcePriority(source: string): number {
  const value = source.toLowerCase();
  if (value.includes("greenhouse") || value.includes("lever") || value.includes("ashby")) return 100;
  if (value.includes("dou")) return 90;
  if (value.includes("djinni")) return 85;
  if (value.includes("workua") || value.includes("work.ua")) return 75;
  if (value.includes("robota") || value.includes("rabota")) return 72;
  if (value.includes("lobby")) return 68;
  if (value.includes("manual")) return 60;
  return 50;
}

function mergedSources(...values: string[]): string {
  const result: string[] = [];
  for (const value of values.flatMap((entry) => entry.split(","))) {
    const source = value.trim();
    if (source && !result.includes(source)) result.push(source);
  }
  return result.join(",");
}

export function mergeDuplicateVacancies<T extends IntakeJob>(left: T, right: T): T {
  const leftWins = sourcePriority(left.source) >= sourcePriority(right.source);
  const primary = leftWins ? left : right;
  const secondary = leftWins ? right : left;
  const description = secondary.description.length > primary.description.length ? secondary.description : primary.description;

  return {
    ...primary,
    source: mergedSources(left.source, right.source),
    remote: left.remote || right.remote,
    description,
    salaryText: primary.salaryText ?? secondary.salaryText,
    postedAt: primary.postedAt ?? secondary.postedAt,
    contactEmail: primary.contactEmail ?? secondary.contactEmail,
    raw: {
      primary: primary.raw ?? null,
      duplicateSources: mergedSources(left.source, right.source).split(","),
    },
  } as T;
}

export function deduplicateVacancies<T extends IntakeJob>(jobs: T[]): DedupeResult<T> {
  const result: T[] = [];
  let duplicateCount = 0;

  for (const job of jobs) {
    const duplicateIndex = result.findIndex((candidate) => areDuplicateVacancies(candidate, job));
    if (duplicateIndex < 0) {
      result.push(job);
      continue;
    }
    result[duplicateIndex] = mergeDuplicateVacancies(result[duplicateIndex], job);
    duplicateCount += 1;
  }

  return { jobs: result, duplicateCount };
}

export function filterRelevantVacancies<T extends IntakeJob>(jobs: T[]): { jobs: T[]; rejected: Array<{ job: T; decision: RelevanceDecision }> } {
  const accepted: T[] = [];
  const rejected: Array<{ job: T; decision: RelevanceDecision }> = [];
  for (const job of jobs) {
    const decision = classifyJobRelevance(job);
    if (decision.accepted) accepted.push(job);
    else rejected.push({ job, decision });
  }
  return { jobs: accepted, rejected };
}
