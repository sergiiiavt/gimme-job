import type { Metadata } from "next";
import { learningTopicPageMetadata, type LearningPageProps } from "../../learning-topic-seo";
import MetricsEstimationPage from "../../metrics-estimation-page";

export function generateMetadata(props: LearningPageProps): Promise<Metadata> {
  return learningTopicPageMetadata("/learn/metrics-estimation", props);
}

export default function Page() {
  return <MetricsEstimationPage mode="public"/>;
}
