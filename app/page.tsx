"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";

type Section = "jobs" | "interview" | "certifications" | "trends" | "agentic" | "llm" | "news";
type JobStatus = "NEW" | "INTERESTED" | "APPLIED" | "INTERVIEW" | "OFFER" | "REJECTED" | "NOT_INTERESTED" | "ARCHIVED";
type JobFeedback = "RELEVANT" | "NOT_RELEVANT" | null;

interface JobAnalysis {
  score?: number;
  verdict?: string;
  matchingSkills?: string[];
  missingSkills?: string[];
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
}

interface DashboardData {
  jobs: Job[];
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
  },
  {
    id: "demo-3",
    source: "greenhouse:demo",
    title: "Senior Quality Engineer",
    company: "Vector Health",
    location: "Remote · Ukraine",
    remote: true,
    url: "https://example.com/job",
    applyUrl: "https://example.com/apply",
    description: "Own risk-based testing across web applications and APIs in a regulated product team.",
    salaryText: null,
    postedAt: new Date(Date.now() - 2 * 86_400_000).toISOString(),
    discoveredAt: new Date(Date.now() - 2 * 86_400_000).toISOString(),
    status: "APPLIED",
    feedback: "RELEVANT",
    analysis: { score: 76, verdict: "strong", matchingSkills: ["API testing", "Test strategy"], missingSkills: ["IEC 62304"] },
  },
];

function apiBase() {
  if (typeof window !== "undefined" && ["localhost", "127.0.0.1"].includes(window.location.hostname)) return "http://127.0.0.1:4317/api";
  return "/api";
}

async function api<T>(path: string, method = "GET", payload?: unknown): Promise<T> {
  const response = await fetch(`${apiBase()}${path}`, {
    method,
    headers: payload !== undefined ? { "content-type": "application/json" } : undefined,
    body: payload !== undefined ? JSON.stringify(payload) : undefined,
  });
  const result = await response.json() as T & { error?: string };
  if (!response.ok) throw new Error(result.error ?? `Request failed: ${response.status}`);
  return result;
}

function Icon({ name, size = 18 }: { name: string; size?: number }) {
  const paths: Record<string, ReactNode> = {
    jobs: <><rect x="3" y="7" width="18" height="13" rx="2"/><path d="M8 7V5a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2M3 12h18"/></>,
    interview: <><path d="M21 15a4 4 0 0 1-4 4H8l-5 3V7a4 4 0 0 1 4-4h10a4 4 0 0 1 4 4Z"/><path d="M8 9h8M8 13h5"/></>,
    certifications: <><circle cx="12" cy="9" r="6"/><path d="m8.5 14-1 8 4.5-3 4.5 3-1-8"/><path d="m10 9 1.3 1.3L14.5 7"/></>,
    trends: <><path d="M4 19V9M10 19V5M16 19v-7M22 19H2"/></>,
    agentic: <><circle cx="12" cy="12" r="3"/><path d="M19 12h3M2 12h3M12 2v3M12 19v3M17 7l2-2M5 19l2-2M17 17l2 2M5 5l2 2"/></>,
    llm: <><path d="M12 2a4 4 0 0 1 4 4v1a4 4 0 0 1 0 8v1a4 4 0 0 1-8 0v-1a4 4 0 0 1 0-8V6a4 4 0 0 1 4-4Z"/><path d="M8 8h8M8 14h8M12 5v14"/></>,
    news: <><path d="M4 4h16v16H4z"/><path d="M8 8h4v4H8zM15 8h2M15 11h2M8 15h9M8 18h9"/></>,
    search: <><circle cx="11" cy="11" r="7"/><path d="m20 20-4-4"/></>,
    sync: <><path d="M20 6v5h-5M4 18v-5h5"/><path d="M18 9a7 7 0 0 0-12-3L4 8M6 15a7 7 0 0 0 12 3l2-2"/></>,
    external: <><path d="M14 3h7v7M10 14 21 3"/><path d="M21 14v5a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5"/></>,
    check: <path d="m5 12 4 4L19 6"/>,
    x: <path d="m6 6 12 12M18 6 6 18"/>,
    clock: <><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></>,
    menu: <><path d="M4 7h16M4 12h16M4 17h16"/></>,
  };
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{paths[name]}</svg>;
}

