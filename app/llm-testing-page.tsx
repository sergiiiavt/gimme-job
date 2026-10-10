"use client";

import llmTestingCatalog from "@/content/llm-testing/catalog";
import { waitingForReviewBannerStyle } from "./learning-review-status";
import TopicLearningPage from "./topic-learning-page";

type LlmTestingPageProps = Readonly<{ mode: "public" | "personal" }>;

export default function LlmTestingPage({ mode }: LlmTestingPageProps) {
  return (
    <>
      <style>{waitingForReviewBannerStyle}</style>
      <TopicLearningPage
        activeSection="llm"
        catalog={llmTestingCatalog}
        defaultTopicId="llm-foundations"
        mode={mode}
        secondaryTitle="Generative AI & LLM"
      />
    </>
  );
}
