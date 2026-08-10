"use client";

import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";

type View = "overview" | "jobs" | "market" | "applications" | "settings";
type Verdict = "strong" | "possible" | "weak" | "reject";
type DraftStatus = "PENDING_APPROVAL" | "APPROVED" | "REJECTED" | "SENT";

interface Analysis {
  score: number;
  verdict: Verdict;
  roleFit: string;
  matchingSkills: string[];
  missingSkills: string[];
  hardBlockers: string[];
  evidence: string[];
  requirements: string[];
  requirementKeywords: string[];
  marketSignals: {
    seniority: string;
    employmentType: string;
    remotePolicy: string;
    salary: string;
    reservation: string;
    language: string;
  };
  recommendation: string;
}

interface Draft {
  id: string;
  jobId: string;
  recipient: string | null;
  subject: string;
  body: string;
  status: DraftStatus;
  approvedAt: string | null;
  sentAt: string | null;
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
  status: string;
  analysis: Analysis | null;
  resume: string | null;
  draft: Draft | null;
}

interface MarketEntry {
  name: string;
  count: number;
}

interface MarketReport {
  totalJobs: number;
  analyzedJobs: number;
  remoteShare: number;
  salaryDisclosureShare: number;
  reservationMentions: number;
  topSources: MarketEntry[];
  topRoles: MarketEntry[];
  topLocations: MarketEntry[];
  topRequirements: MarketEntry[];
  topCandidateGaps: MarketEntry[];
  verdicts: Record<string, number>;
}

interface Connections {
  gmail: { configured: boolean; connected: boolean; enabled: boolean };
  openai: { connected: boolean; model: string };
  boards: { rss: number; greenhouse: number; lever: number; ashby: number };
}

interface DashboardData {
  jobs: Job[];
  market: MarketReport;
  statuses: Record<string, number>;
  connections: Connections;
  generatedAt: string;
}

interface ProfileForm {
  name: string;
  headline: string;
  summary: string;
  targetRoles: string;
  locations: string;
  skills: string;
  email: string;
  phone: string;
  contactLocation: string;
}

function apiBase() {
  if (typeof window !== "undefined" && ["localhost", "127.0.0.1"].includes(window.location.hostname)) {
    return "http://127.0.0.1:4317/api";
  }
  return "/api";
}

const demoAnalysis = (
  score: number,
  verdict: Verdict,
  matches: string[],
  gaps: string[],
): Analysis => ({
  score,
  verdict,
  roleFit: score > 70 ? "Strong title and responsibility alignment." : "Partial role alignment.",
  matchingSkills: matches,
  missingSkills: gaps,
  hardBlockers: [],
  evidence: [`${matches.length} requirements match your profile.`, "Location preference is compatible."],
  requirements: [...matches, ...gaps],
  requirementKeywords: [...matches, ...gaps],
  marketSignals: {
    seniority: score > 75 ? "Senior" : "Middle / Senior",
    employmentType: "Full-time",
    remotePolicy: "Remote mentioned",
    salary: score % 2 ? "Not disclosed" : "$3,500–4,500",
    reservation: "Not mentioned",
    language: "English B2",
  },
  recommendation: score > 70 ? "Review the tailored package and approve if every fact is accurate." : "Keep for market intelligence and review the gaps.",
});

const demoJobs: Job[] = [
  ["j1", "QA Automation Lead", "Northstar Labs", "Remote · Europe", 92, "strong", ["Playwright", "TypeScript", "API testing", "QA leadership"], ["AWS"]],
  ["j2", "Senior QA Engineer", "Orbit Systems", "Kyiv · Hybrid", 84, "strong", ["Python", "Pytest", "SQL", "Mentoring"], ["Performance testing"]],
  ["j3", "Test Engineering Manager", "Vector Health", "Remote · Ukraine", 76, "strong", ["QA leadership", "Test strategy", "API testing"], ["IEC 62304"]],
  ["j4", "SDET — Web Platform", "Brightloop", "Remote", 68, "possible", ["Selenium", "TypeScript", "CI/CD"], ["Kubernetes"]],
  ["j5", "Quality Engineer", "Lumen Works", "Lviv · Hybrid", 57, "possible", ["API testing", "SQL"], ["Java", "Mobile testing"]],
  ["j6", "QA Specialist", "Fieldnote", "Warsaw · On-site", 38, "weak", ["Manual testing"], ["Polish", "Java"]],
].map((entry, index) => {
  const [id, title, company, location, score, verdict, matches, gaps] = entry as [string, string, string, string, number, Verdict, string[], string[]];
  const analysis = demoAnalysis(score, verdict, matches, gaps);
  const draft: Draft | null = score >= 55 ? {
    id: `draft_${id}`,
    jobId: id,
    recipient: index < 2 ? `talent@${company.toLowerCase().replace(/\s/g, "")}.example` : null,
    subject: `Application — ${title}`,
    body: `Hello,\n\nI am applying for the ${title} role at ${company}. My background in ${matches.slice(0, 3).join(", ")} aligns with the core requirements.\n\nI would be glad to discuss the role.\n\nBest regards,\nYour Name`,
    status: index === 1 ? "APPROVED" : "PENDING_APPROVAL",
    approvedAt: index === 1 ? new Date().toISOString() : null,
    sentAt: null,
  } : null;
  return {
    id,
    source: index % 3 === 0 ? "gmail:linkedin" : index % 3 === 1 ? "rss:dou-qa" : "greenhouse:demo",
    title,
    company,
    location,
    remote: location.toLowerCase().includes("remote"),
    url: "https://example.com/job",
    applyUrl: "https://example.com/apply",
    description: `${company} is looking for a ${title}. The role includes test strategy, automation, collaboration with engineers, API quality, and continuous delivery.`,
    salaryText: analysis.marketSignals.salary === "Not disclosed" ? null : analysis.marketSignals.salary,
    postedAt: new Date(Date.now() - index * 86_400_000).toISOString(),
    discoveredAt: new Date(Date.now() - index * 86_400_000).toISOString(),
    status: "REVIEWED",
    analysis,
    resume: `# Your Name\nQA Lead / Test Automation Engineer\n\n## Summary\nQA professional with leadership and automation experience, tailored for ${title}.\n\n## Relevant skills\n${matches.map((skill) => `- ${skill}`).join("\n")}\n\n## Experience\nAdd your verified experience in Settings before sending.`,
    draft,
  };
});

