"use client";

import apiIntegrationCatalog from "@/content/api-integration/catalog";
import TopicLearningPage from "./topic-learning-page";

type ApiIntegrationPageProps = Readonly<{ mode: "public" | "personal" }>;

const publishedTopicMeta = {
  "http-foundations": {
    en: ["HTTP + REST + CORS", "Statuses · headers · auth · files", "Training and practical reference"],
    uk: ["HTTP + REST + CORS", "Статуси · headers · auth · files", "Навчальний і практичний довідник"],
  },
  websocket: {
    en: ["Handshake · frames · lifecycle", "Client/server code · pytest · CLI", "Auth · reconnect · load · backpressure"],
    uk: ["Handshake · frames · lifecycle", "Client/server code · pytest · CLI", "Auth · reconnect · load · backpressure"],
  },
} as const;

const defaultMeta = {
  en: ["API & integration", "Practical learning path", "Source-backed material"],
  uk: ["API та integration", "Практичний learning path", "Source-backed матеріал"],
} as const;

export default function ApiIntegrationPage({ mode }: ApiIntegrationPageProps) {
  return (
    <TopicLearningPage
      activeSection="api"
      catalog={apiIntegrationCatalog}
      defaultMeta={defaultMeta}
      defaultTopicId="http-foundations"
      mode={mode}
      publishedTopicMeta={publishedTopicMeta}
      secondaryTitle="API & integration"
    />
  );
}
