"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { navigationItems, SiteSidebar, SiteTopbar, type SiteSection, type SubnavItem } from "./site-navigation";

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
type InterviewPrevalence = "Very common" | "Common" | "Occasional" | "Specialist";
type InterviewSort = "prevalence" | "editorial" | "level" | "alphabetical";

interface InterviewQuestion {
  id: string;
  level: InterviewLevel;
  prevalence: InterviewPrevalence;
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

interface InterviewCatalog {
  title: string;
  description: string;
  methodology: {
    coverage: string;
    answers: string;
    publishing: string;
    prevalence: string;
    media: string;
  };
  questions: InterviewQuestion[];
  sources: InterviewSource[];
  taxonomy: InterviewTaxonomyItem[];
}

const INTERVIEW_PAGE_SIZE = 60;
const interviewLevels: InterviewLevel[] = ["Junior", "Middle", "Senior", "Lead"];
const interviewPrevalence: Array<"All" | InterviewPrevalence> = ["All", "Very common", "Common", "Occasional", "Specialist"];
const prevalenceOrder: Record<InterviewPrevalence, number> = { "Very common": 0, Common: 1, Occasional: 2, Specialist: 3 };
const levelOrder: Record<InterviewLevel, number> = { Junior: 0, Middle: 1, Senior: 2, Lead: 3 };
const interviewSortOptions: Array<{ value: InterviewSort; label: string }> = [
  { value: "prevalence", label: "Most common first" },
  { value: "editorial", label: "Editorial order" },
  { value: "level", label: "Junior → Lead" },
  { value: "alphabetical", label: "Question A–Z" },
];

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
  "AI, ML and LLM": ["ai", "ml", "llm"],
  "Data and BI": ["data", "bi", "analytics"],
  "Observability and production": ["observability", "production", "sre"],
  "Regulated domains": ["regulated", "compliance", "safety"],
};

function tagsFor(question: InterviewQuestion) {
  return question.tags?.length ? question.tags : fallbackTags[question.category] ?? ["qa"];
}

function normalizeSearch(value: string) {
  return value.toLowerCase().normalize("NFKD").replace(/[^a-z0-9]+/g, " ").trim();
}

function MultiSelectFilter<T extends string>({ allLabel, label, onChange, options, searchable = false, selected }: {
  allLabel: string;
  label: string;
  onChange: (selected: T[]) => void;
  options: T[];
  searchable?: boolean;
  selected: T[];
}) {
  const [optionQuery, setOptionQuery] = useState("");
  const needle = normalizeSearch(optionQuery);
  const visibleOptions = needle ? options.filter((option) => normalizeSearch(option).includes(needle)) : options;
  const toggle = (option: T) => onChange(selected.includes(option) ? selected.filter((item) => item !== option) : [...selected, option]);

  return (
    <div className="iq-multi">
      <span className="iq-filter-label">{label}</span>
      <details name="interview-filter">
        <summary aria-label={`${label}: ${selected.length ? `${selected.length} selected` : allLabel}`}>
          <strong>{selected.length ? `${selected.length} selected` : allLabel}</strong>
          <i aria-hidden="true">⌄</i>
        </summary>
        <div className="iq-multi-menu">
        {searchable && (
          <label className="iq-option-search">
            <span>⌕</span>
            <input value={optionQuery} onChange={(event) => setOptionQuery(event.target.value)} placeholder={`Search ${label.toLowerCase()}`}/>
          </label>
        )}
        <label className="iq-option iq-option-all">
          <input type="checkbox" checked={selected.length === 0} onChange={() => onChange([])}/>
          <span>{allLabel}</span>
        </label>
        <div className="iq-option-list">
          {visibleOptions.map((option) => (
            <label className="iq-option" key={option}>
              <input type="checkbox" checked={selected.includes(option)} onChange={() => toggle(option)}/>
              <span>{option}</span>
            </label>
          ))}
          {visibleOptions.length === 0 && <span className="iq-option-empty">No matching tags</span>}
        </div>
        <small>Matches any selected {label.toLowerCase().replace(/s$/, "")}.</small>
        </div>
      </details>
    </div>
  );
}

