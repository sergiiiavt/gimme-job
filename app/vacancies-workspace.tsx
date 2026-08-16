"use client";

import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { createLocalAgentApiResolver, DEFAULT_LOCAL_AGENT_PORT } from "./local-agent";
import { SiteSidebar } from "./site-navigation";

type JobStatus = "NEW" | "INTERESTED" | "APPLIED" | "INTERVIEW" | "OFFER" | "REJECTED" | "NOT_INTERESTED" | "ARCHIVED";
type JobFeedback = "RELEVANT" | "NOT_RELEVANT" | null;

interface JobAnalysis {
  score?: number;
  verdict?: string;
  roleFit?: string;
  matchingSkills?: string[];
  missingSkills?: string[];
  hardBlockers?: string[];
  recommendation?: string;
  marketSignals?: {
    seniority: string;
    employmentType: string;
    remotePolicy: string;
    salary: string;
    reservation: string;
    language: string;
  };
}

interface JobDraft {
  id: string;
  recipient: string | null;
  subject: string;
  body: string;
  status: string;
}

interface Job {
  id: string;
  source: string;
  title: string;
  company: string;
  location: string;
  remote: boolean;
  url: string;
  applyUrl: string;
  description: string;
  salaryText: string | null;
  postedAt: string | null;
  discoveredAt: string;
  status: JobStatus;
  feedback: JobFeedback;
  feedbackAt?: string | null;
  statusUpdatedAt?: string | null;
  analysis: JobAnalysis | null;
  resume: string | null;
  resumePdf: boolean;
  draft: JobDraft | null;
}

interface DashboardData {
  jobs: Job[];
  authenticated?: boolean;
}

const STATUS_OPTIONS: Array<{ value: JobStatus; label: string }> = [
  { value: "NEW", label: "New" },
  { value: "INTERESTED", label: "Interested" },
  { value: "APPLIED", label: "Applied" },
  { value: "INTERVIEW", label: "Interview" },
  { value: "OFFER", label: "Offer" },
  { value: "REJECTED", label: "Rejected" },
  { value: "NOT_INTERESTED", label: "Not interested" },
  { value: "ARCHIVED", label: "Archived" },
];

const DEMO_JOBS: Job[] = [
  {
    id: "demo-1",
    source: "gmail:linkedin",
    title: "QA Automation Lead",
    company: "Northstar Labs",
    location: "Remote · Europe",
    remote: true,
    url: "https://example.com/job",
    applyUrl: "https://example.com/apply",
    description: "Lead quality engineering for a web platform, own automation strategy, API quality, and mentoring.",
    salaryText: "$4,000–5,000",
    postedAt: new Date().toISOString(),
    discoveredAt: new Date().toISOString(),
    status: "NEW",
    feedback: null,
    analysis: { score: 91, verdict: "strong", matchingSkills: ["Playwright", "TypeScript", "API testing"], missingSkills: ["AWS"] },
    resume: "# Your Name\nQA Automation Lead\n\n## Summary\nQA leader with hands-on Playwright and TypeScript automation experience.",
    resumePdf: false,
    draft: null,
  },
  {
    id: "demo-2",
    source: "rss:dou-qa",
    title: "Team Lead Test Engineer",
    company: "Orbit Systems",
    location: "Kyiv · Hybrid",
    remote: false,
    url: "https://example.com/job",
    applyUrl: "https://example.com/apply",
    description: "Coordinate a QA team, improve delivery quality, and build practical test automation.",
    salaryText: null,
    postedAt: new Date(Date.now() - 86_400_000).toISOString(),
    discoveredAt: new Date(Date.now() - 86_400_000).toISOString(),
    status: "INTERESTED",
    feedback: "RELEVANT",
    analysis: { score: 84, verdict: "strong", matchingSkills: ["QA leadership", "Python", "API testing"], missingSkills: [] },
    resume: null,
    resumePdf: false,
    draft: null,
  },
];

