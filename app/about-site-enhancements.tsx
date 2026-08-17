"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import learningStyles from "./qa-fundamentals-page.module.css";
import tocStyles from "./learning-document-ui.module.css";
import styles from "./about-site-enhancements.module.css";

const REPO_URL = "https://github.com/sergiiiavt/gimme-job";

const tocHeadings = [
  { id: "about-overview-title", text: "Why I created this site" },
  { id: "about-deployment-title", text: "Deployment" },
  { id: "about-n8n-title", text: "n8n email automation" },
  { id: "about-infrastructure-title", text: "Infrastructure as Code" },
  { id: "about-openai-title", text: "OpenAI integration" },
  { id: "about-observability-title", text: "Observability" },
  { id: "about-code-quality-title", text: "Code quality & security" },
  { id: "about-database-title", text: "Database" },
  { id: "about-vacancy-scrapper-title", text: "Vacancy Scrapper" },
  { id: "about-authorization-title", text: "Authorization part" },
] as const;

function ExternalLink({ href, label }: { href: string; label: string }) {
  return (
    <a className="about-tech-link" href={href} target="_blank" rel="noreferrer">
      <span>{label}</span>
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M14 5h5v5"/>
        <path d="M10 14 19 5"/>
        <path d="M19 13v6H5V5h6"/>
      </svg>
    </a>
  );
}

function HighlightNode({
  accent,
  description,
  icon,
  links,
  title,
}: {
  accent: "green" | "blue" | "purple" | "orange" | "neutral";
  description: string;
  icon: "search" | "code" | "github" | "settings";
  links: Array<{ href: string; label: string }>;
  title: string;
}) {
  return (
    <article className={`about-tech-node accent-${accent} ${styles.highlightNode}`}>
      <header>
        <span className="about-tech-node-icon" aria-hidden="true">
          {icon === "search" && <svg viewBox="0 0 24 24" width="1em" height="1em"><circle cx="11" cy="11" r="6"/><path d="m16 16 4.5 4.5"/></svg>}
          {icon === "code" && <svg viewBox="0 0 24 24" width="1em" height="1em"><path d="m9 6-5 6 5 6"/><path d="m15 6 5 6-5 6"/></svg>}
          {icon === "github" && <span className={styles.githubIcon}/>} 
          {icon === "settings" && <svg viewBox="0 0 24 24" width="1em" height="1em"><circle cx="12" cy="12" r="3"/><path d="M19 12a7 7 0 1 1-14 0 7 7 0 0 1 14 0Z"/></svg>}
        </span>
        <strong>{title}</strong>
      </header>
      <p>{description}</p>
      <div className="about-tech-node-links">
        {links.map((link) => <ExternalLink href={link.href} key={link.href} label={link.label}/>)}
      </div>
    </article>
  );
}

