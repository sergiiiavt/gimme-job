type Json = Record<string, unknown>;
type Row = Record<string, unknown>;

const DEFAULT_PROFILE = {
  name: "Your Name",
  headline: "QA Lead / Team Lead Test Engineer",
  summary: "QA professional with software testing, automation, and leadership experience.",
  targetRoles: ["QA Lead", "Team Lead Test Engineer", "Test Automation Lead", "Senior QA Engineer"],
  locations: ["Kyiv", "Remote", "Ukraine"],
  languages: ["English", "Ukrainian"],
  skills: ["QA leadership", "Manual testing", "Test automation", "Python", "TypeScript", "Playwright", "Selenium", "Pytest", "API testing", "SQL", "Azure DevOps", "Scrum", "Mentoring"],
  mustHaveSignals: ["remote", "Kyiv", "Ukraine"],
  preferredSignals: ["бронювання", "reservation from mobilization", "flexible", "part-time", "leadership", "automation"],
  excludedSignals: [],
  facts: ["Add verified professional facts in Connections before approving an application."],
  experience: [],
  education: [],
  links: [],
  contact: { email: "", phone: "", location: "Ukraine" },
};

const DEFAULT_SOURCES = {
  rss: [{ name: "dou-qa", url: "https://jobs.dou.ua/vacancies/feeds/?search=QA" }],
  greenhouse: [],
  lever: [],
  ashby: [],
  gmail: { enabled: false, query: "label:JobAlerts newer_than:14d", maxResults: 100, allowedSendDomains: [] },
  manualFiles: [],
};

const SKILLS: Array<[string, RegExp]> = [
  ["Playwright", /\bplaywright\b/i], ["Cypress", /\bcypress\b/i], ["Selenium", /\bselenium\b/i],
  ["Pytest", /\bpytest\b/i], ["Python", /\bpython\b/i], ["TypeScript", /\btypescript\b/i],
  ["JavaScript", /\bjavascript\b/i], ["Java", /\bjava\b/i], ["API testing", /\b(api|rest|soap|postman|swagger)\b/i],
  ["SQL", /\b(sql|database|db testing)\b/i], ["CI/CD", /\b(ci\/?cd|jenkins|github actions|gitlab ci|azure pipelines)\b/i],
  ["Azure DevOps", /\b(azure devops|ado)\b/i], ["AWS", /\baws\b/i], ["Azure", /\bazure\b/i],
  ["Docker", /\bdocker\b/i], ["Kubernetes", /\b(kubernetes|k8s)\b/i],
  ["Performance testing", /\b(performance|load testing|jmeter|k6)\b/i],
  ["Security testing", /\b(security testing|owasp|penetration)\b/i],
  ["Mobile testing", /\b(mobile|android|ios|appium)\b/i], ["Test strategy", /\b(test strategy|quality strategy|test plan)\b/i],
  ["QA leadership", /\b(qa lead|test lead|team lead|leadership|people management)\b/i],
  ["Mentoring", /\b(mentor|mentoring|coaching)\b/i], ["Agile/Scrum", /\b(agile|scrum|kanban)\b/i],
  ["AI/LLM testing", /\b(ai|llm|machine learning|generative ai)\b/i],
  ["Resilience testing", /\b(resilience|chaos engineering|fault injection)\b/i],
  ["IEC 62304", /\biec\s*62304\b/i], ["IEC 60601", /\biec\s*60601\b/i], ["English", /\benglish\b/i],
];

async function runtimeEnv() {
  return (await import("cloudflare:workers")).env;
}

async function db() {
  const runtime = await runtimeEnv();
  if (!runtime.DB) throw new Error("Cloud database is not available.");
  return runtime.DB;
}

function parse<T>(value: unknown, fallback: T): T {
  try { return JSON.parse(String(value)) as T; } catch { return fallback; }
}

function now() { return new Date().toISOString(); }