function StructuredAnswer({ value }: { value: string }) {
  const paragraphs = value.split(/\n{2,}/).map((item) => item.trim()).filter(Boolean);
  const sentences = paragraphs.length > 1
    ? paragraphs
    : Array.from(new Intl.Segmenter("en", { granularity: "sentence" }).segment(value), ({ segment }) => segment.trim()).filter(Boolean);

  if (sentences.length < 3) {
    return <div className="iq-answer-copy">{sentences.map((sentence) => <p key={sentence}>{sentence}</p>)}</div>;
  }

  return (
    <div className="iq-answer-copy">
      <p className="iq-answer-lead">{sentences[0]}</p>
      <ul className="iq-answer-points">{sentences.slice(1).map((sentence) => <li key={sentence}>{sentence}</li>)}</ul>
    </div>
  );
}

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

function secondaryNavigation(section: PublicSection, jobs: PublicJob[], interviewCatalog: InterviewCatalog | null): SubnavItem[] {
  if (section === "interview") {
    if (!interviewCatalog) return [{ id: "all", label: "Loading catalog…" }];
    return interviewCatalog.taxonomy.map((item) => ({
      id: item.id,
      label: item.label,
      count: item.category ? interviewCatalog.questions.filter((question) => question.category === item.category).length : item.id === "all" ? interviewCatalog.questions.length : undefined,
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
  const [interviewCatalog, setInterviewCatalog] = useState<InterviewCatalog | null>(null);
  const [interviewCatalogError, setInterviewCatalogError] = useState(false);

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
    if (section !== "interview" || interviewCatalog) return;
    let active = true;
    import("@/content/interview/catalog")
      .then((module) => {
        if (active) setInterviewCatalog(module.default as unknown as InterviewCatalog);
      })
      .catch(() => {
        if (active) setInterviewCatalogError(true);
      });
    return () => { active = false; };
  }, [interviewCatalog, section]);

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
  const secondaryItems = secondaryNavigation(section, jobs, interviewCatalog);

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
        <SiteTopbar mode="public" onMenu={() => setMobileNav((value) => !value)}>
          <Link className="kb-top-link" href="/workspace">Manage statuses & feedback</Link>
        </SiteTopbar>

        {section === "jobs" ? (
          <div className="kb-content">
            <header className="kb-page-head">
              <div><h1>Jobs</h1></div>
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
          <KnowledgeSection
            activeTopic={subsection}
            interviewCatalog={interviewCatalog}
            interviewCatalogError={interviewCatalogError}
            onTopicChange={setSubsection}
            section={section}
          />
        )}
      </section>

      {mobileNav && <button className="kb-backdrop" onClick={() => setMobileNav(false)} aria-label="Close navigation"/>}
    </main>
  );
}

function KnowledgeSection({ activeTopic, interviewCatalog, interviewCatalogError, onTopicChange, section }: {
  activeTopic: string;
  interviewCatalog: InterviewCatalog | null;
  interviewCatalogError: boolean;
  onTopicChange: (topic: string) => void;
  section: Exclude<PublicSection, "jobs">;
}) {
  if (section === "interview") {
    if (!interviewCatalog) {
      return (
        <div className="kb-content iq-page">
          <div className="kb-empty iq-catalog-state">
            <strong>{interviewCatalogError ? "Interview catalog unavailable" : "Loading 520-question catalog…"}</strong>
            <span>{interviewCatalogError ? "Reload the page to try the separate catalog request again." : "The public catalog is loaded only when this section is opened."}</span>
          </div>
        </div>
      );
    }
    return <InterviewKnowledgeBase activeTopic={activeTopic} catalog={interviewCatalog} onTopicChange={onTopicChange}/>;
  }

  const content = knowledge[section];
  const visibleItems = activeTopic === "all" ? content.items : content.items.filter((item) => topicId(item.title) === activeTopic);
  return (
    <div className="kb-content">
      <header className="kb-page-head kb-article-head">
        <div><h1>{content.title}</h1></div>
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

function InterviewKnowledgeBase({ activeTopic, catalog, onTopicChange }: { activeTopic: string; catalog: InterviewCatalog; onTopicChange: (topic: string) => void }) {
  const [query, setQuery] = useState("");
  const [levels, setLevels] = useState<InterviewLevel[]>([]);
  const [prevalence, setPrevalence] = useState<(typeof interviewPrevalence)[number]>("All");
  const [sort, setSort] = useState<InterviewSort>("prevalence");
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [page, setPage] = useState(0);

  const interviewQuestions = catalog.questions;
  const interviewTaxonomy = catalog.taxonomy;
  const interviewSourcesList = catalog.sources;
  const interviewSources = useMemo(() => new Map(interviewSourcesList.map((source) => [source.id, source])), [interviewSourcesList]);
  const interviewTags = useMemo(() => Array.from(new Set(interviewQuestions.flatMap(tagsFor))).sort((a, b) => a.localeCompare(b)), [interviewQuestions]);
  const editorialOrder = useMemo(() => new Map(interviewQuestions.map((question, index) => [question.id, index])), [interviewQuestions]);
  const activeTaxonomy = interviewTaxonomy.find((item) => item.id === activeTopic);
  const activeCategory = activeTaxonomy?.category;

  const matchingQuestions = useMemo(() => {
    const searchTerms = normalizeSearch(query).split(" ").filter(Boolean);
    return interviewQuestions
      .filter((item) => {
        const tags = tagsFor(item);
        const matchesLevel = levels.length === 0 || levels.includes(item.level);
        const matchesPrevalence = prevalence === "All" || item.prevalence === prevalence;
        const matchesCategory = !activeCategory || item.category === activeCategory;
        const matchesTag = selectedTags.length === 0 || tags.some((tag) => selectedTags.includes(tag));
        const searchable = normalizeSearch(`${item.question} ${item.shortAnswer} ${item.category} ${item.kind ?? ""} ${item.prevalence} ${tags.join(" ")} ${item.strongAnswerSignals.join(" ")}`);
        return matchesLevel && matchesPrevalence && matchesCategory && matchesTag && searchTerms.every((term) => searchable.includes(term));
      })
      .sort((left, right) => {
        const editorialDifference = (editorialOrder.get(left.id) ?? 0) - (editorialOrder.get(right.id) ?? 0);
        if (sort === "editorial") return editorialDifference;
        if (sort === "alphabetical") return left.question.localeCompare(right.question) || editorialDifference;
        if (sort === "level") {
          return levelOrder[left.level] - levelOrder[right.level]
            || prevalenceOrder[left.prevalence] - prevalenceOrder[right.prevalence]
            || editorialDifference;
        }
        return prevalenceOrder[left.prevalence] - prevalenceOrder[right.prevalence] || editorialDifference;
      });
  }, [activeCategory, editorialOrder, interviewQuestions, levels, prevalence, query, selectedTags, sort]);

  const pageCount = Math.max(1, Math.ceil(matchingQuestions.length / INTERVIEW_PAGE_SIZE));
  const safePage = Math.min(page, pageCount - 1);
  const pageStart = safePage * INTERVIEW_PAGE_SIZE;
  const visibleQuestions = matchingQuestions.slice(pageStart, pageStart + INTERVIEW_PAGE_SIZE);

  if (activeTopic === "methodology") return <InterviewMethodology catalog={catalog} onBack={() => onTopicChange("all")}/>;

  const setQuestionTags = (nextTags: string[]) => {
    setSelectedTags(nextTags);
    setPage(0);
  };
  const toggleQuestionTag = (nextTag: string) => setQuestionTags(
    selectedTags.includes(nextTag) ? selectedTags.filter((tag) => tag !== nextTag) : [...selectedTags, nextTag],
  );
  const setQuestionLevels = (nextLevels: InterviewLevel[]) => {
    setLevels(nextLevels);
    setPage(0);
  };
  const clearFilters = () => {
    setQuery("");
    setLevels([]);
    setPrevalence("All");
    setSort("prevalence");
    setSelectedTags([]);
    setPage(0);
    onTopicChange("all");
  };
  const hasActiveFilters = Boolean(activeCategory || selectedTags.length || query || levels.length || prevalence !== "All" || sort !== "prevalence");

  return (
    <div className="kb-content iq-page">
      <header className="kb-page-head iq-head">
        <div>
          <h1>{activeTaxonomy?.category ? activeTaxonomy.label : "QA interview knowledge base"}</h1>
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
          <input value={query} onChange={(event) => { setQuery(event.target.value); setPage(0); }} placeholder="Search questions, answers, tags, or skills"/>
        </label>
        <label className="iq-category">
          <span>Prevalence</span>
          <select value={prevalence} onChange={(event) => { setPrevalence(event.target.value as (typeof interviewPrevalence)[number]); setPage(0); }}>
            {interviewPrevalence.map((item) => <option key={item} value={item}>{item === "All" ? "All prevalence levels" : item}</option>)}
          </select>
        </label>
        <label className="iq-category">
          <span>Sort</span>
          <select value={sort} onChange={(event) => { setSort(event.target.value as InterviewSort); setPage(0); }}>
            {interviewSortOptions.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
          </select>
        </label>
        <MultiSelectFilter allLabel="All tags" label="Tags" onChange={setQuestionTags} options={interviewTags} searchable selected={selectedTags}/>
        <MultiSelectFilter allLabel="All levels" label="Seniority levels" onChange={setQuestionLevels} options={interviewLevels} selected={levels}/>
        <div className="iq-filter-status" aria-live="polite">
          <span>{matchingQuestions.length} matches<br/>{visibleQuestions.length} rendered</span>
          <button className="iq-clear" disabled={!hasActiveFilters} onClick={clearFilters}>Clear all</button>
        </div>
      </section>

      <div className="iq-list">
        {visibleQuestions.map((item, index) => {
          const tags = tagsFor(item);
          return (
            <details className="iq-question" key={item.id}>
              <summary>
                <span className={`iq-level iq-level-${item.level.toLowerCase()}`}>{item.level}</span>
                <div>
                  <small>{item.category}{item.kind ? ` · ${item.kind}` : ""} · {String(pageStart + index + 1).padStart(3, "0")}</small>
                  <h2>{item.question}</h2>
                  <span className="iq-question-tags"><em className={`iq-prevalence iq-prevalence-${item.prevalence.toLowerCase().replace(" ", "-")}`}>{item.prevalence}</em>{tags.slice(0, 4).map((questionTag) => <em key={questionTag}>{questionTag}</em>)}</span>
                </div>
              </summary>
              <div className="iq-answer">
                <section>
                  <h3>Answer</h3>
                  <StructuredAnswer value={item.shortAnswer}/>
                </section>
                <section>
                  <h3>Strong answer includes</h3>
                  <ul>{item.strongAnswerSignals.map((signal) => <li key={signal}>{signal}</li>)}</ul>
                  <div className="iq-answer-tags">{tags.map((questionTag) => <button className={selectedTags.includes(questionTag) ? "active" : ""} key={questionTag} onClick={() => toggleQuestionTag(questionTag)}>#{questionTag}</button>)}</div>
                </section>
                {item.media?.map((media) => (
                  <figure className="iq-media" key={media.src}>
                    <Image src={media.src} alt={media.alt} height={430} loading="lazy" unoptimized width={760}/>
                    <figcaption>{media.caption}<small>{media.credit}</small></figcaption>
                  </figure>
                ))}
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
        {matchingQuestions.length === 0 && (
          <div className="kb-empty iq-empty"><strong>No matching questions</strong><span>Change the topic, level, prevalence, tag, or search phrase.</span></div>
        )}
      </div>

      {matchingQuestions.length > INTERVIEW_PAGE_SIZE && (
        <nav className="iq-pagination" aria-label="Interview question result pages">
          <button disabled={safePage === 0} onClick={() => setPage(Math.max(0, safePage - 1))}>← Previous 60</button>
          <span>Page {safePage + 1} of {pageCount} · results {pageStart + 1}–{pageStart + visibleQuestions.length}</span>
          <button disabled={safePage >= pageCount - 1} onClick={() => setPage(Math.min(pageCount - 1, safePage + 1))}>Next 60 →</button>
        </nav>
      )}
    </div>
  );
}

function InterviewMethodology({ catalog, onBack }: { catalog: InterviewCatalog; onBack: () => void }) {
  const method = catalog.methodology;
  const interviewSourcesList = catalog.sources;
  return (
    <div className="kb-content iq-page iq-methodology">
      <header className="kb-page-head iq-head">
        <div><h1>Sources & methodology</h1></div>
        <button className="iq-back" onClick={onBack}>View all questions</button>
      </header>

      <section className="iq-method-grid">
        <article><span>01</span><h2>Coverage</h2><p>{method.coverage}</p></article>
        <article><span>02</span><h2>Answer validation</h2><p>{method.answers}</p></article>
        <article><span>03</span><h2>Publishing</h2><p>{method.publishing}</p></article>
        <article><span>04</span><h2>Prevalence</h2><p>{method.prevalence}</p></article>
        <article><span>05</span><h2>Images and diagrams</h2><p>{method.media}</p></article>
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