function ImplementationHighlights() {
  return (
    <>
      <div className="about-tech-stack-title" id="about-implementation-highlights" role="heading" aria-level={2}>
        IMPLEMENTATION HIGHLIGHTS
      </div>

      <section className="about-tech-section" aria-labelledby="about-vacancy-scrapper-title">
        <div className="about-tech-section-heading">
          <span className="about-tech-section-number">1</span>
          <div>
            <h2 id="about-vacancy-scrapper-title">Vacancy Scrapper</h2>
            <p>Vacancies are collected, normalized, synchronized, and regression-checked before they appear in the application.</p>
          </div>
        </div>
        <div className="about-tech-section-body">
          <div className={styles.highlightGrid}>
            <HighlightNode
              accent="green"
              icon="search"
              title="DOU vacancy collection"
              description="Reads the QA vacancy feed and normalizes external vacancy data into the shared job model."
              links={[
                { label: "RSS parser", href: `${REPO_URL}/blob/main/scripts/rss-jobs.mjs` },
                { label: "Agent source", href: `${REPO_URL}/blob/main/agent/src/sources/rss.ts` },
              ]}
            />
            <HighlightNode
              accent="blue"
              icon="code"
              title="Sync + regression guard"
              description="Imports the collected catalog through the internal sync endpoint and verifies known regression vacancies in production."
              links={[
                { label: "Sync runner", href: `${REPO_URL}/blob/main/scripts/sync-dou-vacancies.ts` },
                { label: "Source smoke test", href: `${REPO_URL}/blob/main/scripts/smoke-vacancy-sources.ts` },
              ]}
            />
          </div>
        </div>
      </section>

      <section className="about-tech-section" aria-labelledby="about-authorization-title">
        <div className="about-tech-section-heading">
          <span className="about-tech-section-number">2</span>
          <div>
            <h2 id="about-authorization-title">Authorization part</h2>
            <p>Authentication supports password accounts and Google OAuth with application-owned sessions and protected workspace access.</p>
          </div>
        </div>
        <div className="about-tech-section-body">
          <div className={styles.highlightGrid}>
            <HighlightNode
              accent="purple"
              icon="settings"
              title="Password authentication"
              description="Uses PBKDF2-SHA256 password hashing, constant-time verification, login throttling, and a 30-day application session."
              links={[
                { label: "Password auth", href: `${REPO_URL}/blob/main/app/auth/password-auth.ts` },
                { label: "Session routes", href: `${REPO_URL}/tree/main/app/auth/session` },
              ]}
            />
            <HighlightNode
              accent="orange"
              icon="github"
              title="Google OAuth + access control"
              description="Handles Google OAuth, user identity, redirect validation, and the shared authorization state used by protected application areas."
              links={[
                { label: "Google OAuth", href: `${REPO_URL}/blob/main/app/auth/google-oauth.ts` },
                { label: "Auth module", href: `${REPO_URL}/tree/main/app/auth` },
              ]}
            />
          </div>
        </div>
      </section>
    </>
  );
}

function AboutToc() {
  const [activeSectionId, setActiveSectionId] = useState(tocHeadings[0].id);

  useEffect(() => {
    let frame = 0;

    const updateActiveSection = () => {
      frame = 0;
      const marker = Math.max(96, Math.min(180, window.innerHeight * 0.22));
      let nextActiveId = tocHeadings[0].id;

      for (const heading of tocHeadings) {
        const element = document.getElementById(heading.id);
        if (!element) continue;
        if (element.getBoundingClientRect().top <= marker) nextActiveId = heading.id;
        else break;
      }

      setActiveSectionId((current) => current === nextActiveId ? current : nextActiveId);
    };

    const scheduleUpdate = () => {
      if (!frame) frame = window.requestAnimationFrame(updateActiveSection);
    };

    scheduleUpdate();
    window.addEventListener("scroll", scheduleUpdate, { passive: true });
    window.addEventListener("resize", scheduleUpdate);

    return () => {
      window.removeEventListener("scroll", scheduleUpdate);
      window.removeEventListener("resize", scheduleUpdate);
      if (frame) window.cancelAnimationFrame(frame);
    };
  }, []);

  return (
    <aside className={`${learningStyles.rail} ${styles.tocRail}`} aria-label="About page navigation">
      <section className={learningStyles.toc} aria-label="On this page">
        <span>On this page</span>
        <nav>
          {tocHeadings.map((heading) => {
            const active = activeSectionId === heading.id;
            return (
              <a
                aria-current={active ? "location" : undefined}
                className={active ? tocStyles.activeTocLink : undefined}
                href={`#${heading.id}`}
                key={heading.id}
              >
                {heading.text}
              </a>
            );
          })}
        </nav>
      </section>
    </aside>
  );
}

export default function AboutSiteEnhancements() {
  const [target, setTarget] = useState<HTMLElement | null>(null);

  useEffect(() => {
    setTarget(document.querySelector<HTMLElement>(".about-tech-page"));
  }, []);

  if (!target) return null;

  return createPortal(
    <>
      <ImplementationHighlights/>
      <AboutToc/>
    </>,
    target,
  );
}