function normalize(value: string) {
  return value.toLowerCase().normalize("NFKD").replace(/[^a-z0-9а-яіїєґ+#.]+/gi, " ").trim();
}

function stableId(value: string) {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(16).padStart(8, "0");
}

function cleanText(value: unknown, fallback = "") {
  return typeof value === "string" ? value.trim().slice(0, 60_000) : fallback;
}

function safeUrl(value: unknown, fallback = "https://example.com") {
  try {
    const url = new URL(cleanText(value, fallback));
    return ["http:", "https:"].includes(url.protocol) ? url.toString() : fallback;
  } catch { return fallback; }
}

function assertPublicHttps(value: string) {
  const url = new URL(value);
  const host = url.hostname.toLowerCase();
  if (url.protocol !== "https:" || host === "localhost" || host.endsWith(".local") || /^(10\.|127\.|169\.254\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.)/.test(host)) {
    throw new Error("Only public HTTPS source URLs are allowed.");
  }
  return url;
}

async function setting<T>(key: string, fallback: T): Promise<T> {
  const row = await (await db()).prepare("SELECT value_json FROM settings WHERE key = ?").bind(key).first<Row>();
  return row ? parse(row.value_json, fallback) : fallback;
}

async function saveSetting(key: string, value: unknown) {
  await (await db()).prepare(`INSERT INTO settings (key, value_json, updated_at) VALUES (?, ?, ?)
    ON CONFLICT(key) DO UPDATE SET value_json = excluded.value_json, updated_at = excluded.updated_at`)
    .bind(key, JSON.stringify(value), now()).run();
}

function mapJob(row: Row) {
  return {
    id: String(row.id), fingerprint: String(row.fingerprint), source: String(row.source),
    externalId: row.external_id ? String(row.external_id) : null, title: String(row.title), company: String(row.company),
    location: String(row.location), remote: Number(row.remote) === 1, url: String(row.url), applyUrl: String(row.apply_url),
    description: String(row.description), salaryText: row.salary_text ? String(row.salary_text) : null,
    postedAt: row.posted_at ? String(row.posted_at) : null, contactEmail: row.contact_email ? String(row.contact_email) : null,
    discoveredAt: String(row.discovered_at), updatedAt: String(row.updated_at), status: String(row.status),
    raw: parse(row.raw_json, {}),
  };
}

function mapDraft(row: Row) {
  return {
    id: String(row.id), jobId: String(row.job_id), recipient: row.recipient ? String(row.recipient) : null,
    subject: String(row.subject), body: String(row.body), status: String(row.status),
    approvedAt: row.approved_at ? String(row.approved_at) : null, sentAt: row.sent_at ? String(row.sent_at) : null,
    providerMessageId: row.provider_message_id ? String(row.provider_message_id) : null,
    createdAt: String(row.created_at), updatedAt: String(row.updated_at),
  };
}

async function connections() {
  const sources = await setting<Json>("sources", DEFAULT_SOURCES);
  const runtime = await runtimeEnv() as unknown as Record<string, unknown>;
  const gmail = (sources.gmail ?? DEFAULT_SOURCES.gmail) as Json;
  return {
    gmail: { configured: Boolean(runtime.GOOGLE_CLIENT_ID), connected: false, enabled: Boolean(gmail.enabled) },
    openai: { connected: false, model: String(runtime.OPENAI_MODEL ?? "deterministic") },
    boards: {
      rss: Array.isArray(sources.rss) ? sources.rss.length : 0,
      greenhouse: Array.isArray(sources.greenhouse) ? sources.greenhouse.length : 0,
      lever: Array.isArray(sources.lever) ? sources.lever.length : 0,
      ashby: Array.isArray(sources.ashby) ? sources.ashby.length : 0,
    },
  };
}

export async function settingsView() {
  return {
    profile: await setting("profile", DEFAULT_PROFILE),
    sources: await setting("sources", DEFAULT_SOURCES),
    connections: await connections(),
  };
}

function countBy(values: string[]) {
  const counts = new Map<string, number>();
  for (const value of values.filter(Boolean)) counts.set(value, (counts.get(value) ?? 0) + 1);
  return [...counts].map(([name, count]) => ({ name, count })).sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));
}

