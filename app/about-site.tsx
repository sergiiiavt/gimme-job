const technologyGroups = [
  { label: "Interface", value: "React 19 · TypeScript · Vinext App Router" },
  { label: "Edge", value: "Cloudflare Workers · static assets" },
  { label: "Data", value: "D1 · Drizzle migrations · private sessions" },
  { label: "Content", value: "Git-backed QA catalog · lazy-loaded modules" },
  { label: "Quality", value: "ESLint · type checks · Node tests · artifact validation" },
  { label: "Automation", value: "GitHub Actions · branch and PR delivery" },
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

export default function AboutSite() {
  return (
    <div className="kb-content about-page">
      <header className="about-hero">
        <div>
          <span>PET PROJECT / LIVE SYSTEM</span>
          <h1>A practical portfolio for QA engineering.</h1>
          <p>GimmeJob is where I demonstrate product thinking, quality strategy, frontend engineering, test automation, private data design, and cloud delivery in one working application.</p>
        </div>
        <div className="about-actions">
          <a href="https://github.com/sergiiiavt/gimmejob" target="_blank" rel="noreferrer">GitHub repository ↗</a>
          <a href="#interview">Explore 601 interview questions</a>
        </div>
      </header>

      <section className="about-proof" aria-label="Project scope">
        <div><strong>601</strong><span>researched QA questions</span></div>
        <div><strong>19</strong><span>interview topics</span></div>
        <div><strong>50</strong><span>source references</span></div>
        <div><strong>1</strong><span>live edge application</span></div>
      </section>

      <div className="about-grid">
        <section className="about-card about-card-stack">
          <header><span>01</span><div><h2>Technology map</h2><p>The current production stack, not a wishlist.</p></div></header>
          <div className="about-stack-list">
            {technologyGroups.map((group) => <div key={group.label}><strong>{group.label}</strong><span>{group.value}</span></div>)}
          </div>
        </section>

        <section className="about-card">
          <header><span>02</span><div><h2>Runtime architecture</h2><p>Public knowledge stays in Git; private user state stays in D1.</p></div></header>
          <Flow items={["Browser UI", "Worker router + API", "Git catalog / D1 private data"]}/>
        </section>

        <section className="about-card">
          <header><span>03</span><div><h2>Deployment flow</h2><p>Production changes have one auditable path.</p></div></header>
          <Flow items={["agent/* branch", "Draft PR + CI", "main", "Cloudflare Worker + D1"]}/>
        </section>
      </div>
    </div>
  );
}
