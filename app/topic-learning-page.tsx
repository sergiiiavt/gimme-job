"use client";

import { type ReactNode, useMemo, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { contentHref } from "./content-deep-links";
import { LearningHero, LearningRail, LearningSourceRegistry, type LearningLanguage, type LearningTocHeading } from "./learning-document-ui";
import { sectionNavigationHref } from "./navigation-paths";
import { chapterSourcesLabel } from "./source-count-label";
import MarkdownDocument, { extractMarkdownHeadings, markdownSlug } from "./qa-markdown";
import { SiteSidebar, type SiteSection } from "./site-navigation";
import { localizedLabel, topicNavigationItems, topicSectionNavigation } from "./topic-learning-navigation";
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
  const [selectedLanguage, setSelectedLanguage] = useState<LearningLanguage | null>(null);
  const language = selectedLanguage ?? (searchParams.get("lang") === "uk" ? "uk" : "en");
  const [mobileNav, setMobileNav] = useState(false);

  const topics = catalog.topics;
  const requestedTopic = searchParams.get("topic");
  const activeSupplement = supplements.find((supplement) => supplement.id === requestedTopic);
  const activeTopic = topics.find((topic) => topic.id === requestedTopic)
    ?? topics.find((topic) => topic.id === defaultTopicId)
    ?? topics[0];
  const navigableIds = new Set([...topics, ...supplements].map((item) => item.id));

  const selectTopic = (topicId: string) => {
    if (!navigableIds.has(topicId)) return;
    router.push(contentHref(pathname, searchParams.toString(), { topic: topicId }), { scroll: false });
    setMobileNav(false);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const openSection = (section: SiteSection) => {
    window.location.assign(sectionNavigationHref(section, mode));
  };

  const href = sectionNavigationHref(activeSection, mode);
  const rail = { language, onLanguageChange: setSelectedLanguage };
  let content: ReactNode;
  if (activeSupplement) {
    content = <SupplementView eyebrow={secondaryTitle} supplement={activeSupplement} {...rail}/>;
  } else if (activeTopic.status === "under-construction") {
    content = <UnderConstructionView eyebrow={secondaryTitle} topic={activeTopic} {...rail}/>;
  } else {
    const chapterNumber = topics.findIndex((topic) => topic.id === activeTopic.id) + 1;
    content = <ChapterView catalog={catalog} chapterCount={topics.length} chapterNumber={chapterNumber} eyebrow={secondaryTitle} topic={activeTopic} {...rail}/>;
  }

  return (
    <main className="kb-shell">
      <SiteSidebar
        activeSection={activeSection}
        activeSubsection={(activeSupplement ?? activeTopic).id}
        mobileOpen={mobileNav}
        mode={mode}
        onSelect={openSection}
        onSelectSubsection={selectTopic}
        personalHref={href}
        publicHref={href}
        secondaryItems={topicNavigationItems(topics, supplements, language)}
        secondaryTitle={secondaryTitle}
      />

      <section className="kb-main">
        <button aria-expanded={mobileNav} aria-label="Toggle navigation" className="kb-floating-menu" onClick={() => setMobileNav((value) => !value)} type="button">☰</button>
        <div className={`kb-content ${styles.page}`}>{content}</div>
      </section>

      {mobileNav && <button className="kb-backdrop" onClick={() => setMobileNav(false)} aria-label="Close navigation"/>}
    </main>
  );
}

type ViewProps = Readonly<{
  eyebrow: string;
  language: LearningLanguage;
  onLanguageChange: (language: LearningLanguage) => void;
}>;

function SupplementView({ eyebrow, language, onLanguageChange, supplement }: ViewProps & Readonly<{ supplement: TopicLearningSupplement }>) {
  return (
    <>
      <LearningHero eyebrow={eyebrow} title={localizedLabel(supplement, language)}/>
      <div className={styles.layout}>
        <div className={styles.document}>
          <article className={styles.article}>{supplement.content(language)}</article>
        </div>
        <LearningRail
          headings={[...supplement.headings]}
          language={language}
          languages={["en", "uk"]}
          onLanguageChange={onLanguageChange}
          showSourceRegistry={false}
        />
      </div>
    </>
  );
}

function UnderConstructionView({ eyebrow, language, onLanguageChange, topic }: ViewProps & Readonly<{ topic: TopicLearningItem }>) {
  const uk = language === "uk";
  return (
    <>
      <LearningHero
        eyebrow={`${eyebrow} · ${uk ? "У розробці" : "Under construction"}`}
        title={localizedLabel(topic, language)}
      />
      <section className="kb-under-construction-page">
        <span className="kb-construction-badge">{uk ? "У розробці" : "Under construction"}</span>
        <p>{uk ? "Цей розділ ще не опублікований." : "This chapter has not been published yet."}</p>
      </section>
      <LearningRail headings={[]} language={language} languages={["en", "uk"]} onLanguageChange={onLanguageChange}/>
    </>
  );
}

function ChapterView({ catalog, chapterCount, chapterNumber, eyebrow, language, onLanguageChange, topic }: ViewProps & Readonly<{
  catalog: TopicLearningCatalog;
  chapterCount: number;
  chapterNumber: number;
  topic: TopicLearningItem;
}>) {
  const uk = language === "uk";
  const markdown = uk ? topic.markdownUk : topic.markdown;
  const topicSources = useMemo(() => {
    const sourcesById = new Map((catalog.sources ?? []).map((source) => [source.id, source]));
    return (topic.sourceIds ?? [])
      .map((sourceId) => sourcesById.get(sourceId))
      .filter((source): source is TopicLearningSource => Boolean(source));
  }, [catalog.sources, topic.sourceIds]);
  const hasSourceRegistry = topicSources.length > 0;
  const renderedMarkdown = useMemo(
    () => hasSourceRegistry ? stripSourceSections(markdown) : markdown,
    [hasSourceRegistry, markdown],
  );
  const { headings, headingIdOverrides } = useMemo(() => {
    const canonicalMarkdown = hasSourceRegistry ? stripSourceSections(topic.markdown) : topic.markdown;
    return topicSectionNavigation(
      extractMarkdownHeadings(renderedMarkdown).filter((heading) => heading.level === 2),
      extractMarkdownHeadings(canonicalMarkdown).filter((heading) => heading.level === 2),
    );
  }, [hasSourceRegistry, renderedMarkdown, topic.markdown]);

  return (
    <>
      <LearningHero
        eyebrow={`${eyebrow} · ${uk ? "Розділ" : "Chapter"} ${String(chapterNumber).padStart(2, "0")} / ${String(chapterCount).padStart(2, "0")}`}
        title={uk ? catalog.titleUk : catalog.title}
      />

      <div className={styles.layout}>
        <div className={styles.document}>
          <article className={styles.article}>
            <MarkdownDocument headingIdOverrides={headingIdOverrides} markdown={renderedMarkdown}/>
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
          onLanguageChange={onLanguageChange}
        />
      </div>
    </>
  );
}
