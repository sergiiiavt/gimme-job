"use client";

import styles from "./qa-fundamentals-page.module.css";

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
  return (
    <nav className={styles.pager} aria-label={ariaLabel}>
      <button disabled={!previous} onClick={() => previous && onSelect(previous)} type="button">
        <small>← {language === "uk" ? "Попередній розділ" : "Previous chapter"}</small>
        <strong>{labelFor(previous) ?? (language === "uk" ? "Початок курсу" : "Beginning of path")}</strong>
      </button>
      <button disabled={!next} onClick={() => next && onSelect(next)} type="button">
        <small>{language === "uk" ? "Наступний розділ" : "Next chapter"} →</small>
        <strong>{labelFor(next) ?? (language === "uk" ? "Кінець курсу" : "End of path")}</strong>
      </button>
    </nav>
  );
}

export function LearningRail({ headings, language, onLanguageChange }: {
  headings: LearningTocHeading[];
  language: LearningLanguage;
  onLanguageChange: (language: LearningLanguage) => void;
}) {
  return (
    <aside className={styles.rail} aria-label={language === "uk" ? "Навігація навчального матеріалу" : "Learning material navigation"}>
      <section className={styles.language} aria-label={language === "uk" ? "Мова матеріалу" : "Material language"}>
        <span>{language === "uk" ? "Мова" : "Language"}</span>
        <div role="group" aria-label={language === "uk" ? "Мова матеріалу" : "Material language"}>
          <button className={language === "en" ? styles.activeLanguage : ""} onClick={() => onLanguageChange("en")} type="button">EN</button>
          <button className={language === "uk" ? styles.activeLanguage : ""} onClick={() => onLanguageChange("uk")} type="button">UA</button>
        </div>
      </section>

      <section className={styles.toc} aria-label={language === "uk" ? "На цій сторінці" : "On this page"}>
        <span>{language === "uk" ? "На цій сторінці" : "On this page"}</span>
        <nav>
          {headings.map((heading) => <a href={`#${heading.id}`} key={heading.id}>{heading.text}</a>)}
          <a className={styles.sourceLink} href="#source-registry">
            <small>{language === "uk" ? "Джерела" : "References"}</small>
            {language === "uk" ? "Реєстр джерел" : "Source registry"}
          </a>
        </nav>
      </section>
    </aside>
  );
}