export async function dashboard() {
  const [jobResult, analysisResult, resumeResult, draftResult, conn] = await Promise.all([
    (await db()).prepare("SELECT * FROM jobs ORDER BY discovered_at DESC LIMIT 500").all<Row>(),
    (await db()).prepare("SELECT * FROM analyses").all<Row>(),
    (await db()).prepare("SELECT * FROM resume_variants").all<Row>(),
    (await db()).prepare("SELECT * FROM application_drafts").all<Row>(),
    connections(),
  ]);
  const analyses = new Map(analysisResult.results.map((row) => [String(row.job_id), parse<Json>(row.payload_json, {})]));
  const resumes = new Map(resumeResult.results.map((row) => [String(row.job_id), String(row.markdown)]));
  const drafts = new Map(draftResult.results.map((row) => [String(row.job_id), mapDraft(row)]));
  const jobs = jobResult.results.map(mapJob).map((job) => ({ ...job, analysis: analyses.get(job.id) ?? null, resume: resumes.get(job.id) ?? null, draft: drafts.get(job.id) ?? null }));
  const analyzed = jobs.filter((job) => job.analysis);
  const requirements = analyzed.flatMap((job) => Array.isArray(job.analysis?.requirementKeywords) ? job.analysis.requirementKeywords.map(String) : []);
  const gaps = analyzed.flatMap((job) => Array.isArray(job.analysis?.missingSkills) ? job.analysis.missingSkills.map(String) : []);
  const verdicts = analyzed.reduce<Record<string, number>>((acc, job) => {
    const verdict = String(job.analysis?.verdict ?? "weak"); acc[verdict] = (acc[verdict] ?? 0) + 1; return acc;
  }, { strong: 0, possible: 0, weak: 0, reject: 0 });
  const statuses = draftResult.results.reduce<Record<string, number>>((acc, row) => {
    const status = String(row.status); acc[status] = (acc[status] ?? 0) + 1; return acc;
  }, {});
  const percent = (count: number) => jobs.length ? Math.round(count / jobs.length * 100) : 0;
  return {
    jobs,
    market: {
      totalJobs: jobs.length, analyzedJobs: analyzed.length,
      remoteShare: percent(jobs.filter((job) => job.remote).length),
      salaryDisclosureShare: percent(jobs.filter((job) => job.salaryText).length),
      reservationMentions: jobs.filter((job) => /бронювання|reservation from mobilization/i.test(`${job.title} ${job.description}`)).length,
      topSources: countBy(jobs.map((job) => job.source)), topRoles: countBy(jobs.map((job) => job.title)),
      topLocations: countBy(jobs.map((job) => job.location)), topRequirements: countBy(requirements), topCandidateGaps: countBy(gaps), verdicts,
    },
    statuses, connections: conn, generatedAt: now(),
  };
}

function normalizeJob(value: unknown, index: number) {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error(`Job ${index + 1} must be an object.`);
  const job = value as Json;
  const title = cleanText(job.title); const company = cleanText(job.company);
  if (!title || !company) throw new Error(`Job ${index + 1} requires title and company.`);
  const url = safeUrl(job.url);
  const fingerprint = stableId(normalize(`${company}|${title}|${url}`));
  return {
    id: `job_${fingerprint}`, fingerprint, source: cleanText(job.source, "manual:web"), externalId: cleanText(job.externalId) || null,
    title, company, location: cleanText(job.location, "Unknown"), remote: Boolean(job.remote) || /remote|віддал/i.test(cleanText(job.location)),
    url, applyUrl: safeUrl(job.applyUrl, url), description: cleanText(job.description), salaryText: cleanText(job.salaryText) || null,
    postedAt: cleanText(job.postedAt) || null, contactEmail: cleanText(job.contactEmail) || null, rawJson: JSON.stringify(job).slice(0, 100_000),
  };
}

