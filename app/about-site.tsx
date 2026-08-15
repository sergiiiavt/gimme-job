import type { ReactNode } from "react";
import {
  ABOUT_OVERVIEW,
  CODE_QUALITY,
  DATABASE,
  DEPLOYMENT,
  GRAFANA,
  N8N,
  OPENAI,
  PURPOSE_CARDS,
  REPO_URL,
  type AboutIcon,
  type AboutLink,
  type AboutAccent,
} from "./about-site-content";

function AboutIconSvg({ kind, className }: { kind: AboutIcon; className?: string }) {
  const common = {
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 1.8,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
  };

  switch (kind) {
    case "search":
      return <svg aria-hidden="true" className={className} viewBox="0 0 24 24" width="1em" height="1em"><circle cx="11" cy="11" r="6" {...common}/><path d="m16 16 4.5 4.5" {...common}/></svg>;
    case "code":
      return <svg aria-hidden="true" className={className} viewBox="0 0 24 24" width="1em" height="1em"><path d="m9 6-5 6 5 6" {...common}/><path d="m15 6 5 6-5 6" {...common}/></svg>;
    case "ai":
      return <svg aria-hidden="true" className={className} viewBox="0 0 24 24" width="1em" height="1em"><circle cx="12" cy="5" r="2" {...common}/><circle cx="6" cy="12" r="2" {...common}/><circle cx="18" cy="12" r="2" {...common}/><circle cx="12" cy="19" r="2" {...common}/><path d="M12 7v4M8 12h8M12 13v4" {...common}/></svg>;
    case "book":
      return <svg aria-hidden="true" className={className} viewBox="0 0 24 24" width="1em" height="1em"><path d="M4 6.5A2.5 2.5 0 0 1 6.5 4H19v15H6.5A2.5 2.5 0 0 0 4 21z" {...common}/><path d="M8 7h7" {...common}/><path d="M8 11h7" {...common}/></svg>;
    case "github":
      return <svg aria-hidden="true" className={className} viewBox="0 0 24 24" width="1em" height="1em"><path d="M9.5 18.8v-2.2c-2.9.9-3.5-1.2-3.5-1.2-.5-1.2-1.2-1.5-1.2-1.5 1-.7 2 0 2 0 1 .9 2.3.7 2.9.5.1-.8.4-1.3.7-1.6-2.3-.3-4.7-1.1-4.7-5.1 0-1.1.4-2 1-2.7-.1-.2-.4-1.3.1-2.7 0 0 .9-.3 2.9 1 .8-.2 1.7-.3 2.6-.3.9 0 1.8.1 2.6.3 2-1.3 2.9-1 2.9-1 .5 1.4.2 2.5.1 2.7.6.7 1 1.6 1 2.7 0 4-2.4 4.8-4.8 5.1.4.3.8 1 .8 2v3" {...common}/></svg>;
    case "actions":
      return <svg aria-hidden="true" className={className} viewBox="0 0 24 24" width="1em" height="1em"><path d="M8 4h8l-5 7h4l-7 9 2-7H6z" {...common}/></svg>;
    case "cloudflare":
      return <svg aria-hidden="true" className={className} viewBox="0 0 24 24" width="1em" height="1em"><path d="M7 15a3 3 0 0 1 3-3h.3A4.7 4.7 0 0 1 19 11a3 3 0 0 1 .5 6H8.2A2.2 2.2 0 0 1 7 15z" {...common}/><path d="M6 17h11" {...common}/></svg>;
    case "worker":
      return <svg aria-hidden="true" className={className} viewBox="0 0 24 24" width="1em" height="1em"><path d="M4 6h16v12H4z" {...common}/><path d="M8 10h8M8 14h5" {...common}/></svg>;
    case "asset":
      return <svg aria-hidden="true" className={className} viewBox="0 0 24 24" width="1em" height="1em"><rect x="4" y="4" width="16" height="16" rx="2" {...common}/><path d="m8 15 3-3 2 2 3-4" {...common}/></svg>;
    case "database":
      return <svg aria-hidden="true" className={className} viewBox="0 0 24 24" width="1em" height="1em"><ellipse cx="12" cy="6" rx="7" ry="3" {...common}/><path d="M5 6v6c0 1.7 3.1 3 7 3s7-1.3 7-3V6" {...common}/><path d="M5 12v6c0 1.7 3.1 3 7 3s7-1.3 7-3v-6" {...common}/></svg>;
    case "jobs":
      return <svg aria-hidden="true" className={className} viewBox="0 0 24 24" width="1em" height="1em"><rect x="3" y="6" width="18" height="13" rx="2" {...common}/><path d="M8 6V4h8v2M3 11h18" {...common}/></svg>;
    case "analysis":
      return <svg aria-hidden="true" className={className} viewBox="0 0 24 24" width="1em" height="1em"><path d="M5 19V9M10 19V5M15 19v-7M20 19v-3" {...common}/></svg>;
    case "settings":
      return <svg aria-hidden="true" className={className} viewBox="0 0 24 24" width="1em" height="1em"><circle cx="12" cy="12" r="3" {...common}/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1-1.7 3-1.1-.3a1.7 1.7 0 0 0-1.8.7l-.6 1.1h-3.4l-.6-1.1a1.7 1.7 0 0 0-1.8-.7l-1.1.3-1.7-3 .1-.1A1.7 1.7 0 0 0 4.6 15l-1.1-.4v-3.2l1.1-.4a1.7 1.7 0 0 0 .8-2.6l-.1-.1 1.7-3 1.1.3a1.7 1.7 0 0 0 1.8-.7l.6-1.1h3.4l.6 1.1a1.7 1.7 0 0 0 1.8.7l1.1-.3 1.7 3-.1.1a1.7 1.7 0 0 0 .8 2.6l1.1.4v3.2z" {...common}/></svg>;
    case "observability":
      return <svg aria-hidden="true" className={className} viewBox="0 0 24 24" width="1em" height="1em"><path d="M3 12h4l2-4 3 8 2-4h7" {...common}/></svg>;
    case "document":
      return <svg aria-hidden="true" className={className} viewBox="0 0 24 24" width="1em" height="1em"><path d="M7 3h7l4 4v14H7z" {...common}/><path d="M14 3v4h4M10 12h5M10 16h5" {...common}/></svg>;
    case "openai":
      return <svg aria-hidden="true" className={className} viewBox="0 0 24 24" width="1em" height="1em"><path d="m12 3 3 1.8v3.4L12 10l-3-1.8V4.8z" {...common}/><path d="m9 8.2-3 1.8v3.4l3 1.8" {...common}/><path d="m15 8.2 3 1.8v3.4l-3 1.8" {...common}/><path d="m9 15.2 3 1.8 3-1.8" {...common}/></svg>;
    case "recognition":
      return <svg aria-hidden="true" className={className} viewBox="0 0 24 24" width="1em" height="1em"><rect x="4" y="5" width="16" height="14" rx="2" {...common}/><path d="M8 9h8M8 13h8M8 17h5" {...common}/></svg>;
    case "draft":
      return <svg aria-hidden="true" className={className} viewBox="0 0 24 24" width="1em" height="1em"><path d="M4 20h4l10-10-4-4L4 16z" {...common}/><path d="m12 6 4 4" {...common}/></svg>;
    case "fallback":
      return <svg aria-hidden="true" className={className} viewBox="0 0 24 24" width="1em" height="1em"><path d="M5 12a7 7 0 1 1 2 4.9" {...common}/><path d="M5 8v4h4" {...common}/></svg>;
    case "grafana":
      return <svg aria-hidden="true" className={className} viewBox="0 0 24 24" width="1em" height="1em"><path d="M6 14c0-2.7 2-5 4.7-5.4.8-1.5 2.5-2.6 4.5-2.6 2.8 0 5 2.2 5 5 0 1.7-.8 3.1-2.1 4" {...common}/><path d="M4 18c.5-2.5 2.5-4.3 5-4.3 2.7 0 4.9 2 5.2 4.6" {...common}/></svg>;
    case "dashboard":
      return <svg aria-hidden="true" className={className} viewBox="0 0 24 24" width="1em" height="1em"><rect x="4" y="4" width="16" height="16" rx="2" {...common}/><path d="M8 16V9M12 16v-3M16 16V7" {...common}/></svg>;
    case "alert":
      return <svg aria-hidden="true" className={className} viewBox="0 0 24 24" width="1em" height="1em"><path d="M12 4a5 5 0 0 1 5 5v3l2 3H5l2-3V9a5 5 0 0 1 5-5z" {...common}/><path d="M10 19a2 2 0 0 0 4 0" {...common}/></svg>;
    case "export":
      return <svg aria-hidden="true" className={className} viewBox="0 0 24 24" width="1em" height="1em"><path d="M12 4v12" {...common}/><path d="m8 8 4-4 4 4" {...common}/><path d="M5 14v5h14v-5" {...common}/></svg>;
    case "n8n":
      return <svg aria-hidden="true" className={className} viewBox="0 0 24 24" width="1em" height="1em"><circle cx="5" cy="12" r="2" {...common}/><circle cx="12" cy="6" r="2" {...common}/><circle cx="19" cy="12" r="2" {...common}/><circle cx="12" cy="18" r="2" {...common}/><path d="m6.7 10.8 3.6-3.6M13.7 7.2l3.6 3.6M17.3 13.2l-3.6 3.6M10.3 16.8l-3.6-3.6" {...common}/></svg>;
    default:
      return <svg aria-hidden="true" className={className} viewBox="0 0 24 24" width="1em" height="1em"><circle cx="12" cy="12" r="8" {...common}/></svg>;
  }
}

