"use client";

import { useState } from "react";
import { contentHref } from "./content-deep-links";
import styles from "./interview-question-deep-link.module.css";

interface InterviewDeepLinkQuestion {
  id: string;
  level: string;
  prevalence: string;
  category: string;
  kind?: string;
  question: string;
  shortAnswer: string;
  strongAnswerSignals: string[];
  questionUk?: string;
  shortAnswerUk?: string;
  strongAnswerSignalsUk?: string[];
  example?: string;
  exampleUk?: string;
  sourceIds: string[];
  tags?: string[];
}

interface InterviewDeepLinkSource {
  id: string;
  title: string;
  url: string;
  publisher?: string;
  role?: string;
}

interface InterviewDeepLinkTaxonomyItem {
  id: string;
  label: string;
  category?: string;
}

export interface InterviewDeepLinkCatalog {
  title: string;
  questions: InterviewDeepLinkQuestion[];
  sources: InterviewDeepLinkSource[];
  taxonomy: InterviewDeepLinkTaxonomyItem[];
}

export default function InterviewQuestionDeepLink({ backHref, catalog, eyebrow, questionId }: {
  backHref: string;
  catalog: InterviewDeepLinkCatalog;
  eyebrow: string;
  questionId: string;
}) {
  const question = catalog.questions.find((item) => item.id === questionId);
  const [language, setLanguage] = useState<"en" | "uk">("en");
  const [copied, setCopied] = useState(false);

  if (!question) {
    return (
      <main className={styles.page}>
        <section className={styles.card}>
          <span className={styles.eyebrow}>{eyebrow}</span>
          <h1>Interview question not found</h1>
          <p>No published question has the ID <code>{questionId}</code>.</p>
          <a className={styles.backLink} href={backHref}>← Back to all questions</a>
        </section>
      </main>
    );
  }

  const showUk = language === "uk" && Boolean(question.questionUk);
  const displayQuestion = showUk && question.questionUk ? question.questionUk : question.question;
  const displayAnswer = showUk && question.shortAnswerUk ? question.shortAnswerUk : question.shortAnswer;
  const displaySignals = showUk && question.strongAnswerSignalsUk ? question.strongAnswerSignalsUk : question.strongAnswerSignals;
  const displayExample = showUk && question.exampleUk ? question.exampleUk : question.example;
  const taxonomyItem = catalog.taxonomy.find((item) => item.category === question.category);
  const categoryHref = taxonomyItem ? contentHref(backHref, "", { topic: taxonomyItem.id }) : backHref;
  const sources = question.sourceIds
    .map((sourceId) => catalog.sources.find((source) => source.id === sourceId))
    .filter((source): source is InterviewDeepLinkSource => Boolean(source));

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1600);
    } catch {
      setCopied(false);
    }
  };

  return (
    <main className={styles.page}>
      <article className={styles.card} id={`question-${question.id}`}>
        <nav className={styles.topNav} aria-label="Interview question navigation">
          <a className={styles.backLink} href={backHref}>← All questions</a>
          <button className={styles.copyButton} onClick={copyLink} type="button">{copied ? "Copied" : "Copy link"}</button>
        </nav>

        <header className={styles.header}>
          <span className={styles.eyebrow}>{eyebrow}</span>
          <div className={styles.meta}>
            <a href={categoryHref}>{taxonomyItem?.label ?? question.category}</a>
            <span>{question.level}</span>
            <span>{question.prevalence}</span>
            {question.kind && <span>{question.kind}</span>}
          </div>
          <h1>{displayQuestion}</h1>
          {question.questionUk && (
            <div className={styles.language} role="group" aria-label="Question language">
              <button className={language === "en" ? styles.activeLanguage : ""} onClick={() => setLanguage("en")} type="button">EN</button>
              <button className={language === "uk" ? styles.activeLanguage : ""} onClick={() => setLanguage("uk")} type="button">UA</button>
            </div>
          )}
        </header>

        <section className={styles.section}>
          <h2>Answer</h2>
          <p>{displayAnswer}</p>
        </section>

        <section className={styles.section}>
          <h2>Strong answer includes</h2>
          <ul>{displaySignals.map((signal) => <li key={signal}>{signal}</li>)}</ul>
        </section>

        {displayExample && (
          <section className={styles.section}>
            <h2>Example</h2>
            <p>{displayExample}</p>
          </section>
        )}

        {question.tags?.length ? (
          <section className={styles.tags} aria-label="Question tags">
            {question.tags.map((tag) => <span key={tag}>#{tag}</span>)}
          </section>
        ) : null}

        {sources.length ? (
          <section className={styles.sources}>
            <h2>Sources</h2>
            {sources.map((source) => (
              <a href={source.url} key={source.id} rel="noreferrer" target="_blank">
                <strong>{source.title}</strong>
                <span>{[source.publisher, source.role].filter(Boolean).join(" · ")}</span>
              </a>
            ))}
          </section>
        ) : null}
      </article>
    </main>
  );
}
