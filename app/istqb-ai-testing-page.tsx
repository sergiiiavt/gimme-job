"use client";

import { useEffect, useMemo, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import {
  claude101Catalog,
  claudeCertificationCatalog,
  claudeCode101Catalog,
  claudeDeveloperCertificationCatalog,
  claudePlatform101Catalog,
  githubCopilotCertificationCatalog,
} from "@/content/ai-engineering-certifications/catalog";
import { isMockExamModuleId, type CertificationMockExamSettings } from "@/content/certification-catalog";
import istqbAiTestingCatalog from "@/content/istqb-ai-testing/catalog";
import { ctflCertificationCatalog, ctGenAiCertificationCatalog } from "@/content/istqb-certifications/catalog";
import type { IstqbAiTestingModule } from "@/content/istqb-ai-testing/modules";
import { contentHref } from "./content-deep-links";
import IstqbAiMockExam from "./istqb-ai-mock-exam";
import { topicSectionNavigation } from "./topic-learning-navigation";
import { mockExamGroupHeadings, parseIstqbAiMockExam } from "./istqb-ai-mock-exam-model";
import IstqbAiOfficialSampleCompanion from "./istqb-ai-official-sample-companion";
import { LearningHero, LearningPager, LearningRail, LearningSourceRegistry, type LearningLanguage } from "./learning-document-ui";
import LearningVideo from "./learning-video";
import { sectionNavigationHref } from "./navigation-paths";
import { chapterReferencesEn, sourcesNounUk } from "./source-count-label";
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
  "istqb-ctai-sample-questions-v22": "Офіційний набір прикладів запитань CT-AI v2.2. Це авторитетне джерело для стилю, структури, складності та кількості балів у прикладах запитань.",
  "istqb-ctai-sample-answers-v22": "Офіційні відповіді та обґрунтування до пробного іспиту v2.2. Використовуйте їх для розбору логіки після самостійного проходження запитань.",
  "istqb-ctai-syllabus-v2": "Основне офіційне джерело для навчальних цілей, термінології, структури розділів і всього матеріалу, який може перевірятися на іспиті.",
};

const sourceMetaUk: Record<string, string> = {
  "official-sample-exam": "офіційний пробний іспит",
  "official-sample-exam-answers": "офіційні відповіді",
  "official-syllabus": "офіційна навчальна програма",
};

type CertificationCatalog = {
  title: string;
  titleUk: string;
  lastReviewedAt: string;
  taxonomy: IstqbAiTestingModule[];
  sources: Array<{ id: string; title: string; url: string; publisher: string; kind: string; role: string }>;
  mockExam?: CertificationMockExamSettings;
};

const certificationCatalogs: Record<string, CertificationCatalog> = {
  [ctflCertificationCatalog.trackId]: ctflCertificationCatalog,
  [DEFAULT_TRACK_ID]: istqbAiTestingCatalog,
  [ctGenAiCertificationCatalog.trackId]: ctGenAiCertificationCatalog,
  [claude101Catalog.trackId]: claude101Catalog,
  [claudeCode101Catalog.trackId]: claudeCode101Catalog,
  [claudePlatform101Catalog.trackId]: claudePlatform101Catalog,
  [claudeCertificationCatalog.trackId]: claudeCertificationCatalog,
  [claudeDeveloperCertificationCatalog.trackId]: claudeDeveloperCertificationCatalog,
  [githubCopilotCertificationCatalog.trackId]: githubCopilotCertificationCatalog,
};

const ISTQB_GROUP = "ISTQB";
const CLAUDE_FREE_GROUP = "Claude · free course badges";
const CLAUDE_EXAM_GROUP = "Claude · proctored exams";
const GITHUB_GROUP = "GitHub";
const COMING_SOON_GROUP = "Coming soon";

