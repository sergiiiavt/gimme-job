import type { Metadata } from "next";
import { learningTopicPageMetadata, type LearningPageProps } from "../../learning-topic-seo";
import EmbeddedIotPage from "../../embedded-iot-page";

export function generateMetadata(props: LearningPageProps): Promise<Metadata> {
  return learningTopicPageMetadata("/learn/embedded", props);
}

export default function EmbeddedLearningPage() {
  return <EmbeddedIotPage mode="public"/>;
}
