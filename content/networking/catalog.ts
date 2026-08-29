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
  description: "A general learning path for Internet networking, protocol layering, transports, security, application protocols and diagnostics.",
  descriptionUk: "Загальний learning path про Internet networking, protocol layering, transports, security, application protocols та diagnostics.",
  topics: [
    {
      id: "protocols-and-transports",
      label: "Protocols & transports",
      labelUk: "Protocols та transports",
      description: "IP, TCP, UDP, QUIC, TLS, DNS, HTTP versions, WebSocket, SSE, gRPC, AMQP, email and file-transfer protocols, with Embedded & IoT kept as a separate scope.",
      descriptionUk: "IP, TCP, UDP, QUIC, TLS, DNS, HTTP versions, WebSocket, SSE, gRPC, AMQP, email та file-transfer protocols; Embedded & IoT винесено в окремий scope.",
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
