import httpApiDeepDive from "../testing-tools/http-api-deep-dive.json";
import websocketGuide from "./websocket-guide.json";

export type ApiIntegrationTopicStatus = "under-construction" | "published";

export interface ApiIntegrationTopic {
  id: string;
  label: string;
  labelUk: string;
  description: string;
  descriptionUk: string;
  status: ApiIntegrationTopicStatus;
  markdown: string;
  markdownUk: string;
}

const underConstruction = (
  id: string,
  label: string,
  labelUk: string,
  description: string,
  descriptionUk: string,
): ApiIntegrationTopic => ({
  id,
  label,
  labelUk,
  description,
  descriptionUk,
  status: "under-construction",
  markdown: `## Under construction\n\n${description}\n\nThis topic is reserved in the learning path and will be expanded into a complete source-backed chapter.`,
  markdownUk: `## У розробці\n\n${descriptionUk}\n\nЦей топік залишається у learning path і буде розгорнутий у повний розділ із перевіреними джерелами.`,
});

export const catalog = {
  title: "API & integration testing",
  titleUk: "API та інтеграційне тестування",
  description: "Protocols, contracts, authentication, data exchange, distributed state and failure handling between systems.",
  descriptionUk: "Протоколи, контракти, authentication, обмін даними, distributed state та обробка збоїв між системами.",
  topics: [
    underConstruction(
      "contracts-and-schemas",
      "Contracts and schemas",
      "Контракти та схеми",
      "OpenAPI, GraphQL, compatibility, consumer expectations and schema-based validation.",
      "OpenAPI, GraphQL, compatibility, очікування consumers та schema-based validation.",
    ),
    underConstruction(
      "identity-and-authorization",
      "Identity and authorization",
      "Identity та authorization",
      "Authentication, sessions, scopes, roles, tenants and server-side object access.",
      "Authentication, sessions, scopes, roles, tenants та server-side object access.",
    ),
    underConstruction(
      "messaging-and-events",
      "Messaging and events",
      "Messaging та events",
      "Queues, delivery semantics, ordering, duplication, retries and eventual consistency.",
      "Queues, delivery semantics, ordering, duplication, retries та eventual consistency.",
    ),
    underConstruction(
      "failure-behaviour",
      "Failure behaviour",
      "Поведінка при збоях",
      "Timeouts, partial responses, dependency degradation, rate limits and safe recovery.",
      "Timeouts, partial responses, dependency degradation, rate limits та safe recovery.",
    ),
    {
      id: "http-foundations",
      label: "HTTP, REST & CORS foundations",
      labelUk: "HTTP, REST та CORS — основи",
      description: "Interview-ready HTTP and REST reference: methods, concrete status codes, headers, authentication, file upload, multipart data, CORS and debugging.",
      descriptionUk: "Повний interview-ready довідник з HTTP та REST: methods, конкретні status codes, headers, authentication, file upload, multipart data, CORS та debugging.",
      status: "published" as const,
      markdown: httpApiDeepDive.markdown,
      markdownUk: httpApiDeepDive.markdownUk,
    },
    {
      id: "websocket",
      label: "WebSocket: build, test & debug",
      labelUk: "WebSocket: реалізація, тестування та debug",
      description: "A complete QA guide to WebSocket use cases, handshake and frames, client/server implementation, reconnects, heartbeats, authentication, security, performance and test automation.",
      descriptionUk: "Повний QA guide з WebSocket: use cases, handshake і frames, client/server implementation, reconnects, heartbeats, authentication, security, performance та test automation.",
      status: "published" as const,
      markdown: websocketGuide.markdown,
      markdownUk: websocketGuide.markdownUk,
    },
  ],
};

export default catalog;
