"use client";

import { useEffect, useMemo, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import istqbAiTestingCatalog from "@/content/istqb-ai-testing/catalog";
import type { IstqbAiTestingModule } from "@/content/istqb-ai-testing/modules";
import { contentHref } from "./content-deep-links";
import IstqbAiMockExam from "./istqb-ai-mock-exam";
import IstqbAiOfficialSampleCompanion from "./istqb-ai-official-sample-companion";
import { LearningHero, LearningPager, LearningRail, LearningSourceRegistry, type LearningLanguage } from "./learning-document-ui";
import LearningVideo from "./learning-video";
import { sectionNavigationHref } from "./navigation-paths";
import MarkdownDocument, { extractMarkdownHeadings } from "./qa-markdown";
import { SiteSidebar, type SecondarySwitcher, type SiteSection, type SubnavItem } from "./site-navigation";
import styles from "./qa-fundamentals-page.module.css";

const PUBLIC_HREF = "/learn/certifications";
const DEFAULT_TRACK_ID = "ct-ai-v2";

type UkrainianModuleFields = {
  labelUk: string;
  navLabelUk: string;
  levelUk: string;
  descriptionUk: string;
  markdownUk: string;
};

function hasUkrainian(module: IstqbAiTestingModule): module is IstqbAiTestingModule & UkrainianModuleFields {
  const candidate = module as IstqbAiTestingModule & Partial<UkrainianModuleFields>;
  return typeof candidate.labelUk === "string"
    && typeof candidate.navLabelUk === "string"
    && typeof candidate.levelUk === "string"
    && typeof candidate.descriptionUk === "string"
    && typeof candidate.markdownUk === "string";
}

const sourceRoleUk: Record<string, string> = {
  "istqb-ctai-sample-questions-v22": "Офіційний набір sample questions CT-AI v2.2. Це авторитетне джерело для стилю, структури, складності та кількості балів у прикладах запитань.",
  "istqb-ctai-sample-answers-v22": "Офіційні відповіді та обґрунтування до sample exam v2.2. Використовуй їх для розбору логіки після самостійного проходження запитань.",
  "istqb-ctai-syllabus-v2": "Основне офіційне джерело для learning objectives, термінології, структури розділів і всього матеріалу, який може перевірятися на іспиті.",
};

const sourceMetaUk: Record<string, string> = {
  "official-sample-exam": "офіційний sample exam",
  "official-sample-exam-answers": "офіційні відповіді",
  "official-syllabus": "офіційний syllabus",
};

const certificationTracks = [
  { id: DEFAULT_TRACK_ID, label: "CT-AI v2.0", available: true },
  { id: "istqb", label: "ISTQB", available: false, emptyState: "The broader ISTQB certification learning path is under construction." },
  { id: "cloud", label: "Cloud", available: false, emptyState: "Cloud certification learning paths are under construction." },
  { id: "security", label: "Security", available: false, emptyState: "Security certification learning paths are under construction." },
  { id: "ai-engineering", label: "AI Engineering", available: false, emptyState: "AI engineering certification learning paths are under construction." },
];

const certificationTrackLayout = `
.kb-subnav-switch {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 6px;
}

.kb-subnav-switch button {
  flex: none;
  min-width: 0;
  min-height: 40px;
  padding: 6px 7px;
  line-height: 1.15;
  white-space: normal;
  overflow-wrap: break-word;
}
`;

const mockExamHeadings = [
  { id: "questions-1-10", text: "Questions 1–10" },
  { id: "questions-11-20", text: "Questions 11–20" },
  { id: "questions-21-30", text: "Questions 21–30" },
  { id: "questions-31-40", text: "Questions 31–40" },
];

export default function IstqbAiTestingPage() {
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [language, setLanguage] = useState<LearningLanguage>("en");
  const [mobileNav, setMobileNav] = useState(false);
  const requestedTrackId = searchParams.get("track");
  const activeTrackId = requestedTrackId && certificationTracks.some((track) => track.id === requestedTrackId)
    ? requestedTrackId
    : DEFAULT_TRACK_ID;
  const selectedTrack = certificationTracks.find((track) => track.id === activeTrackId) ?? certificationTracks[0];
  const trackAvailable = selectedTrack.available;
  const modules = trackAvailable ? istqbAiTestingCatalog.taxonomy : [];
  const firstModuleId = modules[0]?.id ?? "";
  const requestedModuleId = searchParams.get("topic");
  const activeModuleId = requestedModuleId && modules.some((chapter) => chapter.id === requestedModuleId)
    ? requestedModuleId
    : firstModuleId;
  const moduleIndex = Math.max(0, modules.findIndex((chapter) => chapter.id === activeModuleId));
  const activeModule = trackAvailable ? modules[moduleIndex] ?? modules[0] : undefined;
  const isMockExam = activeModule?.id === "mock-exam";
  const isOfficialSampleExam = activeModule?.id === "official-sample-exam";
  const activeModuleHasUkrainian = Boolean(activeModule && hasUkrainian(activeModule));
  const effectiveLanguage: LearningLanguage = language === "uk" && activeModuleHasUkrainian ? "uk" : "en";

  useEffect(() => {
    const trackInUrl = searchParams.get("track") === activeTrackId;

    if (!trackAvailable) {
      if (searchParams.get("topic") || !trackInUrl) {
        router.replace(contentHref(pathname, searchParams.toString(), { topic: null, track: activeTrackId }), { scroll: false });
      }
      return;
    }

    if (!activeModuleId) return;
    if (searchParams.get("topic") === activeModuleId && trackInUrl) return;

    router.replace(contentHref(pathname, searchParams.toString(), { topic: activeModuleId, track: activeTrackId }), { scroll: false });
  }, [activeModuleId, activeTrackId, pathname, router, searchParams, trackAvailable]);

  const sourceMap = useMemo(
    () => new Map(istqbAiTestingCatalog.sources.map((source) => [source.id, source])),
    [],
  );
  const moduleSources = activeModule?.sourceIds.flatMap((id) => {
    const source = sourceMap.get(id);
    return source ? [source] : [];
  }) ?? [];
  const localizedMarkdown = activeModule && effectiveLanguage === "uk" && hasUkrainian(activeModule)
    ? activeModule.markdownUk
    : activeModule?.markdown ?? "";
  const localizedLevel = activeModule && effectiveLanguage === "uk" && hasUkrainian(activeModule)
    ? activeModule.levelUk
    : activeModule?.level ?? "";
  const localizedNavLabel = (chapter: IstqbAiTestingModule | undefined) => {
    if (!chapter) return undefined;
    return effectiveLanguage === "uk" && hasUkrainian(chapter) ? chapter.navLabelUk : chapter.navLabel;
  };
  const markdownHeadings = isMockExam
    ? mockExamHeadings
    : activeModule
      ? extractMarkdownHeadings(localizedMarkdown)
        .filter((heading) => heading.level === 2)
        .map(({ id, text }) => ({ id, text }))
      : [];
  const headings = activeModule?.videos?.length
    ? [...markdownHeadings, { id: "recommended-videos", text: effectiveLanguage === "uk" ? "Рекомендовані відео" : "Recommended videos" }]
    : markdownHeadings;
  const secondaryItems: SubnavItem[] = trackAvailable ? modules.map((chapter) => ({
    id: chapter.id,
    label: localizedNavLabel(chapter) ?? chapter.navLabel,
    count: chapter.count,
  })) : [];

  const switcher: SecondarySwitcher = {
    activeId: activeTrackId,
    options: certificationTracks.map(({ id, label }) => ({ id, label })),
    onSelect: (trackId) => {
      const option = certificationTracks.find((candidate) => candidate.id === trackId);
      if (!option) return;
      const firstTrackModule = option.available ? istqbAiTestingCatalog.taxonomy[0]?.id ?? null : null;
      setLanguage("en");
      router.push(contentHref(pathname, searchParams.toString(), {
        topic: firstTrackModule,
        track: trackId,
        section: null,
      }), { scroll: false });
      setMobileNav(false);
      window.scrollTo({ top: 0, behavior: "smooth" });
    },
  };

  const selectModule = (chapter: IstqbAiTestingModule) => {
    if (language === "uk" && !hasUkrainian(chapter)) setLanguage("en");
    router.push(contentHref(pathname, searchParams.toString(), {
      topic: chapter.id,
      track: activeTrackId,
      section: null,
    }), { scroll: false });
    setMobileNav(false);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const selectModuleById = (moduleId: string) => {
    const chapter = modules.find((candidate) => candidate.id === moduleId);
    if (chapter) selectModule(chapter);
  };

  const openSection = (section: SiteSection) => {
    window.location.assign(sectionNavigationHref(section, "public"));
  };

  const previous = moduleIndex > 0 ? modules[moduleIndex - 1] : undefined;
  const next = moduleIndex < modules.length - 1 ? modules[moduleIndex + 1] : undefined;
  const activeModuleCountLabel = activeModule
    ? effectiveLanguage === "uk"
      ? isOfficialSampleExam
        ? `${activeModule.count} офіційних прикладів запитань`
        : isMockExam
          ? `${activeModule.count} авторських тренувальних запитань`
          : `${activeModule.count} екзаменаційних понять / активностей`
      : isOfficialSampleExam
        ? `${activeModule.count} official sample questions`
        : isMockExam
          ? `${activeModule.count} original practice questions`
          : `${activeModule.count} exam concepts / activities`
    : "";
  const catalogTitle = effectiveLanguage === "uk" ? istqbAiTestingCatalog.titleUk : istqbAiTestingCatalog.title;
  const catalogDescription = effectiveLanguage === "uk" ? istqbAiTestingCatalog.descriptionUk : istqbAiTestingCatalog.description;

  return (
    <>
      <style>{certificationTrackLayout}</style>
      <main className="kb-shell">
        <SiteSidebar
          activeSection="certifications"
          activeSubsection={trackAvailable ? activeModule?.id ?? "" : ""}
          mobileOpen={mobileNav}
          mode="public"
          onSelect={openSection}
          onSelectSubsection={selectModuleById}
          personalHref={PUBLIC_HREF}
          publicHref={PUBLIC_HREF}
          secondaryEmptyState={trackAvailable ? undefined : selectedTrack.emptyState}
          secondaryItems={secondaryItems}
          secondarySwitcher={switcher}
          secondaryTitle={effectiveLanguage === "uk" ? "Сертифікації" : "Certifications"}
        />

        <section className="kb-main">
          <button
            aria-expanded={mobileNav}
            aria-label="Toggle navigation"
            className="kb-floating-menu"
            onClick={() => setMobileNav((value) => !value)}
            type="button"
          >☰</button>

          <div className={`kb-content ${styles.page}`}>
            {!trackAvailable ? (
              <LearningHero
                description={selectedTrack.emptyState ?? "This certification learning path is under construction."}
                eyebrow="Certifications"
                meta={[]}
                title={selectedTrack.label}
              />
            ) : activeModule ? (
              <>
                <LearningHero
                  description={catalogDescription}
                  eyebrow={`${effectiveLanguage === "uk" ? "Навчальний шлях для сертифікації" : "Certification learning path"} · ${selectedTrack.label}`}
                  meta={[
                    localizedLevel,
                    activeModuleCountLabel,
                    `${moduleSources.length} ${effectiveLanguage === "uk" ? "джерела розділу" : "chapter references"}`,
                  ]}
                  title={catalogTitle}
                />

                <div className={styles.layout}>
                  <div className={styles.document}>
                    <article className={styles.article}>
                      {isOfficialSampleExam
                        ? <IstqbAiOfficialSampleCompanion language={effectiveLanguage} markdown={localizedMarkdown}/>
                        : isMockExam
                          ? <IstqbAiMockExam markdown={localizedMarkdown}/>
                          : <MarkdownDocument markdown={localizedMarkdown}/>}

                      {activeModule.videos?.length ? (
                        <section>
                          <h2 id="recommended-videos">{effectiveLanguage === "uk" ? "Рекомендовані відео" : "Recommended videos"}</h2>
                          <p>{effectiveLanguage === "uk"
                            ? "Використовуй їх як візуальне закріплення після читання розділу. Офіційний syllabus ISTQB залишається головним джерелом для іспиту."
                            : "Use these as visual reinforcement after reading the chapter. The ISTQB syllabus remains the exam authority."}</p>
                          {activeModule.videos.map((video) => (
                            <LearningVideo
                              channel={video.channel}
                              channelUrl={video.channelUrl}
                              key={video.videoId}
                              title={video.title}
                              videoId={video.videoId}
                            />
                          ))}
                        </section>
                      ) : null}
                    </article>

                    <LearningSourceRegistry
                      language={effectiveLanguage}
                      sources={moduleSources.map((source) => ({
                        id: source.id,
                        meta: effectiveLanguage === "uk" ? sourceMetaUk[source.kind] ?? source.kind.replaceAll("-", " ") : source.kind.replaceAll("-", " "),
                        publisher: source.publisher,
                        role: effectiveLanguage === "uk" ? sourceRoleUk[source.id] ?? source.role : source.role,
                        title: source.title,
                        url: source.url,
                      }))}
                      statusLabel={effectiveLanguage === "uk"
                        ? `Перевірено ${istqbAiTestingCatalog.lastReviewedAt} · ${moduleSources.length} джерела розділу`
                        : `Reviewed ${istqbAiTestingCatalog.lastReviewedAt} · ${moduleSources.length} chapter references`}
                    />

                    <LearningPager
                      ariaLabel={effectiveLanguage === "uk" ? "Навігація розділами ISTQB CT-AI" : "ISTQB CT-AI chapter navigation"}
                      labelFor={localizedNavLabel}
                      language={effectiveLanguage}
                      next={next}
                      onSelect={selectModule}
                      previous={previous}
                    />
                  </div>

                  <LearningRail
                    headings={headings}
                    language={effectiveLanguage}
                    languages={activeModuleHasUkrainian ? ["en", "uk"] : ["en"]}
                    onLanguageChange={setLanguage}
                  />
                </div>
              </>
            ) : null}
          </div>
        </section>

        {mobileNav ? <button aria-label="Close navigation" className="kb-backdrop" onClick={() => setMobileNav(false)}/> : null}
      </main>
    </>
  );
}