/** One tile per exam or course badge, grouped so each tile opens one self-contained preparation path. */
const certificationTracks: Array<{ id: string; label: string; available: boolean; group: string; emptyState?: string }> = [
  { id: ctflCertificationCatalog.trackId, label: ctflCertificationCatalog.trackLabel, available: true, group: ISTQB_GROUP },
  { id: DEFAULT_TRACK_ID, label: "CT-AI v2.0", available: true, group: ISTQB_GROUP },
  { id: ctGenAiCertificationCatalog.trackId, label: ctGenAiCertificationCatalog.trackLabel, available: true, group: ISTQB_GROUP },
  { id: claude101Catalog.trackId, label: claude101Catalog.trackLabel, available: true, group: CLAUDE_FREE_GROUP },
  { id: claudeCode101Catalog.trackId, label: claudeCode101Catalog.trackLabel, available: true, group: CLAUDE_FREE_GROUP },
  { id: claudePlatform101Catalog.trackId, label: claudePlatform101Catalog.trackLabel, available: true, group: CLAUDE_FREE_GROUP },
  { id: claudeCertificationCatalog.trackId, label: claudeCertificationCatalog.trackLabel, available: true, group: CLAUDE_EXAM_GROUP },
  { id: claudeDeveloperCertificationCatalog.trackId, label: claudeDeveloperCertificationCatalog.trackLabel, available: true, group: CLAUDE_EXAM_GROUP },
  { id: githubCopilotCertificationCatalog.trackId, label: githubCopilotCertificationCatalog.trackLabel, available: true, group: GITHUB_GROUP },
  { id: "cloud", label: "Cloud", available: false, group: COMING_SOON_GROUP, emptyState: "Cloud certification learning paths are under construction." },
  { id: "security", label: "Security", available: false, group: COMING_SOON_GROUP, emptyState: "Security certification learning paths are under construction." },
];

/** The available track that owns a topic id; topic ids are unique across tracks, so old links follow moved chapters. */
function trackOwningTopic(topicId: string | null) {
  if (!topicId) return undefined;
  return certificationTracks.find((track) => track.available
    && certificationCatalogs[track.id]?.taxonomy.some((chapter) => chapter.id === topicId))?.id;
}

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

