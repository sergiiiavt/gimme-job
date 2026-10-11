import HomePage from "./home-page";
import { SITE_PAGE_SEO, createPageMetadata } from "./seo";

export const metadata = createPageMetadata(SITE_PAGE_SEO.home);

export default function Page() {
  return <HomePage/>;
}
