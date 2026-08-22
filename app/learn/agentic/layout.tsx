import { createPageMetadata, LEARNING_SEO } from "../../seo";

export const metadata = createPageMetadata(LEARNING_SEO.agentic);

export default function AgenticLearningLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return children;
}