const DEMO: DashboardData = {
  jobs: demoJobs,
  market: {
    totalJobs: 48,
    analyzedJobs: 42,
    remoteShare: 67,
    salaryDisclosureShare: 31,
    reservationMentions: 6,
    topSources: [{ name: "LinkedIn alerts", count: 18 }, { name: "DOU", count: 14 }, { name: "Greenhouse", count: 9 }],
    topRoles: [{ name: "Senior QA Engineer", count: 11 }, { name: "QA Automation", count: 9 }, { name: "QA Lead", count: 7 }],
    topLocations: [{ name: "Remote", count: 32 }, { name: "Kyiv", count: 8 }, { name: "Lviv", count: 4 }],
    topRequirements: [{ name: "API testing", count: 29 }, { name: "TypeScript", count: 24 }, { name: "Playwright", count: 21 }, { name: "SQL", count: 18 }, { name: "CI/CD", count: 15 }, { name: "Python", count: 12 }],
    topCandidateGaps: [{ name: "Kubernetes", count: 8 }, { name: "Performance testing", count: 6 }, { name: "AWS", count: 5 }, { name: "Java", count: 4 }],
    verdicts: { strong: 13, possible: 17, weak: 8, reject: 4 },
  },
  statuses: { PENDING_APPROVAL: 3, APPROVED: 1, REJECTED: 0, SENT: 0 },
  connections: {
    gmail: { configured: false, connected: false, enabled: false },
    openai: { connected: false, model: "gpt-5.6" },
    boards: { rss: 1, greenhouse: 0, lever: 0, ashby: 0 },
  },
  generatedAt: new Date().toISOString(),
};

const defaultProfile: ProfileForm = {
  name: "Your Name",
  headline: "QA Lead / Test Automation Engineer",
  summary: "QA professional with software testing, automation, and leadership experience.",
  targetRoles: "QA Lead\nSenior QA Engineer\nTest Automation Lead",
  locations: "Remote\nUkraine\nKyiv",
  skills: "Playwright\nTypeScript\nPython\nAPI testing\nSQL\nQA leadership",
  email: "",
  phone: "",
  contactLocation: "Ukraine",
};

function Icon({ name, size = 19 }: { name: string; size?: number }) {
  const common = { width: size, height: size, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 1.8, strokeLinecap: "round" as const, strokeLinejoin: "round" as const };
  const paths: Record<string, ReactNode> = {
    home: <><path d="m3 11 9-8 9 8"/><path d="M5 10v10h14V10"/><path d="M9 20v-6h6v6"/></>,
    briefcase: <><rect x="3" y="7" width="18" height="13" rx="2"/><path d="M8 7V5a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2M3 12h18M10 12v2h4v-2"/></>,
    chart: <><path d="M4 20V10M10 20V4M16 20v-7M22 20H2"/></>,
    send: <><path d="m22 2-7 20-4-9-9-4Z"/><path d="M22 2 11 13"/></>,
    settings: <><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .34 1.88l.06.06-2.83 2.83-.06-.06A1.7 1.7 0 0 0 15 19.4a1.7 1.7 0 0 0-1 .6 1.7 1.7 0 0 0-.4 1.1V21H9.6v-.1a1.7 1.7 0 0 0-.4-1.1 1.7 1.7 0 0 0-1-.4 1.7 1.7 0 0 0-1.88.34l-.06.06-2.83-2.83.06-.06A1.7 1.7 0 0 0 3.6 15a1.7 1.7 0 0 0-.6-1 1.7 1.7 0 0 0-1.1-.4H2V9.6h.1A1.7 1.7 0 0 0 3.6 9a1.7 1.7 0 0 0-.34-1.88l-.06-.06 2.83-2.83.06.06A1.7 1.7 0 0 0 8 4.6a1.7 1.7 0 0 0 1-.6 1.7 1.7 0 0 0 .4-1.1V3h4v.1a1.7 1.7 0 0 0 .4 1.1 1.7 1.7 0 0 0 1 .4 1.7 1.7 0 0 0 1.88-.34l.06-.06 2.83 2.83-.06.06A1.7 1.7 0 0 0 19.4 9c.14.4.37.75.7 1 .3.25.68.39 1.1.4h.1v4h-.1a1.7 1.7 0 0 0-1.1.4c-.33.25-.56.6-.7 1Z"/></>,
    search: <><circle cx="11" cy="11" r="7"/><path d="m20 20-4-4"/></>,
    refresh: <><path d="M20 6v5h-5"/><path d="M4 18v-5h5"/><path d="M18 9a7 7 0 0 0-12-3l-2 2M6 15a7 7 0 0 0 12 3l2-2"/></>,
    arrow: <><path d="M5 12h14M13 6l6 6-6 6"/></>,
    check: <path d="m5 12 4 4L19 6"/>,
    x: <><path d="m6 6 12 12M18 6 6 18"/></>,
    spark: <><path d="m12 3 1.4 4.1L17.5 8.5l-4.1 1.4L12 14l-1.4-4.1-4.1-1.4 4.1-1.4Z"/><path d="m19 15 .7 2.3L22 18l-2.3.7L19 21l-.7-2.3L16 18l2.3-.7Z"/></>,
    mail: <><rect x="3" y="5" width="18" height="14" rx="2"/><path d="m3 7 9 6 9-6"/></>,
    link: <><path d="M10 13a5 5 0 0 0 7.5.5l2-2a5 5 0 0 0-7-7l-1.1 1.1"/><path d="M14 11a5 5 0 0 0-7.5-.5l-2 2a5 5 0 0 0 7 7l1.1-1.1"/></>,
    download: <><path d="M12 3v12M7 10l5 5 5-5"/><path d="M4 20h16"/></>,
    upload: <><path d="M12 16V4M7 9l5-5 5 5"/><path d="M4 20h16"/></>,
    chevron: <path d="m9 18 6-6-6-6"/>,
    close: <><path d="m6 6 12 12M18 6 6 18"/></>,
    clock: <><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></>,
  };
  return <svg {...common} aria-hidden="true">{paths[name]}</svg>;
}

