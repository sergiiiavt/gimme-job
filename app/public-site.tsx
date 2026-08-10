"use client";

import { useEffect, useMemo, useState } from "react";

interface PublicJob {
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
}

const modules = [
  { id: "interview", title: "Interview questions", tag: "Knowledge", copy: "Structured notes for QA, automation, APIs, leadership, system design, and behavioural interviews." },
  { id: "certifications", title: "Certifications", tag: "Roadmap", copy: "Practical certification paths across quality, cloud, security, AI, and engineering." },
  { id: "trends", title: "Market trends", tag: "Analysis", copy: "Role demand, recurring skills, tooling signals, salary visibility, and vacancy patterns." },
  { id: "agentic", title: "Agentic lab", tag: "Projects", copy: "Architectures, experiments, and portfolio projects for safe, approval-based agents." },
  { id: "llm", title: "LLM lab", tag: "Projects", copy: "Evaluation patterns, testing techniques, prompt experiments, and LLM product notes." },
  { id: "security", title: "Security lab", tag: "Practice", copy: "Application-security checklists, threat modelling, OWASP topics, and safe labs." },
  { id: "devops", title: "DevOps lab", tag: "Practice", copy: "CI/CD, containers, observability, infrastructure, and reliability projects." },
  { id: "standards", title: "Standards", tag: "Reference", copy: "ISO, IEC, IEEE, testing, quality, security, and compliance references." },
  { id: "news", title: "News", tag: "Digest", copy: "A focused feed for QA, agents, LLM engineering, tooling, and the job market." },
] as const;

function dateLabel(value: string | null) {
  if (!value) return "Recently found";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Recently found";
  return new Intl.DateTimeFormat("en", { day: "numeric", month: "short", year: "numeric" }).format(date);
}

function shortText(value: string) {
  const cleaned = value.replace(/\s+/g, " ").trim();
  return cleaned.length > 190 ? `${cleaned.slice(0, 187)}…` : cleaned;
}

export default function PublicSite() {
  const [jobs, setJobs] = useState<PublicJob[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [query, setQuery] = useState("");

  useEffect(() => {
    let active = true;
    fetch("/api/public/jobs")
      .then(async (response) => {
        if (!response.ok) throw new Error(`Public jobs unavailable: ${response.status}`);
        return response.json() as Promise<{ jobs?: PublicJob[] }>;
      })
      .then((result) => {
        if (active) setJobs(Array.isArray(result.jobs) ? result.jobs : []);
      })
      .catch(() => {
        if (active) setJobs([]);
      })
      .finally(() => {
        if (active) setLoaded(true);
      });
    return () => { active = false; };
  }, []);

  const visibleJobs = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return jobs
      .filter((job) => !needle || `${job.title} ${job.company} ${job.location} ${job.source}`.toLowerCase().includes(needle))
      .slice(0, 30);
  }, [jobs, query]);

  return (
    <main className="public-shell">
      <header className="public-nav">
        <a className="public-logo" href="#top" aria-label="GimmeJob home"><span>GJ</span><strong>GimmeJob</strong></a>
        <nav aria-label="Public navigation">
          <a href="#jobs">Jobs</a>
          <a href="#knowledge">Knowledge</a>
          <a href="#about">About</a>
        </nav>
        <a className="workspace-link" href="/workspace">Private workspace <span aria-hidden="true">→</span></a>
      </header>

      <section className="public-hero" id="top">
        <div className="hero-copy">
          <span className="public-kicker">PUBLIC CAREER ENGINEERING HUB</span>
          <h1>Find better work.<br/><em>Build better systems.</em></h1>
          <p>Curated vacancies, interview knowledge, market signals, and practical labs for QA, AI agents, security, and DevOps.</p>
          <div className="hero-actions"><a href="#jobs">Explore jobs</a><a href="#knowledge">Browse the roadmap</a></div>
        </div>
        <div className="hero-board" aria-label="How GimmeJob works">
          <div><span>01</span><strong>Collect</strong><small>Vacancies from approved sources</small></div>
          <div><span>02</span><strong>Understand</strong><small>Requirements and market patterns</small></div>
          <div><span>03</span><strong>Prepare</strong><small>Knowledge, projects, and CV variants</small></div>
          <div><span>04</span><strong>Apply safely</strong><small>Every send requires approval</small></div>
        </div>
      </section>

      <section className="public-section jobs-showcase" id="jobs">
        <div className="section-heading">
          <div><span className="public-kicker">LIVE DATABASE</span><h2>Newest opportunities</h2><p>Public vacancy data only. Personal tracking, feedback, contacts, analyses, resumes, and drafts stay private.</p></div>
          <label className="public-search"><span aria-hidden="true">⌕</span><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search jobs, companies, locations"/></label>
        </div>

        <div className="public-jobs">
          {loaded && visibleJobs.map((job) => (
            <article className="public-job" key={job.id}>
              <div className="public-job-mark">{job.company.slice(0, 2).toUpperCase()}</div>
              <div className="public-job-copy">
                <div><span>{job.source}</span><time>{dateLabel(job.postedAt ?? job.discoveredAt)}</time></div>
                <h3>{job.title}</h3>
                <p className="job-company">{job.company} · {job.location}</p>
                <p>{shortText(job.description || "Open the original vacancy for full details.")}</p>
                <div className="public-job-meta">{job.remote && <span>Remote</span>}{job.salaryText && <span>{job.salaryText}</span>}</div>
              </div>
              <a href={job.url} target="_blank" rel="noreferrer">Open vacancy <span aria-hidden="true">↗</span></a>
            </article>
          ))}
          {!loaded && <div className="public-empty"><strong>Loading vacancies…</strong><span>Reading the public job database.</span></div>}
          {loaded && visibleJobs.length === 0 && <div className="public-empty"><strong>{jobs.length ? "No matching vacancies" : "The public feed is ready"}</strong><span>{jobs.length ? "Try another search." : "Run the first source sync in the private workspace to publish sanitized vacancies here."}</span></div>}
        </div>
      </section>

      <section className="public-section knowledge-section" id="knowledge">
        <div className="section-heading compact"><div><span className="public-kicker">KNOWLEDGE + LABS</span><h2>A career system, not just a job list</h2><p>The information architecture is ready. Jobs work now; each module can become a searchable knowledge base next.</p></div></div>
        <div className="module-grid">
          {modules.map((module, index) => <article key={module.id} id={module.id}><div><span>{String(index + 1).padStart(2, "0")}</span><em>{module.tag}</em></div><h3>{module.title}</h3><p>{module.copy}</p><small>Planned module</small></article>)}
        </div>
      </section>

      <section className="public-about" id="about">
        <div><span className="public-kicker">DESIGN PRINCIPLES</span><h2>Public knowledge.<br/>Private decisions.</h2></div>
        <div className="principle-grid"><p><strong>Approval first</strong>No application or message is sent without confirmation.</p><p><strong>Useful signals</strong>Vacancies and trends stay focused on the target career path.</p><p><strong>Portable system</strong>Code, CI/CD, and database structure live in the GitHub project.</p></div>
      </section>

      <footer className="public-footer"><a className="public-logo" href="#top"><span>GJ</span><strong>GimmeJob</strong></a><p>Public career engineering hub · Built on Cloudflare</p><a href="/workspace">Open private workspace →</a></footer>
    </main>
  );
}
