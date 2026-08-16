"use client";

import { useEffect, useMemo, useState } from "react";
import qaFundamentalsCatalog from "@/content/qa-fundamentals/catalog";
import { LearningHero, LearningPager, LearningRail, LearningSourceRegistry, type LearningLanguage } from "./learning-document-ui";
import MarkdownDocument, { extractMarkdownHeadings, stripMarkdownSection } from "./qa-markdown";
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
  const [language, setLanguage] = useState<LearningLanguage>("en");
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
    label: language === "uk" ? topic.labelUk ?? topic.label : topic.label,
    count: conceptCounts.get(topic.id),
  }));

  const chapterIndex = Math.max(0, qaFundamentalsCatalog.chapters.findIndex((chapter) => chapter.id === activeTopic));
  const chapter = qaFundamentalsCatalog.chapters[chapterIndex] ?? qaFundamentalsCatalog.chapters[0];
  const chapterSources = chapter.sourceIds
    .map((sourceId) => qaFundamentalsCatalog.sources.find((source) => source.id === sourceId))
    .filter((source): source is NonNullable<typeof source> => Boolean(source));

  const englishMarkdown = stripMarkdownSection(chapter.markdown, "sources");
  const localizedMarkdown = stripMarkdownSection(language === "uk" ? chapter.markdownUk : chapter.markdown, "sources");
  const englishHeadings = extractMarkdownHeadings(englishMarkdown).filter((heading) => heading.level === 2);
  const localizedHeadings = extractMarkdownHeadings(localizedMarkdown).filter((heading) => heading.level === 2);
  const headings = localizedHeadings.map((heading, index) => ({
    ...heading,
    id: englishHeadings[index]?.id || heading.id || `section-${index + 1}`,
  }));
  const headingIdOverrides = Object.fromEntries(headings.map((heading) => [heading.text, heading.id]));

  const previous = chapterIndex > 0 ? qaFundamentalsCatalog.chapters[chapterIndex - 1] : undefined;
  const next = chapterIndex < qaFundamentalsCatalog.chapters.length - 1 ? qaFundamentalsCatalog.chapters[chapterIndex + 1] : undefined;
  const chapterDescription = language === "uk" ? chapter.descriptionUk ?? chapter.description : chapter.description;
  const pageTitle = language === "uk" ? qaFundamentalsCatalog.titleUk : qaFundamentalsCatalog.title;

  const localizedTopicLabel = (topic: typeof chapter | undefined) => {
    if (!topic) return undefined;
    return language === "uk" ? topic.labelUk ?? topic.label : topic.label;
  };

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
          <LearningHero
            description={chapterDescription}
            eyebrow={`QA fundamentals · ${language === "uk" ? "Розділ" : "Chapter"} ${String(chapterIndex + 1).padStart(2, "0")} / 08`}
            meta={[
              `${conceptCounts.get(chapter.id) ?? 0} ${language === "uk" ? "ключових понять" : "required concepts"}`,
              `${chapterSources.length} ${language === "uk" ? "основних джерел" : "primary references"}`,
              language === "uk" ? "Розгорнутий навчальний матеріал" : "Long-form learning material",
            ]}
            title={pageTitle}
          />

          <div className={styles.layout}>
            <div className={styles.document}>
              <article className={styles.article}>
                <MarkdownDocument headingIdOverrides={headingIdOverrides} markdown={localizedMarkdown}/>
              </article>

              <LearningSourceRegistry
                language={language}
                sources={chapterSources.map((source) => ({
                  id: source.id,
                  meta: source.status.replaceAll("-", " "),
                  publisher: source.publisher,
                  role: source.role,
                  title: source.title,
                  url: source.url,
                }))}
                statusLabel={language === "uk" ? "Перевірено 16 серпня 2026" : "Verified 16 Aug 2026"}
              />

              <LearningPager
                ariaLabel="QA fundamentals chapters"
                labelFor={localizedTopicLabel}
                language={language}
                next={next}
                onSelect={(topic) => selectTopic(topic.id)}
                previous={previous}
              />
            </div>

            <LearningRail headings={headings} language={language} onLanguageChange={setLanguage}/>
          </div>
        </div>
      </section>

      {mobileNav && <button className="kb-backdrop" onClick={() => setMobileNav(false)} aria-label="Close navigation"/>}
    </main>
  );
}
