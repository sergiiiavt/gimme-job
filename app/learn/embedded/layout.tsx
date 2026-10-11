import { createPageMetadata, LEARNING_SEO } from "../../seo";

export const metadata = createPageMetadata(LEARNING_SEO.embedded);

export default function EmbeddedLearningLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return children;
}
