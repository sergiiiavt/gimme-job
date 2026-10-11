import { SITE_PAGE_SEO, createPageMetadata } from "../seo";

export const metadata = createPageMetadata(SITE_PAGE_SEO.about);

export default function AboutLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return children;
}
