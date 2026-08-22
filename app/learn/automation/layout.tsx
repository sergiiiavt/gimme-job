import { createPageMetadata, LEARNING_SEO } from "../../seo";

export const metadata = createPageMetadata(LEARNING_SEO.automation);

export default function AutomationLearningLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return children;
}
