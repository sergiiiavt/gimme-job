import type { Metadata } from "next";
import AgenticLearningPage from "../../agentic-learning-page";
import { learningTopicPageMetadata, type LearningPageProps } from "../../learning-topic-seo";

export function generateMetadata(props: LearningPageProps): Promise<Metadata> {
  return learningTopicPageMetadata("/learn/agentic", props);
}

export default function Page() {
  return <AgenticLearningPage mode="public"/>;
}
