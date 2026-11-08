import type { Metadata } from "next";
import { learningTopicPageMetadata, type LearningPageProps } from "../../learning-topic-seo";
import LlmTestingPage from "../../llm-testing-page";

export function generateMetadata(props: LearningPageProps): Promise<Metadata> {
  return learningTopicPageMetadata("/learn/llm", props);
}

export default function LlmLearningPage() {
  return <LlmTestingPage mode="public"/>;
}
