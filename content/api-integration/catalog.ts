import contractsSchemas from "./contracts-schemas";
import httpFoundations from "./http-foundations";
import identityAuthorization from "./identity-authorization";
import websocketGuide from "./websocket-guide";

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

function normalizeWebsocketLearningCopy(markdown: string) {
  return markdown
    .replace("### Interview-ready summary\n\nA strong answer should mention that WebSocket provides", "### Key takeaways\n\nWebSocket provides")
    .replace("### Коротка відповідь для співбесіди", "### Ключові висновки");
}

const websocketMarkdown = normalizeWebsocketLearningCopy(websocketGuide.markdown);
const websocketMarkdownUk = normalizeWebsocketLearningCopy(websocketGuide.markdownUk);

export const catalog = {
  title: "API & Integration",
  titleUk: "API та інтеграції",
  description: "HTTP semantics, API contracts, identity, synchronous and asynchronous integrations, distributed state and failure handling between systems. Protocol and transport fundamentals live in Networking.",
  descriptionUk: "HTTP semantics, API contracts, identity, synchronous та asynchronous integrations, distributed state і обробка збоїв між systems. Protocol та transport fundamentals винесені в Networking.",
  topics: [
    {
      id: "http-foundations",
      label: "HTTP, REST & CORS",
      labelUk: "HTTP, REST та CORS",
      description: "HTTP semantics for APIs: URI addressing, messages, methods, REST constraints, headers, status codes, request bodies, caching, retries and CORS.",
      descriptionUk: "HTTP semantics для APIs: URI addressing, messages, methods, REST constraints, headers, status codes, request bodies, caching, retries і CORS.",
      status: "published" as const,
      markdown: httpFoundations.markdown,
      markdownUk: httpFoundations.markdownUk,
    },
    {
      id: "contracts-and-schemas",
      label: "Contracts & schemas",
      labelUk: "Контракти та схеми",
      description: "OpenAPI, JSON Schema, parameters, bodies, responses, reusable components, compatibility, versioning and deprecation.",
      descriptionUk: "OpenAPI, JSON Schema, parameters, bodies, responses, reusable components, compatibility, versioning та deprecation.",
      status: "published" as const,
      markdown: contractsSchemas.markdown,
      markdownUk: contractsSchemas.markdownUk,
    },
    {
      id: "identity-and-authorization",
      label: "Identity & authorization",
      labelUk: "Identity та authorization",
      description: "Authentication, sessions, API keys, JWT, OAuth 2.0, OIDC, scopes, RBAC, ABAC, tenants and service identities.",
      descriptionUk: "Authentication, sessions, API keys, JWT, OAuth 2.0, OIDC, scopes, RBAC, ABAC, tenants та service identities.",
      status: "published" as const,
      markdown: identityAuthorization.markdown,
      markdownUk: identityAuthorization.markdownUk,
    },
    underConstruction(
      "graphql",
      "GraphQL",
      "GraphQL",
      "Schemas, queries, mutations, subscriptions, resolvers, variables, fragments, errors, pagination and introspection.",
      "Schemas, queries, mutations, subscriptions, resolvers, variables, fragments, errors, pagination та introspection.",
    ),
    underConstruction(
      "grpc-protobuf",
      "gRPC & Protocol Buffers",
      "gRPC та Protocol Buffers",
      ".proto contracts, services, messages, unary calls, streaming, metadata, deadlines, status codes and compatibility.",
      ".proto contracts, services, messages, unary calls, streaming, metadata, deadlines, status codes та compatibility.",
    ),
    underConstruction(
      "soap-xml",
      "SOAP & XML APIs",
      "SOAP та XML APIs",
      "SOAP envelopes, WSDL, XSD, namespaces, XML validation, bindings and SOAP faults.",
      "SOAP envelopes, WSDL, XSD, namespaces, XML validation, bindings та SOAP faults.",
    ),
    {
      id: "websocket",
      label: "WebSocket: build, test & debug",
      labelUk: "WebSocket: реалізація, тестування та debug",
      description: "WebSocket handshake and frames, lifecycle, reconnects, heartbeats, authentication, security, performance and automation.",
      descriptionUk: "WebSocket handshake і frames, lifecycle, reconnects, heartbeats, authentication, security, performance та automation.",
      status: "published" as const,
      markdown: websocketMarkdown,
      markdownUk: websocketMarkdownUk,
    },
    underConstruction(
      "webhooks-callbacks",
      "Webhooks & callbacks",
      "Webhooks та callbacks",
      "Webhook registration, payloads, signatures, retries, duplicate delivery, ordering and replay protection.",
      "Webhook registration, payloads, signatures, retries, duplicate delivery, ordering та replay protection.",
    ),
    underConstruction(
      "messaging-and-events",
      "Messaging & events",
      "Messaging та events",
      "Queues, topics, Kafka, RabbitMQ/AMQP, delivery semantics, acknowledgements, ordering, duplication, retries and dead-letter queues.",
      "Queues, topics, Kafka, RabbitMQ/AMQP, delivery semantics, acknowledgements, ordering, duplication, retries та dead-letter queues.",
    ),
    underConstruction(
      "distributed-consistency",
      "Distributed consistency",
      "Distributed consistency",
      "Synchronous and asynchronous integration, eventual consistency, sagas, transactional outbox, idempotency and deduplication.",
      "Synchronous та asynchronous integration, eventual consistency, sagas, transactional outbox, idempotency та deduplication.",
    ),
    underConstruction(
      "failure-resilience",
      "Failure & resilience",
      "Failure та resilience",
      "Timeouts, retries, backoff, jitter, circuit breakers, bulkheads, partial failure, dependency degradation and rate limiting.",
      "Timeouts, retries, backoff, jitter, circuit breakers, bulkheads, partial failure, dependency degradation та rate limiting.",
    ),
    underConstruction(
      "api-gateways",
      "API gateways & intermediaries",
      "API gateways та intermediaries",
      "API gateways, reverse proxies, load balancers, routing, transformations, throttling, caching and gateway/backend failures.",
      "API gateways, reverse proxies, load balancers, routing, transformations, throttling, caching та gateway/backend failures.",
    ),
    underConstruction(
      "contract-testing",
      "Contract testing",
      "Contract testing",
      "Provider and consumer contracts, consumer-driven contracts, Pact concepts, compatibility checks and CI integration.",
      "Provider та consumer contracts, consumer-driven contracts, Pact concepts, compatibility checks та CI integration.",
    ),
    underConstruction(
      "mocks-service-virtualization",
      "Mocks & service virtualization",
      "Mocks та service virtualization",
      "Mocks, stubs, fakes, dependency simulation, latency and error simulation, deterministic integration environments.",
      "Mocks, stubs, fakes, dependency simulation, latency та error simulation, deterministic integration environments.",
    ),
    underConstruction(
      "integration-observability",
      "Integration observability",
      "Integration observability",
      "Logs, correlation IDs, distributed tracing, traceparent, spans and tracing across gateways, services, queues and workers.",
      "Logs, correlation IDs, distributed tracing, traceparent, spans та tracing через gateways, services, queues і workers.",
    ),
  ],
};

export default catalog;
