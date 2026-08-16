"use client";

import { useEffect, useMemo, useState } from "react";
import { navigationGroups, SiteSidebar, type ExternalNavigationId, type SiteSection, type SubnavItem } from "./site-navigation";
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

const referenceBlueprints: Record<string, string[]> = {
  "qa-fundamentals": ["Testing levels", "Test design", "Defects & evidence", "Risk & release"],
  certifications: ["ISTQB map", "Cloud certifications", "Security certifications", "AI certifications"],
  llm: ["Prompt patterns", "Evaluation", "RAG", "Safety & security", "Operational signals"],
  agentic: ["Agent loop", "Tools", "MCP", "Memory", "Approval gates"],
  programming: ["Python core", "Python testing", "TypeScript core", "Async patterns", "Common gotchas"],
  automation: ["Locators", "Waits", "Assertions", "Fixtures", "Test architecture"],
  "testing-tools": ["Browser DevTools", "API clients", "Traffic inspection", "Logs & diagnostics", "Test data"],
  api: ["HTTP methods", "Common status codes", "Headers & auth", "curl patterns", "Integration failure checks"],
  data: ["SELECT & filtering", "JOINs", "Aggregations", "Constraints", "BI validation"],
  mobile: ["Lifecycle", "Permissions", "Device matrix", "Network changes", "Accessibility"],
  embedded: ["Interfaces", "Timing", "Power loss", "HIL", "OTA & rollback"],
  performance: ["Workload model", "Load types", "Latency & throughput", "Saturation", "Recovery"],
  security: ["OWASP map", "Authentication", "Authorization", "Headers", "Secrets & data"],
  devops: ["CI/CD", "Containers", "Environments", "Deployment gates", "Rollback"],
  observability: ["Logs", "Metrics", "Traces", "SLIs & SLOs", "Alert quality"],
  networking: ["TCP/IP", "DNS", "TLS", "HTTP path", "Diagnostic commands"],
  linux: ["Filesystem", "Permissions", "Processes", "Services", "Network commands"],
  standards: ["Standards map", "Terminology", "Required evidence", "Traceability", "Audit checks"],
  "metrics-estimation": ["Quality metrics", "Flow metrics", "Defect metrics", "Estimation methods", "Interpretation rules"],
  strategy: ["Risk model", "Quality gates", "Release decision", "Metrics", "Leadership prompts"],
};

