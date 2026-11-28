import { SITE_ORIGIN } from "./seo.ts";

/** Official GimmeJob social profiles. Also published as Organization `sameAs`. */
export const SOCIAL_PROFILES = [
  { id: "instagram", label: "Instagram", url: "https://www.instagram.com/gimmejob_qa/" },
  { id: "threads", label: "Threads", url: "https://www.threads.com/@gimmejob_qa" },
  { id: "youtube", label: "YouTube", url: "https://www.youtube.com/@gimmejob_qa" },
] as const;

export type UtmTags = Readonly<{
  /** Where the click happens: instagram, threads, youtube, telegram, linkedin, dou, reddit. */
  source: string;
  /** How the link got there: organic_social, share, community, referral. */
  medium: string;
  campaign?: string;
  content?: string;
}>;

const UTM_VALUE = /^[a-z0-9][a-z0-9_.-]*$/;

/** Adds lowercase snake_case utm_* parameters to a site URL, keeping its other query parameters. */
export function withUtm(href: string, tags: UtmTags): string {
  const url = new URL(href, SITE_ORIGIN);
  const entries: Array<[string, string | undefined]> = [
    ["utm_source", tags.source],
    ["utm_medium", tags.medium],
    ["utm_campaign", tags.campaign],
    ["utm_content", tags.content],
  ];
  for (const [key, value] of entries) {
    if (value === undefined) continue;
    if (!UTM_VALUE.test(value)) throw new Error(`${key} must be lowercase letters, digits, "_", "." or "-": ${value}`);
    url.searchParams.set(key, value);
  }
  return url.toString();
}

export type ShareLink = Readonly<{ id: "telegram" | "threads" | "linkedin"; label: string; href: string }>;

/** Share intents for one public page. Each shared URL says which network it was shared to. */
export function shareLinks(path: string, text: string, campaign = "question_share"): ShareLink[] {
  const shared = (source: string) => withUtm(path, { source, medium: "share", campaign });
  return [
    {
      id: "telegram",
      label: "Telegram",
      href: `https://t.me/share/url?${new URLSearchParams({ url: shared("telegram"), text })}`,
    },
    {
      id: "threads",
      label: "Threads",
      href: `https://www.threads.com/intent/post?${new URLSearchParams({ text: `${text}\n${shared("threads")}` })}`,
    },
    {
      id: "linkedin",
      label: "LinkedIn",
      href: `https://www.linkedin.com/sharing/share-offsite/?${new URLSearchParams({ url: shared("linkedin") })}`,
    },
  ];
}
