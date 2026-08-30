"use client";

import apiIntegrationCatalog from "@/content/api-integration/catalog";
import { reviewRequiredBannerStyle } from "./learning-review-status";
import TopicLearningPage from "./topic-learning-page";

type ApiIntegrationPageProps = Readonly<{ mode: "public" | "personal" }>;

const publishedTopicMeta = {
  "http-foundations": {
    en: ["HTTP · REST · CORS", "URI · methods · status codes", "Methodical material"],
    uk: ["HTTP · REST · CORS", "URI · methods · status codes", "Методичний матеріал"],
  },
  "contracts-and-schemas": {
    en: ["OpenAPI · JSON Schema", "Contracts · compatibility", "Methodical material"],
    uk: ["OpenAPI · JSON Schema", "Contracts · compatibility", "Методичний матеріал"],
  },
  "identity-and-authorization": {
    en: ["Auth · JWT · OAuth 2.0", "Scopes · roles · policies", "Methodical material"],
    uk: ["Auth · JWT · OAuth 2.0", "Scopes · roles · policies", "Методичний матеріал"],
  },
  websocket: {
    en: ["Handshake · frames · lifecycle", "Client/server code · pytest · CLI", "Auth · reconnect · load · backpressure"],
    uk: ["Handshake · frames · lifecycle", "Client/server code · pytest · CLI", "Auth · reconnect · load · backpressure"],
  },
} as const;

const defaultMeta = {
  en: ["API & Integration", "System interfaces and contracts", "Source-backed material"],
  uk: ["API та інтеграції", "System interfaces та contracts", "Source-backed матеріал"],
} as const;

export default function ApiIntegrationPage({ mode }: ApiIntegrationPageProps) {
  return (
    <>
      <style>{reviewRequiredBannerStyle}</style>
      <TopicLearningPage
        activeSection="api"
        catalog={apiIntegrationCatalog}
        defaultMeta={defaultMeta}
        defaultTopicId="http-foundations"
        mode={mode}
        publishedTopicMeta={publishedTopicMeta}
        secondaryTitle="API & Integration"
      />
    </>
  );
}
