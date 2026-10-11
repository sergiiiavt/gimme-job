import PublicSite from "../public-site";
import { SITE_PAGE_SEO, createPageMetadata } from "../seo";

// `/learn` renders the site introduction, so it shares the home page's canonical metadata.
export const metadata = createPageMetadata(SITE_PAGE_SEO.home);

export default function PublicLearningPage() {
  return <PublicSite/>;
}
