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
  rows?: ReferenceRow[];
  code?: ReferenceCode[];
  notes?: string[];
};
type TaxonomyItem = { id: string; label: string; level?: string; kind?: string };
type RequiredConcept = { topicId: string };

const supportedReferenceIds = new Set(["qa-fundamentals", "programming", "automation", "devops"]);

const referenceBlueprints: Record<string, string[]> = {
  "qa-fundamentals": ["Testing levels", "Test design", "Defects & evidence", "Risk & release"],
  automation: ["Locators", "Waits", "Assertions", "Fixtures", "Test architecture"],
  devops: ["CI/CD", "Containers", "Environments", "Deployment gates", "Rollback"],
};

const sampleCards: Record<string, ReferenceCard[]> = {
  programming: [
    {
      id: "syntax-flow",
      title: "Syntax & flow",
      scope: "Python",
      rows: [
        { term: "if / elif / else", detail: "Branch on truthy / falsy expressions." },
        { term: "for x in xs", detail: "Iterate over any iterable." },
        { term: "while condition", detail: "Repeat while the condition remains truthy." },
        { term: "break / continue", detail: "Exit loop / skip to next iteration." },
        { term: "match value", detail: "Structural pattern matching in Python 3.10+." },
      ],
    },
    {
      id: "collections",
      title: "Collections",
      scope: "Python",
      rows: [
        { term: "list", detail: "Ordered, mutable sequence." },
        { term: "tuple", detail: "Ordered, immutable sequence." },
        { term: "set", detail: "Unique values; fast membership checks." },
        { term: "dict", detail: "Insertion-ordered key/value mapping." },
        { term: "x in collection", detail: "Membership test." },
      ],
      code: [
        { label: "Comprehension", code: "squares = [x * x for x in values if x > 0]" },
      ],
    },
    {
      id: "slicing-unpacking",
      title: "Slicing & unpacking",
      scope: "Python",
      rows: [
        { term: "xs[a:b:c]", detail: "Slice start : stop : step." },
        { term: "a, b = pair", detail: "Sequence unpacking." },
        { term: "head, *rest", detail: "Capture remaining items." },
        { term: "**mapping", detail: "Expand keyword arguments or mappings." },
      ],
    },
    {
      id: "functions",
      title: "Functions",
      scope: "Python",
      code: [
        { label: "Parameters", code: "def build(name, *, enabled=True, **meta):\n    return {\"name\": name, \"enabled\": enabled, **meta}" },
        { label: "Lambda", code: "sorted(users, key=lambda user: user.name)" },
      ],
      notes: [
        "Use keyword-only parameters for options that are easy to confuse positionally.",
        "Avoid mutable default arguments such as [] or {}.",
      ],
    },
    {
      id: "strings",
      title: "Strings",
      scope: "Python",
      rows: [
        { term: "f\"{value=}\"", detail: "Format and optionally show expression name." },
        { term: "text.split(',')", detail: "Split into parts." },
        { term: "','.join(parts)", detail: "Join strings efficiently." },
        { term: "text.strip()", detail: "Remove surrounding whitespace." },
        { term: "re.search(...) ", detail: "Search with regular expressions when simple string methods are insufficient." },
      ],
    },
    {
      id: "files-json",
      title: "Files & JSON",
      scope: "Python",
      code: [
        { label: "Text file", code: "from pathlib import Path\ntext = Path(\"report.txt\").read_text(encoding=\"utf-8\")" },
        { label: "JSON", code: "import json\nwith open(\"data.json\", encoding=\"utf-8\") as fh:\n    data = json.load(fh)" },
      ],
      notes: ["Prefer context managers for resources that must be closed.", "Use pathlib for path composition and common filesystem operations."],
    },
    {
      id: "exceptions",
      title: "Exceptions",
      scope: "Python",
      code: [
        { label: "Handle narrowly", code: "try:\n    payload = load_payload()\nexcept ValueError as exc:\n    raise InvalidPayload(str(exc)) from exc" },
      ],
      notes: ["Catch the narrowest useful exception.", "Use finally for cleanup that must happen regardless of success.", "Use raise ... from ... to preserve causal context."],
    },
    {
      id: "oop",
      title: "OOP & dataclasses",
      scope: "Python",
      code: [
        { label: "Dataclass", code: "from dataclasses import dataclass\n\n@dataclass(frozen=True)\nclass User:\n    id: str\n    active: bool = True" },
      ],
      notes: ["Prefer composition over inheritance when objects do not have a true is-a relationship.", "Use properties when attribute syntax needs controlled behavior."],
    },
    {
      id: "imports-env",
      title: "Imports & environment",
      scope: "Python",
      rows: [
        { term: "python -m venv .venv", detail: "Create isolated environment." },
        { term: "python -m pip install ...", detail: "Use pip through the selected interpreter." },
        { term: "python -m package.module", detail: "Run a module using package-aware imports." },
        { term: "if __name__ == '__main__'", detail: "Keep importable code separate from script entry behavior." },
      ],
    },
    {
      id: "iterators-generators",
      title: "Iterators & generators",
      scope: "Python",
      code: [
        { label: "Generator", code: "def active_users(users):\n    for user in users:\n        if user.active:\n            yield user" },
      ],
      notes: ["Generators produce values lazily and are useful for streams or large datasets.", "iter(x) gets an iterator; next(it) requests the next value."],
    },
    {
      id: "typing-pytest",
      title: "Typing & pytest",
      scope: "Python",
      code: [
        { label: "Type hint", code: "def total(values: list[int]) -> int:\n    return sum(values)" },
        { label: "Parametrize", code: "@pytest.mark.parametrize((\"value\", \"expected\"), [(1, True), (0, False)])\ndef test_truth(value, expected):\n    assert bool(value) is expected" },
      ],
      notes: ["Type hints help static tooling; Python still executes dynamically.", "Prefer plain assert statements in pytest tests."],
    },
    {
      id: "concurrency",
      title: "Concurrency",
      scope: "Python",
      rows: [
        { term: "asyncio", detail: "Cooperative concurrency for many I/O-bound tasks." },
        { term: "threading", detail: "Useful for blocking I/O and integrations with synchronous libraries." },
        { term: "multiprocessing", detail: "Separate processes for CPU-bound parallel work." },
        { term: "await", detail: "Suspend current coroutine until awaitable completes." },
      ],
    },
    {
      id: "debugging-tools",
      title: "Debugging & tooling",
      scope: "Python",
      rows: [
        { term: "breakpoint()", detail: "Enter the debugger at a specific line." },
        { term: "python -m pytest -q", detail: "Run pytest through the active interpreter." },
        { term: "python -m compileall .", detail: "Compile modules and catch syntax errors quickly." },
        { term: "logging", detail: "Prefer structured diagnostics over scattered print calls in application code." },
      ],
    },
    {
      id: "gotchas",
      title: "Common gotchas",
      scope: "Python",
      notes: [
        "== compares values; is checks object identity.",
        "Mutable default arguments persist between calls.",
        "A shallow copy does not recursively copy nested objects.",
        "late-bound closures capture variables, not their historical values.",
        "Do not rely on truthiness when 0, empty string, and None have different business meanings.",
      ],
    },
    {
      id: "typescript-placeholder",
      title: "TypeScript",
      scope: "TypeScript",
      notes: ["Reference content will follow the TypeScript learning track when that track is published."],
    },
  ],
};

