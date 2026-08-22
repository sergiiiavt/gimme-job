import { createPageMetadata, LEARNING_SEO } from "../../seo";

export const metadata = createPageMetadata(LEARNING_SEO["metrics-estimation"]);

export default function MetricsEstimationLearningLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return children;
}
