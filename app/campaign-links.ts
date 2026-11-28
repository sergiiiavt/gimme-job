import { withUtm, type UtmTags } from "./social-profiles.ts";

export type CampaignLink = Readonly<{ path: string; tags: UtmTags }>;

/**
 * Short `/go/<slug>` links for places where a long tagged URL looks bad or
 * cannot be clicked: profile bios, video end cards, Telegram posts, DOU.
 * Each slug redirects to its path with these UTM tags. Slugs are permanent
 * once published: change the target, never reuse a slug for another campaign.
 */
export const CAMPAIGN_LINKS: ReadonlyMap<string, CampaignLink> = new Map<string, CampaignLink>([
  // Profile bios open the home page, like the full tagged bio links.
  ["ig", { path: "/", tags: { source: "instagram", medium: "organic_social", campaign: "profile", content: "bio" } }],
  ["threads", { path: "/", tags: { source: "threads", medium: "organic_social", campaign: "profile", content: "bio" } }],
  ["yt", { path: "/", tags: { source: "youtube", medium: "organic_social", campaign: "profile", content: "bio" } }],
  ["tg", { path: "/uk/interview", tags: { source: "telegram", medium: "organic_social", campaign: "tg_daily" } }],
  ["dou", { path: "/uk/interview", tags: { source: "dou", medium: "community", campaign: "dou_resource" } }],
]);

const SLUG = /^[a-z0-9][a-z0-9_-]*$/;

/**
 * A short link's tags and the tagged site-relative URL (path and query) it
 * redirects to, or null for an unknown slug.
 */
export function resolveCampaignLink(slug: string): (CampaignLink & { href: string }) | null {
  const link = CAMPAIGN_LINKS.get(slug);
  if (!link || !SLUG.test(slug)) return null;
  const url = new URL(withUtm(link.path, link.tags));
  return { ...link, href: `${url.pathname}${url.search}` };
}
