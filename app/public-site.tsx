"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { navigationItems, SiteSidebar, SiteTopbar, type SiteSection, type SubnavItem } from "./site-navigation";
import interviewCatalog from "@/content/interview/catalog";

type PublicSection = SiteSection;

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

type InterviewLevel = "Junior" | "Middle" | "Senior" | "Lead";

interface InterviewQuestion {
  id: string;
  level: InterviewLevel;
  category: string;
  kind?: string;
  question: string;
  shortAnswer: string;
  strongAnswerSignals: string[];
  sourceIds: string[];
  tags?: string[];
  media?: Array<{ src: string; alt: string; caption: string; credit: string }>;
}

interface InterviewSource {
  id: string;
  title: string;
  url: string;
  publisher: string;
  kind: string;
  role: string;
}

interface InterviewTaxonomyItem {
  id: string;
  label: string;
  category?: string;
  description: string;
}

const interviewQuestions = interviewCatalog.questions as InterviewQuestion[];
const interviewLevels: Array<"All" | InterviewLevel> = ["All", "Junior", "Middle", "Senior", "Lead"];
const interviewTaxonomy = interviewCatalog.taxonomy as InterviewTaxonomyItem[];
const interviewSourcesList = interviewCatalog.sources as InterviewSource[];
const interviewSources = new Map(interviewSourcesList.map((source) => [source.id, source]));

const fallbackTags: Record<string, string[]> = {
  Fundamentals: ["testing-theory", "core"],
  "Test design": ["test-design", "coverage"],
  "Documentation and defects": ["documentation", "defects"],
  "Web, API and data": ["web", "api", "data"],
  Mobile: ["mobile", "devices"],
  "Automation and CI": ["automation", "ci"],
  Programming: ["programming", "test-code"],
  Infrastructure: ["infrastructure", "devops"],
  "Performance and resilience": ["performance", "resilience"],
  "Security and accessibility": ["security", "accessibility"],
  "Agile and delivery": ["agile", "delivery"],
  "Strategy and risk": ["strategy", "risk"],
  Leadership: ["leadership", "people"],
  "Practical tasks": ["practical", "scenario"],
};

function tagsFor(question: InterviewQuestion) {
  return question.tags?.length ? question.tags : fallbackTags[question.category] ?? ["qa"];
}

const interviewTags = Array.from(new Set(interviewQuestions.flatMap(tagsFor))).sort((a, b) => a.localeCompare(b));

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
    description: "Links and notes about QA, AI agents, LLM engineering, security, and delivery tooling.",
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

