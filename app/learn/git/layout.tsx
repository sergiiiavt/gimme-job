import { createPageMetadata, LEARNING_SEO } from "../../seo";

export const metadata = createPageMetadata(LEARNING_SEO.git);

export default function GitLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return children;
}
