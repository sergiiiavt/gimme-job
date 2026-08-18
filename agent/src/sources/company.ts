import type { JobInput } from "../domain.js";
import { extractJobPostingMetadata, htmlToVacancyText } from "../vacancy-content.js";
import { decodeHtmlEntities, inferCompany } from "../utils.js";
import { fetchText } from "./http.js";

const UNKNOWN_COMPANY = /^(?:unknown|company is hidden|hidden company|невідома компанія|компанію приховано|компания скрыта|n\/a|none|-)$/iu;
const BOARD_NAMES = /^(?:dou|djinni|work\.ua|robota\.ua|rabota\.ua|lobby\s*x|greenhouse|lever|ashby|companies|компанії|компании)$/iu;
const NON_COMPANY_TEXT = /(?:^(?:overview|about|about us|about the role|job description|responsibilities|requirements|nice to have|what we offer|benefits|conditions|обов[’'ʼ]?язки|вимоги|умови|про компанію|про нас|опис вакансії|задачі|требования|условия)$)|(?:\b(?:full[- ]?time|part[- ]?time|work experience|досвід роботи|повна зайнятість)\b)/iu;
const ROLE_LIKE_NAME = /^(?:(?:senior|sr|middle|mid|junior|jr|lead|principal|staff|manual|automation|automated)\s+)?(?:qa|aqa|sdet|test|testing|quality assurance)(?:\s+(?:engineer|specialist|analyst|tester|lead|manager))?$/iu;
const COMPANY_WORD = `[\\p{L}\\p{N}&+.'’ʼ«»()/_-]+`;
const COMPANY_GAP = `[ \\t]+`;

function cleanCompany(value: unknown): string {
  if (typeof value !== "string" && typeof value !== "number") return "";
  return decodeHtmlEntities(String(value))
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .replace(/^(?:at|@|в|у)\s+/iu, "")
    .replace(/[|,;:\-–—]+$/u, "")
    .trim();
}

export function isUsableCompany(value: unknown): boolean {
  const company = cleanCompany(value);
  return Boolean(
    company
      && company.length <= 120
      && !UNKNOWN_COMPANY.test(company)
      && !BOARD_NAMES.test(company)
      && !NON_COMPANY_TEXT.test(company)
      && !ROLE_LIKE_NAME.test(company),
  );
}

function usable(value: unknown): string {
  const company = cleanCompany(value);
  return isUsableCompany(company) ? company : "";
}

function decodeJsonString(value: string): string {
  try {
    return JSON.parse(`"${value}"`) as string;
  } catch {
    return value;
  }
}

function textFromAnchorBody(value: string): string {
  return cleanCompany(htmlToVacancyText(value));
}

export function inferCompanyFromText(value: string): string {
  const text = String(value ?? "").replace(/\r/g, "");
  const prefix = text.slice(0, 2_000);
  const lines = prefix.split(/\n+/).map((line) => line.trim()).filter(Boolean);

  const companySentence = new RegExp(
    `(?:^|\\n)(${COMPANY_WORD}(?:${COMPANY_GAP}${COMPANY_WORD}){0,6})${COMPANY_GAP}(?:is|є|являється|является)${COMPANY_GAP}(?:an?${COMPANY_GAP})?(?:[\\p{L}-]+${COMPANY_GAP}){0,5}(?:company|компанія|компания)\\b`,
    "iu",
  ).exec(prefix);
  const sentenceCompany = usable(companySentence?.[1]);
  if (sentenceCompany) return sentenceCompany;

  const aboutCompanyLine = /(?:^|\n)(?:about the company|about company|про компанію|о компании)\s*:\s*([^\n]{2,180})/iu.exec(prefix)?.[1] ?? "";
  if (aboutCompanyLine) {
    const aboutName = new RegExp(
      `^(${COMPANY_WORD}(?:${COMPANY_GAP}${COMPANY_WORD}){0,6})(?=${COMPANY_GAP}(?:is|є|являється|является|[—–-])${COMPANY_GAP}|$)`,
      "iu",
    ).exec(aboutCompanyLine)?.[1];
    const company = usable(aboutName);
    if (company) return company;
  }

  for (const line of lines) {
    const dash = new RegExp(`^(${COMPANY_WORD}(?:${COMPANY_GAP}${COMPANY_WORD}){0,6})${COMPANY_GAP}*[—–-]${COMPANY_GAP}*`, "u").exec(line);
    const company = usable(dash?.[1]);
    if (company) return company;
  }

  const labelled = /(?:^|\n)(?:company|компанія|компания)\s*:\s*([^\n|]{2,120})/iu.exec(prefix);
  return usable(labelled?.[1]);
}

export function extractCompanyFromHtml(url: string, html: string): string {
  const metadata = extractJobPostingMetadata(html);
  if (isUsableCompany(metadata?.company)) return cleanCompany(metadata?.company);

  const dataAttribute = /\bdata-company(?:-name)?\s*=\s*["']([^"']+)["']/i.exec(html);
  const fromDataAttribute = usable(dataAttribute?.[1]);
  if (fromDataAttribute) return fromDataAttribute;

  const jsonCandidates = [
    ...html.matchAll(/"companyName"\s*:\s*"((?:\\.|[^"\\])*)"/gi),
    ...html.matchAll(/"company_name"\s*:\s*"((?:\\.|[^"\\])*)"/gi),
    ...html.matchAll(/"hiringOrganization"\s*:\s*\{[\s\S]{0,500}?"name"\s*:\s*"((?:\\.|[^"\\])*)"/gi),
  ];
  for (const match of jsonCandidates) {
    const candidate = usable(decodeJsonString(match[1] ?? ""));
    if (candidate) return candidate;
  }

  const anchors = /<a\b([^>]*)>([\s\S]*?)<\/a>/gi;
  let anchor: RegExpExecArray | null;
  while ((anchor = anchors.exec(html))) {
    const attributes = anchor[1] ?? "";
    const href = /\bhref\s*=\s*["']([^"']+)["']/i.exec(attributes)?.[1] ?? "";
    const classes = /\bclass\s*=\s*["']([^"']+)["']/i.exec(attributes)?.[1] ?? "";
    const looksLikeCompanyLink = /\/(?:companies?|jobs\/by-company)\/[^/?#]+/i.test(href)
      || /[?&]company=[^&#]+/i.test(href)
      || /(?:^|\s)(?:company|employer)(?:\s|$)/i.test(classes);
    if (!looksLikeCompanyLink) continue;
    const candidate = usable(textFromAnchorBody(anchor[2] ?? ""));
    if (candidate) return candidate;
  }

  const companyElements = /<(?:span|div|p)\b([^>]*)>([\s\S]*?)<\/(?:span|div|p)>/gi;
  let element: RegExpExecArray | null;
  while ((element = companyElements.exec(html))) {
    const classes = /\bclass\s*=\s*["']([^"']+)["']/i.exec(element[1] ?? "")?.[1] ?? "";
    if (!/(?:^|[-_\s])company(?:[-_\s]|$)|employer/i.test(classes)) continue;
    const candidate = usable(htmlToVacancyText(element[2] ?? ""));
    if (candidate) return candidate;
  }

  const inferredFromPage = inferCompanyFromText(htmlToVacancyText(html));
  if (inferredFromPage) return inferredFromPage;

  try {
    const hostname = new URL(url).hostname.toLowerCase();
    if (hostname.endsWith("dou.ua")) {
      const title = /<title[^>]*>([\s\S]*?)<\/title>/i.exec(html)?.[1] ?? "";
      const inferred = usable(inferCompany(htmlToVacancyText(title), ""));
      if (inferred) return inferred;
    }
  } catch {
    // Generic extraction above remains valid for malformed URLs.
  }

  return "";
}

export async function recoverJobCompany(job: JobInput): Promise<JobInput> {
  if (isUsableCompany(job.company)) return job;

  const fromTitle = usable(inferCompany(job.title, ""));
  if (fromTitle) return { ...job, company: fromTitle };

  const fromDescription = inferCompanyFromText(job.description);
  if (fromDescription) return { ...job, company: fromDescription };

  if (!job.url) return { ...job, company: "Unknown" };
  try {
    const fromHtml = extractCompanyFromHtml(job.url, await fetchText(job.url));
    if (fromHtml) return { ...job, company: fromHtml };
  } catch {
    // A temporary detail-page failure must not fail the entire source.
  }
  return { ...job, company: "Unknown" };
}
