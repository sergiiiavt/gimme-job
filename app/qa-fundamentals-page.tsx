"use client";

import { useEffect, useMemo, useState } from "react";
import qaFundamentalsCatalog from "@/content/qa-fundamentals/catalog";
import MarkdownDocument, { extractMarkdownHeadings } from "./qa-markdown";
import { SiteSidebar, type SiteSection, type SubnavItem } from "./site-navigation";
import styles from "./qa-fundamentals-page.module.css";

type SiteMode = "public" | "personal";

const firstTopicId = qaFundamentalsCatalog.taxonomy[0]?.id ?? "qa-testing-fundamentals";

function topicFromLocation() {
  if (typeof window === "undefined") return firstTopicId;
  const requested = new URLSearchParams(window.location.search).get("topic");
  return qaFundamentalsCatalog.taxonomy.some((topic) => topic.id === requested) ? requested as string : firstTopicId;
}

export default function QaFundamentalsPage({ mode }: { mode: SiteMode }) {
  const [activeTopic, setActiveTopic] = useState(firstTopicId);
  const [mobileNav, setMobileNav] = useState(false);

  useEffect(() => {
    const syncFromLocation = () => setActiveTopic(topicFromLocation());
    syncFromLocation();
    window.addEventListener("popstate", syncFromLocation);
    return () => window.removeEventListener("popstate", syncFromLocation);
  }, []);

  const conceptCounts = useMemo(() => new Map(
    qaFundamentalsCatalog.taxonomy.map((topic) => [
      topic.id,
      qaFundamentalsCatalog.requiredConcepts.filter((concept) => concept.topicId === topic.id).length,
    ]),
  ), []);

  const secondaryItems: SubnavItem[] = qaFundamentalsCatalog.taxonomy.map((topic) => ({
    id: topic.id,
    label: topic.label,
    count: conceptCounts.get(topic.id),
  }));

  const chapterIndex = Math.max(0, qaFundamentalsCatalog.chapters.findIndex((chapter) => chapter.id === activeTopic));
  const chapter = qaFundamentalsCatalog.chapters[chapterIndex] ?? qaFundamentalsCatalog.chapters[0];
  const chapterSources = chapter.sourceIds
    .map((sourceId) => qaFundamentalsCatalog.sources.find((source) => source.id === sourceId))
    .filter((source): source is NonNullable<typeof source> => Boolean(source));
  const headings = extractMarkdownHeadings(chapter.markdown)
    .filter((heading) => heading.level === 2 && !["summary", "sources"].includes(heading.id));
  const previous = chapterIndex > 0 ? qaFundamentalsCatalog.chapters[chapterIndex - 1] : undefined;
  const next = chapterIndex < qaFundamentalsCatalog.chapters.length - 1 ? qaFundamentalsCatalog.chapters[chapterIndex + 1] : undefined;

  const selectTopic = (topicId: string) => {
    if (!qaFundamentalsCatalog.taxonomy.some((topic) => topic.id === topicId)) return;
    setActiveTopic(topicId);
    setMobileNav(false);
    const url = new URL(window.location.href);
    url.searchParams.set("topic", topicId);
    window.history.pushState(null, "", `${url.pathname}?${url.searchParams.toString()}`);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const openSection = (section: SiteSection) => {
    const target = mode === "personal"
      ? section === "jobs" ? "/workspace" : `/workspace/learn?section=${section}`
      : section === "about" ? "/" : section === "jobs" ? "/workspace" : `/#${section}`;
    window.location.assign(target);
  };

  return (
    <main className="kb-shell">
      <SiteSidebar
        activeExternalId="qa-fundamentals"
        activeSection={null}
        activeSubsection={activeTopic}
        mobileOpen={mobileNav}
        mode={mode}
        onSelect={openSection}
        onSelectSubsection={selectTopic}
        personalHref="/workspace/learn/qa-fundamentals"
        publicHref="/learn/qa-fundamentals"
        secondaryItems={secondaryItems}
        secondaryTitle="QA fundamentals"
      />

      <section className="kb-main">
        <button
          aria-expanded={mobileNav}
          aria-label="Toggle navigation"
          className="kb-floating-menu"
          onClick={() => setMobileNav((value) => !value)}
          type="button"
        >
          ☰
        </button>

        <div className={`kb-content ${styles.page}`}>
          <header className={styles.hero}>
            <span className={styles.eyebrow}>QA fundamentals · Chapter {String(chapterIndex + 1).padStart(2, "0")} / 08</span>
            <h1>{qaFundamentalsCatalog.title}</h1>
            <p>{chapter.description}</p>
            <div className={styles.meta}>
              <span>{conceptCounts.get(chapter.id) ?? 0} required concepts</span>
              <span>{chapterSources.length} primary references</span>
              <span>Long-form learning material</span>
            </div>
          </header>

          <div className={styles.layout}>
            <div className={styles.document}>
              <article className={styles.article}>
                <MarkdownDocument markdown={chapter.markdown}/>
              </article>

              <section className={styles.sourcePanel} aria-labelledby="qa-source-register">
                <header>
                  <h2 id="qa-source-register">Source register</h2>
                  <span>Verified 16 Aug 2026</span>
                </header>
                <div className={styles.sources}>
                  {chapterSources.map((source) => (
                    <article className={styles.source} key={source.id}>
                      <div>
                        <strong>{source.title}</strong>
                        <p>{source.role}</p>
                        <span className={styles.sourceStatus}>{source.publisher} · {source.status.replaceAll("-", " ")}</span>
                      </div>
                      <a href={source.url} rel="noreferrer" target="_blank">Source ↗</a>
                    </article>
                  ))}
                </div>
              </section>

              <nav className={styles.pager} aria-label="QA fundamentals chapters">
                <button disabled={!previous} onClick={() => previous && selectTopic(previous.id)} type="button">
                  <small>← Previous chapter</small>
                  <strong>{previous?.label ?? "Beginning of path"}</strong>
                </button>
                <button disabled={!next} onClick={() => next && selectTopic(next.id)} type="button">
                  <small>Next chapter →</small>
                  <strong>{next?.label ?? "End of path"}</strong>
                </button>
              </nav>
            </div>

            <aside className={styles.toc} aria-label="On this page">
              <span>On this page</span>
              <nav>
                {headings.map((heading) => <a href={`#${heading.id}`} key={heading.id}>{heading.text}</a>)}
              </nav>
            </aside>
          </div>
        </div>
      </section>

      {mobileNav && <button className="kb-backdrop" onClick={() => setMobileNav(false)} aria-label="Close navigation"/>}
    </main>
  );
}
