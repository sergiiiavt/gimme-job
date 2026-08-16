"use client";

import { useEffect, useMemo, useState } from "react";
import MarkdownDocument, { extractMarkdownHeadings, markdownSlug } from "./qa-markdown";
import { SiteSidebar, type SecondarySwitcher, type SiteSection, type SubnavItem } from "./site-navigation";
import styles from "./qa-fundamentals-page.module.css";

type SiteMode = "public" | "personal";
type LearningLanguage = "en" | "uk";

interface LearningSource {
  id: string;
  title: string;
  url: string;
  publisher: string;
  kind: string;
  role: string;
}

interface LearningModule {
  id: string;
  label: string;
  labelUk?: string;
  level?: string;
  description: string;
  descriptionUk?: string;
}

interface LessonRepoRef {
  label: string;
  path: string;
  kind?: string;
}

interface LearningLesson {
  id: string;
  moduleId: string;
  level: string;
  order: number;
  title: string;
  titleUk: string;
  summary: string;
  summaryUk: string;
  concept: string;
  conceptUk: string;
  keyPoints: string[];
  keyPointsUk: string[];
  code?: string;
  codeCaption?: string;
  codeCaptionUk?: string;
  pitfalls: string[];
  pitfallsUk: string[];
  exercise?: string;
  exerciseUk?: string;
  sourceIds: string[];
  repoRefs?: LessonRepoRef[];
}

interface ReferenceImplementation {
  repo: string;
  branch: string;
  verifiedCommit: string;
  verifiedAt: string;
}

export interface StructuredLearningCurriculum {
  title: string;
  description: string;
  taxonomy: LearningModule[];
  sources: LearningSource[];
  lessons: LearningLesson[];
  referenceImplementation?: ReferenceImplementation;
}

interface TrackOption {
  id: string;
  label: string;
  available: boolean;
  emptyState?: string;
}

interface LearningDocumentPageProps {
  mode: SiteMode;
  section: Extract<SiteSection, "programming" | "automation">;
  secondaryTitle: string;
  curriculum: StructuredLearningCurriculum;
  publicHref: string;
  personalHref: string;
  trackOptions: TrackOption[];
  defaultTrackId: string;
}

const repoRefKindLabels: Record<string, string> = {
  implementation: "Implementation",
  usage: "Used by",
  ci: "CI",
};

const repoBlobUrl = (repo: string, rev: string, path: string) => `https://github.com/${repo}/blob/${rev}/${path}`;

function topicFromLocation(validIds: string[], fallback: string) {
  if (typeof window === "undefined") return fallback;
  const requested = new URLSearchParams(window.location.search).get("topic");
  return requested && validIds.includes(requested) ? requested : fallback;
}

function trackFromLocation(validIds: string[], fallback: string) {
  if (typeof window === "undefined") return fallback;
  const requested = new URLSearchParams(window.location.search).get("track");
  return requested && validIds.includes(requested) ? requested : fallback;
}

