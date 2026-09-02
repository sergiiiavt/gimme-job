"use client";

import { useMemo, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { contentHref } from "./content-deep-links";
import { LearningHero, LearningRail, LearningSourceRegistry, type LearningLanguage } from "./learning-document-ui";
import { sectionNavigationHref } from "./navigation-paths";
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

type LanguageMeta = Readonly<Record<LearningLanguage, readonly string[]>>;

type TopicLearningPageProps = Readonly<{
  activeSection: SiteSection;
  catalog: TopicLearningCatalog;
  defaultMeta: LanguageMeta;
  defaultTopicId: string;
  mode: SiteMode;
  publishedTopicMeta?: Readonly<Record<string, LanguageMeta>>;
  secondaryTitle: string;
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
  defaultMeta,
  defaultTopicId,
  mode,
  publishedTopicMeta = {},
  secondaryTitle,
}: TopicLearningPageProps) {
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [language, setLanguage] = useState<LearningLanguage>("en");
  const [mobileNav, setMobileNav] = useState(false);

  const topics = catalog.topics;
  const requestedTopic = searchParams.get("topic");
  const activeTopicId = requestedTopic && topics.some((topic) => topic.id === requestedTopic)
    ? requestedTopic
    : defaultTopicId;
  const activeTopic = topics.find((topic) => topic.id === activeTopicId)
    ?? topics.find((topic) => topic.id === defaultTopicId)
    ?? topics[0];
  const localizedLabel = language === "uk" ? activeTopic.labelUk : activeTopic.label;
  const localizedDescription = language === "uk" ? activeTopic.descriptionUk : activeTopic.description;
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

  const secondaryItems: SubnavItem[] = topics.map((topic) => ({
    id: topic.id,
    label: language === "uk" ? topic.labelUk : topic.label,
    status: topic.status === "under-construction" ? "under-construction" : undefined,
  }));

  const selectTopic = (topicId: string) => {
    if (!topics.some((topic) => topic.id === topicId)) return;
    router.push(contentHref(pathname, searchParams.toString(), { topic: topicId }), { scroll: false });
    setMobileNav(false);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const openSection = (section: SiteSection) => {
    window.location.assign(sectionNavigationHref(section, mode));
  };

  const pageTitle = language === "uk" ? catalog.titleUk : catalog.title;
  const chapterNumber = topics.findIndex((topic) => topic.id === activeTopic.id) + 1;
  const meta = publishedTopicMeta[activeTopic.id]?.[language] ?? defaultMeta[language];
  const href = sectionNavigationHref(activeSection, mode);

  return (
    <main className="kb-shell">
      <SiteSidebar
        activeSection={activeSection}
        activeSubsection={activeTopic.id}
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
          {activeTopic.status === "under-construction" ? (
            <>
              <LearningHero
                description={localizedDescription}
                eyebrow={`${secondaryTitle} · Under construction`}
                meta={[]}
                title={localizedLabel}
              />
              <section className="kb-under-construction-page">
                <span className="kb-construction-badge">Under construction</span>
                <p>{language === "uk"
                  ? "Топік збережений у learning path і буде розгорнутий у повний source-backed розділ."
                  : "This topic stays in the learning path and will be expanded into a complete source-backed chapter."}</p>
              </section>
              <LearningRail headings={[]} language={language} languages={["en", "uk"]} onLanguageChange={setLanguage} showSourceRegistry={false}/>
            </>
          ) : (
            <>
              <LearningHero
                description={localizedDescription}
                eyebrow={`${secondaryTitle} · ${language === "uk" ? "Розділ" : "Chapter"} ${String(chapterNumber).padStart(2, "0")} / ${String(topics.length).padStart(2, "0")}`}
                meta={[...meta]}
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
                      statusLabel={`${topicSources.length} ${language === "uk" ? "джерел цього розділу" : "chapter references"}`}
                    />
                  )}
                </div>
                <LearningRail
                  headings={headings}
                  language={language}
                  languages={["en", "uk"]}
                  onLanguageChange={setLanguage}
                  showSourceRegistry={hasSourceRegistry}
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
