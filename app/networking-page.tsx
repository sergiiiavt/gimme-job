"use client";

import networkingCatalog from "@/content/networking/catalog";
import TopicLearningPage from "./topic-learning-page";

type NetworkingPageProps = Readonly<{ mode: "public" | "personal" }>;

const publishedTopicMeta = {
  "protocols-and-transports": {
    en: ["TCP · UDP · TLS · DNS", "HTTP/1.1 · HTTP/2 · HTTP/3 · QUIC", "WebSocket · gRPC · MQTT · AMQP"],
    uk: ["TCP · UDP · TLS · DNS", "HTTP/1.1 · HTTP/2 · HTTP/3 · QUIC", "WebSocket · gRPC · MQTT · AMQP"],
  },
} as const;

const defaultMeta = {
  en: ["Networking", "Practical learning path", "Source-backed material"],
  uk: ["Networking", "Практичний learning path", "Source-backed матеріал"],
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
