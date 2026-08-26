"use client";

import { useMemo, useState } from "react";
import automationCurriculum from "@/content/automation-learning/catalog";
import automationTaxonomy from "@/content/automation-learning/taxonomy.json";
import cloudDevopsTaxonomy from "@/content/cloud-devops/taxonomy.json";
import sqlCurriculum from "@/content/data-learning/catalog";
import pythonCurriculum from "@/content/python-learning/catalog";
import pythonQuickReference from "@/content/python-learning/quick-reference.json";
import pythonQuickReferenceGuidance from "@/content/python-learning/quick-reference-guidance.json";
import pythonQuickReferenceInterview from "@/content/python-learning/quick-reference-interview.json";
import pythonTaxonomy from "@/content/python-learning/taxonomy.json";
import sqlQuickReference from "@/content/data-learning/sql-quick-reference.json";
import sqlPracticalTasks from "@/content/data-learning/sql-practical-tasks.json";
import qaQuickReference from "@/content/qa-fundamentals/quick-reference.json";
import qaRequiredConcepts from "@/content/qa-fundamentals/required-concepts.json";
import qaTaxonomy from "@/content/qa-fundamentals/taxonomy.json";
import { navigationGroups, SiteSidebar, type ExternalNavigationId, type SecondarySwitcher, type SiteSection, type SubnavItem } from "./site-navigation";
import styles from "./quick-reference-page.module.css";

type ReferenceRow = { term: string; detail: string; meaning?: string };
type ReferenceCode = { label: string; code: string };
type ReferenceCard = {
  id: string;
  title: string;
  scope?: string;
  tags?: string[];
  topics?: string[];
  dialects?: string[];
  meta?: string;
  summary?: string;
  rows?: ReferenceRow[];
  moreRows?: ReferenceRow[];
  code?: ReferenceCode[];
  notes?: string[];
  searchTerms?: string[];
  stackedRows?: boolean;
};
type TaxonomyItem = { id: string; label: string; level?: string; kind?: string };
type RequiredConcept = { topicId: string };
type InterviewFrequency = "Very common" | "Common" | "Occasional" | "Specialist";
type PythonReferenceCatalog = {
  filters: string[];
  cards: Array<{
    id: string;
    title: string;
    tags: string[];
    entries: ReferenceRow[];
    more: ReferenceRow[];
  }>;
};
type PythonInterviewReferenceCatalog = {
  filters: string[];
  priority: Array<{ id: string; frequency: InterviewFrequency }>;
  cards: Array<{
    id: string;
    title: string;
    tags: string[];
    summary: string;
    entries: ReferenceRow[];
    more: ReferenceRow[];
  }>;
};
type SqlReferenceCatalog = {
  topicFilters: string[];
  dialectFilters: string[];
  cards: Array<{
    id: string;
    title: string;
    topics: string[];
    dialects: string[];
    summary: string;
    entries: ReferenceRow[];
    more: ReferenceRow[];
  }>;
};
type QaReferenceCatalog = {
  filters: string[];
  cards: ReferenceCard[];
};
type PythonReferenceGuidance = {
  summaries: Record<string, string>;
  explanations: Record<string, Record<string, string>>;
  theoryCards: Array<{
    after: string;
    id: string;
    title: string;
    tags: string[];
    summary: string;
    entries: ReferenceRow[];
    more: ReferenceRow[];
  }>;
};

