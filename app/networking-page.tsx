"use client";

import networkingCatalog from "@/content/networking/catalog";
import TopicLearningPage from "./topic-learning-page";

type NetworkingPageProps = Readonly<{ mode: "public" | "personal" }>;

export default function NetworkingPage({ mode }: NetworkingPageProps) {
  return (
    <TopicLearningPage
      activeSection="networking"
      catalog={networkingCatalog}
      defaultTopicId="protocols-and-transports"
      mode={mode}
      secondaryTitle="Networking"
    />
  );
}
