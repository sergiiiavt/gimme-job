"use client";

import apiIntegrationCatalog from "@/content/api-integration/catalog";
import { reviewRequiredBannerStyle } from "./learning-review-status";
import TopicLearningPage from "./topic-learning-page";

type ApiIntegrationPageProps = Readonly<{ mode: "public" | "personal" }>;

export default function ApiIntegrationPage({ mode }: ApiIntegrationPageProps) {
  return (
    <>
      <style>{reviewRequiredBannerStyle}</style>
      <TopicLearningPage
        activeSection="api"
        catalog={apiIntegrationCatalog}
        defaultTopicId="http-foundations"
        mode={mode}
        secondaryTitle="API & Integration"
      />
    </>
  );
}
