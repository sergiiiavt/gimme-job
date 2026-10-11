import { createPageMetadata, LEARNING_SEO } from "../../seo";

export const metadata = createPageMetadata(LEARNING_SEO.programming);

export default function ProgrammingLearningLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return children;
}
