const technologyGroups = [
  { label: "Interface", value: "React 19 · TypeScript · Vinext App Router" },
  { label: "Edge", value: "Cloudflare Workers · static assets" },
  { label: "Data", value: "D1 · Drizzle migrations · signed private sessions" },
  { label: "Content", value: "Git-backed QA catalog · lazy-loaded modules" },
  { label: "Quality", value: "ESLint · type checks · Node tests · content validation" },
  { label: "Delivery", value: "GitHub Actions · reviewed branches · Cloudflare deployment" },
];

const productAreas = [
  {
    title: "Interview preparation",
    copy: "An additive QA catalog with sourced answers, AND search, multi-select filters, learning progress, and a strict 60-row render cap.",
    tags: ["Research", "Taxonomy", "Learning UX"],
  },
  {
    title: "Career workspace",
    copy: "A sanitized public vacancy feed sits beside private D1-backed application statuses, relevance feedback, learning progress, and resume details.",
    tags: ["Product design", "Private state", "D1"],
  },
  {
    title: "Quality engineering",
    copy: "ID and source validation, linting, type checks, behavior tests, artifact inspection, and live checks gate every production change.",
    tags: ["Automation", "Risk controls", "CI"],
  },
  {
    title: "Working experiments",
    copy: "Lazy catalog chunks, the full-screen Fight AI slop game, responsive layouts, and accessible controls exercise real interface tradeoffs.",
    tags: ["Frontend", "Accessibility", "Performance"],
  },
];

const qualityGates = [
  "Validate every question ID, source, answer, topic, and prevalence value",
  "Lint and type-check the web application and local collection agent",
  "Build and inspect the Worker, static assets, D1 binding, and lazy chunks",
  "Run behavioural tests before merge and verify production after deployment",
];

function Flow({ items }: { items: string[] }) {
  return (
    <div className="about-flow">
      {items.map((item, index) => (
        <div key={item}>
          <span>{String(index + 1).padStart(2, "0")}</span>
          <strong>{item}</strong>
          {index < items.length - 1 && <i aria-hidden="true">→</i>}
        </div>
      ))}
    </div>
  );
}

export default function AboutSite({ mode = "public" }: { mode?: "public" | "personal" }) {
  return (
    <div className="kb-content about-page">
      <header className="about-intro">
        <div>
          <span>PRODUCTION PET PROJECT · QA ENGINEERING PORTFOLIO</span>
          <h1>A working skills showcase, built and operated in production.</h1>
          <p>GimmeJob is my production pet project for demonstrating practical QA, product, and engineering skills. It brings together at least 672 researched QA interview questions across 19+ topics and 67 referenced sources, private career and learning tools, automated quality gates, and a GitHub Actions → Cloudflare delivery pipeline.</p>
        </div>
        <nav className="about-links" aria-label="Project links">
          <a href="https://github.com/sergiiiavt/gimmejob" target="_blank" rel="noreferrer">View the source on GitHub ↗</a>
          <a href={mode === "personal" ? "/workspace/learn?section=interview" : "#interview"}>Open the interview catalog →</a>
        </nav>
      </header>

      <section className="about-proof" aria-label="Project scope">
        <div><strong>672</strong><span>researched QA questions</span></div>
        <div><strong>19+</strong><span>interview topics</span></div>
        <div><strong>67</strong><span>source references</span></div>
        <div><strong>60</strong><span>maximum rendered rows</span></div>
      </section>

      <section className="about-product">
        <header className="about-section-head"><span>WHAT IT DEMONSTRATES</span><h2>One project, several kinds of engineering evidence</h2><p>Every area below is implemented and available in this production application.</p></header>
        <div className="about-product-grid">
          {productAreas.map((area, index) => (
            <article key={area.title}>
              <small>{String(index + 1).padStart(2, "0")}</small>
              <h3>{area.title}</h3>
              <p>{area.copy}</p>
              <footer>{area.tags.map((tag) => <span key={tag}>{tag}</span>)}</footer>
            </article>
          ))}
        </div>
      </section>

      <div className="about-grid">
        <section className="about-card about-card-stack">
          <header><span>05</span><div><h2>Technology map</h2><p>The current production stack and the responsibility of each layer.</p></div></header>
          <div className="about-stack-list">
            {technologyGroups.map((group) => <div key={group.label}><strong>{group.label}</strong><span>{group.value}</span></div>)}
          </div>
        </section>

        <section className="about-card">
          <header><span>06</span><div><h2>Runtime architecture</h2><p>Public routes combine the Git catalog with a sanitized D1 vacancy projection; authenticated routes unlock private D1 state.</p></div></header>
          <Flow items={["Browser UI", "Worker routes", "Public: Git + sanitized vacancies · Private: authenticated D1"]}/>
        </section>

        <section className="about-card">
          <header><span>07</span><div><h2>Deployment flow</h2><p>Production changes have one reviewable path, with no direct local deployment.</p></div></header>
          <Flow items={["agent/* branch", "Draft PR + CI", "main", "Cloudflare Worker + D1"]}/>
        </section>
      </div>

      <section className="about-detail-grid">
        <article>
          <span>QUALITY GATES</span>
          <h2>What must pass</h2>
          <ol>{qualityGates.map((gate) => <li key={gate}>{gate}</li>)}</ol>
        </article>
        <article>
          <span>DATA BOUNDARY</span>
          <h2>What is public and private</h2>
          <dl>
            <div><dt>Git</dt><dd>Public questions, answers, sources, learning material, interface code, and deployment history.</dd></div>
            <div><dt>D1</dt><dd>Sanitized vacancies are projected publicly; learning progress, resume contact details, and application state require authentication.</dd></div>
            <div><dt>Sessions</dt><dd>Protected workspace and write APIs; public pages cannot read personal settings.</dd></div>
          </dl>
        </article>
      </section>
    </div>
  );
}
