import type { Metadata } from "next";
import { learningTopicPageMetadata, type LearningPageProps } from "../../learning-topic-seo";
import NetworkingPage from "../../networking-page";

export function generateMetadata(props: LearningPageProps): Promise<Metadata> {
  return learningTopicPageMetadata("/learn/networking", props);
}

export default function PublicNetworkingLearningPage() {
  return <NetworkingPage mode="public"/>;
}
