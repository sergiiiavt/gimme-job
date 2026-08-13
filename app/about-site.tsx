const technologyGroups = [
  { label: "Interface", value: "React 19 · TypeScript · Vinext App Router" },
  { label: "Edge", value: "Cloudflare Workers · static assets" },
  { label: "Data", value: "D1 · Drizzle migrations · signed private sessions" },
  { label: "Content", value: "Git-backed QA catalog · lazy-loaded modules" },
  { label: "Quality", value: "ESLint · type checks · Node tests · content validation" },
  { label: "Delivery", value: "GitHub Actions · reviewed branches · Cloudflare deployment" },
];

export default function AboutSite({ mode = "public" }: { mode?: "public" | "personal" }) {
  return (
    <div className="kb-content about-page">
      <header className="about-intro">
        <div>
          <h1>Technology stack</h1>
        </div>
        <nav className="about-links" aria-label="Project links">
          <a href="https://github.com/sergiiiavt/gimmejob" target="_blank" rel="noreferrer">View the source on GitHub ↗</a>
          <a href={mode === "personal" ? "/workspace/learn?section=interview" : "#interview"}>Open the interview catalog →</a>
        </nav>
      </header>

      <div className="about-stack-list about-stack-list-row">
        {technologyGroups.map((group) => <div key={group.label}><strong>{group.label}</strong><span>{group.value}</span></div>)}
      </div>

      <section className="about-mechanism">
        <h2>How vacancy analysis works</h2>
        <ol>
          <li><strong>Sync</strong> pulls vacancies from RSS (Dou, Djinni), Work.ua, Lobby X, and Gmail job-alert emails into the database. Nothing is sent anywhere at this step.</li>
          <li><strong>Analyze</strong> scores each vacancy against the candidate profile and drafts a tailored resume and application message. By default this is deterministic keyword/rule matching — no external API calls.</li>
          <li>If an OpenAI API key is configured, Analyze instead calls GPT with a fixed set of instructions (linked below) to score the vacancy and lightly adjust the candidate&apos;s existing resume for it — never inventing facts, never rewriting it from scratch. Any GPT failure falls back to the deterministic scoring automatically.</li>
          <li>Nothing is ever sent to an employer automatically; drafts stay in a pending state until manually approved.</li>
        </ol>
        <p className="about-mechanism-links">
          The exact instructions given to the model are plain text in the source, not hidden:
        </p>
        <nav className="about-links about-mechanism-source" aria-label="Analysis source links">
          <a href="https://github.com/sergiiiavt/gimmejob/blob/main/agent/src/analyst.ts#L48" target="_blank" rel="noreferrer">Local CLI instructions (analyst.ts) ↗</a>
          <a href="https://github.com/sergiiiavt/gimmejob/blob/main/app/api/_jobpilot.ts#L568" target="_blank" rel="noreferrer">Production instructions (_jobpilot.ts) ↗</a>
        </nav>
      </section>
    </div>
  );
}