function sourceLabel(source: string) {
  if (source.includes("linkedin")) return "LinkedIn";
  if (source.includes("dou")) return "DOU";
  if (source.includes("djinni")) return "Djinni";
  if (source.includes("workua")) return "Work.ua";
  if (source.includes("greenhouse")) return "Greenhouse";
  if (source.includes("lever")) return "Lever";
  if (source.includes("ashby")) return "Ashby";
  return source.replace(/^\w+:/, "");
}

function jobDate(job: Job) {
  return new Date(job.postedAt ?? job.discoveredAt);
}

function formatDate(value: string | null) {
  if (!value) return "Unknown";
  return new Intl.DateTimeFormat("en", { day: "numeric", month: "short", year: "numeric" }).format(new Date(value));
}

function statusLabel(status: JobStatus) {
  return STATUS_OPTIONS.find((item) => item.value === status)?.label ?? status;
}

export default function Home() {
  const [section, setSection] = useState<Section>("jobs");
  const [jobs, setJobs] = useState<Job[]>(DEMO_JOBS);
  const [online, setOnline] = useState<boolean | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<JobStatus | "ALL">("ALL");
  const [busy, setBusy] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [mobileNav, setMobileNav] = useState(false);

  useEffect(() => {
    let active = true;
    api<DashboardData>("/dashboard")
      .then((result) => {
        if (!active) return;
        setJobs(result.jobs);
        setOnline(true);
        setSelectedId(result.jobs[0]?.id ?? null);
      })
      .catch(() => {
        if (!active) return;
        setJobs(DEMO_JOBS);
        setOnline(false);
        setSelectedId(DEMO_JOBS[0].id);
      });
    return () => { active = false; };
  }, []);
  useEffect(() => {
    if (!notice) return;
    const timer = window.setTimeout(() => setNotice(null), 3500);
    return () => window.clearTimeout(timer);
  }, [notice]);

  const visibleJobs = useMemo(() => jobs
    .filter((job) => statusFilter === "ALL" || job.status === statusFilter)
    .filter((job) => `${job.title} ${job.company} ${job.location} ${job.source}`.toLowerCase().includes(query.toLowerCase()))
    .sort((a, b) => jobDate(b).getTime() - jobDate(a).getTime()), [jobs, query, statusFilter]);

  const selected = jobs.find((job) => job.id === selectedId) ?? visibleJobs[0] ?? null;
  const counts = {
    total: jobs.length,
    new: jobs.filter((job) => job.status === "NEW").length,
    applied: jobs.filter((job) => job.status === "APPLIED").length,
    interviews: jobs.filter((job) => job.status === "INTERVIEW").length,
  };

  const sync = async () => {
    if (!online) return setNotice("Cloud API is unavailable; demo data cannot be synced.");
    setBusy("sync");
    try {
      const result = await api<{ dashboard: DashboardData }>("/sync", "POST", {});
      setJobs(result.dashboard.jobs);
      setNotice("Job sources synced. Nothing was sent.");
    } catch (error) {
      setNotice(error instanceof Error ? error.message : String(error));
    } finally { setBusy(null); }
  };

  const updateTracking = async (job: Job, change: { status?: JobStatus; feedback?: JobFeedback }) => {
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

  const navigation: Array<{ id: Section; label: string; icon: string; note?: string }> = [
    { id: "jobs", label: "Jobs", icon: "jobs" },
    { id: "interview", label: "Interview questions", icon: "interview", note: "Soon" },
    { id: "certifications", label: "Certifications", icon: "certifications", note: "Soon" },
    { id: "trends", label: "Trends", icon: "trends", note: "Soon" },
    { id: "agentic", label: "Agentic lab", icon: "agentic", note: "Soon" },
    { id: "llm", label: "LLM lab", icon: "llm", note: "Soon" },
    { id: "news", label: "News", icon: "news", note: "Soon" },
  ];

  return (
    <main className="shell">
      <aside className={mobileNav ? "sidebar open" : "sidebar"}>
        <div className="brand"><span>GJ</span><div><strong>GimmeJob</strong><small>personal workspace</small></div></div>
        <nav aria-label="Workspace sections">
          {navigation.map((item) => <button key={item.id} className={section === item.id ? "nav-item active" : "nav-item"} onClick={() => { setSection(item.id); setMobileNav(false); }}>
            <Icon name={item.icon}/><span>{item.label}</span>{item.note && <em>{item.note}</em>}
          </button>)}
        </nav>
        <div className="cloud-state"><i className={online ? "online" : ""}/><div><strong>{online ? "Cloud database" : online === null ? "Connecting" : "Demo mode"}</strong><span>{online ? "All changes are saved" : "No changes are stored"}</span></div></div>
      </aside>

      <section className="workspace">
        <header className="topbar">
          <button className="mobile-menu" onClick={() => setMobileNav((value) => !value)} aria-label="Toggle navigation"><Icon name="menu"/></button>
          <div><strong>{navigation.find((item) => item.id === section)?.label}</strong><span>{section === "jobs" ? "Your job search database" : "Knowledge base"}</span></div>
          {section === "jobs" && <button className="sync-button" onClick={() => void sync()} disabled={busy !== null}><Icon name="sync"/><span>{busy === "sync" ? "Syncing…" : "Sync jobs"}</span></button>}
        </header>

        {section === "jobs" ? <div className="jobs-page">
          <section className="page-intro">
            <div><span className="eyebrow">JOB PIPELINE</span><h1>Opportunities, without the noise.</h1><p>Newest jobs first. Track every decision and teach the future agent what is relevant.</p></div>
            <div className="stat-line"><Stat value={counts.total} label="Total"/><Stat value={counts.new} label="New"/><Stat value={counts.applied} label="Applied"/><Stat value={counts.interviews} label="Interviews"/></div>
          </section>

          <section className="job-workbench">
            <div className="feed-panel">
              <div className="feed-tools">
                <label className="search"><Icon name="search"/><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search jobs or companies"/></label>
                <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value as JobStatus | "ALL")} aria-label="Filter by status">
                  <option value="ALL">All statuses</option>
                  {STATUS_OPTIONS.map((status) => <option key={status.value} value={status.value}>{status.label}</option>)}
                </select>
              </div>
              <div className="feed-meta"><span>{visibleJobs.length} jobs</span><span>Newest first</span></div>
              <div className="job-feed">
                {visibleJobs.map((job) => <button key={job.id} className={selected?.id === job.id ? "job-card selected" : "job-card"} onClick={() => setSelectedId(job.id)}>
                  <div className="company-mark">{job.company.slice(0, 2).toUpperCase()}</div>
                  <div className="job-copy"><div><strong>{job.title}</strong><time>{formatDate(job.postedAt ?? job.discoveredAt)}</time></div><p>{job.company} · {job.location}</p><div className="chips"><span>{sourceLabel(job.source)}</span>{job.remote && <span>Remote</span>}{job.feedback === "RELEVANT" && <span className="good">Relevant</span>}{job.feedback === "NOT_RELEVANT" && <span className="bad">Not relevant</span>}</div></div>
                  <span className={`status status-${job.status.toLowerCase().replace("_", "-")}`}>{statusLabel(job.status)}</span>
                </button>)}
                {visibleJobs.length === 0 && <div className="empty"><strong>No matching jobs</strong><span>Change the search or status filter.</span></div>}
              </div>
            </div>

            <div className="detail-panel">
              {selected ? <JobDetail job={selected} disabled={busy === `job-${selected.id}`} onChange={(change) => void updateTracking(selected, change)}/> : <div className="empty large"><strong>Select a job</strong><span>The vacancy details and tracking controls will appear here.</span></div>}
            </div>
          </section>
        </div> : <ComingSoon section={section}/>}
      </section>

      {mobileNav && <button className="backdrop" onClick={() => setMobileNav(false)} aria-label="Close navigation"/>}
      {notice && <div className="toast">{notice}</div>}
    </main>
  );
}

