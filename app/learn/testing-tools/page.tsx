import type { Metadata } from "next";
import { learningTopicPageMetadata, type LearningPageProps } from "../../learning-topic-seo";
import TestingToolsPage from "../../testing-tools-page";

export function generateMetadata(props: LearningPageProps): Promise<Metadata> {
  return learningTopicPageMetadata("/learn/testing-tools", props);
}

export default function Page() {
  return <TestingToolsPage mode="public"/>;
}
