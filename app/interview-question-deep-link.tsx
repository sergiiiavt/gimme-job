"use client";

import { useState, type ReactNode } from "react";
import { contentHref } from "./content-deep-links";
import styles from "./interview-question-deep-link.module.css";

interface InterviewDeepLinkCodeExample {
  title: string;
  titleUk?: string;
  language: string;
  code: string;
  explanation: string;
  explanationUk?: string;
  expectedResult?: string;
  expectedResultUk?: string;
}

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
  codeExamples?: InterviewDeepLinkCodeExample[];
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

const sqlKeywords = new Set([
  "ALL", "ALTER", "AND", "AS", "ASC", "BEGIN", "BETWEEN", "BY", "CASE", "COMMIT", "CREATE", "DELETE", "DESC",
  "DISTINCT", "DROP", "ELSE", "END", "EXCEPT", "EXISTS", "FALSE", "FROM", "FULL", "GROUP", "HAVING", "IN", "INDEX",
  "INNER", "INSERT", "INTERSECT", "INTO", "IS", "JOIN", "LEFT", "LIKE", "LIMIT", "NOT", "NULL", "ON", "OR", "ORDER",
  "OUTER", "OVER", "PARTITION", "RIGHT", "ROLLBACK", "SELECT", "SET", "TABLE", "THEN", "TRUE", "UNION", "UNIQUE", "UPDATE",
  "VALUES", "WHEN", "WHERE", "WITH",
]);

const pythonKeywords = new Set([
  "and", "as", "assert", "async", "await", "break", "case", "class", "continue", "def", "del", "elif", "else", "except",
  "False", "finally", "for", "from", "global", "if", "import", "in", "is", "lambda", "match", "None", "nonlocal", "not", "or",
  "pass", "raise", "return", "True", "try", "while", "with", "yield",
]);

const pythonBuiltins = new Set([
  "all", "any", "bool", "dict", "enumerate", "filter", "float", "int", "iter", "len", "list", "map", "max", "min", "next",
  "print", "range", "repr", "set", "sorted", "str", "sum", "tuple", "type", "zip",
]);

