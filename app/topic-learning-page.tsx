"use client";

import { type ReactNode, useMemo, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { contentHref } from "./content-deep-links";
import { LearningHero, LearningRail, LearningSourceRegistry, type LearningLanguage, type LearningTocHeading } from "./learning-document-ui";
import { sectionNavigationHref } from "./navigation-paths";
import { chapterSourcesLabel } from "./source-count-label";
import MarkdownDocument, { extractMarkdownHeadings, markdownSlug } from "./qa-markdown";
import { SiteSidebar, type SiteSection, type SubnavItem } from "./site-navigation";
import styles from "./qa-fundamentals-page.module.css";

type SiteMode = "public" | "personal";
type TopicStatus = "under-construction" | "published";

type TopicLearningSource = Readonly<{
  id: string;
  title: string;
  url: string;
  publisher: string;
  kind?: string;
  role: string;
}>;

type TopicLearningItem = Readonly<{
  id: string;
  label: string;
  labelUk: string;
  description: string;
  descriptionUk: string;
  status: TopicStatus;
  markdown: string;
  markdownUk: string;
  sourceIds?: readonly string[];
}>;

type TopicLearningCatalog = Readonly<{
  title: string;
  titleUk: string;
  topics: readonly TopicLearningItem[];
  sources?: readonly TopicLearningSource[];
}>;

/**
 * Page content listed after a catalog's chapters, such as a video list. It opens like a topic
 * (`?topic=<id>`) but is not part of the catalog, so retrieval and topic pages never see it.
 */
export type TopicLearningSupplement = Readonly<{
  id: string;
  label: string;
  labelUk: string;
  headings: readonly LearningTocHeading[];
  content: (language: LearningLanguage) => ReactNode;
}>;

type TopicLearningPageProps = Readonly<{
  activeSection: SiteSection;
  catalog: TopicLearningCatalog;
  defaultTopicId: string;
  mode: SiteMode;
  secondaryTitle: string;
  supplements?: readonly TopicLearningSupplement[];
}>;

const sourceSectionIds = new Set(["sources", "references", "джерела"]);

function stripSourceSections(markdown: string) {
  const lines = markdown.replace(/\r\n/g, "\n").split("\n");
  const output: string[] = [];
  let index = 0;

  while (index < lines.length) {
    const heading = lines[index].match(/^(#{2,3})\s+(.+)$/);
    if (!heading || !sourceSectionIds.has(markdownSlug(heading[2]))) {
      output.push(lines[index]);
      index += 1;
      continue;
    }

    const sourceLevel = heading[1].length;
    index += 1;
    while (index < lines.length) {
      const nextHeading = lines[index].match(/^(#{1,3})\s+(.+)$/);
      if (nextHeading && nextHeading[1].length <= sourceLevel) break;
      index += 1;
    }
  }

  return output.join("\n").trimEnd();
}

export default function TopicLearningPage({
  activeSection,
  catalog,
  defaultTopicId,
  mode,
  secondaryTitle,
  supplements = [],
}: TopicLearningPageProps) {
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [language, setLanguage] = useState<LearningLanguage>("en");
  const [mobileNav, setMobileNav] = useState(false);

  const topics = catalog.topics;
  const requestedTopic = searchParams.get("topic");
  const activeSupplement = supplements.find((supplement) => supplement.id === requestedTopic);
  const activeTopicId = requestedTopic && topics.some((topic) => topic.id === requestedTopic)
    ? requestedTopic
    : defaultTopicId;
  const activeTopic = topics.find((topic) => topic.id === activeTopicId)
    ?? topics.find((topic) => topic.id === defaultTopicId)
    ?? topics[0];
  const localizedLabel = language === "uk" ? activeTopic.labelUk : activeTopic.label;
  const markdown = language === "uk" ? activeTopic.markdownUk : activeTopic.markdown;
  const sourcesById = useMemo(
    () => new Map((catalog.sources ?? []).map((source) => [source.id, source])),
    [catalog.sources],
  );
  const topicSources = useMemo(
    () => (activeTopic.sourceIds ?? [])
      .map((sourceId) => sourcesById.get(sourceId))
      .filter((source): source is TopicLearningSource => Boolean(source)),
    [activeTopic.sourceIds, sourcesById],
  );
  const hasSourceRegistry = topicSources.length > 0;
  const renderedMarkdown = useMemo(
    () => hasSourceRegistry ? stripSourceSections(markdown) : markdown,
    [hasSourceRegistry, markdown],
  );
  const headings = useMemo(
    () => extractMarkdownHeadings(renderedMarkdown).filter((heading) => heading.level === 2),
    [renderedMarkdown],
  );

  const secondaryItems: SubnavItem[] = [
    ...topics.map((topic): SubnavItem => ({
      id: topic.id,
      label: language === "uk" ? topic.labelUk : topic.label,
      status: topic.status === "under-construction" ? "under-construction" : undefined,
    })),
    ...supplements.map((supplement): SubnavItem => ({
      id: supplement.id,
      label: language === "uk" ? supplement.labelUk : supplement.label,
    })),
  ];

  const selectTopic = (topicId: string) => {
    if (!topics.some((topic) => topic.id === topicId) && !supplements.some((supplement) => supplement.id === topicId)) return;
    router.push(contentHref(pathname, searchParams.toString(), { topic: topicId }), { scroll: false });
    setMobileNav(false);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const openSection = (section: SiteSection) => {
    window.location.assign(sectionNavigationHref(section, mode));
  };

  const pageTitle = language === "uk" ? catalog.titleUk : catalog.title;
  const chapterNumber = topics.findIndex((topic) => topic.id === activeTopic.id) + 1;
  const href = sectionNavigationHref(activeSection, mode);

  return (
    <main className="kb-shell">
      <SiteSidebar
        activeSection={activeSection}
        activeSubsection={activeSupplement?.id ?? activeTopic.id}
        mobileOpen={mobileNav}
        mode={mode}
        onSelect={openSection}
        onSelectSubsection={selectTopic}
        personalHref={href}
        publicHref={href}
        secondaryItems={secondaryItems}
        secondaryTitle={secondaryTitle}
      />

      <section className="kb-main">
        <button aria-expanded={mobileNav} aria-label="Toggle navigation" className="kb-floating-menu" onClick={() => setMobileNav((value) => !value)} type="button">☰</button>

        <div className={`kb-content ${styles.page}`}>
          {activeSupplement ? (
            <>
              <LearningHero eyebrow={secondaryTitle} title={language === "uk" ? activeSupplement.labelUk : activeSupplement.label}/>
              <div className={styles.layout}>
                <div className={styles.document}>
                  <article className={styles.article}>{activeSupplement.content(language)}</article>
                </div>
                <LearningRail
                  headings={[...activeSupplement.headings]}
                  language={language}
                  languages={["en", "uk"]}
                  onLanguageChange={setLanguage}
                  showSourceRegistry={false}
                />
              </div>
            </>
          ) : activeTopic.status === "under-construction" ? (
            <>
              <LearningHero
                eyebrow={`${secondaryTitle} · ${language === "uk" ? "У розробці" : "Under construction"}`}
                title={localizedLabel}
              />
              <section className="kb-under-construction-page">
                <span className="kb-construction-badge">{language === "uk" ? "У розробці" : "Under construction"}</span>
                <p>{language === "uk"
                  ? "Цей розділ ще не опублікований."
                  : "This chapter has not been published yet."}</p>
              </section>
              <LearningRail headings={[]} language={language} languages={["en", "uk"]} onLanguageChange={setLanguage}/>
            </>
          ) : (
            <>
              <LearningHero
                eyebrow={`${secondaryTitle} · ${language === "uk" ? "Розділ" : "Chapter"} ${String(chapterNumber).padStart(2, "0")} / ${String(topics.length).padStart(2, "0")}`}
                title={pageTitle}
              />

              <div className={styles.layout}>
                <div className={styles.document}>
                  <article className={styles.article}>
                    <MarkdownDocument markdown={renderedMarkdown}/>
                  </article>

                  {hasSourceRegistry && (
                    <LearningSourceRegistry
                      language={language}
                      sources={topicSources.map((source) => ({
                        id: source.id,
                        meta: (source.kind ?? "reference").replaceAll("-", " "),
                        publisher: source.publisher,
                        role: source.role,
                        title: source.title,
                        url: source.url,
                      }))}
                      statusLabel={chapterSourcesLabel(topicSources.length, language)}
                    />
                  )}
                </div>
                <LearningRail
                  headings={headings}
                  language={language}
                  languages={["en", "uk"]}
                  onLanguageChange={setLanguage}
                />
              </div>
            </>
          )}
        </div>
      </section>

      {mobileNav && <button className="kb-backdrop" onClick={() => setMobileNav(false)} aria-label="Close navigation"/>}
    </main>
  );
}