const configuredLocalAgentPort = Number(import.meta.env.VITE_JOB_AGENT_PORT ?? DEFAULT_LOCAL_AGENT_PORT);
const configuredLocalAgentInstanceId = String(import.meta.env.VITE_JOB_AGENT_INSTANCE_ID ?? "");
const localAgentApi = createLocalAgentApiResolver();

function usesLocalAgent() {
  return typeof window !== "undefined" && ["localhost", "127.0.0.1", "terminal.local"].includes(window.location.hostname);
}

async function apiBase() {
  if (!usesLocalAgent()) return "/api";
  return localAgentApi.resolve({ instanceId: configuredLocalAgentInstanceId, startPort: configuredLocalAgentPort });
}

async function api<T>(path: string, method = "GET", payload?: unknown): Promise<T> {
  const base = await apiBase();
  let response: Response;
  let result: T & { error?: string };
  try {
    response = await fetch(`${base}${path}`, {
      method,
      headers: payload !== undefined ? { "content-type": "application/json" } : undefined,
      body: payload !== undefined ? JSON.stringify(payload) : undefined,
    });
    result = await response.json() as T & { error?: string };
  } catch (error) {
    if (usesLocalAgent()) localAgentApi.invalidate();
    throw error;
  }
  if (!response.ok) throw new Error(result.error ?? `Request failed: ${response.status}`);
  return result;
}

function Icon({ name, size = 18 }: { name: string; size?: number }) {
  const paths: Record<string, ReactNode> = {
    search: <><circle cx="11" cy="11" r="7"/><path d="m20 20-4-4"/></>,
    sync: <><path d="M20 6v5h-5M4 18v-5h5"/><path d="M18 9a7 7 0 0 0-12-3L4 8M6 15a7 7 0 0 0 12 3l2-2"/></>,
    llm: <><path d="M12 2a4 4 0 0 1 4 4v1a4 4 0 0 1 0 8v1a4 4 0 0 1-8 0v-1a4 4 0 0 1 0-8V6a4 4 0 0 1 4-4Z"/><path d="M8 8h8M8 14h8M12 5v14"/></>,
    external: <><path d="M14 3h7v7M10 14 21 3"/><path d="M21 14v5a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5"/></>,
    check: <path d="m5 12 4 4L19 6"/>,
    x: <path d="m6 6 12 12M18 6 6 18"/>,
  };
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{paths[name]}</svg>;
}

function sourceLabel(source: string) {
  if (source.includes("linkedin")) return "LinkedIn";
  if (source.includes("dou")) return "DOU";
  if (source.includes("djinni")) return "Djinni";
  if (source.includes("workua")) return "Work.ua";
  if (source.includes("lobbyx") || source.includes("lobby")) return "Lobby X";
  if (source.includes("greenhouse")) return "Greenhouse";
  if (source.includes("lever")) return "Lever";
  if (source.includes("ashby")) return "Ashby";
  return source.replace(/^\w+:/, "");
}

function jobDate(job: Job) {
  return new Date(job.postedAt ?? job.discoveredAt);
}

function hasReservation(job: Job) {
  return /бронюванн/i.test(job.description);
}

function formatDate(value: string | null) {
  if (!value) return "Unknown";
  return new Intl.DateTimeFormat("en", { day: "numeric", month: "short", year: "numeric" }).format(new Date(value));
}

function formatCompactDate(value: string | null) {
  if (!value) return "—";
  return new Intl.DateTimeFormat("en", { day: "numeric", month: "short" }).format(new Date(value));
}