function lessonMarkdown(lesson: LearningLesson, language: LearningLanguage, referenceImplementation?: ReferenceImplementation) {
  const showUk = language === "uk";
  const title = showUk ? lesson.titleUk : lesson.title;
  const summary = showUk ? lesson.summaryUk : lesson.summary;
  const concept = showUk ? lesson.conceptUk : lesson.concept;
  const keyPoints = showUk ? lesson.keyPointsUk : lesson.keyPoints;
  const pitfalls = showUk ? lesson.pitfallsUk : lesson.pitfalls;
  const caption = showUk ? lesson.codeCaptionUk : lesson.codeCaption;
  const exercise = showUk ? lesson.exerciseUk : lesson.exercise;
  const lines = [`## ${title}`, "", `**${summary}**`, "", concept];

  if (keyPoints.length) {
    lines.push("", `### ${showUk ? "Ключові моменти" : "Key points"}`, "", ...keyPoints.map((point) => `- ${point}`));
  }

  if (lesson.code) {
    lines.push("", `### ${showUk ? "Код" : "Code"}`, "", "```python", lesson.code, "```");
    if (caption) lines.push("", caption);
  }

  if (lesson.repoRefs?.length && referenceImplementation) {
    lines.push("", `### ${showUk ? "У реальному framework" : "See it in the framework"}`, "");
    for (const ref of lesson.repoRefs) {
      const kindLabel = ref.kind ? repoRefKindLabels[ref.kind] ?? ref.kind : "";
      const kind = kindLabel ? `${kindLabel} · ` : "";
      const live = repoBlobUrl(referenceImplementation.repo, referenceImplementation.branch, ref.path);
      const reviewed = repoBlobUrl(referenceImplementation.repo, referenceImplementation.verifiedCommit, ref.path);
      lines.push(`- ${kind}${ref.label}: \`${ref.path}\` — [live](${live}) · [reviewed](${reviewed})`);
    }
    lines.push("", `${showUk ? "Перевірено" : "Reviewed against"} commit \`${referenceImplementation.verifiedCommit.slice(0, 7)}\` (${referenceImplementation.verifiedAt}).`);
  }

  if (pitfalls.length) {
    lines.push("", `### ${showUk ? "Поширені помилки" : "Common pitfalls"}`, "", ...pitfalls.map((pitfall) => `- ${pitfall}`));
  }

  if (exercise) {
    lines.push("", `### ${showUk ? "Практична вправа" : "Practice exercise"}`, "", exercise);
  }

  return lines.join("\n");
}