const supportedReferenceIds = new Set(["qa-fundamentals", "programming", "automation", "devops", "data"]);
const pythonReferenceCatalog = pythonQuickReference as PythonReferenceCatalog;
const pythonInterviewReferenceCatalog = pythonQuickReferenceInterview as PythonInterviewReferenceCatalog;
const pythonReferenceGuidanceCatalog = pythonQuickReferenceGuidance as PythonReferenceGuidance;
const pythonReferenceFilters = [
  ...pythonReferenceCatalog.filters,
  ...pythonInterviewReferenceCatalog.filters.filter((filter) => !pythonReferenceCatalog.filters.includes(filter)),
];
const pythonReferencePriority = new Map(
  pythonInterviewReferenceCatalog.priority.map((item, index) => [item.id, { frequency: item.frequency, index }]),
);
const baseSqlReferenceCatalog = sqlQuickReference as SqlReferenceCatalog;
const sqlTaskReferenceCatalog = sqlPracticalTasks as SqlReferenceCatalog;
const sqlReferenceCatalog: SqlReferenceCatalog = {
  topicFilters: baseSqlReferenceCatalog.topicFilters.includes("Tasks")
    ? baseSqlReferenceCatalog.topicFilters
    : baseSqlReferenceCatalog.topicFilters.flatMap((filter) => filter === "Dialect" ? ["Tasks", filter] : [filter]),
  dialectFilters: baseSqlReferenceCatalog.dialectFilters,
  cards: [...baseSqlReferenceCatalog.cards, ...sqlTaskReferenceCatalog.cards],
};
const qaReferenceCatalog = qaQuickReference as QaReferenceCatalog;

const qaReferenceLifecycleOrder = [
  "core-distinctions",
  "testing-principles",
  "software-lifecycle-models",
  "agile-shift-left",
  "fundamental-test-process",
  "test-plan-strategy-approach",
  "risk-based-testing",
  "prioritization",
  "good-requirements",
  "requirements-relationships",
  "traceability-impact",
  "static-reviews",
  "test-levels",
  "test-types",
  "quality-characteristics",
  "test-pyramid-quadrants",
  "test-design-families",
  "test-design-techniques",
  "equivalence-partitioning",
  "boundary-value-analysis",
  "decision-tables",
  "state-transition",
  "experience-based",
  "test-oracles",
  "test-case-anatomy",
  "test-documentation",
  "environment-data",
  "entry-exit",
  "smoke-vs-sanity",
  "white-box-coverage",
  "confirmation-regression",
  "severity-priority",
  "defect-report",
  "defect-lifecycle",
  "acceptance-uat-alpha-beta",
  "useful-metrics",
  "release-readiness",
  "root-cause-improvement",
] as const;

const qaReferenceLifecycleRank = new Map<string, number>(
  qaReferenceLifecycleOrder.map((id, index) => [id, index]),
);

const qaReferenceAbbreviations = [
  ["STLC", "Software Testing Life Cycle"],
  ["SDLC", "Software Development Life Cycle"],
  ["EP", "Equivalence Partitioning"],
  ["BVA", "Boundary Value Analysis"],
  ["ATDD", "Acceptance Test-Driven Development"],
  ["UAT", "User Acceptance Testing"],
  ["RTM", "Requirements Traceability Matrix"],
  ["RCA", "Root Cause Analysis"],
  ["CI", "Continuous Integration"],
] as const;

function expandQaReferenceAbbreviations(value: string) {
  return qaReferenceAbbreviations.reduce((expanded, [abbreviation, fullName]) => {
    const withoutParentheticalAlias = expanded.replace(new RegExp(`\\s*\\(${abbreviation}\\)`, "g"), "");
    return withoutParentheticalAlias.replace(new RegExp(`\\b${abbreviation}\\b`, "g"), fullName);
  }, value);
}

function clarifyQaReferenceRow(row: ReferenceRow): ReferenceRow {
  return {
    ...row,
    term: expandQaReferenceAbbreviations(row.term),
    meaning: row.meaning ? expandQaReferenceAbbreviations(row.meaning) : undefined,
    detail: expandQaReferenceAbbreviations(row.detail),
  };
}

function clarifyQaReferenceCard(card: ReferenceCard): ReferenceCard {
  return {
    ...card,
    title: expandQaReferenceAbbreviations(card.title),
    summary: card.summary ? expandQaReferenceAbbreviations(card.summary) : undefined,
    rows: card.rows?.map(clarifyQaReferenceRow),
    moreRows: card.moreRows?.map(clarifyQaReferenceRow),
    notes: card.notes?.map(expandQaReferenceAbbreviations),
  };
}

function qaReferenceCardRank(card: ReferenceCard, originalIndex: number) {
  const explicitRank = qaReferenceLifecycleRank.get(card.id);
  if (explicitRank !== undefined) return explicitRank;

  const title = card.title.toLowerCase();
  if (title.includes("software lifecycle")) return qaReferenceLifecycleRank.get("software-lifecycle-models") ?? originalIndex;
  if (title.includes("test design techniques")) return qaReferenceLifecycleRank.get("test-design-techniques") ?? originalIndex;
  return qaReferenceLifecycleOrder.length + originalIndex;
}

