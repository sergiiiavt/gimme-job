import { createPageMetadata, LEARNING_SEO } from "../../seo";

export const metadata = createPageMetadata(LEARNING_SEO.llm);

export default function LlmLearningLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return children;
}
