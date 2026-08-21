"use client";

import { useMemo, useState } from "react";
import { LearningHero, LearningRail, type LearningLanguage } from "./learning-document-ui";
import LearningVideo from "./learning-video";
import { sectionNavigationHref } from "./navigation-paths";
import { SiteSidebar, type SubnavItem } from "./site-navigation";
import styles from "./agentic-learning-page.module.css";

const headings = [
  { id: "claude-code", text: "Claude Code" },
  { id: "claude-cowork", text: "Claude Cowork" },
  { id: "agentic-patterns", text: "Agentic workflow patterns" },
];

const navigation: SubnavItem[] = headings.map(({ id, text }) => ({ id, label: text }));

const copy = {
  en: {
    title: "AI agents & MCP",
    description: "Practical agentic workflows: start with Claude Code, move into Claude Cowork, then connect the ideas to tools, approvals, state, MCP and evaluation.",
    meta: ["Ukrainian video materials", "Embedded playback", "Capability-aware speed controls"],
    codeTitle: "Claude Code: a practical start",
    codeIntro: "A Ukrainian walkthrough from Rodion Lozovoi that starts from zero and builds a working web application with Claude Code. Use it as the practical entry point before moving to broader agentic workflows.",
    coworkTitle: "Claude Cowork: work beyond coding",
    coworkIntro: "Cowork is the bridge from coding agents to general work agents: files, connectors, repeatable workflows and human approval. The chapter combines a practical content-workflow video with a second Rodion Cowork resource.",
    pending: "The exact YouTube watch URL still needs to be verified before embedding. The player intentionally does not guess video IDs.",
    rodionCowork: "How to automate 80% of work for €20? Full Claude Cowork overview",
    shtuchkaCowork: "Content factory with Claude Cowork, Notion and Skill Editor",
    patternsTitle: "Agentic workflow patterns to notice",
    patternsIntro: "Do not watch the videos only as product tutorials. Map each example to reusable agent design ideas:",
    patterns: [
      "Tools and actions: what the agent can read or change, and which calls need validation.",
      "State and memory: what should exist only for a session versus what may be persisted.",
      "Approval gates: require human confirmation before consequential external actions.",
      "Observability and evaluation: measure task success, tool correctness, failures and regressions.",
      "MCP and connectors: treat external systems as explicit capabilities with scoped permissions.",
    ],
    speed: "Playback speed",
    speedCopy: "The custom player asks YouTube which playback rates are actually available. 3× and 4× are shown explicitly, but enabled only when the embedded player reports support for them. This avoids a control that silently falls back to 2×.",
  },
  uk: {
    title: "AI agents & MCP",
    description: "Практичні agentic workflows: спочатку Claude Code, далі Claude Cowork, а потім зв’язок із tools, approval gates, state, MCP та evaluation.",
    meta: ["Україномовні відеоматеріали", "Вбудований плеєр", "Перевірка доступних швидкостей"],
    codeTitle: "Claude Code: практичний старт",
    codeIntro: "Україномовний walkthrough Родіона Лозового: від нуля до робочого вебзастосунку за допомогою Claude Code. Це практична точка входу перед ширшими agentic workflows.",
    coworkTitle: "Claude Cowork: agentic робота поза кодом",
    coworkIntro: "Cowork показує перехід від coding agents до general-work agents: файли, конектори, повторювані workflows та human approval. Тут поєднані практичне відео про content workflow та ще один Cowork-матеріал Родіона.",
    pending: "Точний YouTube watch URL ще треба верифікувати перед embed. Плеєр навмисно не вгадує video ID.",
    rodionCowork: "Як автоматизувати 80% роботи за €20? Повний огляд Claude Cowork",
    shtuchkaCowork: "Контент-завод з Claude Cowork, Notion та Skill Editor",
    patternsTitle: "Agentic patterns, які варто помічати",
    patternsIntro: "Дивись на ці відео не лише як на product tutorials. Прив’язуй приклади до повторно використовуваних принципів побудови агентів:",
    patterns: [
      "Tools and actions: що агент може читати або змінювати та які виклики потребують validation.",
      "State and memory: що має жити тільки в сесії, а що можна зберігати довше.",
      "Approval gates: human confirmation перед зовнішніми діями з наслідками.",
      "Observability та evaluation: task success, коректність tool calls, failures та regression checks.",
      "MCP та connectors: зовнішні системи як явні capabilities з обмеженими permissions.",
    ],
    speed: "Швидкість відтворення",
    speedCopy: "Наш плеєр запитує у YouTube реально доступні playback rates. 3× і 4× показуються окремо, але активуються лише якщо embedded player повідомляє, що підтримує їх. Тобто кнопка не маскує тихий fallback до 2×.",
  },
};

export default function AgenticLearningPage() {
  const [language, setLanguage] = useState<LearningLanguage>("uk");
  const [mobileNav, setMobileNav] = useState(false);
  const [activeSubsection, setActiveSubsection] = useState(headings[0].id);
  const text = copy[language];
  const localizedHeadings = useMemo(() => {
    const labels = [text.codeTitle, text.coworkTitle, text.patternsTitle];
    return headings.map((heading, index) => ({ ...heading, text: labels[index] }));
  }, [text]);

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
          <LearningHero description={text.description} eyebrow="Agentic learning" meta={text.meta} title={text.title}/>

          <div className={styles.layout}>
            <div className={styles.document}>
              <article className={styles.article}>
                <h2 id="claude-code">{text.codeTitle}</h2>
                <p>{text.codeIntro}</p>
                <LearningVideo
                  channel="RO БУДУЄ · Rodion Lozovoi"
                  title="Claude Code Desktop: from zero to a working web app"
                  videoId="zW4SEqgFBJc"
                />

                <h2 id="claude-cowork">{text.coworkTitle}</h2>
                <p>{text.coworkIntro}</p>
                <div className={styles.videoGroup}>
                  <LearningVideo
                    channel="Штучка Інтелект"
                    title={text.shtuchkaCowork}
                    videoId="rSDKAjao_7Q"
                  />
                  <div className={styles.referenceCard}>
                    <strong>RO БУДУЄ · Rodion Lozovoi</strong>
                    <h3>{text.rodionCowork}</h3>
                    <p>{text.pending}</p>
                    <a href="https://cases.media/article/claude-dlya-menedzheriv-yak-zarobiti-plyus-u-karmu-vid-komandi" rel="noreferrer" target="_blank">Verified reference ↗</a>
                  </div>
                </div>

                <h2 id="agentic-patterns">{text.patternsTitle}</h2>
                <p>{text.patternsIntro}</p>
                <ul>{text.patterns.map((item) => <li key={item}>{item}</li>)}</ul>
                <h3>{text.speed}</h3>
                <p>{text.speedCopy}</p>
              </article>
            </div>

            <LearningRail headings={localizedHeadings} language={language} languages={["en", "uk"]} onLanguageChange={setLanguage}/>
          </div>
        </div>
      </section>

      {mobileNav && <button className="kb-backdrop" onClick={() => setMobileNav(false)} aria-label="Close navigation"/>}
    </main>
  );
}