function displayText(value: string) {
  return value.replace(/&nbsp;/g, " ").replace(/&amp;/g, "&").replace(/&quot;/g, "\"").replace(/&#39;/g, "'").replace(/&lt;/g, "<").replace(/&gt;/g, ">");
}

function statusLabel(status: JobStatus) {
  return STATUS_OPTIONS.find((item) => item.value === status)?.label ?? status;
}

function verdictLabel(verdict?: string) {
  if (!verdict) return "Analyzed";
  return verdict.replace(/[_-]+/g, " ").replace(/^./, (letter) => letter.toUpperCase());
}

export default function VacanciesWorkspace() {
  const [jobs, setJobs] = useState<Job[]>([]);
  const [online, setOnline] = useState<boolean | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<JobStatus | "ALL">("ALL");
  const [busy, setBusy] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [mobileNav, setMobileNav] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [analyzeProgress, setAnalyzeProgress] = useState<{ done: number; total: number } | null>(null);
  const [analyzeLog, setAnalyzeLog] = useState<string[]>([]);
  const [authenticated, setAuthenticated] = useState<boolean | null>(null);
  const analyzeCancelRef = useRef(false);
  const isPersonal = authenticated === true;
  const viewMode = isPersonal ? "personal" : "public";

  useEffect(() => {
    let active = true;
    let retryTimer: number | undefined;
    const loadDashboard = (attempt = 0) => api<DashboardData>("/dashboard")
      .then((result) => {
        if (!active) return;
        setJobs([...result.jobs].sort((a, b) => jobDate(b).getTime() - jobDate(a).getTime()));
        setOnline(true);
        setAuthenticated(Boolean(result.authenticated));
      })
      .catch(() => {
        if (!active) return;
        if (attempt < 2) {
          retryTimer = window.setTimeout(() => loadDashboard(attempt + 1), 400);
          return;
        }
        setJobs(DEMO_JOBS);
        setOnline(false);
        // Fail closed: private controls must never appear because the dashboard request failed.
        setAuthenticated(false);
      });
    void loadDashboard();
    return () => {
      active = false;
      if (retryTimer !== undefined) window.clearTimeout(retryTimer);
    };
  }, []);

  useEffect(() => {
    if (!notice) return;
    const timer = window.setTimeout(() => setNotice(null), 3500);
    return () => window.clearTimeout(timer);
  }, [notice]);

  useEffect(() => {
    if (isPersonal) return;
    if (statusFilter !== "ALL") setStatusFilter("ALL");
    if (selectedIds.size) setSelectedIds(new Set());
  }, [isPersonal, selectedIds.size, statusFilter]);

  const visibleJobs = useMemo(() => jobs
    .filter((job) => !isPersonal || statusFilter === "ALL" || job.status === statusFilter)
    .filter((job) => displayText(`${job.title} ${job.company} ${job.location} ${job.source} ${job.salaryText ?? ""}`).toLowerCase().includes(query.toLowerCase()))
    .sort((a, b) => jobDate(b).getTime() - jobDate(a).getTime()), [isPersonal, jobs, query, statusFilter]);

  const selected = visibleJobs.find((job) => job.id === selectedId) ?? jobs.find((job) => job.id === selectedId) ?? null;
  const personalCounts = {
    total: jobs.length,
    new: jobs.filter((job) => job.status === "NEW").length,
    applied: jobs.filter((job) => job.status === "APPLIED").length,
    interviews: jobs.filter((job) => job.status === "INTERVIEW").length,
  };
  const publicCounts = {
    total: jobs.length,
    remote: jobs.filter((job) => job.remote).length,
    reservation: jobs.filter(hasReservation).length,
  };

  const sync = async () => {
    if (!isPersonal) return;
    setBusy("sync");
    try {
      const result = await api<{ dashboard: DashboardData }>("/sync", "POST", {});
      setJobs(result.dashboard.jobs);
      setOnline(true);
      setAuthenticated(Boolean(result.dashboard.authenticated));
      setNotice("Job sources synced. Nothing was sent.");
    } catch (error) {
      setNotice(error instanceof Error ? error.message : String(error));
    } finally { setBusy(null); }
  };

  const toggleSelected = (id: string) => {
    if (!isPersonal) return;
    setSelectedIds((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };
  const selectAllVisible = () => { if (isPersonal) setSelectedIds(new Set(visibleJobs.map((job) => job.id))); };
  const clearSelected = () => setSelectedIds(new Set());

  const analyze = async () => {
    if (!isPersonal) return;
    const targetIds = [...selectedIds];
    if (targetIds.length === 0) {
      setNotice("Select at least one vacancy before analyzing.");
      return;
    }

    setBusy("analyze");
    analyzeCancelRef.current = false;
    setAnalyzeLog([]);
    setAnalyzeProgress({ done: 0, total: targetIds.length });

    let completed = 0;
    for (const jobId of targetIds) {
      if (analyzeCancelRef.current) break;
      const job = jobs.find((item) => item.id === jobId);
      const label = job ? `${displayText(job.title)} at ${displayText(job.company)}` : jobId;
      setAnalyzeLog((log) => [...log, `Analyzing "${label}"…`]);
      try {
        const result = await api<{ dashboard: DashboardData; result: Array<{ score: number; verdict: string; mode: string }> }>("/analyze", "POST", { jobId });
        setJobs(result.dashboard.jobs);
        setOnline(true);
        setAuthenticated(Boolean(result.dashboard.authenticated));
        const outcome = result.result[0];
        setAnalyzeLog((log) => [...log, outcome
          ? `  ✓ ${label} — score ${outcome.score} (${outcome.verdict}, ${outcome.mode})`
          : `  ✓ ${label} — done`]);
      } catch (error) {
        setAnalyzeLog((log) => [...log, `  ✗ ${label} — ${error instanceof Error ? error.message : String(error)}`]);
      }
      completed += 1;
      setAnalyzeProgress({ done: completed, total: targetIds.length });
    }

    setNotice(analyzeCancelRef.current
      ? `Stopped after ${completed} of ${targetIds.length}. Nothing was sent.`
      : `Scored ${completed} job(s). Nothing was sent.`);
    setSelectedIds(new Set());
    setBusy(null);
  };

  const stopAnalyze = () => { analyzeCancelRef.current = true; };

  const adjustResume = async (job: Job) => {
    if (!isPersonal) return;
    setBusy(`resume-${job.id}`);
    try {
      const result = await api<{ dashboard: DashboardData; result: { mode: string } }>("/analyze-resume", "POST", { jobId: job.id });
      setJobs(result.dashboard.jobs);
      setOnline(true);
      setAuthenticated(Boolean(result.dashboard.authenticated));
      setNotice(`Resume adjusted (${result.result.mode}). Nothing was sent.`);
    } catch (error) {
      setNotice(error instanceof Error ? error.message : String(error));
    } finally { setBusy(null); }
  };

  const downloadResumePdf = async (job: Job) => {
    if (!isPersonal) return;
    try {
      const base = await apiBase();
      const response = await fetch(`${base}/resumes/${encodeURIComponent(job.id)}.pdf`);
      if (!response.ok) throw new Error(`Could not download the PDF: ${response.status}`);
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `${job.id}-resume.pdf`;
      link.click();
      URL.revokeObjectURL(url);
    } catch (error) {
      setNotice(error instanceof Error ? error.message : String(error));
    }
  };

  const updateTracking = async (job: Job, change: { status?: JobStatus; feedback?: JobFeedback }) => {
    if (!isPersonal) return;
    if (!online) return setNotice("Cloud API is unavailable; demo changes are not saved.");
    setBusy(`job-${job.id}`);
    const optimistic = { ...job, ...change };
    setJobs((current) => current.map((item) => item.id === job.id ? optimistic : item));
    try {
      const result = await api<{ dashboard: DashboardData }>(`/jobs/${encodeURIComponent(job.id)}`, "PATCH", change);
      setJobs(result.dashboard.jobs);
      setNotice("Saved to the database.");
    } catch (error) {
      setJobs((current) => current.map((item) => item.id === job.id ? job : item));
      setNotice(error instanceof Error ? error.message : String(error));
    } finally { setBusy(null); }
  };

  return (
    <main className="kb-shell">
      <SiteSidebar
        activeSection="jobs"
        activeSubsection={statusFilter}
        hideSecondary
        mobileOpen={mobileNav}
        mode={isPersonal ? "personal" : "public"}
        onSelectSubsection={(next) => { if (isPersonal) setStatusFilter(next as JobStatus | "ALL"); setMobileNav(false); }}
        personalHref="/workspace"
        publicHref="/"
        secondaryItems={[]}
        secondaryTitle="Vacancies"
      />

      <section className="kb-main kb-main-compact-nav">
        <button className="kb-floating-menu" onClick={() => setMobileNav((value) => !value)} aria-label="Toggle navigation">☰</button>

        <div className={`jobs-page private-jobs-page vacancy-workspace vacancy-workspace-${viewMode}`}>
          <section className="page-intro vacancy-page-intro">
            <div className="private-page-heading">
              <h1>Vacancies</h1>
              {isPersonal ? <div className="page-actions">
                <button className="sync-button" onClick={() => void sync()} disabled={busy !== null}><Icon name="sync"/><span>{busy === "sync" ? "Syncing…" : "Sync jobs"}</span></button>
                {busy === "analyze"
                  ? <button className="sync-button stop-button" onClick={stopAnalyze}><Icon name="x"/><span>Stop ({analyzeProgress?.done ?? 0}/{analyzeProgress?.total ?? 0})</span></button>
                  : <button className="sync-button" onClick={() => void analyze()} disabled={busy !== null || selectedIds.size === 0}><Icon name="llm"/><span>{selectedIds.size > 0 ? `Analyze selected (${selectedIds.size})` : "Analyze"}</span></button>}
              </div> : <a className="signin-link" href="/workspace/login">Sign in for personal tools →</a>}
            </div>
            {isPersonal ? (
              <div className="stat-line"><Stat value={personalCounts.total} label="Total"/><Stat value={personalCounts.new} label="New"/><Stat value={personalCounts.applied} label="Applied"/><Stat value={personalCounts.interviews} label="Interviews"/></div>
            ) : (
              <div className="stat-line"><Stat value={publicCounts.total} label="Total"/><Stat value={publicCounts.remote} label="Remote"/><Stat value={publicCounts.reservation} label="Бронювання"/></div>
            )}
            {isPersonal && busy === "sync" && <div className="analyze-progress">
              <div className="analyze-progress-bar indeterminate"><div/></div>
              <div className="analyze-log" role="log" aria-live="polite"><div>Searching job sources…</div></div>
            </div>}
            {isPersonal && (busy === "analyze" || analyzeLog.length > 0) && <div className="analyze-progress">
              {analyzeProgress && <div className="analyze-progress-bar"><div style={{ width: `${analyzeProgress.total ? Math.round(analyzeProgress.done / analyzeProgress.total * 100) : 0}%` }}/></div>}
              <div className="analyze-log" role="log" aria-live="polite">{analyzeLog.map((line, index) => <div key={index}>{line}</div>)}</div>
            </div>}
          </section>

          {selected ? <section className={`job-detail-view${isPersonal ? "" : " job-detail-view-public"}`} id="selected-vacancy-detail" role="region" aria-label="Selected vacancy details">
            <button type="button" className="back-link" onClick={() => setSelectedId(null)}>← Back to vacancies</button>
            <JobDetailPanel job={selected} disabled={busy === `job-${selected.id}`} authenticated={isPersonal} onChange={(change) => void updateTracking(selected, change)}/>
            {isPersonal && <article className="job-analysis-resume">
              <JobAnalysisPanel job={selected}/>
              <JobResumePanel
                job={selected}
                authenticated={isPersonal}
                busy={busy === `resume-${selected.id}`}
                onAdjust={() => void adjustResume(selected)}
                onDownload={() => void downloadResumePdf(selected)}
              />
            </article>}
          </section> : <section className="job-list-view vacancy-list-view">
            <div className={`feed-tools vacancy-feed-tools vacancy-feed-tools-${viewMode}`}>
              <label className="search"><Icon name="search"/><input aria-label="Search vacancies" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search jobs or companies"/></label>
              {isPersonal && <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value as JobStatus | "ALL")} aria-label="Filter by status">
                <option value="ALL">All statuses</option>
                {STATUS_OPTIONS.map((status) => <option key={status.value} value={status.value}>{status.label}</option>)}
              </select>}
            </div>
            <div className={`feed-meta vacancy-feed-meta vacancy-feed-meta-${viewMode}`}>
              <span>{visibleJobs.length} jobs</span>
              {isPersonal && <span className="feed-meta-select">
                {selectedIds.size > 0 ? `${selectedIds.size} selected · ` : ""}
                <button type="button" className="link-button" onClick={selectAllVisible}>Select all</button>
                {selectedIds.size > 0 && <button type="button" className="link-button" onClick={clearSelected}>Clear</button>}
              </span>}
              <span>Newest first</span>
            </div>

            <div className={`vacancy-table-head vacancy-table-head-${viewMode}`} aria-hidden="true">
              {isPersonal && <span/>}
              <span>Vacancy</span>
              <span>Company</span>
              <span>Location</span>
              <span>Source</span>
              <span>Conditions</span>
              <span>Salary</span>
              {isPersonal && <span className="vacancy-workflow-head">Match</span>}
              <span>Posted</span>
              {isPersonal && <span>Status</span>}
            </div>

            <div className="job-feed vacancy-table-body">
              {visibleJobs.map((job) => <div
                key={job.id}
                className={`vacancy-table-row vacancy-table-row-${viewMode}`}
                role="button"
                tabIndex={0}
                onClick={() => setSelectedId(job.id)}
                onKeyDown={(event) => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); setSelectedId(job.id); } }}
              >
                {isPersonal && <input
                  type="checkbox"
                  className="job-card-check vacancy-select"
                  aria-label={`Select ${displayText(job.title)} for analysis`}
                  checked={selectedIds.has(job.id)}
                  onChange={() => toggleSelected(job.id)}
                  onClick={(event) => event.stopPropagation()}
                />}
                <div className="vacancy-cell vacancy-title-cell" data-label="Vacancy"><strong title={displayText(job.title)}>{displayText(job.title)}</strong></div>
                <div className="vacancy-cell vacancy-text-cell" data-label="Company" title={displayText(job.company)}>{displayText(job.company) || "—"}</div>
                <div className="vacancy-cell vacancy-text-cell" data-label="Location" title={displayText(job.location)}>{displayText(job.location) || "—"}</div>
                <div className="vacancy-cell vacancy-chip-cell" data-label="Source"><span className="vacancy-tag">{sourceLabel(job.source)}</span></div>
                <div className="vacancy-cell vacancy-chip-cell vacancy-conditions" data-label="Conditions">
                  {job.remote && <span className="vacancy-tag vacancy-tag-remote">Remote</span>}
                  {hasReservation(job) && <span className="vacancy-tag vacancy-tag-reservation">Бронювання</span>}
                  {!job.remote && !hasReservation(job) && <span className="vacancy-dash">—</span>}
                </div>
                <div className="vacancy-cell vacancy-salary" data-label="Salary">{job.salaryText ? displayText(job.salaryText) : "—"}</div>
                {isPersonal && <div className={`vacancy-cell vacancy-match${typeof job.analysis?.score === "number" ? " has-score" : " no-score"}`} data-label="Match">
                  {typeof job.analysis?.score === "number" ? <><strong>{job.analysis.score}</strong><span>{verdictLabel(job.analysis.verdict)}</span></> : <><strong>—</strong><span>Not analyzed</span></>}
                </div>}
                <time className="vacancy-cell vacancy-posted" data-label="Posted" dateTime={job.postedAt ?? job.discoveredAt} title={formatDate(job.postedAt ?? job.discoveredAt)}>{formatCompactDate(job.postedAt ?? job.discoveredAt)}</time>
                {isPersonal && <div className="vacancy-cell vacancy-status-cell" data-label="Status">
                  <span className={`status status-${job.status.toLowerCase().replace("_", "-")}`}>{statusLabel(job.status)}</span>
                  {job.feedback === "RELEVANT" && <span className="vacancy-feedback good">Relevant</span>}
                  {job.feedback === "NOT_RELEVANT" && <span className="vacancy-feedback bad">Not relevant</span>}
                </div>}
              </div>)}
              {visibleJobs.length === 0 && <div className="empty"><strong>{jobs.length ? "No matching jobs" : online === null ? "Loading jobs" : "Collecting the first jobs"}</strong><span>{jobs.length ? "Change the search or filter." : online === null ? "Connecting to the job database…" : isPersonal ? "The first sync runs automatically. You can also press Sync jobs." : "No public vacancies are available right now."}</span></div>}
            </div>
          </section>}
        </div>
      </section>

      {mobileNav && <button className="kb-backdrop" onClick={() => setMobileNav(false)} aria-label="Close navigation"/>}
      {notice && <div className="toast" role="status" aria-live="polite">{notice}</div>}
    </main>
  );
}

