import type { Metadata } from "next";
import ObservabilityLearningPage from "../../observability-learning-page";
import { learningTopicPageMetadata, type LearningPageProps } from "../../learning-topic-seo";

export function generateMetadata(props: LearningPageProps): Promise<Metadata> {
  return learningTopicPageMetadata("/learn/observability", props);
}

export default function Page() {
  return <ObservabilityLearningPage mode="public"/>;
}
