import HomePageClient from "./home-page-client";
import { createPageMetadata, SITE_PAGE_SEO } from "./seo";

export const metadata = createPageMetadata(SITE_PAGE_SEO.home);

export default function HomePage() {
  return <HomePageClient/>;
}
