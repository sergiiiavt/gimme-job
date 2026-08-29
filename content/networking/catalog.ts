import protocolsGuide from "./protocols-guide";

export type NetworkingTopicStatus = "under-construction" | "published";

export interface NetworkingTopic {
  id: string;
  label: string;
  labelUk: string;
  description: string;
  descriptionUk: string;
  status: NetworkingTopicStatus;
  markdown: string;
  markdownUk: string;
}

const underConstruction = (
  id: string,
  label: string,
  labelUk: string,
  description: string,
  descriptionUk: string,
): NetworkingTopic => ({
  id,
  label,
  labelUk,
  description,
  descriptionUk,
  status: "under-construction",
  markdown: `## Under construction\n\n${description}`,
  markdownUk: `## У розробці\n\n${descriptionUk}`,
});

export const networkingCatalog = {
  title: "Networking",
  titleUk: "Networking",
  description: "Protocols, transports and diagnostics for understanding how systems communicate below and around the application layer.",
  descriptionUk: "Protocols, transports та diagnostics для розуміння того, як systems communicate нижче та навколо application layer.",
  topics: [
    {
      id: "protocols-and-transports",
      label: "Protocols & transports",
      labelUk: "Protocols та transports",
      description: "TCP, UDP, TLS, DNS, HTTP/1.1–3, QUIC, WebSocket, SSE, gRPC, MQTT, AMQP, email and file-transfer protocols with a QA troubleshooting model.",
      descriptionUk: "TCP, UDP, TLS, DNS, HTTP/1.1–3, QUIC, WebSocket, SSE, gRPC, MQTT, AMQP, email та file-transfer protocols із QA troubleshooting model.",
      status: "published" as const,
      markdown: protocolsGuide.markdown,
      markdownUk: protocolsGuide.markdownUk,
    },
    underConstruction(
      "routing-proxies-and-balancing",
      "Routing, proxies & load balancing",
      "Routing, proxies та load balancing",
      "Routes, NAT, forward/reverse proxies, gateways, load balancers, health checks and traffic distribution.",
      "Routes, NAT, forward/reverse proxies, gateways, load balancers, health checks та traffic distribution.",
    ),
    underConstruction(
      "network-diagnostics",
      "Network diagnostics",
      "Network diagnostics",
      "Hands-on diagnosis with DNS tools, curl, OpenSSL, netcat, traceroute and packet capture.",
      "Hands-on diagnosis через DNS tools, curl, OpenSSL, netcat, traceroute та packet capture.",
    ),
  ],
};

export default networkingCatalog;
