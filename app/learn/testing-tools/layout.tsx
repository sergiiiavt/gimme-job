import { createPageMetadata, LEARNING_SEO } from "../../seo";

export const metadata = createPageMetadata(LEARNING_SEO["testing-tools"]);

export default function TestingToolsLearningLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return children;
}
