import { SITE_PAGE_SEO, createPageMetadata } from "../seo";

export const metadata = createPageMetadata(SITE_PAGE_SEO.resume);

export default function ResumeLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return children;
}
