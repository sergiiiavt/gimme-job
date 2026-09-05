import { createPageMetadata, LEARNING_SEO } from "../../seo";

export const metadata = createPageMetadata(LEARNING_SEO.performance);

export default function PerformanceLearningLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return children;
}
