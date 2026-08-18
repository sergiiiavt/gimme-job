"use client";

import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { createLocalAgentApiResolver, DEFAULT_LOCAL_AGENT_PORT } from "./local-agent";
import { SiteSidebar } from "./site-navigation";
import { closeVacancyTab, openVacancyTab, vacancyAnalysisTargets } from "./vacancy-tabs";

type JobStatus = "NEW" | "INTERESTED" | "APPLIED" | "INTERVIEW" | "OFFER" | "REJECTED" | "NOT_INTERESTED" | "ARCHIVED";
type JobCondition = "REMOTE" | "RESERVATION";
type JobSort = "NEWEST" | "OLDEST" | "SCORE_HIGH" | "SCORE_LOW";
type ScoreTone = "low" | "fair" | "good" | "strong";
type VacancyViewMode = "public" | "personal";

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

interface VacancyCacheSnapshot {
  jobs: Job[];
  authenticated: boolean;
  dataUpdatedAt: number;
  lastAccessedAt: number;
}

interface VacancyWorkspaceSnapshot {
  openTabIds: string[];
  selectedId: string | null;
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

const CONDITION_OPTIONS: Array<{ value: JobCondition; label: string }> = [
  { value: "REMOTE", label: "Remote" },
  { value: "RESERVATION", label: "Бронювання" },
];

const PUBLIC_SORT_OPTIONS: Array<{ value: JobSort; label: string }> = [
  { value: "NEWEST", label: "Newest first" },
  { value: "OLDEST", label: "Oldest first" },
];

const PERSONAL_SORT_OPTIONS: Array<{ value: JobSort; label: string }> = [
  { value: "NEWEST", label: "Newest first" },
  { value: "SCORE_HIGH", label: "Highest score first" },
  { value: "OLDEST", label: "Oldest first" },
  { value: "SCORE_LOW", label: "Lowest score first" },
];

const VACANCY_CACHE_KEY = "gimmejob:vacancies-cache:v1";
const VACANCY_WORKSPACE_KEY = "gimmejob:vacancy-workspace:v1";
const VACANCY_VIEW_KEY = "gimmejob:vacancy-view:v1";
const VACANCY_STALE_MS = 10 * 60 * 1000;
const VACANCY_GC_MS = 60 * 60 * 1000;

let clientVacancyCache: VacancyCacheSnapshot | null = null;
let clientVacancyWorkspace: VacancyWorkspaceSnapshot | null = null;

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

function jobDateKey(job: Job) {
  const date = jobDate(job);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function compareJobs(left: Job, right: Job, sortOrder: JobSort) {
  const dateDifference = jobDate(right).getTime() - jobDate(left).getTime();
  if (sortOrder === "NEWEST") return dateDifference;
  if (sortOrder === "OLDEST") return -dateDifference;

  const leftScore = typeof left.analysis?.score === "number" ? left.analysis.score : null;
  const rightScore = typeof right.analysis?.score === "number" ? right.analysis.score : null;
  if (leftScore === null && rightScore === null) return dateDifference;
  if (leftScore === null) return 1;
  if (rightScore === null) return -1;

  const scoreDifference = sortOrder === "SCORE_HIGH" ? rightScore - leftScore : leftScore - rightScore;
  return scoreDifference || dateDifference;
}

function hasReservation(job: Job) {
  return /бронюванн/i.test(job.description);
}

function matchesCondition(job: Job, condition: JobCondition) {
  if (condition === "REMOTE") return job.remote;
  return hasReservation(job);
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

function normalizeScore(score: number) {
  return Math.max(0, Math.min(100, Math.round(score)));
}

function formatScore(score: number) {
  return `${normalizeScore(score)}/100`;
}

function scoreTone(score: number): ScoreTone {
  const normalized = normalizeScore(score);
  if (normalized < 40) return "low";
  if (normalized < 60) return "fair";
  if (normalized < 80) return "good";
  return "strong";
}

function sortJobsByNewest(jobs: Job[]) {
  return [...jobs].sort((a, b) => jobDate(b).getTime() - jobDate(a).getTime());
}

function removeVacancyCache() {
  clientVacancyCache = null;
  if (typeof window !== "undefined") window.sessionStorage.removeItem(VACANCY_CACHE_KEY);
}

function readVacancyCache(): VacancyCacheSnapshot | null {
  if (typeof window === "undefined") return null;
  const now = Date.now();
  let snapshot = clientVacancyCache;

  if (!snapshot) {
    try {
      const raw = window.sessionStorage.getItem(VACANCY_CACHE_KEY);
      if (raw) snapshot = JSON.parse(raw) as VacancyCacheSnapshot;
    } catch {
      removeVacancyCache();
      return null;
    }
  }

  if (!snapshot || !Array.isArray(snapshot.jobs) || typeof snapshot.authenticated !== "boolean" || !Number.isFinite(snapshot.dataUpdatedAt) || !Number.isFinite(snapshot.lastAccessedAt)) {
    removeVacancyCache();
    return null;
  }

  if (now - snapshot.lastAccessedAt >= VACANCY_GC_MS) {
    removeVacancyCache();
    return null;
  }

  const touched = { ...snapshot, lastAccessedAt: now };
  clientVacancyCache = touched;
  window.sessionStorage.setItem(VACANCY_CACHE_KEY, JSON.stringify(touched));
  return touched;
}

function writeVacancyCache(dashboard: DashboardData): VacancyCacheSnapshot {
  const now = Date.now();
  const snapshot: VacancyCacheSnapshot = {
    jobs: sortJobsByNewest(dashboard.jobs),
    authenticated: Boolean(dashboard.authenticated),
    dataUpdatedAt: now,
    lastAccessedAt: now,
  };
  clientVacancyCache = snapshot;
  if (typeof window !== "undefined") window.sessionStorage.setItem(VACANCY_CACHE_KEY, JSON.stringify(snapshot));
  return snapshot;
}

function touchVacancyCache() {
  if (typeof window === "undefined") return;
  const snapshot = clientVacancyCache;
  if (!snapshot) return;
  const touched = { ...snapshot, lastAccessedAt: Date.now() };
  clientVacancyCache = touched;
  window.sessionStorage.setItem(VACANCY_CACHE_KEY, JSON.stringify(touched));
}

function readClientVacancyCache() {
  if (typeof window === "undefined" || !clientVacancyCache) return null;
  if (Date.now() - clientVacancyCache.lastAccessedAt >= VACANCY_GC_MS) {
    removeVacancyCache();
    return null;
  }
  return clientVacancyCache;
}

function readVacancyWorkspace(): VacancyWorkspaceSnapshot | null {
  if (typeof window === "undefined") return null;
  if (clientVacancyWorkspace) return clientVacancyWorkspace;
  try {
    const raw = window.sessionStorage.getItem(VACANCY_WORKSPACE_KEY);
    if (!raw) return null;
    const snapshot = JSON.parse(raw) as VacancyWorkspaceSnapshot;
    if (!Array.isArray(snapshot.openTabIds) || !snapshot.openTabIds.every((id) => typeof id === "string") || (snapshot.selectedId !== null && typeof snapshot.selectedId !== "string")) {
      window.sessionStorage.removeItem(VACANCY_WORKSPACE_KEY);
      return null;
    }
    clientVacancyWorkspace = snapshot;
    return snapshot;
  } catch {
    window.sessionStorage.removeItem(VACANCY_WORKSPACE_KEY);
    return null;
  }
}

function readClientVacancyWorkspace() {
  return typeof window === "undefined" ? null : clientVacancyWorkspace;
}

function writeVacancyWorkspace(snapshot: VacancyWorkspaceSnapshot) {
  clientVacancyWorkspace = snapshot;
  if (typeof window !== "undefined") window.sessionStorage.setItem(VACANCY_WORKSPACE_KEY, JSON.stringify(snapshot));
}

function clearVacancyWorkspace() {
  clientVacancyWorkspace = null;
  if (typeof window !== "undefined") window.sessionStorage.removeItem(VACANCY_WORKSPACE_KEY);
}

function prepareVacancyView(viewMode: VacancyViewMode) {
  if (typeof window === "undefined") return;
  const previousView = window.sessionStorage.getItem(VACANCY_VIEW_KEY);
  if (previousView === viewMode) return;
  removeVacancyCache();
  clearVacancyWorkspace();
  window.sessionStorage.setItem(VACANCY_VIEW_KEY, viewMode);
}

function VacancyMultiFilter<T extends string>({ allLabel, className = "", label, onChange, options, selected }: {
  allLabel: string;
  className?: string;
  label: string;
  onChange: (selected: T[]) => void;
  options: Array<{ value: T; label: string }>;
  selected: T[];
}) {
  const toggle = (value: T) => {
    onChange(selected.includes(value) ? selected.filter((item) => item !== value) : [...selected, value]);
  };

  return <div className={`vacancy-multifilter ${className}`.trim()}>
    <details>
      <summary aria-label={`${label}: ${selected.length ? `${selected.length} selected` : "all"}`}>
        <span className="vacancy-filter-summary-label">{label}</span>
        {selected.length > 0 && <span className="vacancy-filter-summary-count">{selected.length}</span>}
        <i className="vacancy-filter-chevron" aria-hidden="true">⌄</i>
      </summary>
      <div className="vacancy-filter-menu">
        <label className={`vacancy-filter-option vacancy-filter-option-all${selected.length === 0 ? " active" : ""}`}>
          <input className="vacancy-filter-option-input" type="checkbox" checked={selected.length === 0} onChange={() => onChange([])}/>
          <i className="vacancy-filter-option-mark" aria-hidden="true">{selected.length === 0 ? "✓" : ""}</i>
          <span>{allLabel}</span>
        </label>
        {options.map((option) => {
          const active = selected.includes(option.value);
          return <label className={`vacancy-filter-option${active ? " active" : ""}`} key={option.value}>
            <input className="vacancy-filter-option-input" type="checkbox" checked={active} onChange={() => toggle(option.value)}/>
            <i className="vacancy-filter-option-mark" aria-hidden="true">{active ? "✓" : ""}</i>
            <span>{option.label}</span>
          </label>;
        })}
      </div>
    </details>
  </div>;
}

function VacancySort({ onChange, options, value }: {
  onChange: (value: JobSort) => void;
  options: Array<{ value: JobSort; label: string }>;
  value: JobSort;
}) {
  const selectedOption = options.find((option) => option.value === value) ?? options[0];
  return <div className="vacancy-multifilter vacancy-condition-filter vacancy-sort-filter">
    <details>
      <summary aria-label={`Sort: ${selectedOption.label}`}>
        <span className="vacancy-filter-summary-label">Sort: {selectedOption.label}</span>
        <i className="vacancy-filter-chevron" aria-hidden="true">⌄</i>
      </summary>
      <div className="vacancy-filter-menu">
        {options.map((option) => {
          const active = option.value === value;
          return <label className={`vacancy-filter-option${active ? " active" : ""}`} key={option.value}>
            <input
              className="vacancy-filter-option-input"
              type="radio"
              name="vacancy-sort"
              checked={active}
              onChange={(event) => {
                onChange(option.value);
                const details = event.currentTarget.closest("details");
                if (details) details.open = false;
              }}
            />
            <i className="vacancy-filter-option-mark" aria-hidden="true">{active ? "✓" : ""}</i>
            <span>{option.label}</span>
          </label>;
        })}
      </div>
    </details>
  </div>;
}

export default function VacanciesWorkspace({ mode }: { mode: VacancyViewMode }) {
  prepareVacancyView(mode);
  const memoryCache = readClientVacancyCache();
  const memoryWorkspace = readClientVacancyWorkspace();
  const [jobs, setJobs] = useState<Job[]>(() => memoryCache?.jobs ?? []);
  const [online, setOnline] = useState<boolean | null>(() => memoryCache ? true : null);
  const [selectedId, setSelectedId] = useState<string | null>(() => memoryWorkspace?.selectedId ?? null);
  const [openTabIds, setOpenTabIds] = useState<string[]>(() => memoryWorkspace?.openTabIds ?? []);
  const [workspaceReady, setWorkspaceReady] = useState(false);
  const [query, setQuery] = useState("");
  const [dateFilter, setDateFilter] = useState("");
  const [statusFilters, setStatusFilters] = useState<JobStatus[]>([]);
  const [conditionFilters, setConditionFilters] = useState<JobCondition[]>([]);
  const [sortOrder, setSortOrder] = useState<JobSort>("NEWEST");
  const [busy, setBusy] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [mobileNav, setMobileNav] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [analyzeProgress, setAnalyzeProgress] = useState<{ done: number; total: number } | null>(null);
  const [analyzeLog, setAnalyzeLog] = useState<string[]>([]);
  const [authenticated, setAuthenticated] = useState<boolean | null>(() => memoryCache?.authenticated ?? null);
  const analyzeCancelRef = useRef(false);
  const isPersonal = mode === "personal" && authenticated === true;
  const viewMode = isPersonal ? "personal" : "public";

  useEffect(() => {
    let active = true;
    let retryTimer: number | undefined;
    const cached = readVacancyCache();
    const workspace = readVacancyWorkspace();

    if (cached) {
      setJobs(cached.jobs);
      setOnline(true);
      setAuthenticated(cached.authenticated);
    }
    if (workspace) {
      setOpenTabIds(workspace.openTabIds);
      setSelectedId(workspace.selectedId);
    }
    setWorkspaceReady(true);

    const loadDashboard = (attempt = 0) => api<DashboardData>("/dashboard")
      .then((result) => {
        if (!active) return;
        const snapshot = writeVacancyCache(result);
        setJobs(snapshot.jobs);
        setOnline(true);
        setAuthenticated(snapshot.authenticated);
      })
      .catch(() => {
        if (!active) return;
        if (attempt < 2) {
          retryTimer = window.setTimeout(() => loadDashboard(attempt + 1), 400);
          return;
        }
        if (cached) {
          setOnline(false);
          setAuthenticated(false);
          return;
        }
        setJobs(DEMO_JOBS);
        setOnline(false);
        // Fail closed: private controls must never appear because the dashboard request failed.
        setAuthenticated(false);
      });

    const shouldRefresh = !cached || Date.now() - cached.dataUpdatedAt >= VACANCY_STALE_MS;
    if (shouldRefresh) void loadDashboard();

    return () => {
      active = false;
      touchVacancyCache();
      if (retryTimer !== undefined) window.clearTimeout(retryTimer);
    };
  }, []);

  useEffect(() => {
    if (!workspaceReady) return;
    writeVacancyWorkspace({ openTabIds, selectedId });
  }, [openTabIds, selectedId, workspaceReady]);

  useEffect(() => {
    if (!workspaceReady || online !== true || jobs.length === 0) return;
    const availableIds = new Set(jobs.map((job) => job.id));
    setOpenTabIds((current) => {
      const next = current.filter((id) => availableIds.has(id));
      return next.length === current.length ? current : next;
    });
    if (selectedId && !availableIds.has(selectedId)) setSelectedId(null);
  }, [jobs, online, selectedId, workspaceReady]);

  useEffect(() => {
    if (!notice) return;
    const timer = window.setTimeout(() => setNotice(null), 3500);
    return () => window.clearTimeout(timer);
  }, [notice]);

  useEffect(() => {
    if (isPersonal) return;
    if (selectedIds.size) setSelectedIds(new Set());
  }, [isPersonal, selectedIds.size]);

  useEffect(() => {
    if (isPersonal || (sortOrder !== "SCORE_HIGH" && sortOrder !== "SCORE_LOW")) return;
    setSortOrder("NEWEST");
  }, [isPersonal, sortOrder]);

  const visibleJobs = useMemo(() => jobs
    .filter((job) => statusFilters.length === 0 || statusFilters.includes(job.status))
    .filter((job) => !dateFilter || jobDateKey(job) === dateFilter)
    .filter((job) => conditionFilters.length === 0 || conditionFilters.some((condition) => matchesCondition(job, condition)))
    .filter((job) => displayText(`${job.title} ${job.company} ${job.location} ${job.source} ${job.salaryText ?? ""}`).toLowerCase().includes(query.toLowerCase()))
    .sort((a, b) => compareJobs(a, b, sortOrder)), [conditionFilters, dateFilter, jobs, query, sortOrder, statusFilters]);

  const selected = visibleJobs.find((job) => job.id === selectedId) ?? jobs.find((job) => job.id === selectedId) ?? null;
  const openTabs = openTabIds
    .map((id) => jobs.find((job) => job.id === id))
    .filter((job): job is Job => Boolean(job));
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
  const sortOptions = isPersonal ? PERSONAL_SORT_OPTIONS : PUBLIC_SORT_OPTIONS;
  const hasActiveFilters = Boolean(query || dateFilter || statusFilters.length || conditionFilters.length);
  const analysisTargetCount = selected ? 1 : selectedIds.size;

  const applyDashboard = (dashboard: DashboardData) => {
    const snapshot = writeVacancyCache(dashboard);
    setJobs(snapshot.jobs);
    setOnline(true);
    setAuthenticated(snapshot.authenticated);
  };

  const clearFilters = () => {
    setQuery("");
    setDateFilter("");
    setStatusFilters([]);
    setConditionFilters([]);
  };

  const openVacancy = (id: string) => {
    setOpenTabIds((current) => openVacancyTab(current, id));
    setSelectedId(id);
  };

  const closeVacancy = (id: string) => {
    const next = closeVacancyTab(openTabIds, selectedId, id);
    setOpenTabIds(next.openIds);
    setSelectedId(next.activeId);
  };

  const sync = async () => {
    if (!isPersonal) return;
    setOpenTabIds([]);
    setSelectedId(null);
    clearVacancyWorkspace();
    setBusy("sync");
    try {
      const result = await api<{ dashboard: DashboardData }>("/sync", "POST", {});
      applyDashboard(result.dashboard);
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

  const analyze = async () => {
    if (!isPersonal) return;
    const targetIds = vacancyAnalysisTargets(selected?.id ?? null, selectedIds);
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
        applyDashboard(result.dashboard);
        const outcome = result.result[0];
        setAnalyzeLog((log) => [...log, outcome
          ? `  ✓ ${label} — score ${formatScore(outcome.score)} (${outcome.verdict}, ${outcome.mode})`
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
    if (!selected) setSelectedIds(new Set());
    setBusy(null);
  };

  const stopAnalyze = () => { analyzeCancelRef.current = true; };

  const adjustResume = async (job: Job) => {
    if (!isPersonal) return;
    setBusy(`resume-${job.id}`);
    try {
      const result = await api<{ dashboard: DashboardData; result: { mode: string } }>("/analyze-resume", "POST", { jobId: job.id });
      applyDashboard(result.dashboard);
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

  const updateTracking = async (job: Job, change: Partial<Pick<Job, "status">>) => {
    if (!isPersonal) return;
    if (!online) return setNotice("Cloud API is unavailable; demo changes are not saved.");
    setBusy(`job-${job.id}`);
    const optimistic = { ...job, ...change };
    setJobs((current) => current.map((item) => item.id === job.id ? optimistic : item));
    try {
      const result = await api<{ dashboard: DashboardData }>(`/jobs/${encodeURIComponent(job.id)}`, "PATCH", change);
      applyDashboard(result.dashboard);
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
        activeSubsection="ALL"
        hideSecondary
        mobileOpen={mobileNav}
        mode={isPersonal ? "personal" : "public"}
        onSelectSubsection={() => setMobileNav(false)}
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
                  : <button className="sync-button" onClick={() => void analyze()} disabled={busy !== null || analysisTargetCount === 0}><Icon name="llm"/><span>{selected ? "Analyze vacancy" : selectedIds.size > 0 ? `Analyze selected (${selectedIds.size})` : "Analyze"}</span></button>}
              </div> : authenticated === true
                ? <a className="signin-link" href="/workspace">Open personal view →</a>
                : <a className="signin-link" href="/workspace/login">Sign in for personal tools →</a>}
            </div>
            {isPersonal ? (
              <div className="stat-line"><Stat value={personalCounts.total} label="Total"/><Stat value={personalCounts.new} label="New"/><Stat value={personalCounts.applied} label="Applied"/><Stat value={personalCounts.interviews} label="Interviews"/></div>
            ) : (
              <div className="stat-line"><Stat value={publicCounts.total} label="Total"/><Stat value={publicCounts.remote} label="Remote"/><Stat value={publicCounts.reservation} label="Бронювання"/></div>
            )}
          </section>

          <nav className="vacancy-tabs" aria-label="Vacancy workspace tabs">
            <div className="vacancy-tab-list" role="tablist">
              <div className={`vacancy-tab-item vacancy-tab-item-board${selectedId === null ? " active" : ""}`}>
                <button
                  type="button"
                  className="vacancy-tab"
                  id="vacancy-tab-board"
                  role="tab"
                  aria-selected={selectedId === null}
                  aria-controls="vacancy-board-panel"
                  onClick={() => setSelectedId(null)}
                  style={{ justifyContent: "center", width: "100%" }}
                ><strong>Dashboard</strong></button>
              </div>
              {openTabs.map((job) => {
                const active = selectedId === job.id;
                const title = displayText(job.title);
                return <div className={`vacancy-tab-item${active ? " active" : ""}`} key={job.id}>
                  <button
                    type="button"
                    className="vacancy-tab vacancy-job-tab"
                    id={`vacancy-tab-${job.id}`}
                    role="tab"
                    aria-selected={active}
                    aria-controls="selected-vacancy-detail"
                    title={`${title} — ${displayText(job.company)}`}
                    onClick={() => setSelectedId(job.id)}
                  ><span className="vacancy-tab-title">{title}</span></button>
                  <button
                    type="button"
                    className="vacancy-tab-close"
                    aria-label={`Close ${title} tab`}
                    onClick={() => closeVacancy(job.id)}
                  ><Icon name="x" size={12}/></button>
                </div>;
              })}
            </div>
          </nav>

          {(online === null || (isPersonal && busy === "sync")) && <div className="analyze-progress vacancy-load-progress" aria-live="polite">
            <div
              className="analyze-progress-bar indeterminate"
              role="progressbar"
              aria-label={busy === "sync" ? "Loading vacancies from job sources" : "Loading vacancies"}
            ><div/></div>
            <div className="analyze-log" role="status">
              <div>{busy === "sync" ? "Loading vacancies from job sources…" : "Loading vacancies from database…"}</div>
            </div>
          </div>}

          {isPersonal && (busy === "analyze" || analyzeLog.length > 0) && <div className="analyze-progress">
            {analyzeProgress && <div className="analyze-progress-bar"><div style={{ width: `${analyzeProgress.total ? Math.round(analyzeProgress.done / analyzeProgress.total * 100) : 0}%` }}/></div>}
            <div className="analyze-log" role="log" aria-live="polite">{analyzeLog.map((line, index) => <div key={index}>{line}</div>)}</div>
          </div>}

          {selected ? <section className="job-detail-view vacancy-detail-tab" id="selected-vacancy-detail" role="tabpanel" aria-labelledby={`vacancy-tab-${selected.id}`}>
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
          </section> : <section className="job-list-view vacancy-list-view" id="vacancy-board-panel" role="tabpanel" aria-labelledby="vacancy-tab-board" aria-busy={online === null || (isPersonal && busy === "sync")}>
            <div className={`feed-tools vacancy-feed-tools vacancy-feed-tools-${viewMode}`}>
              <label className="search vacancy-search"><Icon name="search"/><input aria-label="Search vacancies" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search jobs or companies"/></label>
              <label className="vacancy-date-filter">
                <span>Date</span>
                <input type="date" aria-label="Filter vacancies by posted date" value={dateFilter} onChange={(event) => setDateFilter(event.target.value)}/>
              </label>
              <VacancyMultiFilter
                allLabel="All statuses"
                label="Status"
                onChange={setStatusFilters}
                options={STATUS_OPTIONS}
                selected={statusFilters}
              />
              <VacancyMultiFilter
                allLabel="All conditions"
                className="vacancy-condition-filter"
                label="Conditions"
                onChange={setConditionFilters}
                options={CONDITION_OPTIONS}
                selected={conditionFilters}
              />
              <VacancySort onChange={setSortOrder} options={sortOptions} value={sortOrder}/>
              <button type="button" className="vacancy-clear-filters" onClick={clearFilters} disabled={!hasActiveFilters}>Clear</button>
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
                onClick={() => openVacancy(job.id)}
                onKeyDown={(event) => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); openVacancy(job.id); } }}
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
                {isPersonal && <div className={`vacancy-cell vacancy-match${typeof job.analysis?.score === "number" ? ` has-score score-${scoreTone(job.analysis?.score ?? 0)}` : " no-score"}`} data-label="Match">
                  {typeof job.analysis?.score === "number" ? <><strong>{formatScore(job.analysis?.score ?? 0)}</strong><span>{verdictLabel(job.analysis.verdict)}</span></> : <><strong>—</strong><span>Not analyzed</span></>}
                </div>}
                <time className="vacancy-cell vacancy-posted" data-label="Posted" dateTime={job.postedAt ?? job.discoveredAt} title={formatDate(job.postedAt ?? job.discoveredAt)}>{formatCompactDate(job.postedAt ?? job.discoveredAt)}</time>
                {isPersonal && <div className="vacancy-cell vacancy-status-cell" data-label="Status">
                  <span className={`status status-${job.status.toLowerCase().replace("_", "-")}`}>{statusLabel(job.status)}</span>
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

function JobDetailPanel({ job, disabled, authenticated, onChange }: { job: Job; disabled: boolean; authenticated: boolean; onChange: (change: Partial<Pick<Job, "status">>) => void }) {
  const summaryTags = [
    job.remote ? "Remote" : null,
    job.salaryText ? "Salary listed" : null,
    job.location && !job.remote ? displayText(job.location) : null,
    sourceLabel(job.source) ? sourceLabel(job.source) : null,
  ].filter(Boolean).slice(0, 3);

  return <article className="job-detail">
    <div className="detail-head">
      <div><span>{displayText(job.company)}</span><h2>{displayText(job.title)}</h2><p>{displayText(job.location)}{job.salaryText ? ` · ${job.salaryText}` : ""}</p></div>
      {authenticated && typeof job.analysis?.score === "number" && <div className={`score score-${scoreTone(job.analysis.score)}`}><strong>{formatScore(job.analysis.score)}</strong><span>match</span></div>}
    </div>

    <div className="detail-actions">
      <a href={job.url} target="_blank" rel="noreferrer"><Icon name="external"/>View vacancy</a>
      {job.applyUrl && job.applyUrl !== job.url && <a className="secondary-link" href={job.applyUrl} target="_blank" rel="noreferrer">Apply link</a>}
    </div>
    <div className="job-summary-tags">{hasReservation(job) && <span className="reservation">Бронювання</span>}{summaryTags.map((tag) => <span key={tag}>{tag}</span>)}</div>

    {authenticated && <section className="tracking-box">
      <div><label htmlFor={`status-${job.id}`}>Pipeline status</label><select id={`status-${job.id}`} value={job.status} disabled={disabled} onChange={(event) => onChange({ status: event.target.value as JobStatus })}>{STATUS_OPTIONS.map((status) => <option key={status.value} value={status.value}>{status.label}</option>)}</select></div>
    </section>}

    <dl className="job-facts"><div><dt>Source</dt><dd>{sourceLabel(job.source)}</dd></div><div><dt>Posted</dt><dd>{formatDate(job.postedAt)}</dd></div><div><dt>Found</dt><dd>{formatDate(job.discoveredAt)}</dd></div><div><dt>Remote</dt><dd>{job.remote ? "Yes" : "Not specified"}</dd></div></dl>

    <section className="description"><h3>Vacancy description</h3><p>{displayText(job.description || "No description was collected for this vacancy.")}</p></section>
  </article>;
}

function JobAnalysisPanel({ job }: { job: Job }) {
  if (!job.analysis) return <article className="job-analysis empty-panel"><strong>Not analyzed yet</strong><span>Press Analyze to score this vacancy against the candidate profile.</span></article>;
  const analysis = job.analysis;
  return <article className="job-analysis">
    <div className="section-head"><h3>Analysis</h3>{typeof analysis.score === "number" && <span className={`verdict verdict-${analysis.verdict ?? "weak"}`}>{analysis.verdict} · {formatScore(analysis.score)}</span>}</div>
    {analysis.recommendation && <p className="analysis-recommendation">{analysis.recommendation}</p>}
    {(analysis.matchingSkills?.length || analysis.missingSkills?.length) ? <div className="skills">
      {Boolean(analysis.matchingSkills?.length) && <div><span>Matches</span><p>{analysis.matchingSkills?.map((skill) => <em key={skill}>{skill}</em>)}</p></div>}
      {Boolean(analysis.missingSkills?.length) && <div><span>Gaps</span><p>{analysis.missingSkills?.map((skill) => <em key={skill} className="gap">{skill}</em>)}</p></div>}
    </div> : null}
    {analysis.hardBlockers?.length ? <div className="analysis-blockers"><span>Blockers</span><p>{analysis.hardBlockers.join(" · ")}</p></div> : null}
    {analysis.marketSignals && <dl className="job-facts market-signals">
      <div><dt>Seniority</dt><dd>{analysis.marketSignals.seniority}</dd></div>
      <div><dt>Employment</dt><dd>{analysis.marketSignals.employmentType}</dd></div>
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
