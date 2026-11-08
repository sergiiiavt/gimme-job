import type { Metadata } from "next";
import { learningTopicPageMetadata, type LearningPageProps } from "../../learning-topic-seo";
import ApiIntegrationPage from "../../api-integration-page";

export function generateMetadata(props: LearningPageProps): Promise<Metadata> {
  return learningTopicPageMetadata("/learn/api", props);
}

export default function Page() {
  return <ApiIntegrationPage mode="public"/>;
}