function Stat({ value, label }: { value: number; label: string }) {
  return <div><strong>{value}</strong><span>{label}</span></div>;
}

function CopyButton({ text, label = "Copy" }: { text: string; label?: string }) {
  const [copied, setCopied] = useState(false);
  return <button
    type="button"
    className="copy-button"
    onClick={() => {
      void navigator.clipboard.writeText(text).then(() => {
        setCopied(true);
        window.setTimeout(() => setCopied(false), 1500);
      });
    }}
  >{copied ? "Copied" : label}</button>;
}

function JobDetailPanel({ job, disabled, authenticated, onChange }: { job: Job; disabled: boolean; authenticated: boolean; onChange: (change: { status?: JobStatus; feedback?: JobFeedback }) => void }) {
  const summaryTags = [
    job.remote ? "Remote" : null,
    job.salaryText ? "Salary listed" : null,
    job.location && !job.remote ? displayText(job.location) : null,
    sourceLabel(job.source) ? sourceLabel(job.source) : null,
  ].filter(Boolean).slice(0, 3);

  return <article className="job-detail">
    <div className="detail-head">
      <div><span>{displayText(job.company)}</span><h2>{displayText(job.title)}</h2><p>{displayText(job.location)}{job.salaryText ? ` · ${job.salaryText}` : ""}</p></div>
      {authenticated && typeof job.analysis?.score === "number" && <div className="score"><strong>{job.analysis.score}</strong><span>match</span></div>}
    </div>

    <div className="detail-actions">
      <a href={job.url} target="_blank" rel="noreferrer"><Icon name="external"/>View vacancy</a>
      {job.applyUrl && job.applyUrl !== job.url && <a className="secondary-link" href={job.applyUrl} target="_blank" rel="noreferrer">Apply link</a>}
    </div>
    <div className="job-summary-tags">{hasReservation(job) && <span className="reservation">Бронювання</span>}{summaryTags.map((tag) => <span key={tag}>{tag}</span>)}</div>

    {authenticated && <section className="tracking-box">
      <div><label htmlFor={`status-${job.id}`}>Pipeline status</label><select id={`status-${job.id}`} value={job.status} disabled={disabled} onChange={(event) => onChange({ status: event.target.value as JobStatus })}>{STATUS_OPTIONS.map((status) => <option key={status.value} value={status.value}>{status.label}</option>)}</select></div>
      <div><label>Feedback for the agent</label><div className="feedback-buttons">
        <button aria-pressed={job.feedback === "RELEVANT"} className={job.feedback === "RELEVANT" ? "active positive" : ""} disabled={disabled} onClick={() => onChange({ feedback: job.feedback === "RELEVANT" ? null : "RELEVANT" })}><Icon name="check"/>Relevant</button>
        <button aria-pressed={job.feedback === "NOT_RELEVANT"} className={job.feedback === "NOT_RELEVANT" ? "active negative" : ""} disabled={disabled} onClick={() => onChange({ feedback: job.feedback === "NOT_RELEVANT" ? null : "NOT_RELEVANT" })}><Icon name="x"/>Not relevant</button>
      </div></div>
    </section>}

    <dl className="job-facts"><div><dt>Source</dt><dd>{sourceLabel(job.source)}</dd></div><div><dt>Posted</dt><dd>{formatDate(job.postedAt)}</dd></div><div><dt>Found</dt><dd>{formatDate(job.discoveredAt)}</dd></div><div><dt>Remote</dt><dd>{job.remote ? "Yes" : "Not specified"}</dd></div></dl>

    <section className="description"><h3>Vacancy description</h3><p>{displayText(job.description || "No description was collected for this vacancy.")}</p></section>
  </article>;
}

