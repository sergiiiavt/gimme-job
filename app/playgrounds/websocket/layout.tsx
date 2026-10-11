import { SITE_PAGE_SEO, createPageMetadata } from "../../seo";

export const metadata = createPageMetadata(SITE_PAGE_SEO.websocketPlayground);

export default function WebSocketPlaygroundLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return children;
}
