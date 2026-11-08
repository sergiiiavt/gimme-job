import type { Metadata } from "next";
import { learningTopicPageMetadata, type LearningPageProps } from "../../learning-topic-seo";
import CloudDevopsPage from "../../cloud-devops-page";

export function generateMetadata(props: LearningPageProps): Promise<Metadata> {
  return learningTopicPageMetadata("/learn/cloud-devops", props);
}

export default function PublicCloudDevopsPage() {
  return <CloudDevopsPage mode="public"/>;
}
