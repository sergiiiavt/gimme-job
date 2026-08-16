import {
  areDuplicateVacancies,
  deduplicateVacancies,
  filterRelevantVacancies,
  mergeDuplicateVacancies,
  type IntakeJob,
} from "../../agent/src/job-intake.js";
import {
  extractJobPostingMetadata,
  htmlToVacancyText,
  normalizeVacancyDescription,
} from "../../agent/src/vacancy-content.js";

type Json = Record<string, unknown>;
type Row = Record<string, unknown>;
type D1Database = {
  prepare(query: string): {
    bind(...values: unknown[]): {
      first<T = Row>(): Promise<T | null>;
      all<T = Row>(): Promise<{ results: T[] }>;
      run(): Promise<unknown>;
    };
    first<T = Row>(): Promise<T | null>;
    all<T = Row>(): Promise<{ results: T[] }>;
  };
};

export interface VacancySourceError {
  source: string;
  error: string;
}

export interface VacancySyncResult {
  seen: number;
  relevant: number;
  rejected: number;
  duplicates: number;
  inserted: number;
  updated: number;
  accepted: number;
  errors: VacancySourceError[];
}

const DEFAULT_VACANCY_SOURCES = {
  rss: [
    { name: "dou-qa", url: "https://jobs.dou.ua/vacancies/feeds/?search=QA" },
    { name: "djinni-qa", url: "https://djinni.co/jobs/rss/?primary_keyword=QA" },
  ],
  greenhouse: [] as Json[],
  lever: [] as Json[],
  ashby: [] as Json[],
  workUa: [{ name: "workua-qa", query: "QA Engineer" }],
  robotaUa: [{ name: "robotaua-qa", query: "QA Engineer" }],
  lobbyX: [{ name: "lobbyx-qa", query: "QA Engineer" }],
};

const WORK_UA_MAX_DETAILS = 40;
const ROBOTA_UA_MAX_DETAILS = 50;
const RSS_MAX_DETAILS = 40;
const LOBBY_X_MAX_DETAILS = 40;

async function database(): Promise<D1Database> {
  const runtime = (await import("cloudflare:workers")).env as unknown as { DB?: D1Database };
  if (!runtime.DB) throw new Error("Cloud database is not available.");
  return runtime.DB;
}

function cleanText(value: unknown, fallback = ""): string {
  return typeof value === "string" || typeof value === "number" ? String(value).trim() : fallback;
}

function parseJson<T>(value: unknown, fallback: T): T {
  try { return JSON.parse(String(value)) as T; } catch { return fallback; }
}

function safeIso(value: unknown): string | null {
  const text = cleanText(value);
  if (!text) return null;
  const time = Date.parse(text);
  return Number.isFinite(time) ? new Date(time).toISOString() : null;
}

function safeUrl(value: unknown, fallback = ""): string {
  const text = cleanText(value, fallback);
  try {
    const url = new URL(text);
    if (!new Set(["http:", "https:"]).has(url.protocol)) return fallback;
    for (const key of [...url.searchParams.keys()]) {
      const lower = key.toLowerCase();
      if (lower.startsWith("utm_") || ["fbclid", "gclid", "trackingid", "refid"].includes(lower)) url.searchParams.delete(key);
    }
    url.hash = "";
    url.hostname = url.hostname.toLowerCase();
    if (url.pathname.length > 1) url.pathname = url.pathname.replace(/\/+$/, "");
    return url.toString();
  } catch { return fallback; }
}

function isRemote(value: string): boolean {
  return /\b(remote|work\s+from\s+home|wfh|віддален|дистанційн|ремоут)\b/iu.test(value);
}

async function fetchText(url: string): Promise<string> {
  const response = await fetch(url, {
    headers: { accept: "text/html, application/xml, text/xml, application/rss+xml, application/atom+xml, */*", "user-agent": "GimmeJob/2.0" },
    signal: AbortSignal.timeout(20_000),
  });
  if (!response.ok) throw new Error(`HTTP ${response.status} from ${url}`);
  return response.text();
}

