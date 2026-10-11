import { SITE_PAGE_SEO, createPageMetadata } from "../seo";

export const metadata = createPageMetadata(SITE_PAGE_SEO.games);

export default function GamesLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return children;
}
