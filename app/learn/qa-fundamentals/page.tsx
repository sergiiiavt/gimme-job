import type { Metadata } from "next";
import { learningTopicPageMetadata, type LearningPageProps } from "../../learning-topic-seo";
import QaFundamentalsPage from "../../qa-fundamentals-page";

export function generateMetadata(props: LearningPageProps): Promise<Metadata> {
  return learningTopicPageMetadata("/learn/qa-fundamentals", props);
}

export default function PublicQaFundamentalsPage() {
  return <QaFundamentalsPage mode="public"/>;
}
