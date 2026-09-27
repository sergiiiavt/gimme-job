"use client";

import embeddedIotCatalog from "@/content/embedded-iot/catalog";
import { waitingForReviewBannerStyle } from "./learning-review-status";
import TopicLearningPage from "./topic-learning-page";

type EmbeddedIotPageProps = Readonly<{ mode: "public" | "personal" }>;

export default function EmbeddedIotPage({ mode }: EmbeddedIotPageProps) {
  return (
    <>
      <style>{waitingForReviewBannerStyle}</style>
      <TopicLearningPage
        activeSection="embedded"
        catalog={embeddedIotCatalog}
        defaultTopicId="foundations"
        mode={mode}
        secondaryTitle="Embedded & IoT"
      />
    </>
  );
}
