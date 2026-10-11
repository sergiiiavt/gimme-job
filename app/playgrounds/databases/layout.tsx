import { SITE_PAGE_SEO, createPageMetadata } from "../../seo";

export const metadata = createPageMetadata(SITE_PAGE_SEO.databasePlayground);

export default function DatabasePlaygroundLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return children;
}
