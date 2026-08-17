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

const ENGLISH_SOFTWARE_QA_PATTERNS = [
  /\b(?:senior|sr|middle|mid|junior|jr|lead|principal|staff|manual|automation|automated) qa\b/iu,
  /\bqa (?:engineer|specialist|analyst|tester|automation)\b/iu,
  /\baqa(?: engineer)?\b/iu,
  /\bsdet\b/iu,
  /\bquality assurance (?:engineer|specialist|analyst)\b/iu,
  /\btest automation (?:engineer|specialist|lead)\b/iu,
  /\bautomation test engineer\b/iu,
  /\bautomation testing engineer\b/iu,
  /\bsoftware tester\b/iu,
  /\bsoftware test engineer\b/iu,
  /\bsoftware testing engineer\b/iu,
];

const EXPLICIT_QA_LEADERSHIP_PATTERNS = [
  /\bqa (?:lead|manager|head|director)\b/iu,
  /\bqa team lead\b/iu,
  /\b(?:head|director) of qa\b/iu,
  /\b(?:head|director) qa\b/iu,
  /qa[- ]?інженер/iu,
  /qa[- ]?инженер/iu,
  /qa[- ]?(?:лід|керівник|менеджер)/iu,
  /qa[- ]?(?:лид|руководитель|менеджер)/iu,
  /керівник(?:ця)? qa/iu,
  /руководитель qa/iu,
];

const CYRILLIC_SOFTWARE_QA_PATTERNS = [
  /інженер(?:ка)? з тестування пз/iu,
  /інженер(?:ка)? із тестування пз/iu,
  /інженер(?:ка)? з тестування програмного забезпечення/iu,
  /інженер(?:ка)? із тестування програмного забезпечення/iu,
  /тестувальник(?:ця|ка)? пз/iu,
  /тестувальник(?:ця|ка)? програмного забезпечення/iu,
  /тестировщик программного обеспечения/iu,
];

const CONTEXTUAL_QA_LEADERSHIP_PATTERNS = [
  /\bquality assurance (?:lead|manager|head|director)\b/iu,
  /\bquality assurance team lead\b/iu,
  /\b(?:head|director) of quality assurance\b/iu,
  /\b(?:test|testing) (?:lead|manager|head|director)\b/iu,
  /\b(?:test|testing) team lead\b/iu,
  /\b(?:head|director) of testing\b/iu,
  /\b(?:head|director) of software testing\b/iu,
  /керівник(?:ця)? відділу тестування/iu,
  /керівник(?:ця)? команди qa/iu,
  /керівник(?:ця)? команди тестування/iu,
  /руководитель отдела тестирования/iu,
  /руководитель команды qa/iu,
  /руководитель команды тестирования/iu,
];

const GENERIC_TEST_ROLE_PATTERNS = [
  /\btest engineer\b/iu,
  /\btesting engineer\b/iu,
  /\btest specialist\b/iu,
  /\btesting specialist\b/iu,
  /\btest analyst\b/iu,
  /\btesting analyst\b/iu,
  /\btester\b/iu,
  /\bquality engineer\b/iu,
  /\bquality specialist\b/iu,
  /тестувальник(?:ця|ка)?/iu,
  /тестировщик/iu,
  /інженер(?:ка)? з тестування/iu,
  /інженер(?:ка)? із тестування/iu,
];

const SOFTWARE_CONTEXT_PATTERNS = [
  /\bsoftware\b/iu, /\bweb\b/iu, /\bmobile\b/iu, /\bapi\b/iu, /\bbackend\b/iu,
  /\bfront-end\b/iu, /\bfrontend\b/iu, /\bapplication\b/iu, /\bapplications\b/iu,
  /\bapp\b/iu, /\bapps\b/iu, /\baqa\b/iu, /\bsdet\b/iu,
  /\bembedded\b/iu, /\bfirmware\b/iu, /\btest case\b/iu, /\btest cases\b/iu,
  /\btest plan\b/iu, /\btest plans\b/iu, /\bbug\b/iu, /\bbugs\b/iu,
  /\bdefect\b/iu, /\bdefects\b/iu, /\bjira\b/iu, /\bselenium\b/iu,
  /\bplaywright\b/iu, /\bcypress\b/iu, /\bappium\b/iu, /\bpostman\b/iu,
  /\bswagger\b/iu, /\brest\b/iu, /\bsql\b/iu, /\bci\/cd\b/iu, /\bci cd\b/iu,
  /\bjenkins\b/iu, /\bgithub actions\b/iu, /\bpytest\b/iu, /\bpython\b/iu,
  /\btypescript\b/iu, /\bjavascript\b/iu, /\bjava\b/iu, /\bandroid\b/iu, /\bios\b/iu,
  /програмне забезпечення/iu, /програмного забезпечення/iu, /\bвеб\b/iu,
  /мобільн/iu, /автоматизац/iu, /тест[- ]?кейс/iu, /дефект/iu,
];