function JobAnalysisPanel({ job }: { job: Job }) {
  if (!job.analysis) return <article className="job-analysis empty-panel"><strong>Not analyzed yet</strong><span>Press Analyze to score this vacancy against the candidate profile.</span></article>;
  const analysis = job.analysis;
  return <article className="job-analysis">
    <div className="section-head"><h3>Analysis</h3>{typeof analysis.score === "number" && <span className={`verdict verdict-${analysis.verdict ?? "weak"}`}>{analysis.verdict} · {analysis.score}</span>}</div>
    {analysis.recommendation && <p className="analysis-recommendation">{analysis.recommendation}</p>}
    {(analysis.matchingSkills?.length || analysis.missingSkills?.length) ? <div className="skills">
      {Boolean(analysis.matchingSkills?.length) && <div><span>Matches</span><p>{analysis.matchingSkills?.map((skill) => <em key={skill}>{skill}</em>)}</p></div>}
      {Boolean(analysis.missingSkills?.length) && <div><span>Gaps</span><p>{analysis.missingSkills?.map((skill) => <em key={skill} className="gap">{skill}</em>)}</p></div>}
    </div> : null}
    {analysis.hardBlockers?.length ? <div className="analysis-blockers"><span>Blockers</span><p>{analysis.hardBlockers.join(" · ")}</p></div> : null}
    {analysis.marketSignals && <dl className="job-facts market-signals">
      <div><dt>Seniority</dt><dd>{analysis.marketSignals.seniority}</dd></div>
      <div><dt>Employment</dt><dd>{analysis.marketSignals.employmentType}</dd></div>
      <div><dt>Remote</dt><dd>{analysis.marketSignals.remotePolicy}</dd></div>
      <div><dt>Language</dt><dd>{analysis.marketSignals.language}</dd></div>
    </dl>}
  </article>;
}