const qaReferenceCards: ReferenceCard[] = qaReferenceCatalog.cards
  .map(clarifyQaReferenceCard)
  .map((card, originalIndex) => ({ card, originalIndex }))
  .sort((left, right) => qaReferenceCardRank(left.card, left.originalIndex) - qaReferenceCardRank(right.card, right.originalIndex))
  .map(({ card }) => card);

function guidedRows(cardId: string, rows: ReferenceRow[]) {
  const explanations = pythonReferenceGuidanceCatalog.explanations[cardId] ?? {};
  return rows.map((row) => ({ ...row, meaning: row.meaning ?? explanations[row.term] }));
}

function pythonCardMeta(cardId: string) {
  const frequency = pythonReferencePriority.get(cardId)?.frequency;
  return frequency ? `Interview · ${frequency}` : undefined;
}

const basePythonReferenceCards: ReferenceCard[] = pythonReferenceCatalog.cards.flatMap((card) => {
  const primaryCard: ReferenceCard = {
    id: `python-${card.id}`,
    title: card.title,
    tags: card.tags,
    meta: pythonCardMeta(card.id),
    summary: pythonReferenceGuidanceCatalog.summaries[card.id],
    rows: guidedRows(card.id, card.entries),
    moreRows: guidedRows(card.id, card.more),
    searchTerms: card.tags,
  };
  const theoryCards = pythonReferenceGuidanceCatalog.theoryCards
    .filter((theoryCard) => theoryCard.after === card.id)
    .map((theoryCard): ReferenceCard => ({
      id: `python-${theoryCard.id}`,
      title: theoryCard.title,
      tags: theoryCard.tags,
      meta: pythonCardMeta(theoryCard.id),
      summary: theoryCard.summary,
      rows: theoryCard.entries,
      moreRows: theoryCard.more,
      searchTerms: [...theoryCard.tags, "theory", "concept", "mental model"],
    }));
  return [primaryCard, ...theoryCards];
});

const interviewPythonReferenceCards: ReferenceCard[] = pythonInterviewReferenceCatalog.cards.map((card) => ({
  id: `python-${card.id}`,
  title: card.title,
  tags: card.tags,
  meta: pythonCardMeta(card.id),
  summary: card.summary,
  rows: card.entries,
  moreRows: card.more,
  searchTerms: [...card.tags, "interview", "python"],
}));

const pythonReferenceCards: ReferenceCard[] = [...basePythonReferenceCards, ...interviewPythonReferenceCards].sort((a, b) => {
  const aId = a.id.replace(/^python-/, "");
  const bId = b.id.replace(/^python-/, "");
  const aOrder = pythonReferencePriority.get(aId)?.index ?? Number.MAX_SAFE_INTEGER;
  const bOrder = pythonReferencePriority.get(bId)?.index ?? Number.MAX_SAFE_INTEGER;
  return aOrder - bOrder;
});

const sqlReferenceCards: ReferenceCard[] = sqlReferenceCatalog.cards.map((card) => ({
  id: `sql-${card.id}`,
  title: card.title,
  topics: card.topics,
  dialects: card.dialects,
  tags: card.topics,
  meta: `${card.entries.length + card.more.length} refs`,
  summary: card.summary,
  rows: card.entries,
  moreRows: card.more,
  searchTerms: [...card.topics, ...card.dialects, "sql", "database", "data"],
}));

const referenceBlueprints: Record<string, string[]> = {
  automation: ["Locators", "Waits", "Assertions", "Fixtures", "Test architecture"],
  devops: ["CI/CD", "Containers", "Environments", "Deployment gates", "Rollback"],
};

const dataTrackLayout = `
.kb-subnav-switch {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 6px;
}

.kb-subnav-switch button {
  flex: none;
  min-width: 0;
  min-height: 40px;
  padding: 6px 7px;
  line-height: 1.15;
  white-space: normal;
  overflow-wrap: break-word;
}
`;