function SectionNumber({ children }: { children: ReactNode }) {
  return <span className="about-tech-section-number">{children}</span>;
}

function TechLink({ label, href, external = true }: AboutLink) {
  if (!href) {
    return (
      <span className="about-tech-link about-tech-link-disabled" aria-disabled="true">
        <span>{label}</span>
      </span>
    );
  }

  return (
    <a className="about-tech-link" href={href} {...(external ? { target: "_blank", rel: "noreferrer" } : {})}>
      <span>{label}</span>
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M14 5h5v5"/>
        <path d="M10 14 19 5"/>
        <path d="M19 13v6H5V5h6"/>
      </svg>
    </a>
  );
}

function FlowArrow({ vertical = false }: { vertical?: boolean }) {
  return (
    <span className={`about-tech-flow-arrow${vertical ? " vertical" : ""}`} aria-hidden="true">
      <svg viewBox="0 0 48 16">
        <path d="M1 8h42"/>
        <path d="m38 3 5 5-5 5"/>
      </svg>
    </span>
  );
}

interface TechNodeProps {
  icon: AboutIcon;
  title: string;
  description?: string;
  accent?: AboutAccent;
  links?: AboutLink[];
  children?: ReactNode;
  className?: string;
}

function TechNode({
  icon,
  title,
  description,
  accent = "neutral",
  links,
  children,
  className,
}: TechNodeProps) {
  return (
    <article className={`about-tech-node accent-${accent}${className ? ` ${className}` : ""}`}>
      <header>
        <span className="about-tech-node-icon">
          <AboutIconSvg kind={icon}/>
        </span>
        <strong>{title}</strong>
      </header>

      {description ? <p>{description}</p> : null}

      {children}

      {links?.length ? (
        <div className="about-tech-node-links">
          {links.map((link) => <TechLink key={`${title}-${link.label}`} {...link}/>)}
        </div>
      ) : null}
    </article>
  );
}

