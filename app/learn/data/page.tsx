import type { Metadata } from "next";
import DataLearningPage from "../../data-learning-page";
import { learningTopicPageMetadata, type LearningPageProps } from "../../learning-topic-seo";

export function generateMetadata(props: LearningPageProps): Promise<Metadata> {
  return learningTopicPageMetadata("/learn/data", props);
}

export default function Page() {
  return <DataLearningPage mode="public"/>;
}