function slug(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
}

function placeholderCards(referenceId: string): ReferenceCard[] {
  return (referenceBlueprints[referenceId] ?? []).map((title) => ({ id: slug(title), title }));
}

function referenceCards(referenceId: string): ReferenceCard[] {
  if (referenceId === "programming") return pythonReferenceCards;
  if (referenceId === "data") return sqlReferenceCards;
  if (referenceId === "qa-fundamentals") return qaReferenceCards;
  return placeholderCards(referenceId);
}

function searchableCardText(card: ReferenceCard) {
  return [
    card.title,
    card.scope ?? "",
    card.meta ?? "",
    card.summary ?? "",
    ...(card.tags ?? []),
    ...(card.topics ?? []),
    ...(card.dialects ?? []),
    ...(card.rows ?? []).flatMap((row) => [row.term, row.meaning ?? "", row.detail]),
    ...(card.moreRows ?? []).flatMap((row) => [row.term, row.meaning ?? "", row.detail]),
    ...(card.code ?? []).flatMap((item) => [item.label, item.code]),
    ...(card.notes ?? []),
    ...(card.searchTerms ?? []),
  ].join(" ").toLowerCase();
}

function regularLearningHref(referenceId: string, topicId?: string, trackId?: string) {
  const path = referenceId === "qa-fundamentals"
    ? "/learn/qa-fundamentals"
    : referenceId === "programming"
      ? "/learn/programming"
      : referenceId === "automation"
        ? "/learn/automation"
        : referenceId === "data"
          ? "/learn/data"
          : "/learn/cloud-devops";
  const params = new URLSearchParams();
  if (trackId) params.set("track", trackId);
  if (topicId) params.set("topic", topicId);
  return params.size ? `${path}?${params.toString()}` : path;
}

function learningSubnav(referenceId: string): SubnavItem[] {
  if (referenceId === "programming") {
    const taxonomy = pythonTaxonomy as TaxonomyItem[];
    return taxonomy.filter((item) => item.level).map((item) => ({
      id: item.id,
      label: item.label,
      count: pythonCurriculum.lessons.filter((lesson) => lesson.moduleId === item.id).length || undefined,
    }));
  }
  if (referenceId === "automation") {
    const taxonomy = automationTaxonomy as TaxonomyItem[];
    return taxonomy.filter((item) => item.level).map((item) => ({
      id: item.id,
      label: item.label,
      count: automationCurriculum.lessons.filter((lesson) => lesson.moduleId === item.id).length || undefined,
    }));
  }
  if (referenceId === "qa-fundamentals") {
    const taxonomy = qaTaxonomy as TaxonomyItem[];
    const concepts = qaRequiredConcepts as RequiredConcept[];
    return taxonomy.map((item) => ({
      id: item.id,
      label: item.label,
      count: concepts.filter((concept) => concept.topicId === item.id).length || undefined,
    }));
  }
  if (referenceId === "data") {
    return sqlCurriculum.taxonomy.map((item) => ({
      id: item.id,
      label: item.navLabel ?? item.label,
      count: item.count || undefined,
    }));
  }
  const taxonomy = cloudDevopsTaxonomy as TaxonomyItem[];
  return taxonomy.map((item) => ({
    id: item.id,
    label: item.kind === "case-study" ? `${item.label} · Case study` : item.label,
  }));
}

function learningSwitcher(referenceId: string): SecondarySwitcher | undefined {
  if (referenceId === "programming") {
    return {
      activeId: "python",
      options: [{ id: "python", label: "Python" }, { id: "typescript", label: "TypeScript" }],
      onSelect: (id) => window.location.assign(regularLearningHref(referenceId, undefined, id)),
    };
  }
  if (referenceId === "automation") {
    return {
      activeId: "framework",
      options: [{ id: "framework", label: "Framework" }, { id: "test-architecture", label: "Test Architecture" }],
      onSelect: (id) => window.location.assign(regularLearningHref(referenceId, undefined, id)),
    };
  }
  if (referenceId === "data") {
    return {
      activeId: "sql",
      options: [
        { id: "sql", label: "SQL" },
        { id: "database-integrity", label: "Database integrity" },
        { id: "etl-and-elt", label: "ETL & ELT" },
        { id: "data-quality", label: "Data quality" },
        { id: "bi-semantics-and-lineage", label: "BI semantics & lineage" },
      ],
      onSelect: (id) => window.location.assign(regularLearningHref(referenceId, undefined, id)),
    };
  }
  return undefined;
}

