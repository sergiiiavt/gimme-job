type EmailEventRow = {
  id: string;
  user_id: string;
  received_at: string;
  sender_email: string | null;
  subject: string;
  text_excerpt: string | null;
  classification: string;
  company: string | null;
  job_title: string | null;
  job_id: string | null;
  thread_id: string | null;
};

type CandidateRow = {
  id: string;
  title: string;
  company: string;
  url: string;
  apply_url: string;
  external_id: string | null;
  status: string;
  status_updated_at: string | null;
};

type ScoredCandidate = CandidateRow & {
  score: number;
  signals: string[];
};

export type VacancyResolutionResult = {
  eventId: string;
  userId: string;
  matchStatus: "MATCHED" | "AMBIGUOUS" | "UNRESOLVED" | "NOT_APPLICABLE";
  jobId: string | null;
  matchMethod: string | null;
  confidence: number | null;
  statusChange: {
    before: string;
    after: string;
  } | null;
  statusNote: string | null;
  candidates: Array<{
    jobId: string;
    title: string;
    company: string;
    status: string;
    score: number;
    signals: string[];
  }>;
};

export type VacancyResolutionOptions = {
  forcedJobId?: string | null;
  actorType?: "automation" | "user";
  actorLabel?: string;
};

const RESOLVABLE_CLASSIFICATIONS = new Set([
  "APPLICATION_RECEIVED",
  "RECRUITER_OUTREACH",
  "INTERVIEW",
  "TEST_TASK",
  "OFFER",
  "REJECTION",
]);

const TARGET_STATUS: Record<string, string | null> = {
  APPLICATION_RECEIVED: "APPLIED",
  RECRUITER_OUTREACH: null,
  INTERVIEW: "INTERVIEW",
  TEST_TASK: null,
  OFFER: "OFFER",
  REJECTION: "REJECTED",
};

const FUZZY_LIMIT = 150;
const AUTO_MATCH_SCORE = 80;
const AUTO_MATCH_MARGIN = 15;

