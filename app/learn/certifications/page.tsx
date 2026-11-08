import type { Metadata } from "next";
import { learningTopicPageMetadata, type LearningPageProps } from "../../learning-topic-seo";
import IstqbAiTestingPage from "../../istqb-ai-testing-page";

export function generateMetadata(props: LearningPageProps): Promise<Metadata> {
  return learningTopicPageMetadata("/learn/certifications", props);
}

export default function Page() {
  return <IstqbAiTestingPage/>;
}
