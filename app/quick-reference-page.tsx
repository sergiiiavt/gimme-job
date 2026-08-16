"use client";

import { useMemo, useState } from "react";
import automationCurriculum from "@/content/automation-learning/catalog";
import automationTaxonomy from "@/content/automation-learning/taxonomy.json";
import cloudDevopsTaxonomy from "@/content/cloud-devops/taxonomy.json";
import pythonCurriculum from "@/content/python-learning/catalog";
import pythonTaxonomy from "@/content/python-learning/taxonomy.json";
import qaRequiredConcepts from "@/content/qa-fundamentals/required-concepts.json";
import qaTaxonomy from "@/content/qa-fundamentals/taxonomy.json";
import { navigationGroups, SiteSidebar, type ExternalNavigationId, type SecondarySwitcher, type SiteSection, type SubnavItem } from "./site-navigation";
import styles from "./quick-reference-page.module.css";

type ReferenceRow = { term: string; detail: string };
type ReferenceCode = { label: string; code: string };
type ReferenceCard = {
  id: string;
  title: string;
  scope?: string;
  meta?: string;
  rows?: ReferenceRow[];
  code?: ReferenceCode[];
  notes?: string[];
  searchTerms?: string[];
};
type TaxonomyItem = { id: string; label: string; level?: string; kind?: string };
type RequiredConcept = { topicId: string };
type PythonLesson = {
  id: string;
  moduleId: string;
  level: string;
  title: string;
  summary: string;
  keyPoints?: string[];
  pitfalls?: string[];
  code?: string;
  codeCaption?: string;
  tags?: string[];
};

const supportedReferenceIds = new Set(["qa-fundamentals", "programming", "automation", "devops"]);
const pythonScopeOrder = ["Beginner", "Intermediate", "Advanced", "Expert"];

const referenceBlueprints: Record<string, string[]> = {
  "qa-fundamentals": ["Testing levels", "Test design", "Defects & evidence", "Risk & release"],
  automation: ["Locators", "Waits", "Assertions", "Fixtures", "Test architecture"],
  devops: ["CI/CD", "Containers", "Environments", "Deployment gates", "Rollback"],
};

function buildPythonReferenceCards(): ReferenceCard[] {
  const modules = (pythonTaxonomy as TaxonomyItem[]).filter((item) => item.level);
  const lessons = pythonCurriculum.lessons as PythonLesson[];

  return modules.map((curriculumModule) => {
    const moduleLessons = lessons.filter((lesson) => lesson.moduleId === curriculumModule.id);
    const exampleLesson = moduleLessons.find((lesson) => Boolean(lesson.code?.trim()));

    return {
      id: `python-${curriculumModule.id}`,
      title: curriculumModule.label,
      scope: curriculumModule.level,
      meta: `${curriculumModule.level} · ${moduleLessons.length} lessons`,
      rows: moduleLessons.map((lesson) => ({
        term: lesson.title,
        detail: lesson.keyPoints?.length ? lesson.keyPoints.join(" · ") : lesson.summary,
      })),
      code: exampleLesson?.code ? [{ label: exampleLesson.title, code: exampleLesson.code }] : undefined,
      searchTerms: moduleLessons.flatMap((lesson) => [
        lesson.summary,
        ...(lesson.keyPoints ?? []),
        ...(lesson.pitfalls ?? []),
        ...(lesson.tags ?? []),
        lesson.code ?? "",
        lesson.codeCaption ?? "",
      ]),
    };
  });
}

const pythonReferenceCards = buildPythonReferenceCards();

function slug(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
}

function placeholderCards(referenceId: string): ReferenceCard[] {
  return (referenceBlueprints[referenceId] ?? []).map((title) => ({ id: slug(title), title }));
}

function referenceCards(referenceId: string): ReferenceCard[] {
  return referenceId === "programming" ? pythonReferenceCards : placeholderCards(referenceId);
}

function searchableCardText(card: ReferenceCard) {
  return [
    card.title,
    card.scope ?? "",
    card.meta ?? "",
    ...(card.rows ?? []).flatMap((row) => [row.term, row.detail]),
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
  return undefined;
}

export default function QuickReferencePage({ referenceId }: { referenceId: string }) {
  const learningGroup = navigationGroups.find((group) => group.id === "learning");
  const activeItem = learningGroup?.items.find((item) => item.id === referenceId);
  const cards = referenceCards(referenceId);
  const scopes = useMemo(() => {
    if (referenceId === "programming") {
      return ["All", ...pythonScopeOrder.filter((level) => cards.some((card) => card.scope === level))];
    }
    return ["All", ...Array.from(new Set(cards.map((card) => card.scope).filter((value): value is string => Boolean(value))))];
  }, [cards, referenceId]);
  const [query, setQuery] = useState("");
  const [scope, setScope] = useState("All");
  const [mobileNav, setMobileNav] = useState(false);
  const normalizedQuery = query.trim().toLowerCase();
  const visibleCards = cards.filter((card) => (scope === "All" || card.scope === scope) && (!normalizedQuery || searchableCardText(card).includes(normalizedQuery)));

  if (!activeItem || !supportedReferenceIds.has(referenceId)) {
    return <main className="kb-content"><div className="kb-empty"><strong>Quick reference not published</strong><span>This reference is limited to the learning paths that already use the document-style curriculum.</span></div></main>;
  }

  const external = activeItem.external === true;
  const activeSection = external ? null : activeItem.id as SiteSection;
  const activeExternalId = external ? activeItem.id as ExternalNavigationId : undefined;
  const secondaryItems = learningSubnav(referenceId);
  const secondarySwitcher = learningSwitcher(referenceId);
  const activeTrack = referenceId === "programming" ? "python" : referenceId === "automation" ? "framework" : undefined;

  const selectLearningTopic = (topicId: string) => {
    window.location.assign(regularLearningHref(referenceId, topicId, activeTrack));
  };

  return (
    <main className="kb-shell">
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
            <div className={styles.scopes} aria-label="Reference scope">
              {scopes.map((item) => <button className={scope === item ? styles.active : ""} key={item} onClick={() => setScope(item)} type="button">{item}</button>)}
            </div>
            <label className={styles.search}>
              <span aria-hidden="true">⌕</span>
              <input aria-label={`Search ${activeItem.label} quick reference`} onChange={(event) => setQuery(event.target.value)} placeholder="Search…" value={query}/>
            </label>
          </div>

          <div className={styles.grid}>
            {visibleCards.map((card) => {
              const hasContent = Boolean(card.rows?.length || card.code?.length || card.notes?.length);
              return (
                <article className={`${styles.card}${hasContent ? "" : ` ${styles.placeholder}`}`} key={card.id}>
                  <header className={styles.cardHeader}>
                    <h2>{card.title}</h2>
                    {card.meta || card.scope ? <small>{card.meta ?? card.scope}</small> : null}
                  </header>
                  {card.rows?.length ? <div className={styles.rows}>{card.rows.map((row, index) => <div className={styles.row} key={`${card.id}-row-${index}`}><code>{row.term}</code><span>{row.detail}</span></div>)}</div> : null}
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
