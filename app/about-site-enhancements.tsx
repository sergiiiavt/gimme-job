"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import learningStyles from "./qa-fundamentals-page.module.css";
import tocStyles from "./learning-document-ui.module.css";
import styles from "./about-site-enhancements.module.css";

const REPO_URL = "https://github.com/sergiiiavt/gimme-job";
const RAW_REPO_URL = "https://raw.githubusercontent.com/sergiiiavt/gimme-job/main";

function rawSource(path: string) {
  return `${RAW_REPO_URL}/${path}`;
}

const tocHeadings = [
  { id: "about-overview-title", text: "Why I created this site" },
  { id: "about-deployment-title", text: "Deployment" },
  { id: "about-n8n-title", text: "n8n email automation" },
  { id: "about-infrastructure-title", text: "Infrastructure as Code" },
  { id: "about-openai-title", text: "OpenAI integration" },
  { id: "about-observability-title", text: "Observability" },
  { id: "about-code-quality-title", text: "Code quality & security" },
  { id: "about-database-title", text: "Database" },
  { id: "about-vacancy-scraper-title", text: "Vacancy Scraper" },
  { id: "about-authorization-title", text: "Authorization" },
] as const;

const vacancySources = [
  {
    name: "DOU",
    detail: "RSS + detail pages",
    href: rawSource("agent/src/sources/rss.ts"),
  },
  {
    name: "Djinni",
    detail: "RSS + detail pages",
    href: rawSource("agent/src/sources/rss.ts"),
  },
  {
    name: "Work.ua",
    detail: "HTML adapter · local",
    href: rawSource("agent/src/sources/workua.ts"),
  },
  {
    name: "Robota.ua",
    detail: "API + detail pages",
    href: rawSource("agent/src/sources/robotaua.ts"),
  },
  {
    name: "Lobby X",
    detail: "API + detail pages",
    href: rawSource("agent/src/sources/lobbyx.ts"),
  },
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

function VacancySourceStrip() {
  return (
    <div className={styles.sourceStrip} aria-label="Five vacancy source adapters">
      {vacancySources.map((source) => (
        <a className={styles.sourceNode} href={source.href} key={source.name} rel="noreferrer" target="_blank">
          <strong>{source.name}</strong>
          <span>{source.detail}</span>
        </a>
      ))}
    </div>
  );
}

function ImplementationHighlights() {
  return (
    <>
      <div className="about-tech-stack-title" id="about-implementation-highlights" role="heading" aria-level={2}>
        IMPLEMENTATION HIGHLIGHTS
      </div>

      <section className="about-tech-section" aria-labelledby="about-vacancy-scraper-title">
        <div className="about-tech-section-heading">
          <span className="about-tech-section-number">1</span>
          <div>
            <h2 id="about-vacancy-scraper-title">Vacancy Scraper</h2>
            <p>Five job boards feed one normalization, relevance, deduplication, and synchronization pipeline.</p>
          </div>
        </div>
        <div className="about-tech-section-body">
          <VacancySourceStrip/>
          <div className={styles.highlightGrid}>
            <HighlightNode
              accent="green"
              icon="search"
              title="Five source adapters"
              description="DOU, Djinni, Work.ua, Robota.ua, and Lobby X are converted into the same vacancy model before filtering and duplicate detection."
              links={[
                { label: "Source registry", href: rawSource("config/sources.example.json") },
                { label: "Source builder", href: rawSource("agent/src/sources/index.ts") },
              ]}
            />
            <HighlightNode
              accent="blue"
              icon="code"
              title="Production intake + guards"
              description="Cloud intake collects supported sources, normalizes descriptions, filters irrelevant roles, deduplicates results, reports source failures, and smoke-tests live parsing. Work.ua stays local because cloud-hosted direct HTML access is blocked."
              links={[
                { label: "Vacancy intake", href: rawSource("app/api/_vacancy-intake.ts") },
                { label: "Intake logic", href: rawSource("agent/src/job-intake.ts") },
                { label: "Source smoke", href: rawSource("scripts/smoke-vacancy-sources.ts") },
              ]}
            />
          </div>
        </div>
      </section>

      <section className="about-tech-section" aria-labelledby="about-authorization-title">
        <div className="about-tech-section-heading">
          <span className="about-tech-section-number">2</span>
          <div>
            <h2 id="about-authorization-title">Authorization</h2>
            <p>Password and Google authentication share application-owned sessions and protected workspace access.</p>
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
                { label: "Password auth", href: rawSource("app/auth/password-auth.ts") },
              ]}
            />
            <HighlightNode
              accent="orange"
              icon="github"
              title="Google OAuth + access control"
              description="Handles Google OAuth, user identity, redirect validation, and the shared authorization state used by protected application areas."
              links={[
                { label: "Google OAuth", href: rawSource("app/auth/google-oauth.ts") },
              ]}
            />
          </div>
        </div>
      </section>
    </>
  );
}

function AboutToc() {
  const [activeSectionId, setActiveSectionId] = useState<string>(tocHeadings[0].id);

  useEffect(() => {
    let frame = 0;

    const updateActiveSection = () => {
      frame = 0;
      const marker = Math.max(90, Math.min(150, window.innerHeight * 0.18));
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

function replaceFragileGithubBlobLinks(target: HTMLElement) {
  const prefix = `${REPO_URL}/blob/main/`;
  for (const anchor of target.querySelectorAll<HTMLAnchorElement>(`a[href^="${prefix}"]`)) {
    const path = anchor.href.slice(prefix.length);
    if (path) anchor.href = rawSource(path);
  }
}

export default function AboutSiteEnhancements() {
  const [target, setTarget] = useState<HTMLElement | null>(null);

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => {
      setTarget(document.querySelector<HTMLElement>(".about-tech-page"));
    });
    return () => window.cancelAnimationFrame(frame);
  }, []);

  useEffect(() => {
    if (!target) return;
    replaceFragileGithubBlobLinks(target);
  }, [target]);

  if (!target) return null;

  return createPortal(
    <>
      <ImplementationHighlights/>
      <AboutToc/>
    </>,
    target,
  );
}