function verdictLabel(verdict?: Verdict) {
  return ({ strong: "Strong match", possible: "Worth review", weak: "Low match", reject: "Skip" } as Record<string, string>)[verdict ?? ""] ?? "Not analyzed";
}

function draftLabel(status?: DraftStatus) {
  return ({ PENDING_APPROVAL: "Needs approval", APPROVED: "Approved", REJECTED: "Rejected", SENT: "Sent" } as Record<string, string>)[status ?? ""] ?? "No draft";
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

function relativeDate(value: string | null) {
  if (!value) return "Recently";
  const days = Math.max(0, Math.floor((Date.now() - new Date(value).getTime()) / 86_400_000));
  return days === 0 ? "Today" : days === 1 ? "Yesterday" : `${days}d ago`;
}

async function api<T>(path: string, method = "GET", payload?: unknown): Promise<T> {
  const response = await fetch(`${apiBase()}${path}`, {
    method,
    headers: payload ? { "content-type": "application/json" } : undefined,
    body: payload ? JSON.stringify(payload) : undefined,
  });
  const result = await response.json() as { error?: string } & T;
  if (!response.ok) throw new Error(result.error ?? `Request failed: ${response.status}`);
  return result;
}

export default function Home() {
  const [view, setView] = useState<View>("overview");
  const [data, setData] = useState<DashboardData>(DEMO);
  const [online, setOnline] = useState<boolean | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [detailTab, setDetailTab] = useState<"match" | "resume" | "draft">("match");
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState("all");
  const [busy, setBusy] = useState<string | null>(null);
  const [notice, setNotice] = useState<{ tone: "success" | "error"; text: string } | null>(null);
  const [profile, setProfile] = useState<ProfileForm>(defaultProfile);
  const [profileRaw, setProfileRaw] = useState<Record<string, unknown> | null>(null);
  const [sourcesText, setSourcesText] = useState("");
  const importRef = useRef<HTMLInputElement>(null);

  const load = async (quiet = false) => {
    try {
      const result = await api<DashboardData>("/dashboard");
      setData(result);
      setOnline(true);
      if (!quiet) setNotice({ tone: "success", text: "Dashboard is connected to JobPilot Cloud." });
    } catch {
      setOnline(false);
      setData(DEMO);
      if (!quiet) setNotice({ tone: "error", text: "JobPilot API is unavailable; demo data is shown for now." });
    }
  };

  useEffect(() => {
    let active = true;
    api<DashboardData>("/dashboard")
      .then((result) => {
        if (!active) return;
        setData(result);
        setOnline(true);
      })
      .catch(() => {
        if (!active) return;
        setOnline(false);
        setData(DEMO);
      });
    return () => { active = false; };
  }, []);
  useEffect(() => {
    if (!notice) return;
    const timeout = window.setTimeout(() => setNotice(null), 4200);
    return () => window.clearTimeout(timeout);
  }, [notice]);

  useEffect(() => {
    if (view !== "settings" || !online) return;
    api<{ profile: Record<string, unknown>; sources: Record<string, unknown> }>("/settings")
      .then((result) => {
        const raw = result.profile;
        const contact = (raw.contact ?? {}) as Record<string, unknown>;
        setProfileRaw(raw);
        setProfile({
          name: String(raw.name ?? ""),
          headline: String(raw.headline ?? ""),
          summary: String(raw.summary ?? ""),
          targetRoles: Array.isArray(raw.targetRoles) ? raw.targetRoles.join("\n") : "",
          locations: Array.isArray(raw.locations) ? raw.locations.join("\n") : "",
          skills: Array.isArray(raw.skills) ? raw.skills.join("\n") : "",
          email: String(contact.email ?? ""),
          phone: String(contact.phone ?? ""),
          contactLocation: String(contact.location ?? ""),
        });
        setSourcesText(JSON.stringify(result.sources, null, 2));
      })
      .catch((error: unknown) => setNotice({ tone: "error", text: error instanceof Error ? error.message : String(error) }));
  }, [view, online]);

  const selected = data.jobs.find((job) => job.id === selectedId) ?? null;
  const queue = data.jobs.filter((job) => job.draft && ["PENDING_APPROVAL", "APPROVED"].includes(job.draft.status));
  const filteredJobs = useMemo(() => data.jobs.filter((job) => {
    const text = `${job.title} ${job.company} ${job.location} ${job.source}`.toLowerCase();
    const queryMatch = text.includes(query.toLowerCase());
    const filterMatch = filter === "all"
      || (filter === "strong" && job.analysis?.verdict === "strong")
      || (filter === "remote" && job.remote)
      || (filter === "new" && !job.analysis);
    return queryMatch && filterMatch;
  }), [data.jobs, query, filter]);

  const run = async (key: string, path: string, payload: unknown, success: string) => {
    if (!online) {
      setNotice({ tone: "error", text: "JobPilot API is unavailable." });
      return;
    }
    setBusy(key);
    try {
      const result = await api<{ dashboard?: DashboardData }>(path, "POST", payload);
      if (result.dashboard) setData(result.dashboard);
      else await load(true);
      setNotice({ tone: "success", text: success });
    } catch (error) {
      setNotice({ tone: "error", text: error instanceof Error ? error.message : String(error) });
    } finally {
      setBusy(null);
    }
  };

  const saveProfile = async () => {
    if (!online) return setNotice({ tone: "error", text: "JobPilot API is unavailable." });
    setBusy("profile");
    try {
      const list = (value: string) => value.split(/\n|,/).map((item) => item.trim()).filter(Boolean);
      const next = {
        ...(profileRaw ?? {}),
        name: profile.name,
        headline: profile.headline,
        summary: profile.summary,
        targetRoles: list(profile.targetRoles),
        locations: list(profile.locations),
        skills: list(profile.skills),
        mustHaveSignals: Array.isArray(profileRaw?.mustHaveSignals) ? profileRaw.mustHaveSignals : [],
        preferredSignals: Array.isArray(profileRaw?.preferredSignals) ? profileRaw.preferredSignals : [],
        excludedSignals: Array.isArray(profileRaw?.excludedSignals) ? profileRaw.excludedSignals : [],
        facts: Array.isArray(profileRaw?.facts) ? profileRaw.facts : [profile.summary],
        experience: Array.isArray(profileRaw?.experience) ? profileRaw.experience : [],
        education: Array.isArray(profileRaw?.education) ? profileRaw.education : [],
        links: Array.isArray(profileRaw?.links) ? profileRaw.links : [],
        languages: Array.isArray(profileRaw?.languages) ? profileRaw.languages : [],
        contact: { email: profile.email, phone: profile.phone, location: profile.contactLocation },
      };
      await api("/profile", "PUT", { profile: next });
      setProfileRaw(next);
      setNotice({ tone: "success", text: "Candidate profile saved to your private cloud database." });
    } catch (error) {
      setNotice({ tone: "error", text: error instanceof Error ? error.message : String(error) });
    } finally {
      setBusy(null);
    }
  };

  const saveSources = async () => {
    if (!online) return setNotice({ tone: "error", text: "JobPilot API is unavailable." });
    setBusy("sources");
    try {
      await api("/sources", "PUT", { sources: JSON.parse(sourcesText) });
      await load(true);
      setNotice({ tone: "success", text: "Job sources saved." });
    } catch (error) {
      setNotice({ tone: "error", text: error instanceof Error ? error.message : String(error) });
    } finally {
      setBusy(null);
    }
  };

  const importJobs = async (file: File) => {
    try {
      const parsed = JSON.parse(await file.text()) as unknown;
      const jobs = Array.isArray(parsed) ? parsed : [parsed];
      await run("import", "/import", { jobs }, `${jobs.length} job records imported.`);
    } catch (error) {
      setNotice({ tone: "error", text: error instanceof Error ? error.message : String(error) });
    }
  };

  const downloadResume = (job: Job) => {
    if (!job.resume) return;
    const blob = new Blob([job.resume], { type: "text/markdown;charset=utf-8" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `${job.company}-${job.title}-resume.md`.replace(/[^a-z0-9.-]+/gi, "-");
    link.click();
    URL.revokeObjectURL(link.href);
  };

  const nav: Array<{ id: View; label: string; icon: string; count?: number }> = [
    { id: "overview", label: "Overview", icon: "home" },
    { id: "jobs", label: "Job feed", icon: "briefcase", count: data.jobs.length },
    { id: "market", label: "Market pulse", icon: "chart" },
    { id: "applications", label: "Approval queue", icon: "send", count: queue.length },
    { id: "settings", label: "Connections", icon: "settings" },
  ];

  return (
    <main className="app-shell">
      <aside className="sidebar">
        <div className="brand">
          <div className="brand-mark"><Icon name="spark" size={18}/></div>
          <div><strong>JobPilot</strong><span>cloud agent</span></div>
        </div>
        <nav className="main-nav" aria-label="Main navigation">
          <p className="nav-label">Workspace</p>
          {nav.map((item) => (
            <button key={item.id} className={view === item.id ? "nav-item active" : "nav-item"} onClick={() => setView(item.id)}>
              <Icon name={item.icon}/><span>{item.label}</span>{item.count !== undefined && <em>{item.count}</em>}
            </button>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <div className="agent-state">
            <span className={`state-dot ${online ? "on" : "off"}`}/>
            <div><strong>{online ? "Agent online" : online === null ? "Connecting…" : "Demo mode"}</strong><span>{online ? "Private cloud data" : "API unavailable"}</span></div>
          </div>
          <div className="mini-profile"><span>{profile.name.slice(0, 1) || "Y"}</span><div><strong>{profile.name}</strong><small>{profile.headline.split("/")[0]}</small></div></div>
        </div>
      </aside>

      <section className="workspace">
        <header className="topbar">
          <div className="mobile-brand"><div className="brand-mark"><Icon name="spark" size={17}/></div><strong>JobPilot</strong></div>
          <div className="global-search"><Icon name="search"/><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search jobs, companies, skills…"/><kbd>⌘ K</kbd></div>
          <div className="top-actions">
            <button className="icon-button" onClick={() => void load()} aria-label="Refresh"><Icon name="refresh"/></button>
            <button className="primary-button" disabled={busy !== null} onClick={() => void run("run", "/run", { limit: 25 }, "Scan and analysis complete. Nothing was sent.")}>
              {busy === "run" ? <span className="spinner"/> : <Icon name="spark"/>}<span>Run agent</span>
            </button>
          </div>
        </header>

        {!online && online !== null && <div className="offline-strip"><span>Demo preview</span> The interface is ready, but the private cloud API is currently unavailable.</div>}

        <div className="page-content">
          {view === "overview" && <Overview data={data} jobs={data.jobs} queue={queue} onOpen={(id, tab = "match") => { setSelectedId(id); setDetailTab(tab); }} onView={setView} onRun={() => void run("run", "/run", { limit: 25 }, "New jobs collected and analyzed. Nothing was sent.")} busy={busy === "run"}/>}
          {view === "jobs" && <JobsView jobs={filteredJobs} filter={filter} setFilter={setFilter} onOpen={(id) => { setSelectedId(id); setDetailTab("match"); }} onImport={() => importRef.current?.click()}/>}
          {view === "market" && <MarketView market={data.market}/>}
          {view === "applications" && <ApplicationsView jobs={queue} busy={busy} onOpen={(id) => { setSelectedId(id); setDetailTab("draft"); }} onAction={(job, action) => {
            if (!job.draft) return;
            if (action === "send" && !window.confirm(`Send this approved email to ${job.draft.recipient ?? "the recipient"}?`)) return;
            void run(`${action}-${job.id}`, `/drafts/${encodeURIComponent(job.draft.id)}/${action}`, {}, action === "approve" ? "Application approved. It has not been sent." : action === "reject" ? "Application rejected." : "Application sent through Gmail.");
          }}/>}
          {view === "settings" && <SettingsView profile={profile} setProfile={setProfile} sourcesText={sourcesText} setSourcesText={setSourcesText} connections={data.connections} busy={busy} onSaveProfile={() => void saveProfile()} onSaveSources={() => void saveSources()} onConnectGmail={() => void run("gmail", "/gmail/connect", {}, "Gmail connected locally.")}/>}
        </div>
      </section>

      <input ref={importRef} hidden type="file" accept="application/json,.json" onChange={(event) => { const file = event.target.files?.[0]; if (file) void importJobs(file); event.target.value = ""; }}/>
      {selected && <JobDrawer key={selected.id} job={selected} tab={detailTab} setTab={setDetailTab} busy={busy} close={() => setSelectedId(null)} analyze={() => void run(`analyze-${selected.id}`, "/analyze", { jobId: selected.id }, "Analysis and tailored resume updated.")} download={() => downloadResume(selected)} action={(action, recipient) => {
        if (!selected.draft) return;
        if (action === "send" && !window.confirm(`Send this approved email to ${selected.draft.recipient ?? recipient ?? "the recipient"}?`)) return;
        void run(`${action}-${selected.id}`, `/drafts/${encodeURIComponent(selected.draft.id)}/${action}`, recipient ? { recipient } : {}, action === "approve" ? "Approved. The application is still waiting for you to send it." : action === "reject" ? "Application rejected." : "Application sent through Gmail.");
      }}/>}
      {notice && <div className={`toast ${notice.tone}`}><Icon name={notice.tone === "success" ? "check" : "x"}/><span>{notice.text}</span></div>}
    </main>
  );
}

function PageHeading({ eyebrow, title, copy, action }: { eyebrow: string; title: string; copy: string; action?: ReactNode }) {
  return <div className="page-heading"><div><p>{eyebrow}</p><h1>{title}</h1><span>{copy}</span></div>{action}</div>;
}

function Overview({ data, jobs, queue, onOpen, onView, onRun, busy }: { data: DashboardData; jobs: Job[]; queue: Job[]; onOpen: (id: string, tab?: "match" | "resume" | "draft") => void; onView: (view: View) => void; onRun: () => void; busy: boolean }) {
  const strong = jobs.filter((job) => job.analysis?.verdict === "strong").length;
  const sent = data.statuses.SENT ?? 0;
  return <>
    <PageHeading eyebrow="Monday, 10 August" title="Your job search, under control." copy="The agent finds and analyzes opportunities. You stay in charge of every application." action={<button className="secondary-button" onClick={onRun} disabled={busy}>{busy ? <span className="spinner dark"/> : <Icon name="refresh"/>} Scan sources</button>}/>
    <section className="stat-grid">
      <StatCard label="Opportunities" value={data.market.totalJobs || jobs.length} meta={`${jobs.filter((job) => relativeDate(job.discoveredAt) === "Today").length} added today`} icon="briefcase" tone="ink"/>
      <StatCard label="Strong matches" value={strong || data.market.verdicts.strong || 0} meta="Based on your profile" icon="spark" tone="green"/>
      <StatCard label="Awaiting approval" value={queue.filter((job) => job.draft?.status === "PENDING_APPROVAL").length} meta="Nothing sends automatically" icon="clock" tone="amber"/>
      <StatCard label="Applications sent" value={sent} meta="Tracked in Gmail" icon="send" tone="blue"/>
    </section>
    <section className="overview-grid">
      <div className="panel priority-panel">
        <PanelTitle title="Priority opportunities" copy="Highest-fit roles discovered across your sources" action={<button className="text-button" onClick={() => onView("jobs")}>View all <Icon name="arrow" size={16}/></button>}/>
        <div className="job-list">
          {jobs.slice().sort((a, b) => (b.analysis?.score ?? -1) - (a.analysis?.score ?? -1)).slice(0, 5).map((job) => <JobRow key={job.id} job={job} onClick={() => onOpen(job.id)}/>) }
          {jobs.length === 0 && <EmptyState title="No jobs yet" copy="Scan your configured sources to build the feed."/>}
        </div>
      </div>
      <div className="panel queue-panel">
        <PanelTitle title="Approval queue" copy="Prepared drafts that need your decision" action={<button className="text-button" onClick={() => onView("applications")}>Open queue <Icon name="arrow" size={16}/></button>}/>
        <div className="queue-stack">
          {queue.slice(0, 3).map((job) => <button key={job.id} className="queue-card" onClick={() => onOpen(job.id, "draft")}>
            <div className="company-avatar">{job.company.slice(0, 2).toUpperCase()}</div><div className="queue-copy"><strong>{job.title}</strong><span>{job.company} · {job.draft && draftLabel(job.draft.status)}</span></div><div className={`score-ring ${job.analysis?.verdict ?? "none"}`}>{job.analysis?.score ?? "—"}</div>
          </button>)}
          {queue.length === 0 && <EmptyState title="Queue is clear" copy="Analyzed jobs with a draft will appear here."/>}
        </div>
        {queue.length > 0 && <div className="safety-note"><Icon name="check" size={17}/><span><strong>Approval-first mode</strong> No application is sent until you approve it and press Send.</span></div>}
      </div>
    </section>
    <section className="panel market-preview">
      <PanelTitle title="Market signal" copy={`Patterns from ${data.market.analyzedJobs} analyzed jobs`} action={<button className="text-button" onClick={() => onView("market")}>Full report <Icon name="arrow" size={16}/></button>}/>
      <div className="signal-grid">
        <div className="signal-summary"><span className="signal-kicker">Demand this cycle</span><strong>Automation + API quality</strong><p>These skills appear most often in the roles closest to your profile.</p><div className="signal-pills"><span>{data.market.remoteShare}% remote</span><span>{data.market.salaryDisclosureShare}% show salary</span></div></div>
        <Bars entries={data.market.topRequirements.slice(0, 5)}/>
      </div>
    </section>
  </>;
}

function StatCard({ label, value, meta, icon, tone }: { label: string; value: number; meta: string; icon: string; tone: string }) {
  return <article className="stat-card"><div className={`stat-icon ${tone}`}><Icon name={icon}/></div><div><p>{label}</p><strong>{value}</strong><span>{meta}</span></div></article>;
}

function PanelTitle({ title, copy, action }: { title: string; copy: string; action?: ReactNode }) {
  return <div className="panel-title"><div><h2>{title}</h2><p>{copy}</p></div>{action}</div>;
}

function JobRow({ job, onClick }: { job: Job; onClick: () => void }) {
  return <button className="job-row" onClick={onClick}>
    <div className="company-avatar">{job.company.slice(0, 2).toUpperCase()}</div>
    <div className="job-main"><strong>{job.title}</strong><span>{job.company} · {job.location}</span><div><span className="source-chip">{sourceLabel(job.source)}</span>{job.remote && <span className="remote-chip">Remote</span>}</div></div>
    <div className="job-source-column"><span className="source-chip">{sourceLabel(job.source)}</span></div>
    <div className="job-date">{relativeDate(job.postedAt ?? job.discoveredAt)}</div>
    <div className={`match-badge ${job.analysis?.verdict ?? "none"}`}><strong>{job.analysis?.score ?? "—"}</strong><span>{verdictLabel(job.analysis?.verdict)}</span></div>
    <Icon name="chevron" size={17}/>
  </button>;
}

function JobsView({ jobs, filter, setFilter, onOpen, onImport }: { jobs: Job[]; filter: string; setFilter: (value: string) => void; onOpen: (id: string) => void; onImport: () => void }) {
  return <>
    <PageHeading eyebrow="Unified feed" title="Every opportunity in one place." copy="Deduplicated listings from alerts, job boards, ATS feeds, and manual imports." action={<button className="secondary-button" onClick={onImport}><Icon name="upload"/> Import JSON</button>}/>
    <div className="filter-row"><div className="segmented">{[["all", "All"], ["strong", "Strong matches"], ["remote", "Remote"], ["new", "Not analyzed"]].map(([id, label]) => <button key={id} className={filter === id ? "active" : ""} onClick={() => setFilter(id)}>{label}</button>)}</div><span>{jobs.length} results</span></div>
    <section className="panel jobs-table">
      <div className="table-head"><span>Role</span><span>Source</span><span>Discovered</span><span>Fit</span><span/></div>
      {jobs.map((job) => <JobRow key={job.id} job={job} onClick={() => onOpen(job.id)}/>) }
      {jobs.length === 0 && <EmptyState title="No matching jobs" copy="Try another filter or run a new scan."/>}
    </section>
  </>;
}

function MarketView({ market }: { market: MarketReport }) {
  const maxVerdict = Math.max(...Object.values(market.verdicts), 1);
  return <>
    <PageHeading eyebrow="Market intelligence" title="See what the market is asking for." copy="Requirements, gaps, locations, and working conditions extracted from your job feed."/>
    <section className="stat-grid market-stats">
      <StatCard label="Jobs analyzed" value={market.analyzedJobs} meta={`of ${market.totalJobs} collected`} icon="briefcase" tone="ink"/>
      <StatCard label="Remote roles" value={market.remoteShare} meta="percent of listings" icon="link" tone="green"/>
      <StatCard label="Salary visible" value={market.salaryDisclosureShare} meta="percent of listings" icon="chart" tone="amber"/>
      <StatCard label="Reservation mentioned" value={market.reservationMentions} meta="Ukrainian market signal" icon="check" tone="blue"/>
    </section>
    <section className="market-grid">
      <div className="panel large-chart"><PanelTitle title="Most requested skills" copy="Frequency across analyzed vacancies"/><Bars entries={market.topRequirements.slice(0, 10)} large/></div>
      <div className="panel verdict-chart"><PanelTitle title="Fit distribution" copy="How the market aligns with your profile"/><div className="verdict-bars">{(["strong", "possible", "weak", "reject"] as Verdict[]).map((verdict) => <div key={verdict}><span>{verdictLabel(verdict)}</span><div><i className={verdict} style={{ width: `${((market.verdicts[verdict] ?? 0) / maxVerdict) * 100}%` }}/></div><strong>{market.verdicts[verdict] ?? 0}</strong></div>)}</div></div>
      <div className="panel"><PanelTitle title="Skill gaps" copy="Most common requirements not yet in your profile"/><div className="gap-list">{market.topCandidateGaps.slice(0, 7).map((entry, index) => <div key={entry.name}><span>{index + 1}</span><strong>{entry.name}</strong><em>{entry.count} roles</em></div>)}</div></div>
      <div className="panel"><PanelTitle title="Where opportunities come from" copy="Top sources and locations"/><div className="split-list"><div><span className="mini-title">Sources</span>{market.topSources.slice(0, 5).map((entry) => <p key={entry.name}><strong>{sourceLabel(entry.name)}</strong><em>{entry.count}</em></p>)}</div><div><span className="mini-title">Locations</span>{market.topLocations.slice(0, 5).map((entry) => <p key={entry.name}><strong>{entry.name}</strong><em>{entry.count}</em></p>)}</div></div></div>
    </section>
  </>;
}

function Bars({ entries, large = false }: { entries: MarketEntry[]; large?: boolean }) {
  const max = Math.max(...entries.map((entry) => entry.count), 1);
  return <div className={large ? "bars large" : "bars"}>{entries.map((entry) => <div key={entry.name}><div><span>{entry.name}</span><strong>{entry.count}</strong></div><i><b style={{ width: `${Math.max(6, entry.count / max * 100)}%` }}/></i></div>)}</div>;
}

function ApplicationsView({ jobs, busy, onOpen, onAction }: { jobs: Job[]; busy: string | null; onOpen: (id: string) => void; onAction: (job: Job, action: "approve" | "reject" | "send") => void }) {
  return <>
    <PageHeading eyebrow="Human checkpoint" title="You decide what gets sent." copy="Review the match, factual resume changes, recipient, and draft before approving."/>
    <div className="approval-banner"><Icon name="check"/><div><strong>Two-step send protection is active</strong><span>Approve changes the status only. Send is a separate action and requires Gmail.</span></div></div>
    <section className="approval-list">
      {jobs.map((job) => <article className="approval-card" key={job.id}>
        <button className="approval-main" onClick={() => onOpen(job.id)}><div className="company-avatar large">{job.company.slice(0, 2).toUpperCase()}</div><div><span className="eyebrow">{sourceLabel(job.source)} · {relativeDate(job.discoveredAt)}</span><h2>{job.title}</h2><p>{job.company} · {job.location}</p><div className="skill-row">{job.analysis?.matchingSkills.slice(0, 4).map((skill) => <span key={skill}>{skill}</span>)}</div></div></button>
        <div className="approval-score"><div className={`score-ring large ${job.analysis?.verdict ?? "none"}`}>{job.analysis?.score ?? "—"}</div><span>{verdictLabel(job.analysis?.verdict)}</span></div>
        <div className="approval-status"><span className={`status-pill ${job.draft?.status.toLowerCase()}`}>{draftLabel(job.draft?.status)}</span><small>{job.draft?.recipient ?? "Recipient not set"}</small></div>
        <div className="approval-actions">
          {job.draft?.status === "PENDING_APPROVAL" && <><button className="reject-button" disabled={busy !== null} onClick={() => onAction(job, "reject")}><Icon name="x"/> Reject</button><button className="approve-button" disabled={busy !== null} onClick={() => onAction(job, "approve")}><Icon name="check"/> Approve</button></>}
          {job.draft?.status === "APPROVED" && <button className="send-button" disabled={busy !== null || !job.draft.recipient} onClick={() => onAction(job, "send")}><Icon name="send"/> Send with Gmail</button>}
        </div>
      </article>)}
      {jobs.length === 0 && <div className="panel"><EmptyState title="No applications waiting" copy="Run analysis to create tailored packages for suitable jobs."/></div>}
    </section>
  </>;
}

function SettingsView({ profile, setProfile, sourcesText, setSourcesText, connections, busy, onSaveProfile, onSaveSources, onConnectGmail }: { profile: ProfileForm; setProfile: (value: ProfileForm) => void; sourcesText: string; setSourcesText: (value: string) => void; connections: Connections; busy: string | null; onSaveProfile: () => void; onSaveSources: () => void; onConnectGmail: () => void }) {
  const update = (key: keyof ProfileForm, value: string) => setProfile({ ...profile, [key]: value });
  const boardCount = Object.values(connections.boards).reduce((sum, value) => sum + value, 0);
  return <>
    <PageHeading eyebrow="Setup" title="Connect your search stack." copy="Profile, jobs, analysis, drafts, and approval history stay in your private cloud workspace."/>
    <section className="settings-grid">
      <div className="panel settings-panel">
        <PanelTitle title="Candidate profile" copy="The only facts the agent may use when tailoring your resume"/>
        <div className="form-grid"><label>Full name<input value={profile.name} onChange={(event) => update("name", event.target.value)}/></label><label>Headline<input value={profile.headline} onChange={(event) => update("headline", event.target.value)}/></label><label className="wide">Professional summary<textarea rows={4} value={profile.summary} onChange={(event) => update("summary", event.target.value)}/></label><label>Target roles <small>one per line</small><textarea rows={6} value={profile.targetRoles} onChange={(event) => update("targetRoles", event.target.value)}/></label><label>Preferred locations <small>one per line</small><textarea rows={6} value={profile.locations} onChange={(event) => update("locations", event.target.value)}/></label><label className="wide">Verified skills <small>one per line</small><textarea rows={7} value={profile.skills} onChange={(event) => update("skills", event.target.value)}/></label><label>Email<input value={profile.email} onChange={(event) => update("email", event.target.value)}/></label><label>Location<input value={profile.contactLocation} onChange={(event) => update("contactLocation", event.target.value)}/></label></div>
        <div className="panel-footer"><span>Keep achievements and work history factual in <code>config/profile.json</code>.</span><button className="primary-button" disabled={busy !== null} onClick={onSaveProfile}>{busy === "profile" ? <span className="spinner"/> : <Icon name="check"/>} Save profile</button></div>
      </div>
      <div className="settings-side">
        <div className="panel connections-panel"><PanelTitle title="Connections" copy="Private cloud credentials and data sources"/>
          <Connection icon="mail" title="Gmail" copy={connections.gmail.connected ? "Connected for alerts and approved sends" : connections.gmail.configured ? "Credentials ready — finish OAuth" : "Available after the first cloud deployment"} connected={connections.gmail.connected} action={!connections.gmail.connected ? <button onClick={onConnectGmail} disabled={busy !== null}>Connect</button> : undefined}/>
          <Connection icon="spark" title="OpenAI" copy={connections.openai.connected ? `Agent analysis · ${connections.openai.model}` : "Deterministic analysis is active"} connected={connections.openai.connected}/>
          <Connection icon="briefcase" title="Job sources" copy={`${boardCount} direct feeds · LinkedIn/Djinni/Work.ua via Gmail alerts`} connected={boardCount > 0}/>
        </div>
        <div className="panel source-editor"><PanelTitle title="Source configuration" copy="RSS, Greenhouse, Lever, Ashby, Gmail, and manual files"/><textarea spellCheck={false} value={sourcesText} onChange={(event) => setSourcesText(event.target.value)} placeholder="Loading local source configuration…"/><button className="secondary-button full" disabled={busy !== null || !sourcesText} onClick={onSaveSources}>{busy === "sources" ? <span className="spinner dark"/> : <Icon name="check"/>} Save sources</button></div>
      </div>
    </section>
  </>;
}

function Connection({ icon, title, copy, connected, action }: { icon: string; title: string; copy: string; connected: boolean; action?: ReactNode }) {
  return <div className="connection"><div className="connection-icon"><Icon name={icon}/></div><div><strong>{title}</strong><span>{copy}</span></div><em className={connected ? "connected" : "pending"}>{connected ? "Ready" : "Setup"}</em>{action}</div>;
}

function JobDrawer({ job, tab, setTab, busy, close, analyze, download, action }: { job: Job; tab: "match" | "resume" | "draft"; setTab: (tab: "match" | "resume" | "draft") => void; busy: string | null; close: () => void; analyze: () => void; download: () => void; action: (action: "approve" | "reject" | "send", recipient?: string) => void }) {
  const [recipient, setRecipient] = useState(job.draft?.recipient ?? "");
  return <div className="drawer-layer" role="dialog" aria-modal="true" aria-label={`${job.title} details`}>
    <button className="drawer-backdrop" onClick={close} aria-label="Close details"/>
    <aside className="drawer">
      <header className="drawer-header"><div className="company-avatar large">{job.company.slice(0, 2).toUpperCase()}</div><div><span>{sourceLabel(job.source)} · {relativeDate(job.discoveredAt)}</span><h2>{job.title}</h2><p>{job.company} · {job.location}</p></div><button className="icon-button" onClick={close}><Icon name="close"/></button></header>
      <div className="drawer-summary"><div className={`score-ring xlarge ${job.analysis?.verdict ?? "none"}`}>{job.analysis?.score ?? "—"}</div><div><strong>{verdictLabel(job.analysis?.verdict)}</strong><span>{job.analysis?.roleFit ?? "Run analysis to calculate fit."}</span></div><a href={job.url} target="_blank" rel="noreferrer">Original listing <Icon name="link" size={15}/></a></div>
      <nav className="drawer-tabs">{[["match", "Match analysis"], ["resume", "Tailored resume"], ["draft", "Application draft"]].map(([id, label]) => <button key={id} className={tab === id ? "active" : ""} onClick={() => setTab(id as typeof tab)}>{label}</button>)}</nav>
      <div className="drawer-body">
        {tab === "match" && <MatchTab job={job}/>}
        {tab === "resume" && <div className="resume-view"><div className="section-heading"><div><h3>Truth-preserving resume</h3><p>Reordered and emphasized for this role; no invented facts.</p></div><button className="secondary-button small" onClick={download} disabled={!job.resume}><Icon name="download"/> Download .md</button></div>{job.resume ? <pre>{job.resume}</pre> : <EmptyState title="No tailored resume yet" copy="Run analysis to create one from your candidate profile."/>}</div>}
        {tab === "draft" && <div className="draft-view">{job.draft ? <><label>Recipient<input value={recipient} onChange={(event) => setRecipient(event.target.value)} placeholder="recruiter@company.com"/></label><label>Subject<input value={job.draft.subject} readOnly/></label><label>Message<textarea value={job.draft.body} readOnly rows={13}/></label><div className="draft-state"><span className={`status-pill ${job.draft.status.toLowerCase()}`}>{draftLabel(job.draft.status)}</span><p>Approval and sending are always separate actions.</p></div></> : <EmptyState title="No application draft" copy="Run analysis to prepare a factual, role-specific message."/>}</div>}
      </div>
      <footer className="drawer-footer">
        <button className="secondary-button" onClick={analyze} disabled={busy !== null}>{busy === `analyze-${job.id}` ? <span className="spinner dark"/> : <Icon name="spark"/>} {job.analysis ? "Re-analyze" : "Analyze & tailor"}</button>
        <div className="drawer-actions">{job.draft?.status === "PENDING_APPROVAL" && <><button className="reject-button" disabled={busy !== null} onClick={() => action("reject")}><Icon name="x"/> Reject</button><button className="approve-button" disabled={busy !== null} onClick={() => action("approve", recipient)}><Icon name="check"/> Approve</button></>}{job.draft?.status === "APPROVED" && <button className="send-button" disabled={busy !== null || !recipient} onClick={() => action("send", recipient)}><Icon name="send"/> Send with Gmail</button>}</div>
      </footer>
    </aside>
  </div>;
}

function MatchTab({ job }: { job: Job }) {
  const analysis = job.analysis;
  if (!analysis) return <EmptyState title="Not analyzed yet" copy="Run analysis to compare this role with your profile."/>;
  return <div className="match-view"><div className="recommendation"><Icon name="spark"/><div><strong>Agent recommendation</strong><p>{analysis.recommendation}</p></div></div><div className="match-columns"><div><h3><span className="dot good"/> Matching evidence</h3>{analysis.matchingSkills.length ? <ul>{analysis.matchingSkills.map((skill) => <li key={skill}><Icon name="check" size={15}/>{skill}</li>)}</ul> : <p className="muted">No explicit matches detected.</p>}</div><div><h3><span className="dot gap"/> Gaps to review</h3>{analysis.missingSkills.length ? <ul className="gaps">{analysis.missingSkills.map((skill) => <li key={skill}><Icon name="x" size={15}/>{skill}</li>)}</ul> : <p className="muted">No major skill gaps detected.</p>}</div></div><div className="signals"><h3>Role signals</h3><div>{Object.entries(analysis.marketSignals).map(([key, value]) => <p key={key}><span>{key.replace(/([A-Z])/g, " $1")}</span><strong>{value}</strong></p>)}</div></div><div className="description"><h3>Vacancy excerpt</h3><p>{job.description.slice(0, 1200) || "No description was collected."}</p></div></div>;
}

function EmptyState({ title, copy }: { title: string; copy: string }) {
  return <div className="empty-state"><div><Icon name="briefcase"/></div><strong>{title}</strong><p>{copy}</p></div>;
}