function displayText(value: string) {
  return value.replace(/&nbsp;/g, " ").replace(/&amp;/g, "&").replace(/&quot;/g, "\"").replace(/&#39;/g, "'").replace(/&lt;/g, "<").replace(/&gt;/g, ">");
}

function shortText(value: string) {
  const cleaned = displayText(value).replace(/\s+/g, " ").trim();
  return cleaned.length > 210 ? `${cleaned.slice(0, 207)}…` : cleaned;
}

function currentSectionFromHash(): PublicSection {
  if (typeof window === "undefined") return "jobs";
  const candidate = window.location.hash.replace("#", "") as PublicSection;
  return navigationItems.some((item) => item.id === candidate) ? candidate : "jobs";
}

function topicId(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
}

function secondaryNavigation(section: PublicSection, jobs: PublicJob[]): SubnavItem[] {
  if (section === "interview") {
    return interviewTaxonomy.map((item) => ({
      id: item.id,
      label: item.label,
      count: item.category ? interviewQuestions.filter((question) => question.category === item.category).length : item.id === "all" ? interviewQuestions.length : undefined,
    }));
  }

  if (section === "jobs") {
    const sources = Array.from(new Set(jobs.map((job) => job.source))).sort();
    return [
      { id: "all", label: "All vacancies", count: jobs.length },
      { id: "remote", label: "Remote", count: jobs.filter((job) => job.remote).length },
      ...sources.map((source) => ({ id: `source:${source}`, label: source.replace(/^\w+:/, ""), count: jobs.filter((job) => job.source === source).length })),
    ];
  }

  const items = knowledge[section].items;
  return [
    { id: "all", label: "All topics", count: items.length },
    ...items.map((item) => ({ id: topicId(item.title), label: item.title })),
  ];
}

export default function PublicSite() {
  const [section, setSection] = useState<PublicSection>("jobs");
  const [jobs, setJobs] = useState<PublicJob[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [query, setQuery] = useState("");
  const [mobileNav, setMobileNav] = useState(false);
  const [subsection, setSubsection] = useState("all");

  useEffect(() => {
    const onHashChange = () => {
      setSection(currentSectionFromHash());
      setSubsection("all");
    };
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
      .filter((job) => !needle || displayText(`${job.title} ${job.company} ${job.location} ${job.source}`).toLowerCase().includes(needle))
      .filter((job) => subsection === "all" || (subsection === "remote" && job.remote) || (subsection.startsWith("source:") && job.source === subsection.slice(7)))
      .sort((a, b) => new Date(b.postedAt ?? b.discoveredAt).getTime() - new Date(a.postedAt ?? a.discoveredAt).getTime())
      .slice(0, 50);
  }, [jobs, query, subsection]);

  const openSection = (next: PublicSection) => {
    setSection(next);
    setSubsection("all");
    setMobileNav(false);
    window.history.replaceState(null, "", next === "jobs" ? window.location.pathname : `#${next}`);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const activeLabel = navigationItems.find((item) => item.id === section)?.label ?? "Jobs";
  const secondaryItems = secondaryNavigation(section, jobs);

  return (
    <main className="kb-shell">
      <SiteSidebar
        activeSection={section}
        activeSubsection={subsection}
        mobileOpen={mobileNav}
        mode="public"
        onSelect={openSection}
        onSelectSubsection={(next) => { setSubsection(next); setMobileNav(false); }}
        secondaryItems={secondaryItems}
        secondaryTitle={activeLabel}
      />

      <section className="kb-main">
        <SiteTopbar mode="public" onMenu={() => setMobileNav((value) => !value)} title={activeLabel}>
          <Link className="kb-top-link" href="/workspace">Manage statuses & feedback</Link>
        </SiteTopbar>

        {section === "jobs" ? (
          <div className="kb-content">
            <header className="kb-page-head">
              <div><span>JOBS</span><h1>Jobs</h1><p>Vacancies from connected sources, ordered from newest to oldest.</p></div>
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
                    <div className="kb-company-mark">{displayText(job.company).slice(0, 2).toUpperCase()}</div>
                    <div className="kb-job-copy">
                      <div><span>{job.source}</span><time>{dateLabel(job.postedAt ?? job.discoveredAt)}</time></div>
                      <h2>{displayText(job.title)}</h2>
                      <p className="kb-job-company">{displayText(job.company)} · {displayText(job.location)}</p>
                      <p>{shortText(job.description || "Open the original vacancy for full details.")}</p>
                      <div className="kb-job-tags">{job.remote && <span>Remote</span>}{job.salaryText && <span>{job.salaryText}</span>}</div>
                    </div>
                    <a href={job.url} target="_blank" rel="noreferrer">Open ↗</a>
                  </article>
                ))}
                {!loaded && <div className="kb-empty"><strong>Loading jobs…</strong><span>Reading the public database.</span></div>}
                {loaded && visibleJobs.length === 0 && <div className="kb-empty"><strong>{jobs.length ? "No matching jobs" : "Collecting the first jobs"}</strong><span>{jobs.length ? "Try another search." : "A new database syncs automatically. Reload shortly, or use Sync jobs in the private workspace."}</span></div>}
              </div>
            </section>
          </div>
        ) : (
          <KnowledgeSection activeTopic={subsection} onTopicChange={setSubsection} section={section}/>
        )}
      </section>

      {mobileNav && <button className="kb-backdrop" onClick={() => setMobileNav(false)} aria-label="Close navigation"/>}
    </main>
  );
}

