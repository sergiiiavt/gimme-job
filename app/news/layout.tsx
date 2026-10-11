import { SITE_PAGE_SEO, createPageMetadata } from "../seo";

export const metadata = createPageMetadata(SITE_PAGE_SEO.news);

export default function NewsLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return children;
}