export default function IstqbAiTestingPage() {
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [language, setLanguage] = useState<LearningLanguage>("en");
  const [mobileNav, setMobileNav] = useState(false);
  const requestedTrackId = searchParams.get("track");
  const requestedModuleId = searchParams.get("topic");
  const activeTrackId = trackOwningTopic(requestedModuleId)
    ?? (requestedTrackId && certificationTracks.some((track) => track.id === requestedTrackId) ? requestedTrackId : DEFAULT_TRACK_ID);
  const selectedTrack = certificationTracks.find((track) => track.id === activeTrackId) ?? certificationTracks[0];
  const trackAvailable = selectedTrack.available;
  const activeCatalog = certificationCatalogs[selectedTrack.id] ?? istqbAiTestingCatalog;
  const modules = trackAvailable ? activeCatalog.taxonomy : [];
  const firstModuleId = modules[0]?.id ?? "";
  const activeModuleId = requestedModuleId && modules.some((chapter) => chapter.id === requestedModuleId)
    ? requestedModuleId
    : firstModuleId;
  const moduleIndex = Math.max(0, modules.findIndex((chapter) => chapter.id === activeModuleId));
  const activeModule = trackAvailable ? modules[moduleIndex] ?? modules[0] : undefined;
  const isMockExam = activeModule ? isMockExamModuleId(activeModule.id) : false;
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
    () => new Map(activeCatalog.sources.map((source) => [source.id, source])),
    [activeCatalog],
  );
  const moduleSources = activeModule?.sourceIds.flatMap((id) => {
    const source = sourceMap.get(id);
    return source ? [source] : [];
  }) ?? [];
  const localizedMarkdown = activeModule && effectiveLanguage === "uk" && hasUkrainian(activeModule)
    ? activeModule.markdownUk
    : activeModule?.markdown ?? "";
  const localizedNavLabel = (chapter: IstqbAiTestingModule | undefined) => {
    if (!chapter) return undefined;
    return effectiveLanguage === "uk" && hasUkrainian(chapter) ? chapter.navLabelUk : chapter.navLabel;
  };
  const sectionNavigation = topicSectionNavigation(
    extractMarkdownHeadings(localizedMarkdown).filter((heading) => heading.level === 2),
    extractMarkdownHeadings(activeModule?.markdown ?? "").filter((heading) => heading.level === 2),
  );
  const markdownHeadings = isMockExam
    ? mockExamGroupHeadings(parseIstqbAiMockExam(localizedMarkdown).questions.length, undefined, effectiveLanguage)
    : sectionNavigation.headings;
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
    options: certificationTracks.map(({ id, label, group }) => ({ id, label, group })),
    itemsTitle: trackAvailable ? `${selectedTrack.label} · ${effectiveLanguage === "uk" ? "теми" : "topics"}` : undefined,
    onSelect: (trackId) => {
      const option = certificationTracks.find((candidate) => candidate.id === trackId);
      if (!option) return;
      const firstTrackModule = option.available ? certificationCatalogs[option.id]?.taxonomy[0]?.id ?? null : null;
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
  const catalogTitle = effectiveLanguage === "uk" ? activeCatalog.titleUk : activeCatalog.title;

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
              <>
                <LearningHero
                  eyebrow={effectiveLanguage === "uk" ? "Сертифікації" : "Certifications"}
                  title={selectedTrack.label}
                />
                <section className="kb-under-construction-page">
                  <span className="kb-construction-badge">{effectiveLanguage === "uk" ? "У розробці" : "Under construction"}</span>
                  <p>{selectedTrack.emptyState ?? (effectiveLanguage === "uk"
                    ? "Цей навчальний трек ще не опублікований."
                    : "This certification learning path is under construction.")}</p>
                </section>
              </>
            ) : activeModule ? (
              <>
                <LearningHero
                  eyebrow={`${effectiveLanguage === "uk" ? "Навчальний шлях для сертифікації" : "Certification learning path"} · ${selectedTrack.label} · ${effectiveLanguage === "uk" ? "Розділ" : "Chapter"} ${String(moduleIndex + 1).padStart(2, "0")} / ${String(modules.length).padStart(2, "0")}`}
                  title={catalogTitle}
                />

                <div className={styles.layout}>
                  <div className={styles.document}>
                    <article className={styles.article}>
                      {isOfficialSampleExam
                        ? <IstqbAiOfficialSampleCompanion language={effectiveLanguage} markdown={localizedMarkdown}/>
                        : isMockExam
                          ? <IstqbAiMockExam key={activeModule.id} language={effectiveLanguage} markdown={localizedMarkdown} evaluationTexts={activeCatalog.mockExam?.evaluationTexts} scoreNote={activeCatalog.mockExam?.scoreNote}/>
                          : <MarkdownDocument headingIdOverrides={sectionNavigation.headingIdOverrides} markdown={localizedMarkdown}/>}

                      {activeModule.videos?.length ? (
                        <section>
                          <h2 id="recommended-videos">{effectiveLanguage === "uk" ? "Рекомендовані відео" : "Recommended videos"}</h2>
                          <p>{effectiveLanguage === "uk"
                            ? "Використовуйте їх для наочного закріплення після читання розділу. Офіційна навчальна програма ISTQB залишається головним джерелом для іспиту."
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
                        ? `Перевірено ${activeCatalog.lastReviewedAt} · ${moduleSources.length} ${sourcesNounUk(moduleSources.length)} розділу`
                        : `Reviewed ${activeCatalog.lastReviewedAt} · ${chapterReferencesEn(moduleSources.length)}`}
                    />

                    <LearningPager
                      ariaLabel={activeTrackId === DEFAULT_TRACK_ID
                        ? effectiveLanguage === "uk" ? "Навігація розділами ISTQB CT-AI" : "ISTQB CT-AI chapter navigation"
                        : `${selectedTrack.label} chapter navigation`}
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
