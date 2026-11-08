import type { Metadata } from "next";
import { learningTopicPageMetadata, type LearningPageProps } from "../../learning-topic-seo";
import PerformanceTestingPage from "../../performance-testing-page";

export function generateMetadata(props: LearningPageProps): Promise<Metadata> {
  return learningTopicPageMetadata("/learn/performance", props);
}

export default function Page() {
  return <PerformanceTestingPage mode="public"/>;
}
