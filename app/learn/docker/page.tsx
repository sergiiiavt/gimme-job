import type { Metadata } from "next";
import { learningTopicPageMetadata, type LearningPageProps } from "../../learning-topic-seo";
import DockerLearningPage from "../../docker-learning-page";

export function generateMetadata(props: LearningPageProps): Promise<Metadata> {
  return learningTopicPageMetadata("/learn/docker", props);
}

export default function Page() {
  return <DockerLearningPage mode="public"/>;
}