export default function AboutSite({ mode = "public" }: { mode?: "public" | "personal" }) {
  const interviewHref = mode === "personal" ? "/workspace/learn?section=interview" : "#interview";

  return (
    <div className="kb-content about-page about-tech-page">
      <section className="about-tech-section about-tech-overview" aria-labelledby="about-overview-title">
        <div className="about-tech-section-heading about-tech-overview-heading">
          <div className="about-tech-overview-title">
            <SectionNumber>1</SectionNumber>
            <div>
              <span className="about-tech-eyebrow">{ABOUT_OVERVIEW.eyebrow}</span>
              <h1 id="about-overview-title">{ABOUT_OVERVIEW.title}</h1>
              <p>{ABOUT_OVERVIEW.subtitle}</p>
            </div>
          </div>
          <nav className="about-tech-actions" aria-label="About page links">
            <a className="about-tech-action about-tech-action-primary" href={REPO_URL} target="_blank" rel="noreferrer">
              <span>View source on GitHub</span>
            </a>
          </nav>
        </div>

        <div className="about-tech-purpose-grid">
          {PURPOSE_CARDS.map((card) => {
            const link = card.linkKey === "interview"
              ? { ...card.link, href: interviewHref, external: false }
              : card.link;

            return (
              <article key={card.number} className={`about-tech-purpose-card accent-${card.accent}`}>
                <div className="about-tech-purpose-card-top">
                  <span className="about-tech-node-icon">
                    <AboutIconSvg kind={card.icon}/>
                  </span>
                  <span className="about-tech-purpose-number">{card.number}</span>
                </div>
                <h3>{card.title}</h3>
                <p>{card.description}</p>
                {link ? <TechLink {...link}/> : null}
              </article>
            );
          })}
        </div>
      </section>

      <div className="about-tech-stack-title" role="heading" aria-level={2}>TECH STACK</div>

      <section className="about-tech-section" aria-labelledby="about-deployment-title">
        <div className="about-tech-section-heading">
          <SectionNumber>1</SectionNumber>
          <div>
            <h2 id="about-deployment-title">{DEPLOYMENT.title}</h2>
            <p>{DEPLOYMENT.description}</p>
          </div>
        </div>
        <div className="about-tech-section-body">
          <div className="about-tech-deployment-flow">
            <TechNode icon={DEPLOYMENT.github.icon} title={DEPLOYMENT.github.title} description={DEPLOYMENT.github.description} accent={DEPLOYMENT.github.accent} links={DEPLOYMENT.github.links}/>
            <FlowArrow/>
            <TechNode icon={DEPLOYMENT.actions.icon} title={DEPLOYMENT.actions.title} description={DEPLOYMENT.actions.description} accent={DEPLOYMENT.actions.accent} links={DEPLOYMENT.actions.links}/>
            <FlowArrow/>
            <TechNode icon={DEPLOYMENT.cloudflare.icon} title={DEPLOYMENT.cloudflare.title} accent={DEPLOYMENT.cloudflare.accent} links={DEPLOYMENT.cloudflare.links}>
              <div className="about-tech-node-grid">
                {DEPLOYMENT.cloudflare.tiles.map((tile) => (
                  <article key={tile.title} className="about-tech-mini-node">
                    <header>
                      <span className="about-tech-mini-icon">
                        <AboutIconSvg kind={tile.icon}/>
                      </span>
                      <strong>{tile.title}</strong>
                    </header>
                    <p>{tile.description}</p>
                  </article>
                ))}
              </div>
            </TechNode>
          </div>
        </div>
      </section>

      <section className="about-tech-section" aria-labelledby="about-n8n-title">
        <div className="about-tech-section-heading">
          <SectionNumber>2</SectionNumber>
          <div>
            <h2 id="about-n8n-title">{N8N.title}</h2>
            <p>{N8N.description}</p>
          </div>
        </div>
        <div className="about-tech-section-body">
          <div className="about-tech-observability-flow">
            <div className="about-tech-observability-sources">
              <TechNode icon={N8N.gmail.icon} title={N8N.gmail.title} description={N8N.gmail.description} accent={N8N.gmail.accent}/>
              <TechNode icon={N8N.routing.icon} title={N8N.routing.title} description={N8N.routing.description} accent={N8N.routing.accent}/>
              <TechNode icon={N8N.eventStore.icon} title={N8N.eventStore.title} description={N8N.eventStore.description} accent={N8N.eventStore.accent}/>
            </div>
            <FlowArrow/>
            <TechNode icon={N8N.orchestrator.icon} title={N8N.orchestrator.title} description={N8N.orchestrator.description} accent={N8N.orchestrator.accent} links={N8N.orchestrator.links}/>
            <FlowArrow/>
            <div className="about-tech-output-grid" role="group" aria-label="n8n automation outputs">
              {N8N.outputs.map((output) => (
                <article key={output.title} className="about-tech-mini-node">
                  <header>
                    <span className="about-tech-mini-icon">
                      <AboutIconSvg kind={output.icon}/>
                    </span>
                    <strong>{output.title}</strong>
                  </header>
                  <p>{output.description}</p>
                </article>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className="about-tech-section" aria-labelledby="about-openai-title">
        <div className="about-tech-section-heading">
          <SectionNumber>3</SectionNumber>
          <div>
            <h2 id="about-openai-title">{OPENAI.title}</h2>
            <p>{OPENAI.description}</p>
          </div>
        </div>
        <div className="about-tech-section-body">
          <div className="about-tech-ai-flow">
            <TechNode icon={OPENAI.input.icon} title={OPENAI.input.title} description={OPENAI.input.description} accent={OPENAI.input.accent}/>
            <FlowArrow/>
            <TechNode icon={OPENAI.api.icon} title={OPENAI.api.title} accent={OPENAI.api.accent} links={OPENAI.api.links}/>
            <FlowArrow/>
            <div className="about-tech-output-grid" role="group" aria-label="OpenAI outputs">
              {OPENAI.outputs.map((output) => (
                <article key={output.title} className="about-tech-mini-node">
                  <header>
                    <span className="about-tech-mini-icon">
                      <AboutIconSvg kind={output.icon}/>
                    </span>
                    <strong>{output.title}</strong>
                  </header>
                  <p>{output.description}</p>
                </article>
              ))}
            </div>
            <TechNode icon={OPENAI.fallback.icon} title={OPENAI.fallback.title} description={OPENAI.fallback.description} accent={OPENAI.fallback.accent} className="about-tech-fallback"/>
          </div>
        </div>
      </section>

      <section className="about-tech-section" aria-labelledby="about-observability-title">
        <div className="about-tech-section-heading">
          <SectionNumber>4</SectionNumber>
          <div>
            <h2 id="about-observability-title">{GRAFANA.title}</h2>
            <p>{GRAFANA.description}</p>
          </div>
        </div>
        <div className="about-tech-section-body">
          <div className="about-tech-observability-flow">
            <div className="about-tech-observability-sources">
              <TechNode icon={GRAFANA.workersLogs.icon} title={GRAFANA.workersLogs.title} description={GRAFANA.workersLogs.description} accent={GRAFANA.workersLogs.accent} links={GRAFANA.workersLogs.links}/>
              <TechNode icon={GRAFANA.sourceEvents.icon} title={GRAFANA.sourceEvents.title} description={GRAFANA.sourceEvents.description} accent={GRAFANA.sourceEvents.accent}/>
              <TechNode icon={GRAFANA.sourceSummary.icon} title={GRAFANA.sourceSummary.title} description={GRAFANA.sourceSummary.description} accent={GRAFANA.sourceSummary.accent} links={GRAFANA.sourceSummary.links}/>
            </div>
            <FlowArrow/>
            <TechNode icon={GRAFANA.grafana.icon} title={GRAFANA.grafana.title} description={GRAFANA.grafana.description} accent={GRAFANA.grafana.accent} links={GRAFANA.grafana.links}/>
            <FlowArrow/>
            <div className="about-tech-output-grid" role="group" aria-label="Observability outputs">
              {GRAFANA.outputs.map((output) => (
                <article key={output.title} className="about-tech-mini-node">
                  <header>
                    <span className="about-tech-mini-icon">
                      <AboutIconSvg kind={output.icon}/>
                    </span>
                    <strong>{output.title}</strong>
                  </header>
                  <p>{output.description}</p>
                </article>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className="about-tech-section" aria-labelledby="about-code-quality-title">
        <div className="about-tech-section-heading">
          <SectionNumber>5</SectionNumber>
          <div>
            <h2 id="about-code-quality-title">{CODE_QUALITY.title}</h2>
            <p>{CODE_QUALITY.description}</p>
          </div>
        </div>
        <div className="about-tech-section-body">
          <div className="about-tech-deployment-flow">
            <TechNode icon={CODE_QUALITY.ci.icon} title={CODE_QUALITY.ci.title} description={CODE_QUALITY.ci.description} accent={CODE_QUALITY.ci.accent} links={CODE_QUALITY.ci.links}/>
            <FlowArrow/>
            <TechNode icon={CODE_QUALITY.sonar.icon} title={CODE_QUALITY.sonar.title} description={CODE_QUALITY.sonar.description} accent={CODE_QUALITY.sonar.accent} links={CODE_QUALITY.sonar.links}/>
            <FlowArrow/>
            <div className="about-tech-output-grid" role="group" aria-label="Code quality outputs">
              {CODE_QUALITY.outputs.map((output) => (
                <article key={output.title} className="about-tech-mini-node">
                  <header>
                    <span className="about-tech-mini-icon">
                      <AboutIconSvg kind={output.icon}/>
                    </span>
                    <strong>{output.title}</strong>
                  </header>
                  <p>{output.description}</p>
                </article>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className="about-tech-section" aria-labelledby="about-database-title">
        <div className="about-tech-section-heading">
          <SectionNumber>6</SectionNumber>
          <div>
            <h2 id="about-database-title">{DATABASE.title}</h2>
            <p>{DATABASE.description}</p>
          </div>
        </div>
        <div className="about-tech-section-body">
          <div className="about-tech-database-flow">
            <TechNode icon={DATABASE.worker.icon} title={DATABASE.worker.title} description={DATABASE.worker.description} accent={DATABASE.worker.accent}/>
            <FlowArrow/>
            <TechNode icon={DATABASE.d1.icon} title={DATABASE.d1.title} description={DATABASE.d1.description} accent={DATABASE.d1.accent} links={DATABASE.d1.links}/>
            <FlowArrow/>
            <div className="about-tech-data-grid" role="group" aria-label="Database data groups">
              {DATABASE.groups.map((group) => (
                <article key={group.title} className="about-tech-mini-node">
                  <header>
                    <span className="about-tech-mini-icon">
                      <AboutIconSvg kind={group.icon}/>
                    </span>
                    <strong>{group.title}</strong>
                  </header>
                  <p>{group.description}</p>
                </article>
              ))}
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
