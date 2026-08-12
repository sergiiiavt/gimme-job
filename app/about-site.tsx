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
    </div>
  );
}
