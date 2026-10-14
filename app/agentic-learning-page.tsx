"use client";

import { Fragment, useState } from "react";
import { agenticPlannedTopics, agenticVideos } from "./agentic-videos";
import { LearningHero, LearningRail, type LearningLanguage } from "./learning-document-ui";
import LearningVideo from "./learning-video";
import { sectionNavigationHref } from "./navigation-paths";
import { SiteSidebar, type SubnavItem } from "./site-navigation";
import styles from "./agentic-learning-page.module.css";

const navigation: SubnavItem[] = [
  { id: "learning-videos", label: "Learning videos" },
  ...agenticPlannedTopics.map(({ id, title }) => ({ id, label: title, status: "under-construction" as const })),
];

const videoHeadings = agenticVideos.map(({ id, tocTitle }) => ({ id, text: tocTitle }));

const copy = {
  en: { plannedTitle: "Planned learning topics", underConstruction: "Under construction" },
  uk: { plannedTitle: "Заплановані навчальні теми", underConstruction: "У розробці" },
};

export default function AgenticLearningPage() {
  const [language, setLanguage] = useState<LearningLanguage>("uk");
  const [mobileNav, setMobileNav] = useState(false);
  const [activeSubsection, setActiveSubsection] = useState("learning-videos");
  const text = copy[language];

  const openSection = (section: Parameters<typeof sectionNavigationHref>[0]) => {
    window.location.assign(sectionNavigationHref(section, "public"));
  };

  const selectSubsection = (id: string) => {
    const target = document.getElementById(id);
    if (!target) return;
    setActiveSubsection(id);
    setMobileNav(false);
    target.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  return (
    <main className="kb-shell">
      <SiteSidebar
        activeSection="agentic"
        activeSubsection={activeSubsection}
        mobileOpen={mobileNav}
        mode="public"
        onSelect={openSection}
        onSelectSubsection={selectSubsection}
        personalHref="/learn/agentic"
        publicHref="/learn/agentic"
        secondaryItems={navigation}
        secondaryTitle="AI agents & MCP"
      />

      <section className="kb-main">
        <button aria-expanded={mobileNav} aria-label="Toggle navigation" className="kb-floating-menu" onClick={() => setMobileNav((value) => !value)} type="button">☰</button>
        <div className={`kb-content ${styles.page}`}>
          <LearningHero eyebrow="Learning path" title="AI agents & MCP"/>

          <div className={styles.layout}>
            <div className={styles.document}>
              <article className={styles.article} id="learning-videos">
                {agenticVideos.map(({ id, title, channel, channelUrl, videoId }) => (
                  <Fragment key={id}>
                    <h2 className={styles.videoTitle} id={id}>{title}</h2>
                    <LearningVideo
                      channel={channel}
                      channelUrl={channelUrl}
                      showTitle={false}
                      title={title}
                      videoId={videoId}
                    />
                  </Fragment>
                ))}

                <h2 className={styles.plannedTitle} id="planned-topics">{text.plannedTitle}</h2>
                {agenticPlannedTopics.map((item) => (
                  <section aria-labelledby={`topic-${item.id}`} className={styles.referenceCard} id={item.id} key={item.id}>
                    <span className={styles.placeholder}>{text.underConstruction}</span>
                    <h3 id={`topic-${item.id}`}>{item.title}</h3>
                    <p>{item.description}</p>
                  </section>
                ))}
              </article>
            </div>

            <LearningRail headings={videoHeadings} language={language} languages={["en", "uk"]} onLanguageChange={setLanguage} showSourceRegistry={false}/>
          </div>
        </div>
      </section>

      {mobileNav && <button className="kb-backdrop" onClick={() => setMobileNav(false)} aria-label="Close navigation"/>}
    </main>
  );
}