export async function upsertJobs(values: unknown[]) {
  if (values.length > 500) throw new Error("Import is limited to 500 jobs at a time.");
  const timestamp = now(); let accepted = 0;
  for (const [index, value] of values.entries()) {
    const job = normalizeJob(value, index);
    await (await db()).prepare(`INSERT INTO jobs (
      id, fingerprint, source, external_id, title, company, location, remote, url, apply_url, description,
      salary_text, posted_at, contact_email, discovered_at, updated_at, status, raw_json
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'NEW', ?)
    ON CONFLICT(fingerprint) DO UPDATE SET source=excluded.source, title=excluded.title, company=excluded.company,
      location=excluded.location, remote=excluded.remote, url=excluded.url, apply_url=excluded.apply_url,
      description=CASE WHEN length(excluded.description) > length(jobs.description) THEN excluded.description ELSE jobs.description END,
      salary_text=COALESCE(excluded.salary_text, jobs.salary_text), posted_at=COALESCE(excluded.posted_at, jobs.posted_at),
      contact_email=COALESCE(excluded.contact_email, jobs.contact_email), updated_at=excluded.updated_at, raw_json=excluded.raw_json`)
      .bind(job.id, job.fingerprint, job.source, job.externalId, job.title, job.company, job.location, job.remote ? 1 : 0,
        job.url, job.applyUrl, job.description, job.salaryText, job.postedAt, job.contactEmail, timestamp, timestamp, job.rawJson).run();
    accepted += 1;
  }
  return { seen: values.length, accepted };
}

function decodeEntities(value: string) {
  return value.replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1").replace(/<[^>]+>/g, " ")
    .replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, "\"").replace(/&#39;/g, "'")
    .replace(/\s+/g, " ").trim();
}

function tag(block: string, name: string) {
  return decodeEntities(block.match(new RegExp(`<${name}[^>]*>([\\s\\S]*?)<\\/${name}>`, "i"))?.[1] ?? "");
}