function slug(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
}

function placeholderCards(referenceId: string): ReferenceCard[] {
  return (referenceBlueprints[referenceId] ?? []).map((title) => ({ id: slug(title), title }));
}

function searchableCardText(card: ReferenceCard) {
  return [
    card.title,
    card.scope ?? "",
    ...(card.rows ?? []).flatMap((row) => [row.term, row.detail]),
    ...(card.code ?? []).flatMap((item) => [item.label, item.code]),
    ...(card.notes ?? []),
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
  const cards = sampleCards[referenceId] ?? placeholderCards(referenceId);
  const scopes = useMemo(() => ["All", ...Array.from(new Set(cards.map((card) => card.scope).filter((value): value is string => Boolean(value))))], [cards]);
  const [query, setQuery] = useState("");
  const [scope, setScope] = useState(referenceId === "programming" && scopes.includes("Python") ? "Python" : "All");
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
                    {card.scope ? <small>{card.scope}</small> : null}
                  </header>
                  {card.rows?.length ? <div className={styles.rows}>{card.rows.map((row) => <div className={styles.row} key={`${row.term}-${row.detail}`}><code>{row.term}</code><span>{row.detail}</span></div>)}</div> : null}
                  {card.code?.length ? <div className={styles.codeList}>{card.code.map((item) => <div className={styles.codeItem} key={item.label}><span>{item.label}</span><pre><code>{item.code}</code></pre></div>)}</div> : null}
                  {card.notes?.length ? <ul className={styles.notes}>{card.notes.map((note) => <li key={note}>{note}</li>)}</ul> : null}
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