function Stat({ value, label }: { value: number; label: string }) {
  return <div><strong>{value}</strong><span>{label}</span></div>;
}

function JobDetail({ job, disabled, onChange }: { job: Job; disabled: boolean; onChange: (change: { status?: JobStatus; feedback?: JobFeedback }) => void }) {
  return <article className="job-detail">
    <div className="detail-head">
      <div className="company-mark large">{job.company.slice(0, 2).toUpperCase()}</div>
      <div><span>{job.company}</span><h2>{job.title}</h2><p>{job.location}{job.salaryText ? ` · ${job.salaryText}` : ""}</p></div>
      {typeof job.analysis?.score === "number" && <div className="score"><strong>{job.analysis.score}</strong><span>match</span></div>}
    </div>

    <div className="detail-actions">
      <a href={job.url} target="_blank" rel="noreferrer"><Icon name="external"/>View vacancy</a>
      {job.applyUrl && job.applyUrl !== job.url && <a className="secondary-link" href={job.applyUrl} target="_blank" rel="noreferrer">Apply link</a>}
    </div>

    <section className="tracking-box">
      <div><label htmlFor={`status-${job.id}`}>Pipeline status</label><select id={`status-${job.id}`} value={job.status} disabled={disabled} onChange={(event) => onChange({ status: event.target.value as JobStatus })}>{STATUS_OPTIONS.map((status) => <option key={status.value} value={status.value}>{status.label}</option>)}</select></div>
      <div><label>Feedback for the agent</label><div className="feedback-buttons">
        <button className={job.feedback === "RELEVANT" ? "active positive" : ""} disabled={disabled} onClick={() => onChange({ feedback: job.feedback === "RELEVANT" ? null : "RELEVANT" })}><Icon name="check"/>Relevant</button>
        <button className={job.feedback === "NOT_RELEVANT" ? "active negative" : ""} disabled={disabled} onClick={() => onChange({ feedback: job.feedback === "NOT_RELEVANT" ? null : "NOT_RELEVANT" })}><Icon name="x"/>Not relevant</button>
      </div></div>
    </section>

    <dl className="job-facts"><div><dt>Source</dt><dd>{sourceLabel(job.source)}</dd></div><div><dt>Posted</dt><dd>{formatDate(job.postedAt)}</dd></div><div><dt>Found</dt><dd>{formatDate(job.discoveredAt)}</dd></div><div><dt>Remote</dt><dd>{job.remote ? "Yes" : "Not specified"}</dd></div></dl>

    {(job.analysis?.matchingSkills?.length || job.analysis?.missingSkills?.length) && <section className="skills"><h3>Quick match</h3>{Boolean(job.analysis?.matchingSkills?.length) && <div><span>Matches</span><p>{job.analysis?.matchingSkills?.map((skill) => <em key={skill}>{skill}</em>)}</p></div>}{Boolean(job.analysis?.missingSkills?.length) && <div><span>Gaps</span><p>{job.analysis?.missingSkills?.map((skill) => <em key={skill} className="gap">{skill}</em>)}</p></div>}</section>}

    <section className="description"><h3>Vacancy description</h3><p>{job.description || "No description was collected for this vacancy."}</p></section>
  </article>;
}

function ComingSoon({ section }: { section: Exclude<Section, "jobs"> }) {
  const content = {
    interview: ["Interview questions", "A structured knowledge base for QA, leadership, automation, APIs, databases, system design, and behavioural interviews."],
    certifications: ["Certifications", "A practical roadmap for relevant QA, cloud, security, AI, and engineering certifications, with priorities and progress tracking."],
    trends: ["Market trends", "Skills, tools, role demand, salary signals, and patterns extracted from collected vacancies and resume versions."],
    agentic: ["Agentic lab", "Notes, architectures, experiments, and small portfolio projects built around autonomous agents."],
    llm: ["LLM lab", "Knowledge, evaluation patterns, testing techniques, prompts, and pet projects for LLM-based products."],
    news: ["News", "A focused feed of useful QA, agentic engineering, LLM, tooling, and job-market updates without general tech noise."],
  } as const;
  const [title, copy] = content[section];
  return <div className="coming-soon"><span>PLANNED MODULE</span><h1>{title}</h1><p>{copy}</p><div><Icon name="clock"/><strong>Next iteration</strong><small>The navigation is ready; content and editing will be added after the Jobs workflow is stable.</small></div></div>;
}