async function collectRss(source: Json) {
  const sourceUrl = assertPublicHttps(cleanText(source.url));
  const response = await fetch(sourceUrl, { headers: { "user-agent": "JobPilot/1.0" }, signal: AbortSignal.timeout(15_000) });
  if (!response.ok) throw new Error(`${cleanText(source.name, "RSS")}: HTTP ${response.status}`);
  const xml = await response.text();
  const blocks = [...xml.matchAll(/<(item|entry)\b[^>]*>([\s\S]*?)<\/\1>/gi)].slice(0, 100).map((match) => match[2]);
  return blocks.map((block) => {
    const rawLink = tag(block, "link") || block.match(/<link[^>]+href=["']([^"']+)/i)?.[1] || sourceUrl.toString();
    const title = tag(block, "title") || "Untitled role";
    return { source: `rss:${cleanText(source.name, sourceUrl.hostname)}`, externalId: tag(block, "guid") || null, title,
      company: tag(block, "author") || tag(block, "dc:creator") || "Unknown", location: "Unknown", remote: /remote|віддал/i.test(title),
      url: rawLink, applyUrl: rawLink, description: tag(block, "description") || tag(block, "summary") || tag(block, "content"),
      salaryText: null, postedAt: tag(block, "pubDate") || tag(block, "published") || null, contactEmail: null };
  });
}

async function collectGreenhouse(source: Json) {
  const board = encodeURIComponent(cleanText(source.board));
  const response = await fetch(`https://boards-api.greenhouse.io/v1/boards/${board}/jobs?content=true`, { signal: AbortSignal.timeout(15_000) });
  if (!response.ok) throw new Error(`${cleanText(source.name, "Greenhouse")}: HTTP ${response.status}`);
  const payload = await response.json() as { jobs?: Json[] };
  return (payload.jobs ?? []).slice(0, 100).map((job) => ({ source: `greenhouse:${cleanText(source.name, board)}`, externalId: String(job.id ?? ""),
    title: cleanText(job.title, "Untitled role"), company: cleanText(source.name, board), location: cleanText((job.location as Json | undefined)?.name, "Unknown"),
    remote: /remote/i.test(JSON.stringify(job.location ?? "")), url: cleanText(job.absolute_url), applyUrl: cleanText(job.absolute_url),
    description: decodeEntities(cleanText(job.content)), salaryText: null, postedAt: cleanText(job.updated_at) || null, contactEmail: null }));
}

async function collectLever(source: Json) {
  const board = encodeURIComponent(cleanText(source.board));
  const response = await fetch(`https://api.lever.co/v0/postings/${board}?mode=json`, { signal: AbortSignal.timeout(15_000) });
  if (!response.ok) throw new Error(`${cleanText(source.name, "Lever")}: HTTP ${response.status}`);
  const payload = await response.json() as Json[];
  return payload.slice(0, 100).map((job) => ({ source: `lever:${cleanText(source.name, board)}`, externalId: cleanText(job.id) || null,
    title: cleanText(job.text, "Untitled role"), company: cleanText(source.name, board), location: cleanText((job.categories as Json | undefined)?.location, "Unknown"),
    remote: /remote/i.test(JSON.stringify(job.categories ?? "")), url: cleanText(job.hostedUrl), applyUrl: cleanText(job.applyUrl, cleanText(job.hostedUrl)),
    description: decodeEntities(cleanText(job.descriptionPlain, cleanText(job.description))), salaryText: null, postedAt: null, contactEmail: null }));
}

export async function syncSources() {
  const sources = await setting<Json>("sources", DEFAULT_SOURCES); const jobs: unknown[] = []; const errors: Array<{ source: string; error: string }> = [];
  for (const source of Array.isArray(sources.rss) ? sources.rss as Json[] : []) {
    try { jobs.push(...await collectRss(source)); } catch (error) { errors.push({ source: cleanText(source.name, "rss"), error: error instanceof Error ? error.message : String(error) }); }
  }
  for (const source of Array.isArray(sources.greenhouse) ? sources.greenhouse as Json[] : []) {
    try { jobs.push(...await collectGreenhouse(source)); } catch (error) { errors.push({ source: cleanText(source.name, "greenhouse"), error: error instanceof Error ? error.message : String(error) }); }
  }
  for (const source of Array.isArray(sources.lever) ? sources.lever as Json[] : []) {
    try { jobs.push(...await collectLever(source)); } catch (error) { errors.push({ source: cleanText(source.name, "lever"), error: error instanceof Error ? error.message : String(error) }); }
  }
  const result = await upsertJobs(jobs.slice(0, 500));
  return { ...result, errors };
}

function profileHas(profile: Json, skill: string) {
  const wanted = normalize(skill); return (Array.isArray(profile.skills) ? profile.skills : []).some((item) => {
    const candidate = normalize(String(item)); return candidate.includes(wanted) || wanted.includes(candidate);
  });
}

function roleSimilarity(title: string, target: string) {
  const a = new Set(normalize(title).split(" ").filter((token) => token.length > 1));
  const b = new Set(normalize(target).split(" ").filter((token) => token.length > 1));
  return a.size && b.size ? [...a].filter((token) => b.has(token)).length / Math.max(a.size, b.size) : 0;
}

function analyze(job: ReturnType<typeof mapJob>, profile: Json) {
  const text = `${job.title}\n${job.company}\n${job.location}\n${job.description}`;
  const requirements = SKILLS.filter(([, pattern]) => pattern.test(text)).map(([name]) => name);
  const matchingSkills = requirements.filter((skill) => profileHas(profile, skill));
  const missingSkills = requirements.filter((skill) => !profileHas(profile, skill));
  const targetRoles = Array.isArray(profile.targetRoles) ? profile.targetRoles.map(String) : [];
  const bestRole = Math.max(...targetRoles.map((target) => roleSimilarity(job.title, target)), 0);
  const locations = Array.isArray(profile.locations) ? profile.locations.map(String) : [];
  const locationFit = locations.some((location) => normalize(`${job.location} ${job.remote ? "remote" : ""}`).includes(normalize(location)));
  const excluded = (Array.isArray(profile.excludedSignals) ? profile.excludedSignals.map(String) : []).filter((signal) => normalize(text).includes(normalize(signal)));
  const score = Math.max(0, Math.min(100, 15 + Math.round(bestRole * 30) + Math.min(35, matchingSkills.length * 6) + (locationFit ? 10 : 0) - Math.min(30, missingSkills.length * 3) - (excluded.length ? 60 : 0)));
  const verdict = score >= 75 ? "strong" : score >= 55 ? "possible" : score >= 35 ? "weak" : "reject";
  const name = cleanText(profile.name, "Your Name"); const headline = cleanText(profile.headline, "QA professional");
  const summary = cleanText(profile.summary); const facts = Array.isArray(profile.facts) ? profile.facts.map(String) : [];
  const skills = Array.isArray(profile.skills) ? profile.skills.map(String) : [];
  const experience = Array.isArray(profile.experience) ? profile.experience as Json[] : [];
  const resume = `# ${name}\n${headline}\n\n## Summary\n${summary}\n\n## Relevant skills\n${[...matchingSkills, ...skills.filter((item) => !matchingSkills.includes(item))].map((item) => `- ${item}`).join("\n")}\n\n## Experience\n${experience.length ? experience.map((entry) => `### ${cleanText(entry.role)} — ${cleanText(entry.company)}\n${cleanText(entry.period)}\n${(Array.isArray(entry.achievements) ? entry.achievements : []).map((item) => `- ${String(item)}`).join("\n")}`).join("\n\n") : "Add verified experience in Connections before applying."}`;
  const analysis = {
    score, verdict, roleFit: bestRole >= .5 ? "Title aligns with a target role." : "Title alignment is partial.", matchingSkills, missingSkills,
    hardBlockers: excluded.map((signal) => `Excluded signal found: ${signal}`),
    evidence: [`${matchingSkills.length} detected requirements match the profile.`, locationFit ? "Location/remote preference matches." : "Location preference was not confirmed."],
    requirements, requirementKeywords: requirements,
    marketSignals: {
      seniority: /\b(head|director|principal)\b/i.test(text) ? "Head/Principal" : /\b(lead|manager)\b/i.test(text) ? "Lead/Manager" : /\bsenior\b/i.test(text) ? "Senior" : "Not specified",
      employmentType: /part[- ]?time/i.test(text) ? "Part-time" : /contract|b2b/i.test(text) ? "Contract/B2B" : /full[- ]?time/i.test(text) ? "Full-time" : "Not specified",
      remotePolicy: job.remote ? "Remote mentioned" : "Remote not confirmed", salary: job.salaryText ?? "Not disclosed",
      reservation: /бронювання|reservation from mobilization/i.test(text) ? "Mentioned" : "Not mentioned", language: /english/i.test(text) ? "English mentioned" : "Not specified",
    },
    recommendation: excluded.length ? "Do not apply unless the blocker is resolved." : score >= 55 ? "Review the tailored resume and approve only if every fact is accurate." : "Keep for market intelligence and review the gaps.",
  };
  const recipient = job.contactEmail; const firstFact = facts[0] ?? summary;
  const draft = { recipient, subject: `Application — ${job.title}`, body: `Hello,\n\nI am applying for the ${job.title} role at ${job.company}. ${firstFact}${matchingSkills.length ? ` My relevant experience includes ${matchingSkills.slice(0, 4).join(", ")}.` : ""}\n\nI would be glad to discuss the position.\n\nBest regards,\n${name}` };
  return { analysis, resume, draft };
}

export async function analyzeJobs(jobId?: string, limit = 25) {
  const profile = await setting<Json>("profile", DEFAULT_PROFILE);
  const jobRows = jobId
    ? await (await db()).prepare("SELECT * FROM jobs WHERE id = ?").bind(jobId).all<Row>()
    : await (await db()).prepare("SELECT jobs.* FROM jobs LEFT JOIN analyses ON analyses.job_id = jobs.id WHERE analyses.job_id IS NULL AND jobs.status <> 'ARCHIVED' ORDER BY jobs.discovered_at DESC LIMIT ?").bind(Math.min(Math.max(limit, 1), 100)).all<Row>();
  if (jobId && !jobRows.results.length) throw new Error("Job not found.");
  const completed: Json[] = [];
  for (const row of jobRows.results) {
    const job = mapJob(row); const pkg = analyze(job, profile); const timestamp = now(); const suffix = job.id.replace(/^job_/, "");
    await (await db()).batch([
      (await db()).prepare(`INSERT INTO analyses (job_id, mode, score, verdict, payload_json, created_at, updated_at) VALUES (?, 'deterministic', ?, ?, ?, ?, ?)
        ON CONFLICT(job_id) DO UPDATE SET score=excluded.score, verdict=excluded.verdict, payload_json=excluded.payload_json, updated_at=excluded.updated_at`)
        .bind(job.id, pkg.analysis.score, pkg.analysis.verdict, JSON.stringify(pkg.analysis), timestamp, timestamp),
      (await db()).prepare(`INSERT INTO resume_variants (id, job_id, markdown, created_at, updated_at) VALUES (?, ?, ?, ?, ?)
        ON CONFLICT(job_id) DO UPDATE SET markdown=excluded.markdown, updated_at=excluded.updated_at`)
        .bind(`resume_${suffix}`, job.id, pkg.resume, timestamp, timestamp),
    ]);
    const existing = await (await db()).prepare("SELECT status FROM application_drafts WHERE job_id = ?").bind(job.id).first<Row>();
    if (!existing || ["PENDING_APPROVAL", "REJECTED"].includes(String(existing.status))) {
      await (await db()).prepare(`INSERT INTO application_drafts (id, job_id, recipient, subject, body, status, created_at, updated_at) VALUES (?, ?, ?, ?, ?, 'PENDING_APPROVAL', ?, ?)
        ON CONFLICT(job_id) DO UPDATE SET recipient=COALESCE(excluded.recipient, application_drafts.recipient), subject=excluded.subject, body=excluded.body, status='PENDING_APPROVAL', approved_at=NULL, updated_at=excluded.updated_at`)
        .bind(`draft_${suffix}`, job.id, pkg.draft.recipient, pkg.draft.subject, pkg.draft.body, timestamp, timestamp).run();
    }
    await (await db()).prepare("UPDATE jobs SET status='REVIEWED', updated_at=? WHERE id=?").bind(timestamp, job.id).run();
    completed.push({ id: job.id, score: pkg.analysis.score, verdict: pkg.analysis.verdict, mode: "deterministic" });
  }
  return completed;
}

export async function updateDraft(id: string, action: string, recipient?: string) {
  const draft = await (await db()).prepare("SELECT * FROM application_drafts WHERE id = ?").bind(id).first<Row>();
  if (!draft) throw new Error("Application draft not found.");
  const status = String(draft.status); const timestamp = now();
  if (action === "approve") {
    if (!recipient && !draft.recipient) throw new Error("Add a recipient before approval.");
    await (await db()).prepare("UPDATE application_drafts SET recipient=?, status='APPROVED', approved_at=?, updated_at=? WHERE id=?")
      .bind(recipient || draft.recipient, timestamp, timestamp, id).run();
  } else if (action === "reject") {
    if (status === "SENT") throw new Error("A sent application cannot be rejected.");
    await (await db()).prepare("UPDATE application_drafts SET status='REJECTED', approved_at=NULL, updated_at=? WHERE id=?").bind(timestamp, id).run();
  } else if (action === "send") {
    if (status !== "APPROVED") throw new Error("Approve this application before sending.");
    throw new Error("Cloud Gmail sending is not configured yet. The application remains APPROVED and nothing was sent.");
  } else throw new Error("Unsupported draft action.");
}

export function jsonError(error: unknown) {
  const message = error instanceof Error ? error.message : String(error);
  const status = /not found/i.test(message) ? 404 : /requires|limited|allowed|approve|recipient/i.test(message) ? 400 : 500;
  return Response.json({ ok: false, error: message }, { status });
}

export async function readPayload(request: Request) {
  const length = Number(request.headers.get("content-length") ?? 0);
  if (length > 2_000_000) throw new Error("Request body is too large.");
  const value = await request.json() as unknown;
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("JSON body must be an object.");
  return value as Json;
}

export { DEFAULT_PROFILE, DEFAULT_SOURCES, saveSetting };