async function fetchJson<T>(url: string): Promise<T> {
  const response = await fetch(url, {
    headers: { accept: "application/json", "user-agent": "GimmeJob/2.0" },
    signal: AbortSignal.timeout(20_000),
  });
  if (!response.ok) throw new Error(`HTTP ${response.status} from ${url}`);
  return await response.json() as T;
}

function sourceArray(config: Json, key: string, fallback: Json[]): Json[] {
  return Array.isArray(config[key]) ? config[key] as Json[] : fallback;
}

async function sourceConfig(): Promise<Json> {
  const row = await (await database()).prepare("SELECT value_json FROM settings WHERE key = ?").bind("sources").first<Row>();
  const configured = row ? parseJson<Json>(row.value_json, {}) : {};
  return {
    ...configured,
    rss: sourceArray(configured, "rss", DEFAULT_VACANCY_SOURCES.rss),
    greenhouse: sourceArray(configured, "greenhouse", DEFAULT_VACANCY_SOURCES.greenhouse),
    lever: sourceArray(configured, "lever", DEFAULT_VACANCY_SOURCES.lever),
    ashby: sourceArray(configured, "ashby", DEFAULT_VACANCY_SOURCES.ashby),
    workUa: sourceArray(configured, "workUa", DEFAULT_VACANCY_SOURCES.workUa),
    robotaUa: sourceArray(configured, "robotaUa", DEFAULT_VACANCY_SOURCES.robotaUa),
    lobbyX: sourceArray(configured, "lobbyX", DEFAULT_VACANCY_SOURCES.lobbyX),
  };
}

function extractNestedDiv(html: string, attribute: RegExp): string {
  const opening = new RegExp(`<div[^>]*${attribute.source}[^>]*>`, attribute.flags.includes("i") ? "i" : "").exec(html);
  if (!opening) return "";
  let depth = 1;
  const start = opening.index + opening[0].length;
  const tags = /<div\b[^>]*>|<\/div>/gi;
  tags.lastIndex = start;
  let match: RegExpExecArray | null;
  while ((match = tags.exec(html))) {
    depth += match[0].startsWith("</") ? -1 : 1;
    if (depth === 0) return html.slice(start, match.index);
  }
  return html.slice(start);
}

function extractDivById(html: string, id: string): string {
  return extractNestedDiv(html, new RegExp(`\\bid=["']${id}["']`, "i"));
}

function extractDivByClass(html: string, className: string): string {
  return extractNestedDiv(html, new RegExp(`class=["'][^"']*\\b${className}\\b[^"']*["']`, "i"));
}

function detailedDescription(url: string, html: string): string {
  const metadata = extractJobPostingMetadata(html);
  if (metadata?.description) {
    const description = normalizeVacancyDescription(metadata.description);
    if (description.length >= 100) return description;
  }

  let host = "";
  try { host = new URL(url).hostname.toLowerCase(); } catch { /* generic extraction below */ }
  if (host.endsWith("work.ua")) return normalizeVacancyDescription(htmlToVacancyText(extractDivById(html, "job-description")));
  if (host.endsWith("thelobbyx.com")) return normalizeVacancyDescription(htmlToVacancyText(extractDivByClass(html, "vacancy-description")));
  if (host.endsWith("dou.ua")) {
    for (const className of ["vacancy-section", "b-typo"]) {
      const description = normalizeVacancyDescription(htmlToVacancyText(extractDivByClass(html, className)));
      if (description.length >= 100) return description;
    }
  }
  if (host.endsWith("djinni.co")) {
    for (const className of ["job-details--about", "job-details__about", "job-description", "job-details"]) {
      const description = normalizeVacancyDescription(htmlToVacancyText(extractDivByClass(html, className)));
      if (description.length >= 100) return description;
    }
  }
  if (host.endsWith("robota.ua")) {
    const candidates = [...html.matchAll(/"description"\s*:\s*"((?:\\.|[^"\\])*)"/g)]
      .map((match) => {
        try { return JSON.parse(`"${match[1]}"`) as string; } catch { return match[1] ?? ""; }
      })
      .map((value) => normalizeVacancyDescription(htmlToVacancyText(value)))
      .filter((value) => value.length >= 100)
      .sort((left, right) => right.length - left.length);
    if (candidates[0]) return candidates[0];
  }
  return "";
}