const sqlTokenPattern = /(--[^\n]*|'(?:''|[^'])*'|\b[A-Za-z_]+\b)/g;
const pythonTokenPattern = /(#[^\n]*|"""[\s\S]*?"""|'''[\s\S]*?'''|"(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'|@[A-Za-z_]\w*(?:\.[A-Za-z_]\w*)*|\b\d+(?:\.\d+)?\b|\b[A-Za-z_]\w*\b)/g;

function highlightTokens(source: string, pattern: RegExp, colorForToken: (token: string) => string, keyPrefix: string): ReactNode[] {
  const nodes: ReactNode[] = [];
  let lastIndex = 0;
  let tokenIndex = 0;
  let match: RegExpExecArray | null;
  pattern.lastIndex = 0;

  while ((match = pattern.exec(source)) !== null) {
    if (match.index > lastIndex) nodes.push(source.slice(lastIndex, match.index));
    const token = match[0];
    nodes.push(<span key={`${keyPrefix}-${tokenIndex++}`} style={{ color: colorForToken(token) }}>{token}</span>);
    lastIndex = pattern.lastIndex;
  }

  if (lastIndex < source.length) nodes.push(source.slice(lastIndex));
  return nodes;
}

function highlightSql(source: string): ReactNode[] {
  return highlightTokens(source, sqlTokenPattern, (token) => {
    if (token.startsWith("--")) return "#6a9955";
    if (token.startsWith("'")) return "#ce9178";
    if (sqlKeywords.has(token.toUpperCase())) return "#569cd6";
    return "#d4d4d4";
  }, "sql-token");
}

function highlightPython(source: string): ReactNode[] {
  return highlightTokens(source, pythonTokenPattern, (token) => {
    if (token.startsWith("#")) return "#6a9955";
    if (token.startsWith("\"") || token.startsWith("'")) return "#ce9178";
    if (token.startsWith("@")) return "#dcdcaa";
    if (/^\d/.test(token)) return "#b5cea8";
    if (pythonKeywords.has(token)) return "#569cd6";
    if (pythonBuiltins.has(token)) return "#4ec9b0";
    return "#d4d4d4";
  }, "python-token");
}

function highlightCode(source: string, language: string): ReactNode[] | string {
  const normalizedLanguage = language.toLowerCase();
  if (normalizedLanguage === "python" || normalizedLanguage === "py") return highlightPython(source);
  if (normalizedLanguage === "sql") return highlightSql(source);
  return source;
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
  const [copiedCode, setCopiedCode] = useState<number | null>(null);

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

  const copyCode = async (code: string, index: number) => {
    try {
      await navigator.clipboard.writeText(code);
      setCopiedCode(index);
      window.setTimeout(() => setCopiedCode((current) => current === index ? null : current), 1400);
    } catch {
      setCopiedCode(null);
    }
  };

  const returnToQuestionList = () => {
    try {
      const referrer = document.referrer ? new URL(document.referrer) : null;
      if (referrer?.origin === window.location.origin && referrer.pathname === backHref && window.history.length > 1) {
        window.history.scrollRestoration = "auto";
        window.history.back();
        return;
      }
    } catch {
      // Fall through to the canonical list URL if the referrer cannot be parsed.
    }
    window.location.assign(backHref);
  };

  return (
    <main className={styles.page}>
      <article className={styles.card} id={`question-${question.id}`}>
        <nav className={styles.topNav} aria-label="Interview question navigation">
          <button className={styles.backLink} onClick={returnToQuestionList} type="button">← All questions</button>
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
          <h2>{showUk ? "Відповідь" : "Answer"}</h2>
          <p>{displayAnswer}</p>
        </section>

        <section className={styles.section}>
          <h2>{showUk ? "Сильна відповідь включає" : "Strong answer includes"}</h2>
          <ul>{displaySignals.map((signal) => <li key={signal}>{signal}</li>)}</ul>
        </section>

        {(question.codeExamples?.length || displayExample) ? (
          <section className={`${styles.section}${question.codeExamples?.length ? ` ${styles.codeSection}` : ""}`}>
            <h2>{showUk ? "Практичний приклад" : "Practical example"}</h2>
            {question.codeExamples?.length ? (
              <div className={styles.codeExamples}>
                {question.codeExamples.map((example, index) => {
                  const title = showUk && example.titleUk ? example.titleUk : example.title;
                  const explanation = showUk && example.explanationUk ? example.explanationUk : example.explanation;
                  const expectedResult = showUk && example.expectedResultUk ? example.expectedResultUk : example.expectedResult;
                  return (
                    <article className={styles.codeCard} key={`${question.id}-code-${index}`}>
                      <header className={styles.codeHeader}>
                        <strong>{title}</strong>
                        <button onClick={() => void copyCode(example.code, index)} type="button">{copiedCode === index ? (showUk ? "Скопійовано" : "Copied") : (showUk ? "Копіювати" : "Copy")}</button>
                      </header>
                      <pre className={styles.codeBlock}><code>{highlightCode(example.code, example.language)}</code></pre>
                      <p className={styles.codeExplanation}>{explanation}</p>
                      {expectedResult && (
                        <p className={styles.expectedResult}><strong>{showUk ? "Очікуваний результат" : "Expected result"}:</strong> {expectedResult}</p>
                      )}
                    </article>
                  );
                })}
              </div>
            ) : displayExample ? <p>{displayExample}</p> : null}
          </section>
        ) : null}

        {question.tags?.length ? (
          <section className={styles.tags} aria-label="Question tags">
            {question.tags.map((tag) => <span key={tag}>#{tag}</span>)}
          </section>
        ) : null}

        {sources.length ? (
          <section className={styles.sources}>
            <h2>{showUk ? "Джерела" : "Sources"}</h2>
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