function KnowledgeSection({ activeTopic, onTopicChange, section }: { activeTopic: string; onTopicChange: (topic: string) => void; section: Exclude<PublicSection, "jobs"> }) {
  if (section === "interview") return <InterviewKnowledgeBase activeTopic={activeTopic} onTopicChange={onTopicChange}/>;

  const content = knowledge[section];
  const visibleItems = activeTopic === "all" ? content.items : content.items.filter((item) => topicId(item.title) === activeTopic);
  return (
    <div className="kb-content">
      <header className="kb-page-head kb-article-head">
        <div><span>{content.title.toUpperCase()}</span><h1>{content.title}</h1><p>{content.description}</p></div>
        <div className="kb-outline-badge"><i/>Public section</div>
      </header>
      <div className="kb-topic-grid">
        {visibleItems.map((item, index) => (
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

function InterviewKnowledgeBase({ activeTopic, onTopicChange }: { activeTopic: string; onTopicChange: (topic: string) => void }) {
  const [query, setQuery] = useState("");
  const [level, setLevel] = useState<(typeof interviewLevels)[number]>("All");
  const [tag, setTag] = useState("All");

  const activeTaxonomy = interviewTaxonomy.find((item) => item.id === activeTopic);
  const activeCategory = activeTaxonomy?.category;

  const visibleQuestions = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return interviewQuestions.filter((item) => {
      const tags = tagsFor(item);
      const matchesLevel = level === "All" || item.level === level;
      const matchesCategory = !activeCategory || item.category === activeCategory;
      const matchesTag = tag === "All" || tags.includes(tag);
      const searchable = `${item.question} ${item.shortAnswer} ${item.category} ${item.kind ?? ""} ${tags.join(" ")} ${item.strongAnswerSignals.join(" ")}`.toLowerCase();
      return matchesLevel && matchesCategory && matchesTag && (!needle || searchable.includes(needle));
    });
  }, [activeCategory, level, query, tag]);

  if (activeTopic === "methodology") return <InterviewMethodology onBack={() => onTopicChange("all")}/>;

  return (
    <div className="kb-content iq-page">
      <header className="kb-page-head iq-head">
        <div>
          <span>INTERVIEW QUESTIONS</span>
          <h1>{activeTaxonomy?.category ? activeTaxonomy.label : "QA interview knowledge base"}</h1>
          <p>{activeTaxonomy?.description ?? interviewCatalog.description}</p>
        </div>
        <div className="kb-page-stats">
          <div><strong>{interviewQuestions.length}</strong><span>Questions</span></div>
          <div><strong>{interviewTaxonomy.filter((item) => item.category).length}</strong><span>Topics</span></div>
          <div><strong>{interviewSourcesList.length}</strong><span>Sources</span></div>
        </div>
      </header>

      <section className="iq-toolbar" aria-label="Interview question filters">
        <label className="iq-search">
          <span>⌕</span>
          <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search questions, answers, tags, or skills"/>
        </label>
        <label className="iq-category">
          <span>Tag</span>
          <select value={tag} onChange={(event) => setTag(event.target.value)}>
            <option value="All">All tags</option>
            {interviewTags.map((item) => <option key={item} value={item}>{item}</option>)}
          </select>
        </label>
      </section>

      <div className="iq-levels" aria-label="Seniority filter">
        {interviewLevels.map((item) => (
          <button key={item} className={level === item ? "active" : ""} onClick={() => setLevel(item)}>{item}</button>
        ))}
        {(activeCategory || tag !== "All" || query || level !== "All") && <button className="iq-clear" onClick={() => { setQuery(""); setLevel("All"); setTag("All"); onTopicChange("all"); }}>Clear filters</button>}
        <span>{visibleQuestions.length} shown</span>
      </div>

      <div className="iq-list">
        {visibleQuestions.map((item, index) => {
          const tags = tagsFor(item);
          return (
            <details className="iq-question" key={item.id}>
              <summary>
                <span className={`iq-level iq-level-${item.level.toLowerCase()}`}>{item.level}</span>
                <div>
                  <small>{item.category}{item.kind ? ` · ${item.kind}` : ""} · {String(index + 1).padStart(3, "0")}</small>
                  <h2>{item.question}</h2>
                  <span className="iq-question-tags">{tags.slice(0, 4).map((questionTag) => <em key={questionTag}>{questionTag}</em>)}</span>
                </div>
                <i aria-hidden="true">+</i>
              </summary>
              <div className="iq-answer">
                <section>
                  <h3>Answer</h3>
                  <p>{item.shortAnswer}</p>
                  {item.media?.map((media) => (
                    <figure className="iq-media" key={media.src}>
                      <Image src={media.src} alt={media.alt} height={430} loading="lazy" unoptimized width={760}/>
                      <figcaption>{media.caption}<small>{media.credit}</small></figcaption>
                    </figure>
                  ))}
                </section>
                <section>
                  <h3>Strong answer includes</h3>
                  <ul>{item.strongAnswerSignals.map((signal) => <li key={signal}>{signal}</li>)}</ul>
                  <div className="iq-answer-tags">{tags.map((questionTag) => <button key={questionTag} onClick={() => setTag(questionTag)}>#{questionTag}</button>)}</div>
                </section>
                <footer>
                  <span>References</span>
                  {item.sourceIds.map((sourceId) => {
                    const source = interviewSources.get(sourceId);
                    return source ? <a href={source.url} target="_blank" rel="noreferrer" key={sourceId}>{source.publisher}: {source.title} ↗</a> : null;
                  })}
                </footer>
              </div>
            </details>
          );
        })}
        {visibleQuestions.length === 0 && (
          <div className="kb-empty iq-empty"><strong>No matching questions</strong><span>Change the level, section, tag, or search phrase.</span></div>
        )}
      </div>
    </div>
  );
}

function InterviewMethodology({ onBack }: { onBack: () => void }) {
  const method = interviewCatalog.methodology;
  return (
    <div className="kb-content iq-page iq-methodology">
      <header className="kb-page-head iq-head">
        <div><span>INTERVIEW QUESTIONS</span><h1>Sources & methodology</h1><p>The research, source roles, editorial rules and storage model behind the public collection.</p></div>
        <button className="iq-back" onClick={onBack}>View all questions</button>
      </header>

      <section className="iq-method-grid">
        <article><span>01</span><h2>Coverage</h2><p>{method.coverage}</p></article>
        <article><span>02</span><h2>Answer validation</h2><p>{method.answers}</p></article>
        <article><span>03</span><h2>Publishing</h2><p>{method.publishing}</p></article>
        <article><span>04</span><h2>Images and diagrams</h2><p>{method.media}</p></article>
      </section>

      <section className="iq-source-catalog">
        <header><div><span>SOURCE CATALOG</span><h2>{interviewSourcesList.length} research and validation sources</h2></div><p>Community collections show what is asked. Official documentation, specifications and standards are used to validate technical answers.</p></header>
        <div>
          {interviewSourcesList.map((source) => (
            <article key={source.id}>
              <div><span>{source.kind}</span><small>{source.publisher}</small></div>
              <h3><a href={source.url} target="_blank" rel="noreferrer">{source.title} ↗</a></h3>
              <p>{source.role}</p>
            </article>
          ))}
        </div>
      </section>
    </div>
  );
}