function xmlRawTag(block: string, name: string): string {
  return block.match(new RegExp(`<${name}(?:\\s[^>]*)?>([\\s\\S]*?)<\\/${name}>`, "i"))?.[1]
    ?.replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1")
    .trim() ?? "";
}

function xmlTextTag(block: string, name: string): string {
  return htmlToVacancyText(xmlRawTag(block, name));
}

async function collectRss(source: Json): Promise<IntakeJob[]> {
  const sourceUrl = safeUrl(source.url);
  if (!sourceUrl) throw new Error("RSS source URL is missing.");
  const xml = await fetchText(sourceUrl);
  const blocks = [...xml.matchAll(/<(?:item|entry)\b[^>]*>([\s\S]*?)<\/(?:item|entry)>/gi)].slice(0, 100).map((match) => match[1] ?? "");
  let feedHost = "";
  try { feedHost = new URL(sourceUrl).hostname.toLowerCase(); } catch { /* ignore */ }
  const sourceName = cleanText(source.name, feedHost || "rss");

  const jobs = blocks.flatMap((block): IntakeJob[] => {
    const rawLink = xmlTextTag(block, "link") || block.match(/<link[^>]+href=["']([^"']+)/i)?.[1] || "";
    const url = safeUrl(rawLink);
    const rawTitle = xmlTextTag(block, "title");
    if (!url || !rawTitle) return [];
    const descriptionHtml = xmlRawTag(block, "encoded") || xmlRawTag(block, "content") || xmlRawTag(block, "description") || xmlRawTag(block, "summary");
    const description = normalizeVacancyDescription(htmlToVacancyText(descriptionHtml));
    const dou = feedHost.endsWith("dou.ua") ? rawTitle.match(/^(.+?)\s+в\s+(.+?)(?:,\s+(.+))?$/iu) : null;
    const title = dou?.[1]?.trim() || rawTitle.replace(/\s+(?:at|@|в)\s+[^|—–]+$/iu, "").trim();
    const company = dou?.[2]?.trim() || xmlTextTag(block, "author") || xmlTextTag(block, "creator") || feedHost || "Unknown";
    const location = dou?.[3]?.trim() || xmlTextTag(block, "location") || "Unknown";
    return [{
      source: `rss:${sourceName}`,
      externalId: xmlTextTag(block, "guid") || xmlTextTag(block, "id") || url,
      title,
      company,
      location,
      remote: isRemote(`${title}\n${description}\n${location}`),
      url,
      applyUrl: url,
      description,
      salaryText: null,
      postedAt: safeIso(xmlTextTag(block, "pubDate") || xmlTextTag(block, "published") || xmlTextTag(block, "updated")),
      contactEmail: null,
      raw: { feed: sourceName },
    }];
  });

  return Promise.all(jobs.map(async (job, index) => {
    if (index >= RSS_MAX_DETAILS) return job;
    try {
      const full = detailedDescription(job.url, await fetchText(job.url));
      if (full.length > job.description.length) return { ...job, description: full, remote: job.remote || isRemote(`${job.title}\n${full}\n${job.location}`) };
    } catch { /* keep feed description */ }
    return job;
  }));
}

const WORK_CARD = /href=["'](\/[a-z]{2}\/jobs\/\d+\/)["'][^>]*>([^<]*)<\/a>\s*<\/h2>([\s\S]{0,3000}?)<p class=["']ellipsis[^"']*["'][^>]*>([\s\S]*?)<\/p>/g;
const WORK_COMPANY = /<span class=["']strong-600["']>([^<]*)<\/span>/g;
const WORK_LOCATION = /<span class=["']["']>([^<]*)<\/span>/g;

async function collectWorkUa(source: Json): Promise<IntakeJob[]> {
  const query = cleanText(source.query, "QA Engineer");
  const sourceName = cleanText(source.name, "workua-qa");
  const html = await fetchText(`https://www.work.ua/en/jobs/?search=${encodeURIComponent(query)}`);
  const jobs: IntakeJob[] = [];
  for (const match of html.matchAll(WORK_CARD)) {
    const [, relative, titleHtml, meta, teaserHtml] = match;
    const title = htmlToVacancyText(titleHtml ?? "");
    if (!relative || !title) continue;
    const companyCandidates = [...(meta ?? "").matchAll(WORK_COMPANY)].map((entry) => htmlToVacancyText(entry[1] ?? ""));
    const company = companyCandidates.find((value) => value && value !== "Company is hidden" && !/\d/.test(value)) || "Unknown";
    const locations = [...(meta ?? "").matchAll(WORK_LOCATION)].map((entry) => htmlToVacancyText(entry[1] ?? "")).filter(Boolean);
    const location = locations.at(-1)?.replace(/^,\s*|,\s*$/g, "").trim() || "Unknown";
    const url = safeUrl(`https://www.work.ua${relative}`);
    const description = normalizeVacancyDescription(htmlToVacancyText(teaserHtml ?? ""));
    jobs.push({ source: `workua:${sourceName}`, externalId: url, title, company, location, remote: isRemote(`${title}\n${description}\n${location}`), url, applyUrl: url, description, salaryText: null, postedAt: null, contactEmail: null, raw: { query } });
  }
  return Promise.all(jobs.map(async (job, index) => {
    if (index >= WORK_UA_MAX_DETAILS) return job;
    try {
      const full = detailedDescription(job.url, await fetchText(job.url));
      if (full.length > job.description.length) return { ...job, description: full, remote: job.remote || isRemote(`${job.title}\n${full}\n${job.location}`) };
    } catch { /* keep teaser */ }
    return job;
  }));
}

type RobotaDocument = Json & { id?: number | string; notebookId?: number | string; name?: string; companyName?: string; cityName?: string; date?: string; shortDescription?: string; description?: string; salary?: number | string; salaryFrom?: number | string; salaryTo?: number | string; salaryComment?: string };
type RobotaResponse = { total?: number; documents?: RobotaDocument[] };

function robotaSalary(document: RobotaDocument): string | null {
  const comment = cleanText(document.salaryComment);
  if (comment) return comment;
  const from = cleanText(document.salaryFrom); const to = cleanText(document.salaryTo);
  if (from && to) return `${from}–${to}`;
  if (from) return `from ${from}`;
  if (to) return `up to ${to}`;
  const salary = cleanText(document.salary);
  return salary && salary !== "0" ? salary : null;
}

async function collectRobotaUa(source: Json): Promise<IntakeJob[]> {
  const query = cleanText(source.query, "QA Engineer");
  const sourceName = cleanText(source.name, "robotaua-qa");
  const jobs: IntakeJob[] = [];
  let total = Number.POSITIVE_INFINITY;
  for (let page = 0; page < 3 && jobs.length < total; page += 1) {
    const payload = await fetchJson<RobotaResponse>(`https://api.rabota.ua/vacancy/search?keyWords=${encodeURIComponent(query)}&count=50&page=${page}`);
    const documents = Array.isArray(payload.documents) ? payload.documents : [];
    for (const document of documents) {
      const id = cleanText(document.id); const notebookId = cleanText(document.notebookId); const title = cleanText(document.name);
      if (!id || !notebookId || !title) continue;
      const url = `https://robota.ua/company${encodeURIComponent(notebookId)}/vacancy${encodeURIComponent(id)}`;
      const company = cleanText(document.companyName, "Unknown"); const location = cleanText(document.cityName, "Unknown");
      const description = normalizeVacancyDescription(cleanText(document.description) || cleanText(document.shortDescription));
      jobs.push({ source: `robotaua:${sourceName}`, externalId: id, title, company, location, remote: isRemote(`${title}\n${description}\n${location}`), url, applyUrl: url, description, salaryText: robotaSalary(document), postedAt: safeIso(document.date), contactEmail: null, raw: document });
    }
    total = typeof payload.total === "number" ? payload.total : jobs.length;
    if (!documents.length) break;
  }
  return Promise.all(jobs.map(async (job, index) => {
    if (index >= ROBOTA_UA_MAX_DETAILS) return job;
    try {
      const full = detailedDescription(job.url, await fetchText(job.url));
      if (full.length > job.description.length) return { ...job, description: full, remote: job.remote || isRemote(`${job.title}\n${full}\n${job.location}`) };
    } catch { /* keep API description */ }
    return job;
  }));
}

async function collectLobbyX(source: Json): Promise<IntakeJob[]> {
  const query = cleanText(source.query, "QA Engineer"); const sourceName = cleanText(source.name, "lobbyx-qa");
  const items = await fetchJson<Json[]>(`https://thelobbyx.com/wp-json/wp/v2/tors?search=${encodeURIComponent(query)}&tors-status=84&per_page=50`);
  const listings = items.slice(0, LOBBY_X_MAX_DETAILS).flatMap((item): Array<{ id: string; title: string; url: string; postedAt: string | null }> => {
    const titleObject = item.title && typeof item.title === "object" ? item.title as Json : {};
    const title = htmlToVacancyText(cleanText(titleObject.rendered)); const url = safeUrl(item.link); const id = cleanText(item.id);
    return title && url && id ? [{ id, title, url, postedAt: safeIso(item.date) }] : [];
  });
  return Promise.all(listings.map(async (listing): Promise<IntakeJob> => {
    let description = "";
    try { description = detailedDescription(listing.url, await fetchText(listing.url)); } catch { /* empty description */ }
    const company = /(?:^|\n)([A-ZА-ЯЁІЇЄ][\p{L}0-9«»'".,-]*(?:\s[A-ZА-ЯЁІЇЄ«][\p{L}0-9«»'".,-]*){0,4})\s*[—-]\s/u.exec(description.slice(0, 400))?.[1]?.trim() || "Unknown";
    return { source: `lobbyx:${sourceName}`, externalId: listing.id, title: listing.title, company, location: "Ukraine", remote: isRemote(`${listing.title}\n${description}`), url: listing.url, applyUrl: listing.url, description, salaryText: null, postedAt: listing.postedAt, contactEmail: null, raw: listing };
  }));
}

async function collectGreenhouse(source: Json): Promise<IntakeJob[]> {
  const board = cleanText(source.board); const company = cleanText(source.name, board);
  const payload = await fetchJson<{ jobs?: Json[] }>(`https://boards-api.greenhouse.io/v1/boards/${encodeURIComponent(board)}/jobs?content=true`);
  return (payload.jobs ?? []).slice(0, 100).map((job) => {
    const locationObject = job.location && typeof job.location === "object" ? job.location as Json : {};
    const location = cleanText(locationObject.name, "Unknown"); const description = normalizeVacancyDescription(htmlToVacancyText(cleanText(job.content))); const url = safeUrl(job.absolute_url);
    return { source: `greenhouse:${company}`, externalId: cleanText(job.id) || url, title: cleanText(job.title, "Untitled role"), company, location, remote: isRemote(`${location}\n${description}`), url, applyUrl: url, description, salaryText: null, postedAt: safeIso(job.updated_at), contactEmail: null, raw: job };
  });
}

async function collectLever(source: Json): Promise<IntakeJob[]> {
  const board = cleanText(source.board); const company = cleanText(source.name, board);
  const payload = await fetchJson<Json[]>(`https://api.lever.co/v0/postings/${encodeURIComponent(board)}?mode=json`);
  return payload.slice(0, 100).map((job) => {
    const categories = job.categories && typeof job.categories === "object" ? job.categories as Json : {};
    const location = cleanText(categories.location, "Unknown"); const description = normalizeVacancyDescription(cleanText(job.descriptionPlain) || htmlToVacancyText(cleanText(job.description))); const url = safeUrl(job.hostedUrl); const applyUrl = safeUrl(job.applyUrl, url);
    return { source: `lever:${company}`, externalId: cleanText(job.id) || url, title: cleanText(job.text, "Untitled role"), company, location, remote: cleanText(job.workplaceType).toLowerCase() === "remote" || isRemote(`${location}\n${description}`), url, applyUrl, description, salaryText: cleanText(job.salaryRange) || null, postedAt: safeIso(job.createdAt), contactEmail: null, raw: job };
  });
}

async function collectAshby(source: Json): Promise<IntakeJob[]> {
  const board = cleanText(source.board); const company = cleanText(source.name, board);
  const payload = await fetchJson<{ jobs?: Json[] }>(`https://api.ashbyhq.com/posting-api/job-board/${encodeURIComponent(board)}?includeCompensation=true`);
  return (payload.jobs ?? []).slice(0, 100).map((job) => {
    const secondary = Array.isArray(job.secondaryLocations) ? (job.secondaryLocations as unknown[]).map((entry) => cleanText((entry as Json)?.location)).filter(Boolean) : [];
    const location = [cleanText(job.location), ...secondary].filter(Boolean).join(", ") || "Unknown"; const description = normalizeVacancyDescription(cleanText(job.descriptionPlain) || htmlToVacancyText(cleanText(job.descriptionHtml))); const url = safeUrl(job.jobUrl); const applyUrl = safeUrl(job.applyUrl, url);
    return { source: `ashby:${company}`, externalId: cleanText(job.id) || url, title: cleanText(job.title, "Untitled role"), company, location, remote: Boolean(job.isRemote) || isRemote(`${location}\n${description}`), url, applyUrl, description, salaryText: cleanText(job.compensation) || null, postedAt: safeIso(job.publishedAt), contactEmail: null, raw: job };
  });
}

function normalizedJob(value: IntakeJob): IntakeJob {
  return {
    ...value,
    source: cleanText(value.source, "job-board"),
    externalId: value.externalId ? cleanText(value.externalId) : null,
    title: cleanText(value.title, "Untitled role"),
    company: cleanText(value.company, "Unknown"),
    location: cleanText(value.location, "Unknown"),
    url: safeUrl(value.url),
    applyUrl: safeUrl(value.applyUrl, safeUrl(value.url)),
    description: normalizeVacancyDescription(value.description),
    salaryText: value.salaryText ? cleanText(value.salaryText) : null,
    postedAt: safeIso(value.postedAt),
    contactEmail: value.contactEmail ? cleanText(value.contactEmail) : null,
  };
}

function mapExisting(row: Row): IntakeJob & { id: string; fingerprint: string; status?: string; feedback?: string | null } {
  return {
    id: String(row.id), fingerprint: String(row.fingerprint), source: String(row.source), externalId: row.external_id ? String(row.external_id) : null,
    title: String(row.title), company: String(row.company), location: String(row.location), remote: Number(row.remote) === 1,
    url: String(row.url), applyUrl: String(row.apply_url), description: String(row.description), salaryText: row.salary_text ? String(row.salary_text) : null,
    postedAt: row.posted_at ? String(row.posted_at) : null, contactEmail: row.contact_email ? String(row.contact_email) : null,
    raw: parseJson(row.raw_json, {}), status: row.status ? String(row.status) : undefined, feedback: row.feedback ? String(row.feedback) : null,
  };
}

function stableId(value: string): string {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) { hash ^= value.charCodeAt(index); hash = Math.imul(hash, 16777619); }
  return (hash >>> 0).toString(16).padStart(8, "0");
}

function normalizeKey(value: string): string {
  return value.toLowerCase().normalize("NFKD").replace(/[^a-z0-9а-яіїєґ+#.]+/gi, " ").replace(/\s+/g, " ").trim();
}

export async function upsertVacancies(values: IntakeJob[]): Promise<Omit<VacancySyncResult, "errors">> {
  const normalized = values.map(normalizedJob).filter((job) => job.title && job.company && job.url);
  const relevance = filterRelevantVacancies(normalized);
  const incoming = deduplicateVacancies(relevance.jobs);
  const db = await database();
  const existingResult = await db.prepare("SELECT * FROM jobs ORDER BY updated_at DESC LIMIT 1000").all<Row>();
  const existing = existingResult.results.map(mapExisting);
  let inserted = 0; let updated = 0; const timestamp = new Date().toISOString();

  for (const job of incoming.jobs) {
    const duplicate = existing.find((candidate) => areDuplicateVacancies(candidate, job));
    if (duplicate) {
      const merged = mergeDuplicateVacancies(duplicate, job);
      await db.prepare(`UPDATE jobs SET source = ?, external_id = COALESCE(?, external_id), title = ?, company = ?, location = ?, remote = ?, url = ?, apply_url = ?, description = ?, salary_text = COALESCE(?, salary_text), posted_at = COALESCE(?, posted_at), contact_email = COALESCE(?, contact_email), updated_at = ?, raw_json = ? WHERE id = ?`)
        .bind(merged.source, merged.externalId, merged.title, merged.company, merged.location, merged.remote ? 1 : 0, merged.url, merged.applyUrl, merged.description, merged.salaryText, merged.postedAt, merged.contactEmail, timestamp, JSON.stringify(merged.raw ?? {}), duplicate.id).run();
      Object.assign(duplicate, merged);
      updated += 1;
      continue;
    }

    const fingerprint = stableId(normalizeKey(`${job.source}|${job.externalId || job.url}`));
    const id = `job_${fingerprint}`;
    await db.prepare(`INSERT INTO jobs (id, fingerprint, source, external_id, title, company, location, remote, url, apply_url, description, salary_text, posted_at, contact_email, discovered_at, updated_at, status, raw_json)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'NEW', ?)
      ON CONFLICT(fingerprint) DO UPDATE SET source = excluded.source, external_id = COALESCE(excluded.external_id, jobs.external_id), title = excluded.title, company = excluded.company, location = excluded.location, remote = MAX(jobs.remote, excluded.remote), url = excluded.url, apply_url = excluded.apply_url, description = CASE WHEN length(excluded.description) > length(jobs.description) THEN excluded.description ELSE jobs.description END, salary_text = COALESCE(excluded.salary_text, jobs.salary_text), posted_at = COALESCE(excluded.posted_at, jobs.posted_at), contact_email = COALESCE(excluded.contact_email, jobs.contact_email), updated_at = excluded.updated_at, raw_json = excluded.raw_json`)
      .bind(id, fingerprint, job.source, job.externalId, job.title, job.company, job.location, job.remote ? 1 : 0, job.url, job.applyUrl, job.description, job.salaryText, job.postedAt, job.contactEmail, timestamp, timestamp, JSON.stringify(job.raw ?? {})).run();
    existing.push({ ...job, id, fingerprint });
    inserted += 1;
  }

  return { seen: normalized.length, relevant: relevance.jobs.length, rejected: relevance.rejected.length, duplicates: incoming.duplicateCount, inserted, updated, accepted: inserted + updated };
}

export async function syncVacancySources(): Promise<VacancySyncResult> {
  const config = await sourceConfig();
  const jobs: IntakeJob[] = []; const errors: VacancySourceError[] = [];
  const run = async (label: string, collector: () => Promise<IntakeJob[]>) => {
    try { jobs.push(...await collector()); } catch (error) { errors.push({ source: label, error: error instanceof Error ? error.message : String(error) }); }
  };
  for (const source of sourceArray(config, "rss", DEFAULT_VACANCY_SOURCES.rss)) await run(`rss:${cleanText(source.name, "rss")}`, () => collectRss(source));
  for (const source of sourceArray(config, "greenhouse", [])) await run(`greenhouse:${cleanText(source.name, "greenhouse")}`, () => collectGreenhouse(source));
  for (const source of sourceArray(config, "lever", [])) await run(`lever:${cleanText(source.name, "lever")}`, () => collectLever(source));
  for (const source of sourceArray(config, "ashby", [])) await run(`ashby:${cleanText(source.name, "ashby")}`, () => collectAshby(source));
  for (const source of sourceArray(config, "workUa", DEFAULT_VACANCY_SOURCES.workUa)) await run(`workua:${cleanText(source.name, "workua")}`, () => collectWorkUa(source));
  for (const source of sourceArray(config, "robotaUa", DEFAULT_VACANCY_SOURCES.robotaUa)) await run(`robotaua:${cleanText(source.name, "robotaua")}`, () => collectRobotaUa(source));
  for (const source of sourceArray(config, "lobbyX", DEFAULT_VACANCY_SOURCES.lobbyX)) await run(`lobbyx:${cleanText(source.name, "lobbyx")}`, () => collectLobbyX(source));
  return { ...(await upsertVacancies(jobs)), errors };
}

function displaySource(source: string): string {
  const labels: string[] = [];
  const value = source.toLowerCase();
  if (value.includes("dou")) labels.push("DOU");
  if (value.includes("djinni")) labels.push("Djinni");
  if (value.includes("workua") || value.includes("work.ua")) labels.push("Work.ua");
  if (value.includes("robotaua") || value.includes("robota.ua") || value.includes("rabota")) labels.push("Robota.ua");
  if (value.includes("lobby")) labels.push("Lobby X");
  if (value.includes("greenhouse")) labels.push("Greenhouse");
  if (value.includes("lever")) labels.push("Lever");
  if (value.includes("ashby")) labels.push("Ashby");
  return labels.length ? [...new Set(labels)].join(" + ") : source.replace(/^\w+:/, "") || "Job board";
}

function sanitizeJobs<T extends IntakeJob>(jobs: T[]): T[] {
  const normalized = jobs.map((job) => ({ ...job, description: normalizeVacancyDescription(job.description) }));
  const relevant = filterRelevantVacancies(normalized).jobs;
  return deduplicateVacancies(relevant).jobs.map((job) => ({ ...job, source: displaySource(job.source) }));
}

export function sanitizeDashboardPayload<T extends { jobs?: unknown }>(payload: T): T {
  if (!Array.isArray(payload.jobs)) return payload;
  return { ...payload, jobs: sanitizeJobs(payload.jobs as IntakeJob[]) } as T;
}

export async function publicVacancies(): Promise<{ jobs: Array<IntakeJob & { id: string; discoveredAt: string }>; generatedAt: string }> {
  const result = await (await database()).prepare(`SELECT id, source, external_id, title, company, location, remote, url, apply_url, description, salary_text, posted_at, contact_email, discovered_at, raw_json FROM jobs ORDER BY COALESCE(posted_at, discovered_at) DESC, discovered_at DESC LIMIT 500`).all<Row>();
  const jobs = result.results.map((row) => ({ ...mapExisting(row), id: String(row.id), discoveredAt: String(row.discovered_at) }));
  return { jobs: sanitizeJobs(jobs), generatedAt: new Date().toISOString() };
}

export async function ensureVacancyCatalog(): Promise<void> {
  const row = await (await database()).prepare("SELECT COUNT(*) AS count FROM jobs").first<Row>();
  if (Number(row?.count ?? 0) > 0) return;
  await syncVacancySources();
}

export function mergeVacancySourceDefaults(value: unknown): Json {
  const settings = value && typeof value === "object" ? value as Json : {};
  const sources = settings.sources && typeof settings.sources === "object" ? settings.sources as Json : {};
  return {
    ...settings,
    sources: {
      ...sources,
      robotaUa: sourceArray(sources, "robotaUa", DEFAULT_VACANCY_SOURCES.robotaUa),
    },
  };
}
