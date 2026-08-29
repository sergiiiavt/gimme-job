"use client";

import networkingCatalog from "@/content/networking/catalog";
import TopicLearningPage from "./topic-learning-page";

type NetworkingPageProps = Readonly<{ mode: "public" | "personal" }>;

const publishedTopicMeta = {
  "protocols-and-transports": {
    en: ["IP · TCP · UDP · QUIC", "TLS · DNS · HTTP/1.1 · HTTP/2 · HTTP/3", "WebSocket · gRPC · AMQP"],
    uk: ["IP · TCP · UDP · QUIC", "TLS · DNS · HTTP/1.1 · HTTP/2 · HTTP/3", "WebSocket · gRPC · AMQP"],
  },
} as const;

const defaultMeta = {
  en: ["Networking", "General learning path", "Source-backed material"],
  uk: ["Networking", "Загальний learning path", "Source-backed матеріал"],
} as const;

export default function NetworkingPage({ mode }: NetworkingPageProps) {
  return (
    <TopicLearningPage
      activeSection="networking"
      catalog={networkingCatalog}
      defaultMeta={defaultMeta}
      defaultTopicId="protocols-and-transports"
      mode={mode}
      publishedTopicMeta={publishedTopicMeta}
      secondaryTitle="Networking"
    />
  );
}