const NON_SOFTWARE_TITLE_PATTERNS = [
  /cosmet/iu, /космет/iu, /парфум/iu, /perfume/iu, /fragrance/iu, /food tester/iu,
  /дегуст/iu, /лаборант/iu, /laboratory tester/iu, /textile/iu, /текстил/iu,
  /quality control inspector/iu, /qc inspector/iu, /контролер(?:ка)? якості/iu,
  /відділ технічного контролю/iu, /\bотк\b/iu, /manufactur/iu, /виробництв/iu,
  /product tester/iu, /тестер продукц/iu,
];

const NON_SOFTWARE_CONTEXT_PATTERNS = [
  /\bpharmaceutical\b/iu, /\bpharma\b/iu, /фармацевт/iu, /\bgmp\b/iu, /\bhaccp\b/iu,
  /\bfood production\b/iu, /харчов\S* виробництв/iu, /\blaboratory\b/iu, /\blaboratories\b/iu,
  /лаборатор/iu, /\bcosmetic\b/iu, /\bcosmetics\b/iu, /космет/iu,
  /\bmanufacturing line\b/iu, /виробнич\S* ліні/iu, /\braw material\b/iu,
  /\braw materials\b/iu, /сировин/iu, /\bbatch release\b/iu,
];

const HARDWARE_ONLY_TITLE_PATTERNS = [
  /\bhardware qa\b/iu, /\bhardware test\b/iu, /\bhardware tester\b/iu, /\bhardware testing\b/iu,
  /\belectronic test\b/iu, /\belectronics test\b/iu, /\belectronic tester\b/iu,
  /\belectronics tester\b/iu, /електронік\S* тест/iu, /електронік\S* випробув/iu,
];

const CONFLICTING_PRIMARY_ROLE_PATTERNS = [
  /^technical support/iu, /^tech support/iu, /^customer support/iu, /^support specialist/iu,
  /^support engineer/iu, /^developer/iu, /^software developer/iu, /^front-end developer/iu,
  /^frontend developer/iu, /^back-end developer/iu, /^backend developer/iu, /^product manager/iu,
  /^project manager/iu, /^business analyst/iu, /^data analyst/iu, /^recruiter/iu,
  /^sales manager/iu, /^account manager/iu, /^маркетолог/iu, /^менеджер з продаж/iu,
  /^рекрутер/iu, /^служба підтримки/iu,
];

const BARE_QA_TITLE = /^(?:qa|qa\/aqa|senior qa|sr qa|middle qa|mid qa|junior qa|jr qa|lead qa|principal qa|staff qa|manual qa|automation qa|head qa|director qa)$/iu;
const COMPANY_SUFFIXES = /\b(?:llc|ltd|limited|inc|incorporated|corp|corporation|gmbh|plc|company|co|тов|тзов|пат|ат|фоп)\b/giu;
const TITLE_STOP_WORDS = new Set(["a", "an", "and", "the", "for", "of", "to", "with", "in", "on", "at", "та", "і", "й", "в", "у", "з", "із", "зі", "для", "на"]);
const DESCRIPTION_STOP_WORDS = new Set([...TITLE_STOP_WORDS, "we", "you", "our", "your", "is", "are", "be", "will", "this", "that", "as", "or", "by", "from", "ми", "ви", "наш", "ваш", "це", "що", "як", "або", "від", "до", "про", "робота", "роботи"]);

function matchesAny(value: string, patterns: readonly RegExp[]): boolean {
  return patterns.some((pattern) => pattern.test(value));
}

