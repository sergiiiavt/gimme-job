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
import { SiteSidebar, type SiteSection, type SubnavItem } from "./site-navigation";
import styles from "./qa-fundamentals-page.module.css";

const PUBLIC_HREF = "/learn/certifications";

export default function IstqbAiTestingPage() {
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [mobileNav, setMobileNav] = useState(false);
  const modules = istqbAiTestingCatalog.taxonomy;
  const firstModuleId = modules[0]?.id ?? "";
  const requestedModuleId = searchParams.get("topic");
  const activeModuleId = requestedModuleId && modules.some((module) => module.id === requestedModuleId)
    ? requestedModuleId
    : firstModuleId;
  const moduleIndex = Math.max(0, modules.findIndex((module) => module.id === activeModuleId));
  const activeModule = modules[moduleIndex] ?? modules[0];

  useEffect(() => {
    if (!activeModuleId || searchParams.get("topic")) return;
    router.replace(contentHref(pathname, searchParams.toString(), { topic: activeModuleId }), { scroll: false });
  }, [activeModuleId, pathname, router, searchParams]);

  const sourceMap = useMemo(
    () => new Map(istqbAiTestingCatalog.sources.map((source) => [source.id, source])),
    [],
  );
  const moduleSources = activeModule.sourceIds
    .map((id) => sourceMap.get(id))
    .filter((source): source is NonNullable<typeof source> => Boolean(source));
  const markdownHeadings = extractMarkdownHeadings(activeModule.markdown)
    .filter((heading) => heading.level === 2)
    .map(({ id, text }) => ({ id, text }));
  const headings = activeModule.videos?.length
    ? [...markdownHeadings, { id: "recommended-videos", text: "Recommended videos" }]
    : markdownHeadings;
  const secondaryItems: SubnavItem[] = modules.map((module) => ({
    id: module.id,
    label: module.navLabel,
    count: module.count,
  }));

  const selectModule = (module: IstqbAiTestingModule) => {
    router.push(contentHref(pathname, searchParams.toString(), { topic: module.id, section: null }), { scroll: false });
    setMobileNav(false);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const selectModuleById = (moduleId: string) => {
    const module = modules.find((candidate) => candidate.id === moduleId);
    if (module) selectModule(module);
  };

  const openSection = (section: SiteSection) => {
    window.location.assign(sectionNavigationHref(section, "public"));
  };

  const previous = moduleIndex > 0 ? modules[moduleIndex - 1] : undefined;
  const next = moduleIndex < modules.length - 1 ? modules[moduleIndex + 1] : undefined;

  return (
    <main className="kb-shell">
      <SiteSidebar
        activeSection="certifications"
        activeSubsection={activeModule.id}
        mobileOpen={mobileNav}
        mode="public"
        onSelect={openSection}
        onSelectSubsection={selectModuleById}
        personalHref={PUBLIC_HREF}
        publicHref={PUBLIC_HREF}
        secondaryItems={secondaryItems}
        secondaryTitle="ISTQB CT-AI v2.0"
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
          <LearningHero
            description={istqbAiTestingCatalog.description}
            eyebrow="Certification learning path"
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
                  <section id="recommended-videos">
                    <h2>Recommended videos</h2>
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
                labelFor={(module) => module?.navLabel}
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
        </div>
      </section>

      {mobileNav ? <button aria-label="Close navigation" className="kb-backdrop" onClick={() => setMobileNav(false)}/> : null}
    </main>
  );
}
