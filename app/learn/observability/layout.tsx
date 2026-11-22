import { createPageMetadata, LEARNING_SEO } from "../../seo";

export const metadata = createPageMetadata(LEARNING_SEO.observability);

export default function ObservabilityLearningLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return children;
}