export default function LearningDocumentPage({ curriculum, defaultTrackId, mode, personalHref, publicHref, secondaryTitle, section, trackOptions }: LearningDocumentPageProps) {
  const modules = useMemo(() => curriculum.taxonomy.filter((item) => item.level), [curriculum.taxonomy]);
  const firstModuleId = modules[0]?.id ?? "";
  const [activeModule, setActiveModule] = useState(firstModuleId);
  const [activeTrack, setActiveTrack] = useState(defaultTrackId);
  const [language, setLanguage] = useState<LearningLanguage>("en");
  const [mobileNav, setMobileNav] = useState(false);

  useEffect(() => {
    const syncFromLocation = () => {
      setActiveTrack(trackFromLocation(trackOptions.map((option) => option.id), defaultTrackId));
      setActiveModule(topicFromLocation(modules.map((item) => item.id), firstModuleId));
    };
    syncFromLocation();
    window.addEventListener("popstate", syncFromLocation);
    return () => window.removeEventListener("popstate", syncFromLocation);
  }, [defaultTrackId, firstModuleId, modules, trackOptions]);

  const selectedTrack = trackOptions.find((option) => option.id === activeTrack) ?? trackOptions[0];
  const trackAvailable = selectedTrack?.available !== false;
  const moduleIndex = Math.max(0, modules.findIndex((item) => item.id === activeModule));
  const activeChapter = modules[moduleIndex] ?? modules[0];
  const moduleLessons = useMemo(
    () => curriculum.lessons.filter((lesson) => lesson.moduleId === activeChapter?.id).sort((left, right) => left.order - right.order),
    [activeChapter?.id, curriculum.lessons],
  );
  const sourcesById = useMemo(() => new Map(curriculum.sources.map((source) => [source.id, source])), [curriculum.sources]);
  const moduleSources = useMemo(() => {
    const ids = Array.from(new Set(moduleLessons.flatMap((lesson) => lesson.sourceIds)));
    return ids.map((id) => sourcesById.get(id)).filter((source): source is LearningSource => Boolean(source));
  }, [moduleLessons, sourcesById]);

  const localizedModuleLabel = language === "uk" ? activeChapter?.labelUk ?? activeChapter?.label : activeChapter?.label;
  const localizedModuleDescription = language === "uk" ? activeChapter?.descriptionUk ?? activeChapter?.description : activeChapter?.description;
  const generatedMarkdown = activeChapter ? [
    `# ${localizedModuleLabel}`,
    "",
    localizedModuleDescription ?? "",
    "",
    ...moduleLessons.map((lesson) => lessonMarkdown(lesson, language, curriculum.referenceImplementation)),
  ].join("\n") : "";

  const headingIdOverrides = Object.fromEntries(moduleLessons.map((lesson) => [
    language === "uk" ? lesson.titleUk : lesson.title,
    markdownSlug(lesson.title),
  ]));
  const headings = extractMarkdownHeadings(generatedMarkdown)
    .filter((heading) => heading.level === 2)
    .map((heading) => ({ ...heading, id: headingIdOverrides[heading.text] ?? heading.id }));

  const moduleCounts = useMemo(() => new Map(modules.map((item) => [
    item.id,
    curriculum.lessons.filter((lesson) => lesson.moduleId === item.id).length,
  ])), [curriculum.lessons, modules]);
  const secondaryItems: SubnavItem[] = trackAvailable ? modules.map((item) => ({
    id: item.id,
    label: language === "uk" ? item.labelUk ?? item.label : item.label,
    count: moduleCounts.get(item.id),
  })) : [];

  const switcher: SecondarySwitcher = {
    activeId: activeTrack,
    options: trackOptions.map(({ id, label }) => ({ id, label })),
    onSelect: (trackId) => {
      const option = trackOptions.find((candidate) => candidate.id === trackId);
      if (!option) return;
      setActiveTrack(trackId);
      setMobileNav(false);
      const url = new URL(window.location.href);
      url.searchParams.set("track", trackId);
      if (option.available) url.searchParams.set("topic", firstModuleId);
      else url.searchParams.delete("topic");
      window.history.pushState(null, "", `${url.pathname}?${url.searchParams.toString()}`);
      window.scrollTo({ top: 0, behavior: "smooth" });
    },
  };

  const selectModule = (moduleId: string) => {
    if (!modules.some((item) => item.id === moduleId)) return;
    setActiveModule(moduleId);
    setMobileNav(false);
    const url = new URL(window.location.href);
    url.searchParams.set("topic", moduleId);
    url.searchParams.set("track", activeTrack);
    window.history.pushState(null, "", `${url.pathname}?${url.searchParams.toString()}`);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const openSection = (targetSection: SiteSection) => {
    const target = mode === "personal"
      ? targetSection === "jobs" ? "/workspace" : `/workspace/learn?section=${targetSection}`
      : targetSection === "about" ? "/" : targetSection === "jobs" ? "/workspace" : `/#${targetSection}`;
    window.location.assign(target);
  };

  const previous = moduleIndex > 0 ? modules[moduleIndex - 1] : undefined;
  const next = moduleIndex < modules.length - 1 ? modules[moduleIndex + 1] : undefined;
  const localizedLabel = (item: LearningModule | undefined) => item ? language === "uk" ? item.labelUk ?? item.label : item.label : undefined;

  return (
    <main className="kb-shell">
      <SiteSidebar
        activeSection={section}
        activeSubsection={trackAvailable ? activeModule : ""}
        mobileOpen={mobileNav}
        mode={mode}
        onSelect={openSection}
        onSelectSubsection={selectModule}
        personalHref={personalHref}
        publicHref={publicHref}
        secondaryEmptyState={trackAvailable ? undefined : selectedTrack?.emptyState ?? "This learning track is under construction."}
        secondaryItems={secondaryItems}
        secondarySwitcher={switcher}
        secondaryTitle={secondaryTitle}
      />

      <section className="kb-main">
        <button aria-expanded={mobileNav} aria-label="Toggle navigation" className="kb-floating-menu" onClick={() => setMobileNav((value) => !value)} type="button">☰</button>

        <div className={`kb-content ${styles.page}`}>
          {!trackAvailable ? (
            <header className={styles.hero}>
              <span className={styles.eyebrow}>{secondaryTitle}</span>
              <h1>{selectedTrack?.label}</h1>
              <p>{selectedTrack?.emptyState ?? "This learning track is under construction."}</p>
            </header>
          ) : (
            <>
              <header className={styles.hero}>
                <span className={styles.eyebrow}>
                  {secondaryTitle} · {selectedTrack?.label} · {language === "uk" ? "Розділ" : "Chapter"} {String(moduleIndex + 1).padStart(2, "0")} / {String(modules.length).padStart(2, "0")}
                </span>
                <h1>{curriculum.title}</h1>
                <p>{localizedModuleDescription}</p>
                <div className={styles.meta}>
                  <span>{moduleLessons.length} {language === "uk" ? "тем" : "lessons"}</span>
                  <span>{moduleSources.length} {language === "uk" ? "джерел" : "references"}</span>
                  <span>{language === "uk" ? "Розгорнутий навчальний матеріал" : "Long-form learning material"}</span>
                </div>
              </header>

              <div className={styles.layout}>
                <div className={styles.document}>
                  <article className={styles.article}>
                    <MarkdownDocument headingIdOverrides={headingIdOverrides} markdown={generatedMarkdown}/>
                  </article>

                  <section className={styles.sourcePanel} id="source-registry" aria-labelledby="learning-source-register">
                    <header>
                      <h2 id="learning-source-register">{language === "uk" ? "Реєстр джерел" : "Source registry"}</h2>
                      <span>{moduleSources.length} {language === "uk" ? "джерел цього розділу" : "chapter references"}</span>
                    </header>
                    <div className={styles.sources}>
                      {moduleSources.map((source) => (
                        <article className={styles.source} key={source.id}>
                          <div>
                            <strong>{source.title}</strong>
                            <p>{source.role}</p>
                            <span className={styles.sourceStatus}>{source.publisher} · {source.kind.replaceAll("-", " ")}</span>
                          </div>
                          <a href={source.url} rel="noreferrer" target="_blank">{language === "uk" ? "Джерело" : "Source"} ↗</a>
                        </article>
                      ))}
                    </div>
                  </section>

                  <nav className={styles.pager} aria-label={`${secondaryTitle} chapters`}>
                    <button disabled={!previous} onClick={() => previous && selectModule(previous.id)} type="button">
                      <small>← {language === "uk" ? "Попередній розділ" : "Previous chapter"}</small>
                      <strong>{localizedLabel(previous) ?? (language === "uk" ? "Початок курсу" : "Beginning of path")}</strong>
                    </button>
                    <button disabled={!next} onClick={() => next && selectModule(next.id)} type="button">
                      <small>{language === "uk" ? "Наступний розділ" : "Next chapter"} →</small>
                      <strong>{localizedLabel(next) ?? (language === "uk" ? "Кінець курсу" : "End of path")}</strong>
                    </button>
                  </nav>
                </div>

                <aside className={styles.rail} aria-label={language === "uk" ? "Навігація навчального матеріалу" : "Learning material navigation"}>
                  <section className={styles.language} aria-label={language === "uk" ? "Мова матеріалу" : "Material language"}>
                    <span>{language === "uk" ? "Мова" : "Language"}</span>
                    <div role="group" aria-label={language === "uk" ? "Мова матеріалу" : "Material language"}>
                      <button className={language === "en" ? styles.activeLanguage : ""} onClick={() => setLanguage("en")} type="button">EN</button>
                      <button className={language === "uk" ? styles.activeLanguage : ""} onClick={() => setLanguage("uk")} type="button">UA</button>
                    </div>
                  </section>

                  <section className={styles.toc} aria-label={language === "uk" ? "На цій сторінці" : "On this page"}>
                    <span>{language === "uk" ? "На цій сторінці" : "On this page"}</span>
                    <nav>
                      {headings.map((heading) => <a href={`#${heading.id}`} key={heading.id}>{heading.text}</a>)}
                      <a className={styles.sourceLink} href="#source-registry">
                        <small>{language === "uk" ? "Джерела" : "References"}</small>
                        {language === "uk" ? "Реєстр джерел" : "Source registry"}
                      </a>
                    </nav>
                  </section>
                </aside>
              </div>
            </>
          )}
        </div>
      </section>

      {mobileNav && <button className="kb-backdrop" onClick={() => setMobileNav(false)} aria-label="Close navigation"/>}
    </main>
  );
}
