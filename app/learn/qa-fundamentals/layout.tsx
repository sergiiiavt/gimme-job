import { createPageMetadata, LEARNING_SEO } from "../../seo";

export const metadata = createPageMetadata(LEARNING_SEO["qa-fundamentals"]);

export default function QaFundamentalsLearningLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return children;
}