export function normalizeVacancyText(value: string): string {
  return String(value ?? "")
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
  const explicitQaRole = matchesAny(title, ENGLISH_SOFTWARE_QA_PATTERNS)
    || matchesAny(title, CYRILLIC_SOFTWARE_QA_PATTERNS)
    || matchesAny(title, EXPLICIT_QA_LEADERSHIP_PATTERNS)
    || BARE_QA_TITLE.test(title);
  const contextualQaLeadership = matchesAny(title, CONTEXTUAL_QA_LEADERSHIP_PATTERNS);
  const softwareContext = matchesAny(body, SOFTWARE_CONTEXT_PATTERNS);
  const nonSoftwareContext = matchesAny(body, NON_SOFTWARE_CONTEXT_PATTERNS);
  const nonSoftwareTitle = matchesAny(title, NON_SOFTWARE_TITLE_PATTERNS)
    || matchesAny(title, HARDWARE_ONLY_TITLE_PATTERNS);

  if ((nonSoftwareTitle || nonSoftwareContext) && !softwareContext) {
    return { accepted: false, score: 0, reason: "non_software_testing_role" };
  }
  if (matchesAny(title, CONFLICTING_PRIMARY_ROLE_PATTERNS) && !explicitQaRole) {
    return { accepted: false, score: 5, reason: "conflicting_primary_role" };
  }
  if (explicitQaRole || (contextualQaLeadership && softwareContext)) {
    return { accepted: true, score: 100, reason: "explicit_software_qa_role" };
  }
  if (contextualQaLeadership) {
    return { accepted: false, score: 15, reason: "generic_test_role_without_software_context" };
  }
  if (matchesAny(title, GENERIC_TEST_ROLE_PATTERNS)) {
    if (softwareContext) return { accepted: true, score: 80, reason: "generic_test_role_with_software_context" };
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
    .replace(/\bsoftware quality assurance\b/g, "qa")
    .replace(/\bquality assurance\b/g, "qa")
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
  if ((left?.length ?? 0) < 40 || (right?.length ?? 0) < 40) return 0;
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
    return String(value ?? "").trim();
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
  return Math.min(1, title * 0.45 + description * 0.35 + location * 0.1 + date * 0.1 + (exactTitle ? 0.08 : 0));
}

export function areDuplicateVacancies(left: IntakeJob, right: IntakeJob): boolean {
  return duplicateConfidence(left, right) >= 0.76;
}

function sourcePriority(source: string): number {
  const value = String(source ?? "").toLowerCase();
  if (value.includes("greenhouse") || value.includes("lever") || value.includes("ashby")) return 100;
  if (value.includes("dou")) return 90;
  if (value.includes("djinni")) return 85;
  if (value.includes("workua") || value.includes("work.ua")) return 75;
  if (value.includes("robota") || value.includes("rabota")) return 72;
  if (value.includes("lobby")) return 68;
  if (value.includes("manual")) return 60;
  return 50;
}

function statePriority(job: IntakeJob): number {
  const record = job as unknown as Record<string, unknown>;
  let score = 0;
  if (typeof record.status === "string" && !["", "NEW"].includes(record.status)) score += 1000;
  if (record.analysis) score += 200;
  if (record.draft || record.resume) score += 100;
  return score;
}

function mergedSources(...values: string[]): string {
  const result: string[] = [];
  for (const value of values.flatMap((entry) => String(entry ?? "").split(","))) {
    const source = value.trim();
    if (source && !result.includes(source)) result.push(source);
  }
  return result.join(",");
}

export function mergeDuplicateVacancies<T extends IntakeJob>(left: T, right: T): T {
  const leftScore = statePriority(left) + sourcePriority(left.source);
  const rightScore = statePriority(right) + sourcePriority(right.source);
  const primary = leftScore >= rightScore ? left : right;
  const secondary = primary === left ? right : left;
  const description = (secondary.description?.length ?? 0) > (primary.description?.length ?? 0)
    ? secondary.description
    : primary.description;

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
    } else {
      result[duplicateIndex] = mergeDuplicateVacancies(result[duplicateIndex], job);
      duplicateCount += 1;
    }
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