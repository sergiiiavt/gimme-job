"use client";

import { useEffect, useMemo, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import istqbAiTestingCatalog from "@/content/istqb-ai-testing/catalog";
import type { IstqbAiTestingModule } from "@/content/istqb-ai-testing/modules";
import { contentHref } from "./content-deep-links";
import { LearningHero, LearningPager, LearningRail, LearningSourceRegistry } from "./learning-document-ui";
import LearningVideo from "./learning-video";
import { sectionNavigationHref } from "./navigation-paths";
import MarkdownDocument, { extractMarkdownHeadings } from "./qa-markdown";
import { SiteSidebar, type SecondarySwitcher, type SiteSection, type SubnavItem } from "./site-navigation";
import styles from "./qa-fundamentals-page.module.css";

const PUBLIC_HREF = "/learn/certifications";
const DEFAULT_TRACK_ID = "ct-ai-v2";

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

export default function IstqbAiTestingPage() {
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();
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
  const markdownHeadings = activeModule
    ? extractMarkdownHeadings(activeModule.markdown)
      .filter((heading) => heading.level === 2)
      .map(({ id, text }) => ({ id, text }))
    : [];
  const headings = activeModule?.videos?.length
    ? [...markdownHeadings, { id: "recommended-videos", text: "Recommended videos" }]
    : markdownHeadings;
  const secondaryItems: SubnavItem[] = trackAvailable ? modules.map((chapter) => ({
    id: chapter.id,
    label: chapter.navLabel,
    count: chapter.count,
  })) : [];

  const switcher: SecondarySwitcher = {
    activeId: activeTrackId,
    options: certificationTracks.map(({ id, label }) => ({ id, label })),
    onSelect: (trackId) => {
      const option = certificationTracks.find((candidate) => candidate.id === trackId);
      if (!option) return;
      const firstTrackModule = option.available ? istqbAiTestingCatalog.taxonomy[0]?.id ?? null : null;
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
          secondaryTitle="Certifications"
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
                  description={istqbAiTestingCatalog.description}
                  eyebrow={`Certification learning path · ${selectedTrack.label}`}
                  meta={[
                    activeModule.level,
                    `${activeModule.count} ${activeModule.id === "mock-exam" ? "practice questions" : "exam concepts / activities"}`,
                    `${moduleSources.length} chapter references`,
                  ]}
                  title={istqbAiTestingCatalog.title}
                />

                <div className={styles.layout}>
                  <div className={styles.document}>
                    <article className={styles.article}>
                      <MarkdownDocument markdown={activeModule.markdown}/>

                      {activeModule.videos?.length ? (
                        <section>
                          <h2 id="recommended-videos">Recommended videos</h2>
                          <p>Use these as visual reinforcement after reading the chapter. The ISTQB syllabus remains the exam authority.</p>
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
                      language="en"
                      sources={moduleSources.map((source) => ({
                        id: source.id,
                        meta: source.kind.replaceAll("-", " "),
                        publisher: source.publisher,
                        role: source.role,
                        title: source.title,
                        url: source.url,
                      }))}
                      statusLabel={`Reviewed ${istqbAiTestingCatalog.lastReviewedAt} · ${moduleSources.length} chapter references`}
                    />

                    <LearningPager
                      ariaLabel="ISTQB CT-AI chapter navigation"
                      labelFor={(chapter) => chapter?.navLabel}
                      language="en"
                      next={next}
                      onSelect={selectModule}
                      previous={previous}
                    />
                  </div>

                  <LearningRail
                    headings={headings}
                    language="en"
                    languages={["en"]}
                    onLanguageChange={() => undefined}
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