function normalizeText(value: string | null | undefined): string {
  return (value ?? "")
    .normalize("NFKD")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function tokens(value: string): Set<string> {
  return new Set(normalizeText(value).split(" ").filter((token) => token.length >= 2));
}

function tokenSimilarity(left: string, right: string): number {
  const a = tokens(left);
  const b = tokens(right);
  if (!a.size || !b.size) return 0;
  let overlap = 0;
  for (const token of a) if (b.has(token)) overlap += 1;
  return overlap / Math.max(a.size, b.size);
}

function senderLooksLikeCompany(senderEmail: string | null, company: string): boolean {
  const sender = normalizeText(senderEmail).replace(/\s/g, "");
  const companyTokens = [...tokens(company)].filter((token) => token.length >= 4);
  return companyTokens.some((token) => sender.includes(token));
}

function candidateStatuses(classification: string): string[] {
  if (classification === "APPLICATION_RECEIVED") return ["NEW", "INTERESTED", "APPLIED"];
  if (classification === "RECRUITER_OUTREACH") return ["NEW", "INTERESTED", "APPLIED", "INTERVIEW"];
  return ["APPLIED", "INTERVIEW", "OFFER"];
}

export function scoreVacancyCandidate(
  event: Pick<EmailEventRow, "company" | "job_title" | "sender_email">,
  candidate: Pick<CandidateRow, "title" | "company">,
  uniqueness: { exactTitleCount: number; exactCompanyCount: number },
): { score: number; signals: string[] } {
  const signals: string[] = [];
  let score = 0;
  const eventCompany = normalizeText(event.company);
  const eventTitle = normalizeText(event.job_title);
  const company = normalizeText(candidate.company);
  const title = normalizeText(candidate.title);

  if (eventCompany && company) {
    if (eventCompany === company) {
      score += 35;
      signals.push("company_exact");
      if (uniqueness.exactCompanyCount === 1) {
        score += 45;
        signals.push("company_unique_active");
      }
    } else if (eventCompany.includes(company) || company.includes(eventCompany)) {
      score += 25;
      signals.push("company_close");
    }
  }

  if (eventTitle && title) {
    if (eventTitle === title) {
      score += 45;
      signals.push("title_exact");
      if (uniqueness.exactTitleCount === 1) {
        score += 35;
        signals.push("title_unique_active");
      }
    } else if (eventTitle.includes(title) || title.includes(eventTitle)) {
      score += 38;
      signals.push("title_close");
    } else {
      const similarity = tokenSimilarity(eventTitle, title);
      if (similarity >= 0.7) {
        score += 32;
        signals.push("title_tokens_strong");
      } else if (similarity >= 0.5) {
        score += 22;
        signals.push("title_tokens_partial");
      }
    }
  }

  if (senderLooksLikeCompany(event.sender_email, candidate.company)) {
    score += 10;
    signals.push("sender_matches_company");
  }

  return { score: Math.min(100, score), signals };
}

export function selectVacancyCandidate(
  event: Pick<EmailEventRow, "company" | "job_title" | "sender_email">,
  candidates: CandidateRow[],
): { matchStatus: "MATCHED" | "AMBIGUOUS" | "UNRESOLVED"; selected: ScoredCandidate | null; scored: ScoredCandidate[] } {
  const normalizedEventTitle = normalizeText(event.job_title);
  const normalizedEventCompany = normalizeText(event.company);
  const exactTitleCount = normalizedEventTitle
    ? candidates.filter((candidate) => normalizeText(candidate.title) === normalizedEventTitle).length
    : 0;
  const exactCompanyCount = normalizedEventCompany
    ? candidates.filter((candidate) => normalizeText(candidate.company) === normalizedEventCompany).length
    : 0;

  const scored = candidates
    .map((candidate) => ({
      ...candidate,
      ...scoreVacancyCandidate(event, candidate, { exactTitleCount, exactCompanyCount }),
    }))
    .filter((candidate) => candidate.score > 0)
    .sort((left, right) => right.score - left.score || left.id.localeCompare(right.id));

  const best = scored[0] ?? null;
  if (!best) return { matchStatus: "UNRESOLVED", selected: null, scored };
  const second = scored[1] ?? null;
  const margin = second ? best.score - second.score : best.score;
  if (best.score >= AUTO_MATCH_SCORE && margin >= AUTO_MATCH_MARGIN) {
    return { matchStatus: "MATCHED", selected: best, scored };
  }
  return { matchStatus: "AMBIGUOUS", selected: null, scored };
}

function compactCandidates(candidates: ScoredCandidate[]) {
  return candidates.slice(0, 3).map((candidate) => ({
    jobId: candidate.id,
    title: candidate.title,
    company: candidate.company,
    status: candidate.status,
    score: candidate.score,
    signals: candidate.signals,
  }));
}

async function loadEvent(db: D1Database, userId: string, eventId: string): Promise<EmailEventRow | null> {
  return db.prepare(`SELECT
    id, user_id, received_at, sender_email, subject, text_excerpt, classification,
    company, job_title, job_id, thread_id
  FROM user_email_events
  WHERE user_id = ? AND id = ?
  LIMIT 1`)
    .bind(userId, eventId)
    .first<EmailEventRow>();
}

async function loadCandidateById(db: D1Database, userId: string, jobId: string): Promise<CandidateRow | null> {
  return db.prepare(`SELECT
    jobs.id, jobs.title, jobs.company, jobs.url, jobs.apply_url, jobs.external_id,
    COALESCE(tracking.status, 'NEW') AS status,
    tracking.status_updated_at
  FROM jobs
  LEFT JOIN job_tracking AS tracking ON tracking.user_id = ? AND tracking.job_id = jobs.id
  WHERE jobs.id = ?
  LIMIT 1`)
    .bind(userId, jobId)
    .first<CandidateRow>();
}

async function loadThreadCandidate(db: D1Database, event: EmailEventRow): Promise<CandidateRow | null> {
  if (!event.thread_id) return null;
  const linked = await db.prepare(`SELECT job_id
    FROM user_email_events
    WHERE user_id = ? AND thread_id = ? AND id <> ? AND job_id IS NOT NULL
    ORDER BY resolved_at DESC, received_at DESC
    LIMIT 1`)
    .bind(event.user_id, event.thread_id, event.id)
    .first<{ job_id: string }>();
  return linked?.job_id ? loadCandidateById(db, event.user_id, linked.job_id) : null;
}

async function loadIdentifierCandidates(db: D1Database, event: EmailEventRow): Promise<CandidateRow[]> {
  const haystack = `${event.subject}\n${event.text_excerpt ?? ""}`.toLowerCase();
  if (!haystack.trim()) return [];
  const result = await db.prepare(`SELECT
    jobs.id, jobs.title, jobs.company, jobs.url, jobs.apply_url, jobs.external_id,
    COALESCE(tracking.status, 'NEW') AS status,
    tracking.status_updated_at
  FROM jobs
  LEFT JOIN job_tracking AS tracking ON tracking.user_id = ? AND tracking.job_id = jobs.id
  WHERE
    (length(jobs.url) >= 8 AND instr(?, lower(jobs.url)) > 0)
    OR (length(jobs.apply_url) >= 8 AND instr(?, lower(jobs.apply_url)) > 0)
    OR (jobs.external_id IS NOT NULL AND length(jobs.external_id) >= 5 AND instr(?, lower(jobs.external_id)) > 0)
  LIMIT 5`)
    .bind(event.user_id, haystack, haystack, haystack)
    .all<CandidateRow>();
  return result.results ?? [];
}

async function loadFuzzyCandidates(db: D1Database, event: EmailEventRow): Promise<CandidateRow[]> {
  const statuses = candidateStatuses(event.classification);
  const placeholders = statuses.map(() => "?").join(", ");
  const result = await db.prepare(`SELECT
    jobs.id, jobs.title, jobs.company, jobs.url, jobs.apply_url, jobs.external_id,
    COALESCE(tracking.status, 'NEW') AS status,
    tracking.status_updated_at
  FROM jobs
  LEFT JOIN job_tracking AS tracking ON tracking.user_id = ? AND tracking.job_id = jobs.id
  WHERE COALESCE(tracking.status, 'NEW') IN (${placeholders})
  ORDER BY COALESCE(tracking.status_updated_at, jobs.updated_at) DESC
  LIMIT ?`)
    .bind(event.user_id, ...statuses, FUZZY_LIMIT)
    .all<CandidateRow>();
  return result.results ?? [];
}

function allowedTransition(current: string, target: string): boolean {
  if (current === target) return true;
  if (target === "APPLIED") return current === "NEW" || current === "INTERESTED";
  if (target === "INTERVIEW") return current === "APPLIED";
  if (target === "OFFER") return current === "APPLIED" || current === "INTERVIEW";
  if (target === "REJECTED") return current === "APPLIED" || current === "INTERVIEW" || current === "OFFER";
  return false;
}

async function applyResolvedStatus(
  db: D1Database,
  event: EmailEventRow,
  candidate: CandidateRow,
  matchMethod: string,
  confidence: number,
  options: VacancyResolutionOptions,
): Promise<{ change: { before: string; after: string } | null; note: string }> {
  const target = TARGET_STATUS[event.classification] ?? null;
  if (!target) return { change: null, note: "no_status_change" };

  const current = candidate.status || "NEW";
  if (current === target) return { change: null, note: `already_${target}` };

  if (candidate.status_updated_at) {
    const statusTime = Date.parse(candidate.status_updated_at);
    const emailTime = Date.parse(event.received_at);
    if (Number.isFinite(statusTime) && Number.isFinite(emailTime) && statusTime > emailTime) {
      return { change: null, note: "stale_event" };
    }
  }

  if (!allowedTransition(current, target)) {
    return { change: null, note: `blocked_${current}_to_${target}` };
  }

  const changedAt = new Date().toISOString();
  await db.prepare(`INSERT INTO job_tracking (
    user_id, job_id, status, status_updated_at, updated_at
  ) VALUES (?, ?, ?, ?, ?)
  ON CONFLICT(user_id, job_id) DO UPDATE SET
    status = excluded.status,
    status_updated_at = excluded.status_updated_at,
    updated_at = excluded.updated_at`)
    .bind(event.user_id, candidate.id, target, changedAt, changedAt)
    .run();

  const actorType = options.actorType ?? "automation";
  const actorLabel = options.actorLabel ?? (actorType === "user" ? "You" : "GimmeJob automation");
  const metadata = JSON.stringify({
    emailEventId: event.id,
    classification: event.classification,
    matchMethod,
    matchConfidence: confidence,
  });
  await db.prepare(`UPDATE user_vacancy_audit_log
    SET actor_type = ?, actor_label = ?, metadata_json = ?
    WHERE user_id = ? AND job_id = ? AND action = 'status_changed'
      AND before_value = ? AND after_value = ? AND created_at = ?`)
    .bind(actorType, actorLabel, metadata, event.user_id, candidate.id, current, target, changedAt)
    .run();

  return { change: { before: current, after: target }, note: "status_updated" };
}

async function persistResolution(
  db: D1Database,
  event: EmailEventRow,
  matchStatus: VacancyResolutionResult["matchStatus"],
  jobId: string | null,
  method: string | null,
  confidence: number | null,
  candidates: ReturnType<typeof compactCandidates>,
  statusAppliedAt: string | null,
  statusNote: string | null,
): Promise<void> {
  const now = new Date().toISOString();
  await db.prepare(`UPDATE user_email_events
    SET job_id = ?, match_status = ?, match_method = ?, match_confidence = ?,
        match_evidence_json = ?, resolved_at = ?, status_applied_at = ?,
        status_apply_note = ?, updated_at = ?
    WHERE user_id = ? AND id = ?`)
    .bind(
      jobId,
      matchStatus,
      method,
      confidence,
      JSON.stringify({ candidates }),
      matchStatus === "MATCHED" ? now : null,
      statusAppliedAt,
      statusNote,
      now,
      event.user_id,
      event.id,
    )
    .run();
}

export async function resolveEmailEvent(
  db: D1Database,
  userId: string,
  eventId: string,
  options: VacancyResolutionOptions = {},
): Promise<VacancyResolutionResult> {
  const event = await loadEvent(db, userId, eventId);
  if (!event) throw new Error("Email event was not found.");

  if (!RESOLVABLE_CLASSIFICATIONS.has(event.classification)) {
    await persistResolution(db, event, "NOT_APPLICABLE", null, null, null, [], null, "not_applicable");
    return {
      eventId,
      userId,
      matchStatus: "NOT_APPLICABLE",
      jobId: null,
      matchMethod: null,
      confidence: null,
      statusChange: null,
      statusNote: "not_applicable",
      candidates: [],
    };
  }

  let selected: CandidateRow | null = null;
  let method: string | null = null;
  let confidence: number | null = null;
  let scored: ScoredCandidate[] = [];

  if (options.forcedJobId) {
    selected = await loadCandidateById(db, userId, options.forcedJobId);
    if (!selected) throw new Error("Vacancy was not found.");
    method = "MANUAL";
    confidence = 1;
    scored = [{ ...selected, score: 100, signals: ["manual_link"] }];
  } else if (event.job_id) {
    selected = await loadCandidateById(db, userId, event.job_id);
    if (selected) {
      method = "EXISTING_LINK";
      confidence = 1;
      scored = [{ ...selected, score: 100, signals: ["existing_link"] }];
    }
  }

  if (!selected) {
    const threadCandidate = await loadThreadCandidate(db, event);
    if (threadCandidate) {
      selected = threadCandidate;
      method = "THREAD";
      confidence = 1;
      scored = [{ ...threadCandidate, score: 100, signals: ["thread_link"] }];
    }
  }

  if (!selected) {
    const identifierCandidates = await loadIdentifierCandidates(db, event);
    if (identifierCandidates.length === 1) {
      selected = identifierCandidates[0] ?? null;
      method = "IDENTIFIER";
      confidence = 0.99;
      if (selected) scored = [{ ...selected, score: 99, signals: ["url_or_external_id"] }];
    } else if (identifierCandidates.length > 1) {
      scored = identifierCandidates.map((candidate) => ({ ...candidate, score: 99, signals: ["url_or_external_id"] }));
      const candidates = compactCandidates(scored);
      await persistResolution(db, event, "AMBIGUOUS", null, "IDENTIFIER", 0.99, candidates, null, "multiple_identifier_matches");
      return {
        eventId,
        userId,
        matchStatus: "AMBIGUOUS",
        jobId: null,
        matchMethod: "IDENTIFIER",
        confidence: 0.99,
        statusChange: null,
        statusNote: "multiple_identifier_matches",
        candidates,
      };
    }
  }

  if (!selected) {
    const fuzzyCandidates = await loadFuzzyCandidates(db, event);
    const choice = selectVacancyCandidate(event, fuzzyCandidates);
    scored = choice.scored;
    selected = choice.selected;
    if (choice.matchStatus !== "MATCHED" || !selected) {
      const candidates = compactCandidates(scored);
      const matchStatus = choice.matchStatus;
      const topScore = scored[0]?.score ?? 0;
      await persistResolution(db, event, matchStatus, null, "COMPOSITE", topScore / 100 || null, candidates, null, matchStatus === "AMBIGUOUS" ? "needs_manual_link" : "no_candidate_match");
      return {
        eventId,
        userId,
        matchStatus,
        jobId: null,
        matchMethod: "COMPOSITE",
        confidence: topScore / 100 || null,
        statusChange: null,
        statusNote: matchStatus === "AMBIGUOUS" ? "needs_manual_link" : "no_candidate_match",
        candidates,
      };
    }
    method = "COMPOSITE";
    confidence = selected.score / 100;
  }

  const applied = await applyResolvedStatus(db, event, selected, method ?? "COMPOSITE", confidence ?? 1, options);
  const statusAppliedAt = applied.change ? new Date().toISOString() : null;
  const candidates = compactCandidates(scored.length ? scored : [{ ...selected, score: Math.round((confidence ?? 1) * 100), signals: [method ?? "matched"] }]);
  await persistResolution(db, event, "MATCHED", selected.id, method, confidence, candidates, statusAppliedAt, applied.note);

  return {
    eventId,
    userId,
    matchStatus: "MATCHED",
    jobId: selected.id,
    matchMethod: method,
    confidence,
    statusChange: applied.change,
    statusNote: applied.note,
    candidates,
  };
}
