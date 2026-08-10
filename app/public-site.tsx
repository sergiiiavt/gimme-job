"use client";

import { useEffect, useMemo, useState } from "react";

type PublicSection = "jobs" | "interview" | "certifications" | "trends" | "agentic" | "llm" | "security" | "devops" | "standards" | "news";

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

const navigation: Array<{ label: string; items: Array<{ id: PublicSection; label: string; marker: string }> }> = [
  {
    label: "Career",
    items: [
      { id: "jobs", label: "Jobs", marker: "J" },
      { id: "interview", label: "Interview questions", marker: "Q" },
      { id: "certifications", label: "Certifications", marker: "C" },
      { id: "trends", label: "Market trends", marker: "T" },
    ],
  },
  {
    label: "Engineering labs",
    items: [
      { id: "agentic", label: "Agentic lab", marker: "A" },
      { id: "llm", label: "LLM lab", marker: "L" },
      { id: "security", label: "Security lab", marker: "S" },
      { id: "devops", label: "DevOps lab", marker: "D" },
    ],
  },
  {
    label: "Reference",
    items: [
      { id: "standards", label: "Standards", marker: "I" },
      { id: "news", label: "News", marker: "N" },
    ],
  },
];

const knowledge: Record<Exclude<PublicSection, "jobs">, {
  title: string;
  description: string;
  items: Array<{ title: string; copy: string; tags: string[] }>;
}> = {
  interview: {
    title: "Interview questions",
    description: "Structured preparation notes for technical, leadership, and behavioural interviews.",
    items: [
      { title: "QA leadership", copy: "Team coordination, mentoring, quality ownership, conflict handling, and stakeholder communication.", tags: ["Lead", "People"] },
      { title: "Test strategy", copy: "Risk-based testing, coverage, release criteria, metrics, and practical quality planning.", tags: ["Strategy", "Risk"] },
      { title: "Automation", copy: "Framework design, Playwright, Selenium, Pytest, maintainability, and CI execution.", tags: ["TypeScript", "Python"] },
      { title: "API and databases", copy: "HTTP, contracts, authentication, integration testing, SQL, and data validation.", tags: ["API", "SQL"] },
      { title: "System design", copy: "Testability, distributed systems, queues, caching, observability, and failure modes.", tags: ["Architecture"] },
      { title: "Behavioural questions", copy: "Project examples, difficult decisions, failures, improvements, and measurable outcomes.", tags: ["STAR", "Communication"] },
    ],
  },
  certifications: {
    title: "Certifications",
    description: "A practical map of certifications worth evaluating for QA leadership, cloud, security, and AI work.",
    items: [
      { title: "ISTQB", copy: "Testing foundations, advanced test management, automation, and specialist tracks.", tags: ["QA"] },
      { title: "Cloud", copy: "Azure and AWS fundamentals before role-specific engineering certifications.", tags: ["Azure", "AWS"] },
      { title: "Security", copy: "Application security, cloud security, and security-testing foundations.", tags: ["Security"] },
      { title: "AI engineering", copy: "Model, data, evaluation, and responsible-AI certification paths.", tags: ["AI", "LLM"] },
    ],
  },
  trends: {
    title: "Market trends",
    description: "Patterns collected from vacancies, requirements, tools, and role descriptions.",
    items: [
      { title: "Role demand", copy: "Track recurring QA Lead, Test Automation Lead, Senior QA, and Quality Engineering roles.", tags: ["Roles"] },
      { title: "Skills and tools", copy: "Compare automation stacks, cloud platforms, AI expectations, and leadership requirements.", tags: ["Skills"] },
      { title: "Salary signals", copy: "Measure salary disclosure, location differences, and seniority signals when data is available.", tags: ["Salary"] },
      { title: "Resume signals", copy: "Connect common requirements to verified experience and identify useful learning gaps.", tags: ["Resume"] },
    ],
  },
  agentic: {
    title: "Agentic lab",
    description: "Notes and small projects for building agents that act through tools with explicit approval gates.",
    items: [
      { title: "Tools and actions", copy: "Typed tools, validation, permissions, retries, and safe external actions.", tags: ["Tools"] },
      { title: "State and memory", copy: "Session state, durable memory, retrieval, and boundaries between user and agent data.", tags: ["State"] },
      { title: "Approval workflows", copy: "Human confirmation before applications, messages, or any consequential action.", tags: ["Safety"] },
      { title: "Agent evaluation", copy: "Task success, trajectory checks, tool correctness, regression suites, and observability.", tags: ["Evals"] },
      { title: "MCP experiments", copy: "Small integrations for job sources, Gmail, GitHub, and structured knowledge.", tags: ["MCP"] },
      { title: "Pet projects", copy: "A portfolio backlog of narrow, testable agents instead of one uncontrolled system.", tags: ["Projects"] },
    ],
  },
  llm: {
    title: "LLM lab",
    description: "A testing and engineering knowledge base for products built around language models.",
    items: [
      { title: "LLM testing", copy: "Functional behaviour, robustness, safety, consistency, and model-change regression.", tags: ["Testing"] },
      { title: "Evaluations", copy: "Datasets, rubrics, model graders, human review, thresholds, and experiment tracking.", tags: ["Evals"] },
      { title: "RAG", copy: "Retrieval quality, grounding, citations, chunking, permissions, and freshness.", tags: ["RAG"] },
      { title: "Prompt security", copy: "Prompt injection, data leakage, tool misuse, and layered mitigations.", tags: ["Security"] },
      { title: "Observability", copy: "Traces, token usage, latency, failures, feedback, and production diagnostics.", tags: ["Ops"] },
      { title: "Pet projects", copy: "Practical QA copilots, test generators, review tools, and evaluation harnesses.", tags: ["Projects"] },
    ],
  },
  security: {
    title: "Security lab",
    description: "Practical application-security notes and controlled exercises for quality engineers.",
    items: [
      { title: "OWASP", copy: "Web, API, and LLM application risks with testing ideas and mitigations.", tags: ["OWASP"] },
      { title: "Threat modelling", copy: "Assets, trust boundaries, abuse cases, controls, and residual risk.", tags: ["Risk"] },
      { title: "Authentication", copy: "Sessions, OAuth, access control, identity boundaries, and negative testing.", tags: ["Auth"] },
      { title: "Secrets and data", copy: "Credential handling, sensitive data, logging, retention, and least privilege.", tags: ["Data"] },
    ],
  },
  devops: {
    title: "DevOps lab",
    description: "Reference notes and projects for delivery pipelines, cloud systems, and reliability.",
    items: [
      { title: "CI/CD", copy: "Build gates, test stages, artifacts, deployments, rollbacks, and branch controls.", tags: ["Pipelines"] },
      { title: "Containers", copy: "Docker images, compose environments, dependencies, and test execution.", tags: ["Docker"] },
      { title: "Cloud", copy: "Workers, serverless services, storage, networking, and environment configuration.", tags: ["Cloud"] },
      { title: "Observability", copy: "Logs, metrics, traces, alerts, dashboards, and actionable diagnostics.", tags: ["Monitoring"] },
      { title: "Infrastructure as code", copy: "Repeatable environments, reviewable changes, drift, and secret separation.", tags: ["IaC"] },
      { title: "Resilience", copy: "Failure injection, dependency degradation, recovery, and reliability checks.", tags: ["Resilience"] },
    ],
  },
  standards: {
    title: "Standards",
    description: "A working index of standards relevant to software quality, security, and regulated products.",
    items: [
      { title: "ISO/IEC 25010", copy: "Software product quality model and quality characteristics.", tags: ["Quality"] },
      { title: "ISO/IEC/IEEE 29119", copy: "Software-testing processes, documentation, and techniques.", tags: ["Testing"] },
      { title: "ISO/IEC 27001", copy: "Information-security management systems and risk-based controls.", tags: ["Security"] },
      { title: "IEC 62304", copy: "Medical-device software lifecycle processes and safety classification.", tags: ["Medical"] },
      { title: "IEC 60601", copy: "Safety and essential performance requirements for medical electrical equipment.", tags: ["Medical"] },
      { title: "ISO 9001", copy: "Quality-management principles, processes, evidence, and improvement.", tags: ["QMS"] },
    ],
  },
  news: {
    title: "News",
    description: "A focused reading list for QA, AI agents, LLM engineering, security, and delivery tooling.",
    items: [
      { title: "QA and test automation", copy: "Framework releases, quality-engineering practices, and useful case studies.", tags: ["QA"] },
      { title: "Agents and LLMs", copy: "Agent platforms, model releases, evaluation research, and applied engineering.", tags: ["AI"] },
      { title: "Security", copy: "Important vulnerabilities, guidance, and defensive engineering updates.", tags: ["Security"] },
      { title: "Cloud and DevOps", copy: "Platform changes, CI/CD tooling, reliability, and observability updates.", tags: ["DevOps"] },
    ],
  },
};

