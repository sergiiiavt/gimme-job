"use client";

import { useState } from "react";
import { agenticVideos } from "./agentic-videos";
import { LearningHero } from "./learning-document-ui";
import LearningVideo from "./learning-video";
import { sectionNavigationHref } from "./navigation-paths";
import { SiteSidebar, type SubnavItem } from "./site-navigation";
import styles from "./agentic-learning-page.module.css";

const navigation: SubnavItem[] = agenticVideos.map(({ id, title }) => ({ id, label: title }));

export default function AgenticLearningPage() {
  const [mobileNav, setMobileNav] = useState(false);
  const [activeSubsection, setActiveSubsection] = useState<string>(agenticVideos[0].id);

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
        <div className={"kb-content " + styles.page}>
          <LearningHero eyebrow="Videos" title="AI agents & MCP"/>
          <div className={styles.videoList}>
            {agenticVideos.map(({ id, title, channel, channelUrl, videoId }) => (
              <div className={styles.videoItem} id={id} key={id}>
                <LearningVideo
                  channel={channel}
                  channelUrl={channelUrl}
                  title={title}
                  videoId={videoId}
                />
              </div>
            ))}
          </div>
        </div>
      </section>

      {mobileNav && <button className="kb-backdrop" onClick={() => setMobileNav(false)} aria-label="Close navigation"/>}
    </main>
  );
}
