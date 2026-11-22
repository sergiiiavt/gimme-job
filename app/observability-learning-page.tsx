"use client";

import observabilityCatalog from "@/content/observability-learning/catalog";
import { waitingForReviewBannerStyle } from "./learning-review-status";
import TopicLearningPage from "./topic-learning-page";

export default function ObservabilityLearningPage({ mode }: Readonly<{ mode: "public" | "personal" }>) {
  return (
    <>
      <style>{waitingForReviewBannerStyle}</style>
      <TopicLearningPage
        activeSection="observability"
        catalog={observabilityCatalog}
        defaultTopicId="observability-for-qa"
        mode={mode}
        secondaryTitle="Observability & SRE"
      />
    </>
  );
}
