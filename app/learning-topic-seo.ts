import type { Metadata } from "next";
import { automationTrackAliases, automationTrackForModule } from "../content/automation-learning/tracks";
import learningRagSources, { learningCatalogItems, type LearningCatalogItem } from "../content/learning-rag-registry";
import { contentHref } from "./content-deep-links";
import { createPageMetadata, isIndexableSeoPage, LEARNING_SEO, metaDescription, type SeoPage } from "./seo";

/**
 * One canonical page per published learning topic: `<route>?topic=<id>[&track=<id>]`, the
 * same topic link retrieval produces. `section` only scrolls within a topic, so it never
 * becomes a page of its own.
 */
export type LearningTopicPage = Readonly<{
  route: string;
  topic: string;
  track?: string;
  path: string;
  title: string;
  description: string;
}>;

export type LearningSearchParams = Readonly<Record<string, string | string[] | undefined>>;
export type LearningPageProps = Readonly<{ searchParams: Promise<LearningSearchParams> }>;

/** Registry routes whose topic links the Worker redirects to the page that renders them. */
const RENDERED_ROUTES: Readonly<Record<string, string>> = {
  "/reference/qa-fundamentals": "/learn/qa-fundamentals",
};

type TopicTracks = Readonly<{ trackFor(topic: string): string | undefined; aliases: Readonly<Record<string, string>> }>;

/** Pages that open a topic only inside the track listing it, where the registry names no track. */
const TOPIC_TRACKS: Readonly<Record<string, TopicTracks>> = {
  "/learn/automation": { trackFor: automationTrackForModule, aliases: automationTrackAliases },
};

type TopicEntry = Readonly<{ topic: string; label: string; description: string }>;

function text(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function isPublished(item: LearningCatalogItem): boolean {
  const status = text(item.status);
  return !status || status === "published";
}

function sectionSeo(route: string): SeoPage | undefined {
  return Object.values(LEARNING_SEO).find((page) => page.path === route);
}

function catalogRecord(catalog: unknown): Record<string, unknown> {
  return catalog && typeof catalog === "object" && !Array.isArray(catalog) ? catalog as Record<string, unknown> : {};
}

/**
 * Chapter catalogs publish one topic per chapter. Lesson catalogs publish one topic per
 * module, named and summarized by its taxonomy entry. Quick-reference cards are entries
 * inside a page rather than pages, so they are not topics here.
 */
function topicEntries(catalog: unknown): TopicEntry[] {
  const taxonomy = catalogRecord(catalog).taxonomy;
  const modules = Array.isArray(taxonomy) ? taxonomy as LearningCatalogItem[] : [];
  const entries = new Map<string, TopicEntry>();
  for (const item of learningCatalogItems(catalog).filter(isPublished)) {
    const moduleId = text(item.moduleId);
    const owner = moduleId ? modules.find((module) => text(module.id) === moduleId) : typeof item.markdown === "string" ? item : undefined;
    const topic = moduleId || text(item.id);
    if (!owner || !topic || entries.has(topic)) continue;
    const label = text(owner.label) || text(owner.title);
    if (label) entries.set(topic, { topic, label, description: text(owner.description) });
  }
  return [...entries.values()];
}

let topicPages: LearningTopicPage[] | undefined;

export function learningTopicPages(): LearningTopicPage[] {
  if (topicPages) return topicPages;
  const byPath = new Map<string, LearningTopicPage>();
  for (const source of learningRagSources) {
    const route = RENDERED_ROUTES[source.route] ?? source.route;
    const section = sectionSeo(route);
    if (!section || !isIndexableSeoPage(section)) continue;
    const catalogTitle = text(catalogRecord(source.value).title) || section.title;
    const tracks = TOPIC_TRACKS[route];
    for (const entry of topicEntries(source.value)) {
      const track = source.track ?? tracks?.trackFor(entry.topic);
      if (tracks && !track) continue;
      const path = contentHref(route, "", { topic: entry.topic, track });
      if (byPath.has(path)) continue;
      byPath.set(path, {
        route,
        topic: entry.topic,
        ...(track ? { track } : {}),
        path,
        title: `${entry.label} — ${catalogTitle}`,
        description: metaDescription(entry.description || section.description),
      });
    }
  }
  topicPages = [...byPath.values()];
  return topicPages;
}

function single(value: string | string[] | undefined): string | undefined {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

/** The topic page a request renders, or undefined when it shows the section's default view. */
export function learningTopicPage(route: string, searchParams: LearningSearchParams): LearningTopicPage | undefined {
  const topic = single(searchParams.topic);
  if (!topic) return undefined;
  const requestedTrack = single(searchParams.track);
  const track = requestedTrack ? TOPIC_TRACKS[route]?.aliases[requestedTrack] ?? requestedTrack : undefined;
  // A page with tracks opens the topic only in its own track; any other request keeps the section canonical.
  return learningTopicPages().find((page) => page.route === route && page.topic === topic && (!page.track || page.track === track));
}

export function learningTopicMetadata(route: string, searchParams: LearningSearchParams): Metadata {
  const page = learningTopicPage(route, searchParams);
  return page ? createPageMetadata({ title: page.title, description: page.description, path: page.path }) : {};
}

/** `generateMetadata` body for a learning route; an empty result keeps the section metadata from its layout. */
export async function learningTopicPageMetadata(route: string, { searchParams }: LearningPageProps): Promise<Metadata> {
  return learningTopicMetadata(route, await searchParams);
}
