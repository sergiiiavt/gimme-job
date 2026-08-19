"use client";

import { useEffect, useState } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import { contentHref } from "./content-deep-links";
import styles from "./qa-fundamentals-page.module.css";
import uiStyles from "./learning-document-ui.module.css";

export type LearningLanguage = "en" | "uk";

export interface LearningTocHeading {
  id: string;
  text: string;
}

export interface LearningRegistrySource {
  id: string;
  title: string;
  role: string;
  publisher: string;
  meta: string;
  url: string;
}

const directLinkSvgMarkup = '<svg aria-hidden="true" fill="none" height="15" viewBox="0 0 24 24" width="15"><path d="M9 7H7a5 5 0 0 0 0 10h2M15 7h2a5 5 0 0 1 0 10h-2M8.5 12h7" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="1.8"/></svg>';

function DirectLinkIcon() {
  return (
    <svg aria-hidden="true" fill="none" height="15" viewBox="0 0 24 24" width="15">
      <path d="M9 7H7a5 5 0 0 0 0 10h2M15 7h2a5 5 0 0 1 0 10h-2M8.5 12h7" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8"/>
    </svg>
  );
}

function pagerItemId<T>(item: T | undefined) {
  if (!item || typeof item !== "object" || !("id" in item)) return null;
  const id = (item as { id?: unknown }).id;
  return typeof id === "string" ? id : null;
}

export function LearningHero({ description, eyebrow, meta, title }: {
  description: string;
  eyebrow: string;
  meta: string[];
  title: string;
}) {
  return (
    <header className={styles.hero}>
      <span className={styles.eyebrow}>{eyebrow}</span>
      <h1>{title}</h1>
      <p>{description}</p>
      <div className={styles.meta}>
        {meta.map((item) => <span key={item}>{item}</span>)}
      </div>
    </header>
  );
}

export function LearningSourceRegistry({ language, sources, statusLabel }: {
  language: LearningLanguage;
  sources: LearningRegistrySource[];
  statusLabel: string;
}) {
  return (
    <section className={styles.sourcePanel} id="source-registry" aria-labelledby="learning-source-register">
      <header>
        <h2 id="learning-source-register">{language === "uk" ? "Реєстр джерел" : "Source registry"}</h2>
        <span>{statusLabel}</span>
      </header>
      <div className={styles.sources}>
        {sources.map((source) => (
          <article className={styles.source} key={source.id}>
            <div>
              <strong>{source.title}</strong>
              <p>{source.role}</p>
              <span className={styles.sourceStatus}>{source.publisher} · {source.meta}</span>
            </div>
            <a href={source.url} rel="noreferrer" target="_blank">{language === "uk" ? "Джерело" : "Source"} ↗</a>
          </article>
        ))}
      </div>
    </section>
  );
}

export function LearningPager<T>({ ariaLabel, language, labelFor, next, onSelect, previous }: {
  ariaLabel: string;
  language: LearningLanguage;
  labelFor: (item: T | undefined) => string | undefined;
  next?: T;
  onSelect: (item: T) => void;
  previous?: T;
}) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const previousId = pagerItemId(previous);
  const nextId = pagerItemId(next);
  const previousHref = previousId ? contentHref(pathname, searchParams.toString(), { topic: previousId }) : null;
  const nextHref = nextId ? contentHref(pathname, searchParams.toString(), { topic: nextId }) : null;

  return (
    <nav className={styles.pager} aria-label={ariaLabel}>
      <div className={uiStyles.pagerItem}>
        <button disabled={!previous} onClick={() => previous && onSelect(previous)} type="button">
          <small>← {language === "uk" ? "Попередній розділ" : "Previous chapter"}</small>
          <strong>{labelFor(previous) ?? (language === "uk" ? "Початок курсу" : "Beginning of path")}</strong>
        </button>
        {previousHref && (
          <a
            aria-label={language === "uk" ? "Відкрити пряме посилання на попередній розділ у новій вкладці" : "Open direct link to previous chapter in a new tab"}
            className={uiStyles.pagerDirectLink}
            href={previousHref}
            rel="noreferrer"
            target="_blank"
            title={language === "uk" ? "Відкрити у новій вкладці" : "Open in new tab"}
          >
            <DirectLinkIcon/>
          </a>
        )}
      </div>
      <div className={uiStyles.pagerItem}>
        <button disabled={!next} onClick={() => next && onSelect(next)} type="button">
          <small>{language === "uk" ? "Наступний розділ" : "Next chapter"} →</small>
          <strong>{labelFor(next) ?? (language === "uk" ? "Кінець курсу" : "End of path")}</strong>
        </button>
        {nextHref && (
          <a
            aria-label={language === "uk" ? "Відкрити пряме посилання на наступний розділ у новій вкладці" : "Open direct link to next chapter in a new tab"}
            className={uiStyles.pagerDirectLink}
            href={nextHref}
            rel="noreferrer"
            target="_blank"
            title={language === "uk" ? "Відкрити у новій вкладці" : "Open in new tab"}
          >
            <DirectLinkIcon/>
          </a>
        )}
      </div>
    </nav>
  );
}