const sampleCards: Record<string, ReferenceCard[]> = {
  api: [
    {
      id: "http-methods",
      title: "HTTP methods",
      rows: [
        { term: "GET", detail: "Read a resource; should not change server state." },
        { term: "POST", detail: "Create or process; commonly non-idempotent." },
        { term: "PUT", detail: "Replace the target representation; designed to be idempotent." },
        { term: "PATCH", detail: "Apply a partial modification." },
        { term: "DELETE", detail: "Remove the target resource." },
      ],
    },
    {
      id: "status-codes",
      title: "Common status codes",
      rows: [
        { term: "200", detail: "OK" },
        { term: "201", detail: "Created" },
        { term: "204", detail: "Success with no response body" },
        { term: "400", detail: "Malformed or invalid request" },
        { term: "401", detail: "Authentication required or failed" },
        { term: "403", detail: "Authenticated but not allowed" },
        { term: "404", detail: "Resource not found" },
        { term: "409", detail: "Conflict with current resource state" },
        { term: "422", detail: "Syntactically valid but semantically invalid content" },
        { term: "429", detail: "Too many requests" },
        { term: "500 / 503", detail: "Server failure / temporarily unavailable" },
      ],
    },
    {
      id: "headers-auth",
      title: "Headers & auth",
      rows: [
        { term: "Authorization", detail: "Bearer <token>" },
        { term: "Content-Type", detail: "Format of the request body, e.g. application/json" },
        { term: "Accept", detail: "Response media types the client can process" },
        { term: "Cache-Control", detail: "Caching directives for requests and responses" },
        { term: "Idempotency-Key", detail: "Common API pattern for safely retrying selected writes" },
      ],
    },
    {
      id: "curl-patterns",
      title: "curl patterns",
      code: [
        { label: "GET with headers", code: "curl -i -H 'Authorization: Bearer TOKEN' https://api.example.test/users/42" },
        { label: "POST JSON", code: "curl -i -X POST -H 'Content-Type: application/json' -d '{\"name\":\"Ada\"}' https://api.example.test/users" },
        { label: "See timing", code: "curl -sS -o /dev/null -w '%{http_code} %{time_total}\\n' https://api.example.test/health" },
      ],
    },
    {
      id: "integration-failures",
      title: "Integration failure checks",
      notes: [
        "Timeout: verify the caller stops waiting and returns a controlled error.",
        "Retry: verify only safe operations are repeated and backoff is bounded.",
        "Duplicate delivery: verify idempotency or deduplication where required.",
        "Partial failure: verify state remains consistent when one dependency fails.",
        "Rate limit: verify 429 handling and any Retry-After behavior used by the API.",
      ],
    },
  ],
  programming: [
    {
      id: "python-core",
      title: "Python core",
      scope: "Python",
      rows: [
        { term: "list", detail: "Ordered, mutable sequence" },
        { term: "tuple", detail: "Ordered, immutable sequence" },
        { term: "set", detail: "Unique values; fast membership checks" },
        { term: "dict", detail: "Key/value mapping" },
        { term: "with", detail: "Context manager for deterministic cleanup" },
      ],
    },
    {
      id: "python-testing",
      title: "Python testing",
      scope: "Python",
      code: [
        { label: "Pytest assertion", code: "def test_total():\n    assert calculate_total([2, 3]) == 5" },
        { label: "Parametrize", code: "@pytest.mark.parametrize(('value', 'expected'), [(1, True), (0, False)])\ndef test_truth(value, expected):\n    assert bool(value) is expected" },
      ],
    },
    {
      id: "typescript-core",
      title: "TypeScript core",
      scope: "TypeScript",
      code: [
        { label: "Object type", code: "type User = {\n  id: string;\n  active: boolean;\n};" },
        { label: "Union narrowing", code: "function printId(id: string | number) {\n  if (typeof id === 'string') return id.toUpperCase();\n  return id.toString();\n}" },
      ],
    },
    {
      id: "async-patterns",
      title: "Async patterns",
      scope: "TypeScript",
      code: [
        { label: "Await response", code: "const response = await fetch(url);\nif (!response.ok) throw new Error(`HTTP ${response.status}`);\nconst body = await response.json();" },
      ],
      notes: ["Await the promise you need; avoid fire-and-forget work in tests unless it is deliberate.", "Use Promise.all when operations are independent and parallel execution is intended."],
    },
    {
      id: "common-gotchas",
      title: "Common gotchas",
      notes: [
        "Python: mutable default arguments persist between calls.",
        "Python: == compares values; is checks object identity.",
        "TypeScript: type information is erased at runtime.",
        "TypeScript: optional chaining prevents access errors; it does not validate business meaning.",
      ],
    },
  ],
  linux: [
    {
      id: "filesystem",
      title: "Filesystem",
      rows: [
        { term: "pwd", detail: "Print current directory" },
        { term: "ls -lah", detail: "List files, including hidden files, with readable sizes" },
        { term: "find . -name '*.log'", detail: "Find matching files recursively" },
        { term: "du -sh *", detail: "Summarize disk usage for entries in the current directory" },
        { term: "df -h", detail: "Show filesystem capacity and free space" },
      ],
    },
    {
      id: "permissions",
      title: "Permissions",
      rows: [
        { term: "r / w / x", detail: "Read / write / execute" },
        { term: "chmod 640 file", detail: "Owner rw, group r, others none" },
        { term: "chmod +x script.sh", detail: "Add execute permission" },
        { term: "chown user:group file", detail: "Change owner and group" },
      ],
    },
    {
      id: "processes",
      title: "Processes",
      code: [
        { label: "Find a process", code: "ps aux | grep '[n]ode'" },
        { label: "Follow resource use", code: "top" },
        { label: "Send normal termination", code: "kill <pid>" },
      ],
    },
    {
      id: "services",
      title: "Services & logs",
      code: [
        { label: "Service status", code: "systemctl status my-service" },
        { label: "Recent unit logs", code: "journalctl -u my-service -n 100 --no-pager" },
        { label: "Follow a file", code: "tail -f /var/log/app.log" },
      ],
    },
    {
      id: "network-commands",
      title: "Network commands",
      code: [
        { label: "Listening sockets", code: "ss -lntp" },
        { label: "DNS lookup", code: "dig example.com" },
        { label: "HTTP/TLS request", code: "curl -v https://example.com" },
      ],
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

export default function QuickReferencePage({ referenceId }: { referenceId: string }) {
  const learningGroup = navigationGroups.find((group) => group.id === "learning");
  const activeItem = learningGroup?.items.find((item) => item.id === referenceId);
  const [query, setQuery] = useState("");
  const [scope, setScope] = useState("All");
  const cards = sampleCards[referenceId] ?? placeholderCards(referenceId);
  const scopes = useMemo(() => ["All", ...Array.from(new Set(cards.map((card) => card.scope).filter((value): value is string => Boolean(value))))], [cards]);
  const normalizedQuery = query.trim().toLowerCase();
  const visibleCards = cards.filter((card) => (scope === "All" || card.scope === scope) && (!normalizedQuery || searchableCardText(card).includes(normalizedQuery)));
  const [activeSubsection, setActiveSubsection] = useState(cards[0]?.id ?? "all");

  useEffect(() => {
    const ids = cards.map((card) => card.id);
    const observer = new IntersectionObserver((entries) => {
      const visible = entries.filter((entry) => entry.isIntersecting).sort((left, right) => left.boundingClientRect.top - right.boundingClientRect.top)[0];
      if (visible?.target.id) setActiveSubsection(visible.target.id.replace("reference-", ""));
    }, { rootMargin: "-18% 0px -68% 0px", threshold: [0, 1] });
    ids.forEach((id) => {
      const element = document.getElementById(`reference-${id}`);
      if (element) observer.observe(element);
    });
    return () => observer.disconnect();
  }, [cards]);

  if (!activeItem) {
    return <main className="kb-content"><div className="kb-empty"><strong>Unknown reference topic</strong><span>Choose a Learning path topic from the main navigation.</span></div></main>;
  }

  const external = activeItem.external === true;
  const activeSection = external ? null : activeItem.id as SiteSection;
  const activeExternalId = external ? activeItem.id as ExternalNavigationId : undefined;
  const secondaryItems: SubnavItem[] = cards.map((card) => ({ id: card.id, label: card.title }));

  const selectSubsection = (id: string) => {
    setActiveSubsection(id);
    document.getElementById(`reference-${id}`)?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  return (
    <main className="kb-shell">
      <SiteSidebar
        activeExternalId={activeExternalId}
        activeSection={activeSection}
        activeSubsection={activeSubsection}
        mobileOpen={false}
        mode="public"
        onSelectSubsection={selectSubsection}
        personalHref="/workspace"
        quickReferenceActive
        secondaryItems={secondaryItems}
        secondaryTitle={activeItem.label}
      />

      <section className="kb-main">
        <div className={`kb-content ${styles.page}`}>
          <header className={styles.hero}>
            <div>
              <div className={styles.eyebrow}><span>Quick reference</span><span className={styles.prototype}>Prototype</span></div>
              <h1>{activeItem.label}</h1>
              <p>One-page scan surface. Dense facts, commands and patterns only; long explanations stay in the Learning path.</p>
            </div>
            <label className={styles.search}>
              <span aria-hidden="true">⌕</span>
              <input aria-label={`Search ${activeItem.label} quick reference`} onChange={(event) => setQuery(event.target.value)} placeholder="Filter this reference…" value={query}/>
              <kbd>filter</kbd>
            </label>
          </header>

          <div className={styles.toolbar} aria-label="Reference scope">
            {scopes.map((item) => <button className={scope === item ? styles.active : ""} key={item} onClick={() => setScope(item)} type="button">{item}</button>)}
            <span className={styles.resultCount}>{visibleCards.length} / {cards.length} cards</span>
          </div>

          <div className={styles.grid}>
            {visibleCards.map((card) => {
              const hasContent = Boolean(card.rows?.length || card.code?.length || card.notes?.length);
              return (
                <article className={`${styles.card}${hasContent ? "" : ` ${styles.placeholder}`}`} id={`reference-${card.id}`} key={card.id}>
                  <header className={styles.cardHeader}>
                    <h2>{card.title}</h2>
                    <small>{card.scope ?? (hasContent ? "reference" : "structure only")}</small>
                  </header>
                  {card.rows?.length ? <div className={styles.rows}>{card.rows.map((row) => <div className={styles.row} key={`${row.term}-${row.detail}`}><code>{row.term}</code><span>{row.detail}</span></div>)}</div> : null}
                  {card.code?.length ? <div className={styles.codeList}>{card.code.map((item) => <div className={styles.codeItem} key={item.label}><span>{item.label}</span><pre><code>{item.code}</code></pre></div>)}</div> : null}
                  {card.notes?.length ? <ul className={styles.notes}>{card.notes.map((note) => <li key={note}>{note}</li>)}</ul> : null}
                  {!hasContent ? <div className={styles.placeholderBody}>Reference slot is wired into navigation; content intentionally not written in this prototype.</div> : null}
                </article>
              );
            })}
            {visibleCards.length === 0 ? <div className={styles.empty}>No cards match this filter.</div> : null}
          </div>
        </div>
      </section>
    </main>
  );
}