function ReferenceRows({ cardId, rows, className = "" }: { cardId: string; rows: ReferenceRow[]; className?: string }) {
  return (
    <div className={`${styles.rows}${className ? ` ${className}` : ""}`}>
      {rows.map((row, index) => (
        <div className={`${styles.row}${row.meaning ? ` ${styles.explainedRow}` : ""}`} key={`${cardId}-row-${index}`}>
          <code>{row.term}</code>
          <span className={styles.rowContent}>
            {row.meaning ? <span className={styles.rowMeaning}>{row.meaning}</span> : null}
            <span className={styles.rowExample}>{row.detail}</span>
          </span>
        </div>
      ))}
    </div>
  );
}

export default function QuickReferencePage({ referenceId }: { referenceId: string }) {
  const learningGroup = navigationGroups.find((group) => group.id === "learning");
  const activeItem = learningGroup?.items.find((item) => item.id === referenceId);
  const cards = referenceCards(referenceId);
  const scopes = useMemo(() => {
    if (referenceId === "programming") return pythonReferenceFilters;
    if (referenceId === "data") return sqlReferenceCatalog.topicFilters;
    if (referenceId === "qa-fundamentals") return qaReferenceCatalog.filters;
    return ["All", ...Array.from(new Set(cards.map((card) => card.scope).filter((value): value is string => Boolean(value))))];
  }, [cards, referenceId]);
  const dialects = referenceId === "data" ? sqlReferenceCatalog.dialectFilters : ["All"];
  const [query, setQuery] = useState("");
  const [scope, setScope] = useState("All");
  const [dialect, setDialect] = useState("All");
  const [expandedCards, setExpandedCards] = useState<Set<string>>(() => new Set());
  const [mobileNav, setMobileNav] = useState(false);
  const normalizedQuery = query.trim().toLowerCase();
  const visibleCards = cards.filter((card) => {
    const scopeMatches = scope === "All" || card.scope === scope || card.tags?.includes(scope) || card.topics?.includes(scope);
    const dialectMatches = referenceId !== "data" || dialect === "All" || card.dialects?.includes(dialect) || (dialect !== "Portable" && card.dialects?.includes("Portable"));
    return scopeMatches && dialectMatches && (!normalizedQuery || searchableCardText(card).includes(normalizedQuery));
  });

  if (!activeItem || !supportedReferenceIds.has(referenceId)) {
    return <main className="kb-content"><div className="kb-empty"><strong>Quick reference not published</strong><span>This reference is limited to the learning paths that already use the document-style curriculum.</span></div></main>;
  }

  const external = activeItem.external === true;
  const activeSection = external ? null : activeItem.id as SiteSection;
  const activeExternalId = external ? activeItem.id as ExternalNavigationId : undefined;
  const secondaryItems = learningSubnav(referenceId);
  const secondarySwitcher = learningSwitcher(referenceId);
  const activeTrack = referenceId === "programming" ? "python" : referenceId === "automation" ? "framework" : referenceId === "data" ? "sql" : undefined;

  const selectLearningTopic = (topicId: string) => {
    window.location.assign(regularLearningHref(referenceId, topicId, activeTrack));
  };

  const toggleCard = (cardId: string) => {
    setExpandedCards((current) => {
      const next = new Set(current);
      if (next.has(cardId)) next.delete(cardId);
      else next.add(cardId);
      return next;
    });
  };

  return (
    <main className="kb-shell">
      {referenceId === "data" ? <style>{dataTrackLayout}</style> : null}
      <SiteSidebar
        activeExternalId={activeExternalId}
        activeSection={activeSection}
        activeSubsection=""
        mobileOpen={mobileNav}
        mode="public"
        onSelectSubsection={selectLearningTopic}
        personalHref="/workspace"
        quickReferenceActive
        secondaryItems={secondaryItems}
        secondarySwitcher={secondarySwitcher}
        secondaryTitle={activeItem.label}
      />

      <section className="kb-main">
        <button aria-expanded={mobileNav} aria-label="Toggle navigation" className="kb-floating-menu" onClick={() => setMobileNav((value) => !value)} type="button">☰</button>
        <div className={`kb-content ${styles.page}`}>
          <div className={styles.topbar} aria-label="Quick reference filters">
            <div className={styles.filterGroups} style={referenceId === "data" ? { flexDirection: "column", alignItems: "stretch", gap: 4 } : undefined}>
              <div className={styles.filterGroup}>
                {referenceId === "data" ? <span className={styles.filterLabel}>Topic</span> : null}
                <div className={styles.scopes} aria-label="Reference topic">
                  {scopes.map((item) => <button className={scope === item ? styles.active : ""} key={item} onClick={() => setScope(item)} type="button">{item}</button>)}
                </div>
              </div>
              {referenceId === "data" ? (
                <div className={styles.filterGroup}>
                  <span className={styles.filterLabel}>Dialect</span>
                  <div className={styles.scopes} aria-label="SQL dialect">
                    {dialects.map((item) => <button className={dialect === item ? styles.active : ""} key={item} onClick={() => setDialect(item)} type="button">{item}</button>)}
                  </div>
                </div>
              ) : null}
            </div>
            <label className={styles.search}>
              <span aria-hidden="true">⌕</span>
              <input aria-label={`Search ${activeItem.label} quick reference`} onChange={(event) => setQuery(event.target.value)} placeholder="Search topics, APIs, symbols…" value={query}/>
            </label>
          </div>

          <div className={styles.grid}>
            {visibleCards.map((card) => {
              const hasContent = Boolean(card.rows?.length || card.code?.length || card.notes?.length);
              const expanded = expandedCards.has(card.id);
              const showMoreRows = expanded || Boolean(normalizedQuery);
              const cardNumber = referenceId === "programming" || referenceId === "data" ? cards.findIndex((candidate) => candidate.id === card.id) + 1 : null;
              return (
                <article className={`${styles.card}${hasContent ? "" : ` ${styles.placeholder}`}${expanded ? ` ${styles.expandedCard}` : ""}`} key={card.id}>
                  <header className={styles.cardHeader}>
                    <div className={styles.cardTitle}>
                      {cardNumber ? <span className={styles.cardIndex}>{cardNumber}</span> : null}
                      <h2>{card.title}</h2>
                    </div>
                    {card.meta || card.scope ? <small>{card.meta ?? card.scope}</small> : null}
                  </header>
                  {card.summary ? <p className={styles.cardSummary}>{card.summary}</p> : null}
                  {card.rows?.length ? <ReferenceRows cardId={card.id} className={card.stackedRows ? styles.stackedRows : ""} rows={card.rows}/> : null}
                  {showMoreRows && card.moreRows?.length ? <ReferenceRows cardId={`${card.id}-more`} className={styles.moreRows} rows={card.moreRows}/> : null}
                  {!normalizedQuery && card.moreRows?.length ? <button aria-expanded={expanded} className={styles.moreButton} onClick={() => toggleCard(card.id)} type="button">{expanded ? "Less" : `More · ${card.moreRows.length}`}</button> : null}
                  {card.code?.length ? <div className={styles.codeList}>{card.code.map((item, index) => <div className={styles.codeItem} key={`${card.id}-code-${index}`}><span>{item.label}</span><pre><code>{item.code}</code></pre></div>)}</div> : null}
                  {card.notes?.length ? <ul className={styles.notes}>{card.notes.map((note, index) => <li key={`${card.id}-note-${index}`}>{note}</li>)}</ul> : null}
                  {!hasContent ? <div className={styles.placeholderBody}>Structure only.</div> : null}
                </article>
              );
            })}
            {visibleCards.length === 0 ? <div className={styles.empty}>No matches.</div> : null}
          </div>
        </div>
      </section>

      {mobileNav ? <button className="kb-backdrop" onClick={() => setMobileNav(false)} aria-label="Close navigation"/> : null}
    </main>
  );
}