function dateLabel(value: string | null) {
  if (!value) return "Recently found";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Recently found";
  return new Intl.DateTimeFormat("en", { day: "numeric", month: "short", year: "numeric" }).format(date);
}

function shortText(value: string) {
  const cleaned = value.replace(/\s+/g, " ").trim();
  return cleaned.length > 210 ? `${cleaned.slice(0, 207)}…` : cleaned;
}

function currentSectionFromHash(): PublicSection {
  if (typeof window === "undefined") return "jobs";
  const candidate = window.location.hash.replace("#", "") as PublicSection;
  return navigation.some((group) => group.items.some((item) => item.id === candidate)) ? candidate : "jobs";
}

export default function PublicSite() {
  const [section, setSection] = useState<PublicSection>("jobs");
  const [jobs, setJobs] = useState<PublicJob[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [query, setQuery] = useState("");
  const [mobileNav, setMobileNav] = useState(false);

  useEffect(() => {
    const onHashChange = () => setSection(currentSectionFromHash());
    const frame = window.requestAnimationFrame(onHashChange);
    window.addEventListener("hashchange", onHashChange);
    return () => {
      window.cancelAnimationFrame(frame);
      window.removeEventListener("hashchange", onHashChange);
    };
  }, []);

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
      .slice(0, 50);
  }, [jobs, query]);

  const openSection = (next: PublicSection) => {
    setSection(next);
    setMobileNav(false);
    window.history.replaceState(null, "", next === "jobs" ? window.location.pathname : `#${next}`);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const activeLabel = navigation.flatMap((group) => group.items).find((item) => item.id === section)?.label ?? "Jobs";

  return (
    <main className="kb-shell">
      <aside className={mobileNav ? "kb-sidebar open" : "kb-sidebar"}>
        <div className="kb-brand"><span>GJ</span><div><strong>GimmeJob</strong><small>Knowledge base</small></div></div>
        <nav aria-label="Knowledge base sections">
          {navigation.map((group) => (
            <div className="kb-nav-group" key={group.label}>
              <h2>{group.label}</h2>
              {group.items.map((item) => (
                <button className={section === item.id ? "active" : ""} key={item.id} onClick={() => openSection(item.id)}>
                  <i>{item.marker}</i><span>{item.label}</span>
                </button>
              ))}
            </div>
          ))}
        </nav>
        <div className="kb-private">
          <span>PRIVATE AREA</span>
          <p>Status, feedback, resume versions, drafts, and agent actions.</p>
          <a href="/workspace"><i>↳</i> Manage jobs</a>
        </div>
      </aside>

      <section className="kb-main">
        <header className="kb-topbar">
          <button className="kb-menu" onClick={() => setMobileNav((value) => !value)} aria-label="Toggle navigation">☰</button>
          <div><span>Knowledge base</span><strong>{activeLabel}</strong></div>
          <div className="kb-public-state"><i/>Public view</div>
          <a href="/workspace">Manage statuses & feedback</a>
        </header>

        {section === "jobs" ? (
          <div className="kb-content">
            <header className="kb-page-head">
              <div><span>CAREER / JOBS</span><h1>Jobs</h1><p>Collected vacancies, ordered from newest to oldest. This page is public and read-only.</p></div>
              <div className="kb-page-stats"><div><strong>{jobs.length}</strong><span>Vacancies</span></div><div><strong>Newest</strong><span>First</span></div><div><strong>Read-only</strong><span>Public view</span></div></div>
            </header>

            <section className="kb-jobs-panel">
              <div className="kb-jobs-tools">
                <label><span>⌕</span><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search title, company, location, or source"/></label>
                <a href="/workspace">Private management →</a>
              </div>
              <div className="kb-jobs-note"><span>{visibleJobs.length} results</span><p>Statuses and personal feedback are visible only after authentication.</p></div>
              <div className="kb-job-list">
                {loaded && visibleJobs.map((job) => (
                  <article className="kb-job-row" key={job.id}>
                    <div className="kb-company-mark">{job.company.slice(0, 2).toUpperCase()}</div>
                    <div className="kb-job-copy">
                      <div><span>{job.source}</span><time>{dateLabel(job.postedAt ?? job.discoveredAt)}</time></div>
                      <h2>{job.title}</h2>
                      <p className="kb-job-company">{job.company} · {job.location}</p>
                      <p>{shortText(job.description || "Open the original vacancy for full details.")}</p>
                      <div className="kb-job-tags">{job.remote && <span>Remote</span>}{job.salaryText && <span>{job.salaryText}</span>}</div>
                    </div>
                    <a href={job.url} target="_blank" rel="noreferrer">Open ↗</a>
                  </article>
                ))}
                {!loaded && <div className="kb-empty"><strong>Loading jobs…</strong><span>Reading the public database.</span></div>}
                {loaded && visibleJobs.length === 0 && <div className="kb-empty"><strong>{jobs.length ? "No matching jobs" : "No jobs collected yet"}</strong><span>{jobs.length ? "Try another search." : "Use the private workspace to run the first source sync."}</span></div>}
              </div>
            </section>
          </div>
        ) : (
          <KnowledgeSection section={section}/>
        )}
      </section>

      {mobileNav && <button className="kb-backdrop" onClick={() => setMobileNav(false)} aria-label="Close navigation"/>}
    </main>
  );
}

function KnowledgeSection({ section }: { section: Exclude<PublicSection, "jobs"> }) {
  const content = knowledge[section];
  return (
    <div className="kb-content">
      <header className="kb-page-head kb-article-head">
        <div><span>KNOWLEDGE BASE / {content.title.toUpperCase()}</span><h1>{content.title}</h1><p>{content.description}</p></div>
        <div className="kb-outline-badge"><i/>Public section</div>
      </header>
      <section className="kb-article-intro">
        <div><strong>Section index</strong><span>{content.items.length} topics</span></div>
        <p>This is a working outline. Notes, links, examples, and projects will be added directly inside these topics.</p>
      </section>
      <div className="kb-topic-grid">
        {content.items.map((item, index) => (
          <article key={item.title}>
            <div><span>{String(index + 1).padStart(2, "0")}</span><small>Outline</small></div>
            <h2>{item.title}</h2>
            <p>{item.copy}</p>
            <footer>{item.tags.map((tag) => <em key={tag}>{tag}</em>)}</footer>
          </article>
        ))}
      </div>
    </div>
  );
}
