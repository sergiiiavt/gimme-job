"use client";

import { useMemo, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import networkingCatalog from "@/content/networking/catalog";
import { contentHref } from "./content-deep-links";
import { LearningHero, LearningRail, type LearningLanguage } from "./learning-document-ui";
import { sectionNavigationHref } from "./navigation-paths";
import MarkdownDocument, { extractMarkdownHeadings } from "./qa-markdown";
import { SiteSidebar, type SiteSection, type SubnavItem } from "./site-navigation";
import styles from "./qa-fundamentals-page.module.css";

type NetworkingPageProps = Readonly<{ mode: "public" | "personal" }>;

const publishedTopicMeta = {
  "protocols-and-transports": {
    en: ["TCP · UDP · TLS · DNS", "HTTP/1.1 · HTTP/2 · HTTP/3 · QUIC", "WebSocket · gRPC · MQTT · AMQP"],
    uk: ["TCP · UDP · TLS · DNS", "HTTP/1.1 · HTTP/2 · HTTP/3 · QUIC", "WebSocket · gRPC · MQTT · AMQP"],
  },
} as const;

export default function NetworkingPage({ mode }: NetworkingPageProps) {
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [language, setLanguage] = useState<LearningLanguage>("en");
  const [mobileNav, setMobileNav] = useState(false);

  const topics = networkingCatalog.topics;
  const requestedTopic = searchParams.get("topic");
  const activeTopicId = requestedTopic && topics.some((topic) => topic.id === requestedTopic)
    ? requestedTopic
    : "protocols-and-transports";
  const activeTopic = topics.find((topic) => topic.id === activeTopicId) ?? topics[0];
  const localizedLabel = language === "uk" ? activeTopic.labelUk : activeTopic.label;
  const localizedDescription = language === "uk" ? activeTopic.descriptionUk : activeTopic.description;
  const markdown = language === "uk" ? activeTopic.markdownUk : activeTopic.markdown;
  const headings = useMemo(() => extractMarkdownHeadings(markdown).filter((heading) => heading.level === 2), [markdown]);

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

  const pageTitle = language === "uk" ? networkingCatalog.titleUk : networkingCatalog.title;
  const chapterNumber = topics.findIndex((topic) => topic.id === activeTopic.id) + 1;
  const metaByLanguage = publishedTopicMeta[activeTopic.id as keyof typeof publishedTopicMeta];
  const meta = metaByLanguage?.[language] ?? [
    language === "uk" ? "Networking" : "Networking",
    language === "uk" ? "Практичний learning path" : "Practical learning path",
    language === "uk" ? "Source-backed матеріал" : "Source-backed material",
  ];

  return (
    <main className="kb-shell">
      <SiteSidebar
        activeSection="networking"
        activeSubsection={activeTopic.id}
        mobileOpen={mobileNav}
        mode={mode}
        onSelect={openSection}
        onSelectSubsection={selectTopic}
        personalHref="/learn/networking"
        publicHref="/learn/networking"
        secondaryItems={secondaryItems}
        secondaryTitle="Networking"
      />

      <section className="kb-main">
        <button aria-expanded={mobileNav} aria-label="Toggle navigation" className="kb-floating-menu" onClick={() => setMobileNav((value) => !value)} type="button">☰</button>

        <div className={`kb-content ${styles.page}`}>
          {activeTopic.status === "under-construction" ? (
            <>
              <LearningHero
                description={localizedDescription}
                eyebrow="Networking · Under construction"
                meta={[]}
                title={localizedLabel}
              />
              <section className="kb-under-construction-page">
                <span className="kb-construction-badge">Under construction</span>
                <p>{language === "uk"
                  ? "Топік збережений у learning path і буде розгорнутий у повний source-backed розділ."
                  : "This topic stays in the learning path and will be expanded into a complete source-backed chapter."}</p>
              </section>
              <LearningRail headings={[]} language={language} languages={["en", "uk"]} onLanguageChange={setLanguage}/>
            </>
          ) : (
            <>
              <LearningHero
                description={localizedDescription}
                eyebrow={`Networking · ${language === "uk" ? "Розділ" : "Chapter"} ${String(chapterNumber).padStart(2, "0")} / ${String(topics.length).padStart(2, "0")}`}
                meta={[...meta]}
                title={pageTitle}
              />

              <div className={styles.layout}>
                <div className={styles.document}>
                  <article className={styles.article}>
                    <MarkdownDocument markdown={markdown}/>
                  </article>
                </div>
                <LearningRail headings={headings} language={language} languages={["en", "uk"]} onLanguageChange={setLanguage}/>
              </div>
            </>
          )}
        </div>
      </section>

      {mobileNav && <button className="kb-backdrop" onClick={() => setMobileNav(false)} aria-label="Close navigation"/>}
    </main>
  );
}
