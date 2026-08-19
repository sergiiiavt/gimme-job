"use client";

import { useEffect, useMemo, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { contentHref } from "./content-deep-links";
import { LearningHero, LearningPager, LearningRail, LearningSourceRegistry, type LearningLanguage } from "./learning-document-ui";
import { sectionNavigationHref } from "./navigation-paths";
import MarkdownDocument, { extractMarkdownHeadings, markdownSlug, stripMarkdownSection, type MarkdownUsageFrequency } from "./qa-markdown";
import { SiteSidebar, type ExternalNavigationId, type SecondarySwitcher, type SiteSection, type SubnavItem } from "./site-navigation";
import styles from "./qa-fundamentals-page.module.css";

type SiteMode = "public" | "personal";

interface LearningSource {
  id: string;
  title: string;
  url: string;
  publisher: string;
  kind?: string;
  role: string;
}

interface LearningModule {
  id: string;
  label: string;
  labelUk?: string;
  navLabel?: string;
  navLabelUk?: string;
  level?: string;
  description: string;
  descriptionUk?: string;
  introMarkdown?: string;
  introMarkdownUk?: string;
  markdown?: string;
  markdownUk?: string;
  sourceIds?: string[];
  count?: number;
  kind?: string;
  usageByHeading?: Record<string, MarkdownUsageFrequency>;
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
  titleUk?: string;
  description: string;
  taxonomy: LearningModule[];
  sources: LearningSource[];
  lessons?: LearningLesson[];
  referenceImplementation?: ReferenceImplementation;
}

interface TrackOption {
  id: string;
  label: string;
  labelUk?: string;
  available: boolean;
  moduleIds?: string[];
  emptyState?: string;
}

interface LearningMetaContext {
  language: LearningLanguage;
  module: LearningModule;
  lessonCount: number;
  sourceCount: number;
}

interface LearningDocumentPageProps {
  mode: SiteMode;
  section: SiteSection | null;
  activeExternalId?: ExternalNavigationId;
  secondaryTitle: string;
  curriculum: StructuredLearningCurriculum;
  publicHref: string;
  personalHref: string;
  trackOptions?: TrackOption[];
  defaultTrackId?: string;
  initialModuleId?: string;
  languages?: LearningLanguage[];
  heroMeta?: (context: LearningMetaContext) => string[];
  sourceStatusLabel?: (context: LearningMetaContext) => string;
}

const repoRefKindLabels: Record<string, string> = {
  implementation: "Implementation",
  usage: "Used by",
  ci: "CI",
};

const repoBlobUrl = (repo: string, rev: string, path: string) => `https://github.com/${repo}/blob/${rev}/${path}`;

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

export default function LearningDocumentPage({ activeExternalId, curriculum, defaultTrackId, heroMeta, initialModuleId, languages = ["en", "uk"], mode, personalHref, publicHref, secondaryTitle, section, sourceStatusLabel, trackOptions }: LearningDocumentPageProps) {
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();
  const lessons = useMemo(() => curriculum.lessons ?? [], [curriculum.lessons]);
  const allModules = useMemo(() => curriculum.taxonomy.filter((item) => item.level || item.markdown), [curriculum.taxonomy]);
  const resolvedTrackOptions = useMemo<TrackOption[]>(
    () => trackOptions?.length ? trackOptions : [{ id: "default", label: secondaryTitle, available: true }],
    [secondaryTitle, trackOptions],
  );
  const resolvedDefaultTrackId = defaultTrackId ?? resolvedTrackOptions[0]?.id ?? "default";
  const requestedTrackId = searchParams.get("track");
  const initialTrackId = requestedTrackId && resolvedTrackOptions.some((option) => option.id === requestedTrackId)
    ? requestedTrackId
    : resolvedDefaultTrackId;
  const showTrackSwitcher = resolvedTrackOptions.length > 1;
  const [activeTrack, setActiveTrack] = useState(initialTrackId);
  const [language, setLanguage] = useState<LearningLanguage>(languages[0] ?? "en");
  const [mobileNav, setMobileNav] = useState(false);

  const selectedTrack = resolvedTrackOptions.find((option) => option.id === activeTrack) ?? resolvedTrackOptions[0];
  const trackAvailable = selectedTrack?.available !== false;
  const modules = useMemo(() => {
    if (!trackAvailable) return [];
    if (!selectedTrack?.moduleIds?.length) return allModules;
    const selectedModuleIds = new Set(selectedTrack.moduleIds);
    return allModules.filter((item) => selectedModuleIds.has(item.id));
  }, [allModules, selectedTrack, trackAvailable]);
  const firstModuleId = modules[0]?.id ?? "";
  const requestedModuleId = searchParams.get("topic") ?? initialModuleId;
  const initialActiveModuleId = requestedModuleId && modules.some((item) => item.id === requestedModuleId) ? requestedModuleId : firstModuleId;
  const [activeModule, setActiveModule] = useState(initialActiveModuleId);

  useEffect(() => {
    if (!requestedTrackId || !resolvedTrackOptions.some((option) => option.id === requestedTrackId)) return;
    setActiveTrack((current) => current === requestedTrackId ? current : requestedTrackId);
  }, [requestedTrackId, resolvedTrackOptions]);

  useEffect(() => {
    if (!requestedModuleId || !modules.some((item) => item.id === requestedModuleId)) return;
    setActiveModule((current) => current === requestedModuleId ? current : requestedModuleId);
  }, [modules, requestedModuleId]);

  useEffect(() => {
    if (!activeModule || searchParams.get("topic")) return;
    router.replace(contentHref(pathname, searchParams.toString(), {
      topic: activeModule,
      track: showTrackSwitcher ? activeTrack : null,
    }), { scroll: false });
  }, [activeModule, activeTrack, pathname, router, searchParams, showTrackSwitcher]);

  const moduleIndex = Math.max(0, modules.findIndex((item) => item.id === activeModule));
  const activeChapter = modules[moduleIndex] ?? modules[0];
  const moduleLessons = useMemo(
    () => lessons.filter((lesson) => lesson.moduleId === activeChapter?.id).sort((left, right) => left.order - right.order),
    [activeChapter?.id, lessons],
  );
  const sourcesById = useMemo(() => new Map(curriculum.sources.map((source) => [source.id, source])), [curriculum.sources]);
  const moduleSources = useMemo(() => {
    const ids = Array.from(new Set([
      ...(activeChapter?.sourceIds ?? []),
      ...moduleLessons.flatMap((lesson) => lesson.sourceIds),
    ]));
    return ids.map((id) => sourcesById.get(id)).filter((source): source is LearningSource => Boolean(source));
  }, [activeChapter, moduleLessons, sourcesById]);

  const localizedModuleLabel = language === "uk" ? activeChapter?.labelUk ?? activeChapter?.label : activeChapter?.label;
  const localizedModuleDescription = language === "uk" ? activeChapter?.descriptionUk ?? activeChapter?.description : activeChapter?.description;
  const localizedIntroMarkdown = language === "uk" ? activeChapter?.introMarkdownUk ?? activeChapter?.introMarkdown : activeChapter?.introMarkdown;
  const englishIntroMarkdown = activeChapter?.introMarkdown ?? "";
  const rawMarkdown = language === "uk" ? activeChapter?.markdownUk ?? activeChapter?.markdown : activeChapter?.markdown;
  const englishRawMarkdown = activeChapter?.markdown ? stripMarkdownSection(activeChapter.markdown, "sources") : "";
  const generatedMarkdown = rawMarkdown
    ? stripMarkdownSection(rawMarkdown, "sources")
    : activeChapter ? [
      `# ${localizedModuleLabel}`,
      "",
      localizedModuleDescription ?? "",
      ...(localizedIntroMarkdown ? ["", localizedIntroMarkdown] : []),
      "",
      ...moduleLessons.map((lesson) => lessonMarkdown(lesson, language, curriculum.referenceImplementation)),
    ].join("\n") : "";

  const localizedIntroHeadings = extractMarkdownHeadings(localizedIntroMarkdown ?? "").filter((heading) => heading.level === 2);
  const englishIntroHeadings = extractMarkdownHeadings(englishIntroMarkdown).filter((heading) => heading.level === 2);
  const introHeadingOverrides = Object.fromEntries(localizedIntroHeadings.map((heading, index) => [
    heading.text,
    englishIntroHeadings[index]?.id ?? heading.id,
  ]));
  const structuredHeadingOverrides = {
    ...introHeadingOverrides,
    ...Object.fromEntries(moduleLessons.map((lesson) => [
      language === "uk" ? lesson.titleUk : lesson.title,
      markdownSlug(lesson.title),
    ])),
  };
  const localizedHeadings = extractMarkdownHeadings(generatedMarkdown).filter((heading) => heading.level === 2);
  const englishRawHeadings = extractMarkdownHeadings(englishRawMarkdown).filter((heading) => heading.level === 2);
  const rawHeadingOverrides = Object.fromEntries(localizedHeadings.map((heading, index) => [
    heading.text,
    englishRawHeadings[index]?.id ?? heading.id,
  ]));
  const headingIdOverrides = rawMarkdown ? rawHeadingOverrides : structuredHeadingOverrides;
  const headings = localizedHeadings.map((heading) => ({ ...heading, id: headingIdOverrides[heading.text] ?? heading.id }));

  useEffect(() => {
    if (typeof window === "undefined" || !window.location.hash) return;
    const rawHash = window.location.hash.slice(1);
    let targetId = rawHash;
    try {
      targetId = decodeURIComponent(rawHash);
    } catch {
      targetId = rawHash;
    }

    const frame = window.requestAnimationFrame(() => {
      document.getElementById(targetId)?.scrollIntoView({ block: "start" });
    });
    return () => window.cancelAnimationFrame(frame);
  }, [activeModule, generatedMarkdown]);

  const moduleCounts = useMemo(() => new Map(modules.map((item) => [
    item.id,
    item.count ?? lessons.filter((lesson) => lesson.moduleId === item.id).length,
  ])), [lessons, modules]);
  const secondaryItems: SubnavItem[] = trackAvailable ? modules.map((item) => ({
    id: item.id,
    label: language === "uk" ? item.navLabelUk ?? item.labelUk ?? item.navLabel ?? item.label : item.navLabel ?? item.label,
    count: moduleCounts.get(item.id) || undefined,
  })) : [];

  const switcher: SecondarySwitcher = {
    activeId: activeTrack,
    options: resolvedTrackOptions.map(({ id, label, labelUk }) => ({ id, label: language === "uk" ? labelUk ?? label : label })),
    onSelect: (trackId) => {
      const option = resolvedTrackOptions.find((candidate) => candidate.id === trackId);
      if (!option) return;
      setActiveTrack(trackId);
      const allowedIds = option.moduleIds?.length ? new Set(option.moduleIds) : undefined;
      const firstTrackModule = option.available
        ? (allowedIds ? allModules.find((item) => allowedIds.has(item.id)) : allModules[0])
        : undefined;
      setActiveModule(firstTrackModule?.id ?? "");
      router.push(contentHref(pathname, searchParams.toString(), {
        topic: firstTrackModule?.id ?? null,
        track: trackId,
      }), { scroll: false });
      setMobileNav(false);
      window.scrollTo({ top: 0, behavior: "smooth" });
    },
  };

  const selectModule = (moduleId: string) => {
    if (!modules.some((item) => item.id === moduleId)) return;
    setActiveModule(moduleId);
    router.push(contentHref(pathname, searchParams.toString(), {
      topic: moduleId,
      track: showTrackSwitcher ? activeTrack : null,
    }), { scroll: false });
    setMobileNav(false);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const openSection = (targetSection: SiteSection) => {
    window.location.assign(sectionNavigationHref(targetSection, mode));
  };

  const previous = moduleIndex > 0 ? modules[moduleIndex - 1] : undefined;
  const next = moduleIndex < modules.length - 1 ? modules[moduleIndex + 1] : undefined;
  const localizedLabel = (item: LearningModule | undefined) => item ? language === "uk" ? item.labelUk ?? item.label : item.label : undefined;
  const metaContext: LearningMetaContext = {
    language,
    module: activeChapter,
    lessonCount: moduleLessons.length,
    sourceCount: moduleSources.length,
  };
  const meta = heroMeta ? heroMeta(metaContext) : [
    `${moduleLessons.length} ${language === "uk" ? "тем" : "lessons"}`,
    `${moduleSources.length} ${language === "uk" ? "джерел" : "references"}`,
    language === "uk" ? "Розгорнутий навчальний матеріал" : "Long-form learning material",
  ];
  const registryStatus = sourceStatusLabel
    ? sourceStatusLabel(metaContext)
    : `${moduleSources.length} ${language === "uk" ? "джерел цього розділу" : "chapter references"}`;
  const pageTitle = language === "uk" ? curriculum.titleUk ?? curriculum.title : curriculum.title;
  const selectedTrackLabel = language === "uk" ? selectedTrack?.labelUk ?? selectedTrack?.label : selectedTrack?.label;
  const trackSegment = showTrackSwitcher ? ` · ${selectedTrackLabel}` : "";

  return (
    <main className="kb-shell">
      <SiteSidebar
        activeExternalId={activeExternalId}
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
        secondarySwitcher={showTrackSwitcher ? switcher : undefined}
        secondaryTitle={secondaryTitle}
      />

      <section className="kb-main">
        <button aria-expanded={mobileNav} aria-label="Toggle navigation" className="kb-floating-menu" onClick={() => setMobileNav((value) => !value)} type="button">☰</button>

        <div className={`kb-content ${styles.page}`}>
          {!trackAvailable ? (
            <LearningHero
              description={selectedTrack?.emptyState ?? "This learning track is under construction."}
              eyebrow={secondaryTitle}
              meta={[]}
              title={selectedTrackLabel ?? secondaryTitle}
            />
          ) : (
            <>
              <LearningHero
                description={localizedModuleDescription ?? ""}
                eyebrow={`${secondaryTitle}${trackSegment} · ${language === "uk" ? "Розділ" : "Chapter"} ${String(moduleIndex + 1).padStart(2, "0")} / ${String(modules.length).padStart(2, "0")}`}
                meta={meta}
                title={pageTitle}
              />

              <div className={styles.layout}>
                <div className={styles.document}>
                  <article className={styles.article}>
                    <MarkdownDocument headingIdOverrides={headingIdOverrides} markdown={generatedMarkdown} usageByHeading={activeChapter?.usageByHeading}/>
                  </article>

                  <LearningSourceRegistry
                    language={language}
                    sources={moduleSources.map((source) => ({
                      id: source.id,
                      meta: (source.kind ?? "reference").replaceAll("-", " "),
                      publisher: source.publisher,
                      role: source.role,
                      title: source.title,
                      url: source.url,
                    }))}
                    statusLabel={registryStatus}
                  />

                  <LearningPager
                    ariaLabel={`${secondaryTitle} chapters`}
                    labelFor={localizedLabel}
                    language={language}
                    next={next}
                    onSelect={(item) => selectModule(item.id)}
                    previous={previous}
                  />
                </div>

                <LearningRail headings={headings} language={language} languages={languages} onLanguageChange={setLanguage}/>
              </div>
            </>
          )}
        </div>
      </section>

      {mobileNav && <button className="kb-backdrop" onClick={() => setMobileNav(false)} aria-label="Close navigation"/>}
    </main>
  );
}