function JobResumePanel({ job, authenticated, busy, onAdjust, onDownload }: { job: Job; authenticated: boolean; busy: boolean; onAdjust: () => void; onDownload: () => void }) {
  return <article className="job-resume">
    <div className="section-head">
      <h3>Tailored resume</h3>
      {authenticated && <button type="button" className="sync-button small" onClick={onAdjust} disabled={busy}>
        <Icon name="llm" size={14}/><span>{busy ? "Adjusting…" : job.resume ? "Re-adjust for this vacancy" : "Adjust resume for this vacancy"}</span>
      </button>}
    </div>
    {busy && <div className="analyze-progress-bar indeterminate resume-progress-bar"><div/></div>}

    {job.resume ? <>
      <div className="section-head"><span className="eyebrow">Resume preview</span><div className="resume-actions">
        <CopyButton text={job.resume}/>
        {job.resumePdf && <button type="button" className="copy-button" onClick={onDownload}>Download PDF</button>}
      </div></div>
      <pre className="resume-preview-text">{job.resume}</pre>
    </> : <p className="empty-hint">No tailored resume yet for this vacancy.</p>}

    {job.draft && <section className="draft-preview">
      <div className="section-head"><h3>Application draft</h3><CopyButton text={`Subject: ${job.draft.subject}\n\n${job.draft.body}`}/></div>
      <p className="draft-subject">{job.draft.subject}</p>
      <pre>{job.draft.body}</pre>
    </section>}
  </article>;
}
