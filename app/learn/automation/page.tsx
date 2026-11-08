import type { Metadata } from "next";
import { learningTopicPageMetadata, type LearningPageProps } from "../../learning-topic-seo";
import AutomationLearningPage from "../../automation-learning-page";

export function generateMetadata(props: LearningPageProps): Promise<Metadata> {
  return learningTopicPageMetadata("/learn/automation", props);
}

export default function Page() {
  return <AutomationLearningPage mode="public"/>;
}