export function LearningRail({ headings, language, languages = ["en", "uk"], onLanguageChange }: {
  headings: LearningTocHeading[];
  language: LearningLanguage;
  languages?: LearningLanguage[];
  onLanguageChange: (language: LearningLanguage) => void;
}) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [activeSectionId, setActiveSectionId] = useState(headings[0]?.id ?? "source-registry");
  const sectionHref = (sectionId: string) => contentHref(pathname, searchParams.toString(), {}, sectionId);

  useEffect(() => {
    const trackedIds = [...headings.map((heading) => heading.id), "source-registry"];
    let frame = 0;

    const updateActiveSection = () => {
      frame = 0;
      const marker = Math.max(96, Math.min(180, window.innerHeight * 0.22));
      let nextActiveId = trackedIds[0] ?? "source-registry";

      for (const id of trackedIds) {
        const element = document.getElementById(id);
        if (!element) continue;

        const rect = element.getBoundingClientRect();
        if (rect.top <= marker) nextActiveId = id;
        else break;
      }

      const sourceRegistry = document.getElementById("source-registry");
      if (sourceRegistry && sourceRegistry.getBoundingClientRect().top <= window.innerHeight * 0.55) {
        nextActiveId = "source-registry";
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
  }, [headings]);

  useEffect(() => {
    const createdLinks: HTMLAnchorElement[] = [];
    const sectionIds = [...headings.map((heading) => heading.id), "source-registry"];

    for (const sectionId of sectionIds) {
      const target = sectionId === "source-registry"
        ? document.getElementById("learning-source-register")
        : document.getElementById(sectionId);
      if (!(target instanceof HTMLElement)) continue;

      const existing = Array.from(target.children).find((child) => child.classList.contains(uiStyles.headingDirectLink));
      if (existing) continue;

      const link = document.createElement("a");
      link.className = uiStyles.headingDirectLink;
      link.href = contentHref(pathname, searchParams.toString(), {}, sectionId);
      link.rel = "noreferrer";
      link.target = "_blank";
      link.title = language === "uk" ? "Відкрити у новій вкладці" : "Open in new tab";
      link.setAttribute("aria-label", `${language === "uk" ? "Відкрити пряме посилання у новій вкладці" : "Open direct link in a new tab"}: ${target.textContent?.trim() ?? sectionId}`);
      link.innerHTML = directLinkSvgMarkup;
      target.appendChild(link);
      createdLinks.push(link);
    }

    return () => {
      for (const link of createdLinks) link.remove();
    };
  }, [headings, language, pathname, searchParams]);

  return (
    <aside className={styles.rail} aria-label={language === "uk" ? "Навігація навчального матеріалу" : "Learning material navigation"}>
      {languages.length > 1 && (
        <section className={styles.language} aria-label={language === "uk" ? "Мова матеріалу" : "Material language"}>
          <span>{language === "uk" ? "Мова" : "Language"}</span>
          <div role="group" aria-label={language === "uk" ? "Мова матеріалу" : "Material language"}>
            {languages.includes("en") && <button className={language === "en" ? styles.activeLanguage : ""} onClick={() => onLanguageChange("en")} type="button">EN</button>}
            {languages.includes("uk") && <button className={language === "uk" ? styles.activeLanguage : ""} onClick={() => onLanguageChange("uk")} type="button">UA</button>}
          </div>
        </section>
      )}

      <section className={styles.toc} aria-label={language === "uk" ? "На цій сторінці" : "On this page"}>
        <span>{language === "uk" ? "На цій сторінці" : "On this page"}</span>
        <nav>
          {headings.map((heading) => {
            const isActive = activeSectionId === heading.id;
            return (
              <a
                aria-current={isActive ? "location" : undefined}
                className={isActive ? uiStyles.activeTocLink : undefined}
                href={sectionHref(heading.id)}
                key={heading.id}
              >
                {heading.text}
              </a>
            );
          })}
          <a
            aria-current={activeSectionId === "source-registry" ? "location" : undefined}
            className={`${styles.sourceLink} ${activeSectionId === "source-registry" ? uiStyles.activeTocLink : ""}`}
            href={sectionHref("source-registry")}
          >
            <small>{language === "uk" ? "Джерела" : "References"}</small>
            {language === "uk" ? "Реєстр джерел" : "Source registry"}
          </a>
        </nav>
      </section>
    </aside>
  );
}
