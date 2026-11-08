import type { Metadata } from "next";
import { learningTopicPageMetadata, type LearningPageProps } from "../../learning-topic-seo";
import ProgrammingLearningPage from "../../programming-learning-page";

export function generateMetadata(props: LearningPageProps): Promise<Metadata> {
  return learningTopicPageMetadata("/learn/programming", props);
}

export default function Page() {
  return <ProgrammingLearningPage mode="public"/>;
}
