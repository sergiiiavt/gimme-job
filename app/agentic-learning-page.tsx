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
  { id: "claude-prompting", text: "Prompting Claude" },
  { id: "agentic-patterns", text: "Agentic workflow patterns" },
];

const roadmapItems = [
  { id: "tools-and-actions", title: "Tools and actions", copy: "Typed tools, validation, permissions, retries, and safe external actions." },
  { id: "state-and-memory", title: "State and memory", copy: "Session state, durable memory, retrieval, and boundaries between user and agent data." },
  { id: "approval-workflows", title: "Approval workflows", copy: "Human confirmation before applications, messages, or any consequential action." },
  { id: "agent-evaluation", title: "Agent evaluation", copy: "Task success, trajectory checks, tool correctness, regression suites, and observability." },
  { id: "mcp-experiments", title: "MCP experiments", copy: "Small integrations for job sources, Gmail, GitHub, and structured knowledge." },
  { id: "pet-projects", title: "Pet projects", copy: "A portfolio backlog of narrow, testable agents instead of one uncontrolled system." },
] as const;

const navigation: SubnavItem[] = [
  ...headings.map(({ id, text }) => ({ id, label: text })),
  ...roadmapItems.map(({ id, title }) => ({ id, label: title, status: "under-construction" as const })),
];

const copy = {
  en: {
    title: "AI agents & MCP",
    description: "Practical agentic workflows: start with Claude Code, move into Claude Cowork, then connect the ideas to tools, approvals, state, MCP and evaluation.",
    meta: ["Claude Code in practice", "Cowork workflows", "Prompting & agent patterns"],
    codeTitle: "Claude Code: a practical start",
    codeIntro: "Rodion Lozovoi starts from zero and builds a working web application with Claude Code. Use the walkthrough to see the full flow: initial setup, task framing, iteration, and a concrete result.",
    coworkTitle: "Claude Cowork: work beyond coding",
    coworkIntro: "Cowork is the bridge from coding agents to general work agents: files, connectors, repeatable workflows and human approval. This chapter combines two practical Cowork walkthroughs.",
    rodionCowork: "How to automate 80% of work for €20? Full Claude Cowork overview",
    shtuchkaCowork: "Content factory with Claude Cowork, Notion and Skill Editor",
    promptingTitle: "Prompting Claude effectively",
    promptingIntro: "This video breaks down four prompting rules from Anthropic engineers and shows how to apply them in practice: task framing, context, constraints, and iteration. Use them as a checklist for Claude Code, Cowork, and agent workflows.",
    promptingVideo: "Claude engineer explains how to write prompts properly",
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
    speedCopy: "The console trick uses the native HTMLMediaElement video.playbackRate property directly on youtube.com. A cross-origin YouTube iframe does not expose that inner <video> to gimme-job.com, so we cannot literally run the same DOM command. Instead, every 3× / 4× click is sent as a best-effort setPlaybackRate request through the YouTube IFrame API. YouTube may accept it or clamp it to a supported rate, and the player reports the actual applied speed back in the UI.",
    roadmapTitle: "Planned Agentic topics",
    underConstruction: "Under construction",
  },
  uk: {
    title: "AI agents & MCP",
    description: "Практичні agentic workflows: спочатку Claude Code, далі Claude Cowork, а потім зв’язок із tools, approval gates, state, MCP та evaluation.",
    meta: ["Claude Code на практиці", "Cowork workflows", "Prompting та agent patterns"],
    codeTitle: "Claude Code: практичний старт",
    codeIntro: "Родіон Лозовий починає з нуля і будує робочий вебзастосунок за допомогою Claude Code. Корисно пройти весь flow: початкове налаштування, постановка задачі, ітерації та конкретний результат.",
    coworkTitle: "Claude Cowork: agentic робота поза кодом",
    coworkIntro: "Cowork показує перехід від coding agents до general-work agents: файли, конектори, повторювані workflows та human approval. Тут зібрані два практичні Cowork walkthroughs.",
    rodionCowork: "Як автоматизувати 80% роботи за €20? Повний огляд Claude Cowork",
    shtuchkaCowork: "Контент-завод з Claude Cowork, Notion та Skill Editor",
    promptingTitle: "Як ефективно писати промпти для Claude",
    promptingIntro: "Відео розбирає чотири правила промптингу від інженерів Anthropic і показує їх практичне застосування: постановка задачі, контекст, обмеження та ітерації. Використовуй їх як чекліст для Claude Code, Cowork та agentic workflows.",
    promptingVideo: "Інженер Claude показав, ЯК ПРАВИЛЬНО писати промти",
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
    speedCopy: "Трюк у console працює через нативну властивість HTMLMediaElement video.playbackRate прямо на youtube.com. Через cross-origin iframe gimme-job.com не має доступу до внутрішнього <video>, тому буквально виконати ту саму DOM-команду ми не можемо. Натомість кожен клік 3× / 4× завжди відправляє best-effort setPlaybackRate через YouTube IFrame API. YouTube може прийняти значення або звести його до підтримуваної швидкості, а наш UI показує фактично застосований rate.",
    roadmapTitle: "Заплановані Agentic теми",
    underConstruction: "Under construction",
  },
};

export default function AgenticLearningPage() {
  const [language, setLanguage] = useState<LearningLanguage>("uk");
  const [mobileNav, setMobileNav] = useState(false);
  const [activeSubsection, setActiveSubsection] = useState(headings[0].id);
  const text = copy[language];
  const localizedHeadings = useMemo(() => {
    const labels = [text.codeTitle, text.coworkTitle, text.promptingTitle, text.patternsTitle];
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
                  channelUrl="https://www.youtube.com/@ro_dionys"
                  title="Claude Code Desktop: from zero to a working web app"
                  videoId="zW4SEqgFBJc"
                />

                <h2 id="claude-cowork">{text.coworkTitle}</h2>
                <p>{text.coworkIntro}</p>
                <div className={styles.videoGroup}>
                  <LearningVideo
                    channel="Штучка Інтелект"
                    channelUrl="https://www.youtube.com/@shtuchka-intelekt"
                    title={text.shtuchkaCowork}
                    videoId="rSDKAjao_7Q"
                  />
                  <LearningVideo
                    channel="RO БУДУЄ · Rodion Lozovoi"
                    channelUrl="https://www.youtube.com/@ro_dionys"
                    title={text.rodionCowork}
                    videoId="LZ79ZwTI6lU"
                  />
                </div>

                <h2 id="claude-prompting">{text.promptingTitle}</h2>
                <p>{text.promptingIntro}</p>
                <LearningVideo
                  channel="Hillel IT School"
                  channelUrl="https://www.youtube.com/@HillelITSchool"
                  title={text.promptingVideo}
                  videoId="geoFJ6OXMKE"
                />

                <h2 id="agentic-patterns">{text.patternsTitle}</h2>
                <p>{text.patternsIntro}</p>
                <ul>{text.patterns.map((item) => <li key={item}>{item}</li>)}</ul>
                <h3>{text.speed}</h3>
                <p>{text.speedCopy}</p>

                <h2>{text.roadmapTitle}</h2>
                {roadmapItems.map((item) => (
                  <section className={styles.referenceCard} id={item.id} key={item.id}>
                    <strong>{text.underConstruction}</strong>
                    <h3>{item.title}</h3>
                    <p>{item.copy}</p>
                  </section>
                ))}
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
