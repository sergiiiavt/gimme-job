import type { Metadata } from "next";
import { learningTopicPageMetadata, type LearningPageProps } from "../../learning-topic-seo";
import GitLearningPage from "../../git-learning-page";

export function generateMetadata(props: LearningPageProps): Promise<Metadata> {
  return learningTopicPageMetadata("/learn/git", props);
}

export default function Page() {
  return <GitLearningPage mode="public"/>;
}
