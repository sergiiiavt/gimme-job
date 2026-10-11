import { SITE_PAGE_SEO, createPageMetadata } from "../seo";

export const metadata = createPageMetadata(SITE_PAGE_SEO.trends);

export default function TrendsLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return children;
}
