import apiIntegrationCatalog from "./api-integration/catalog";
import automationCurriculum from "./automation-learning/catalog";
import cloudDevopsCatalog from "./cloud-devops/catalog";
import csharpCurriculum from "./csharp-learning/catalog";
import sqlPracticalTasks from "./data-learning/sql-practical-tasks.json";
import sqlQuickReference from "./data-learning/sql-quick-reference.json";
import embeddedIotCatalog from "./embedded-iot/catalog";
import istqbAiTestingCatalog from "./istqb-ai-testing/catalog";
import metricsEstimationCatalog from "./metrics-estimation/catalog";
import networkingCatalog from "./networking/catalog";
import pythonCurriculum from "./python-learning/catalog";
import pythonQuickReference from "./python-learning/quick-reference.json";
import qaFundamentalsCatalog from "./qa-fundamentals/catalog";
import testingToolsCatalog from "./testing-tools/catalog";

export type LearningRagSource = Readonly<{
  key: string;
  route: `/${string}`;
  value: unknown;
  track?: string;
}>;

/**
 * Canonical registry of Git-backed learning material exposed to retrieval.
 *
 * A learning surface is registered here once. The Worker derives retrieval documents and
 * deep links from the underlying catalog, so adding lessons/topics/markdown sections to an
 * existing catalog requires no AI-service or Learning Advisor registration changes.
 */
export const learningRagSources: readonly LearningRagSource[] = [
  { key: "qa-fundamentals", route: "/reference/qa-fundamentals", value: qaFundamentalsCatalog },
  { key: "python", route: "/learn/programming", track: "python", value: pythonCurriculum },
  { key: "csharp", route: "/learn/programming", track: "csharp", value: csharpCurriculum },
  { key: "python-quick-reference", route: "/learn/programming", track: "python", value: pythonQuickReference },
  { key: "automation", route: "/learn/automation", value: automationCurriculum },
  { key: "testing-tools", route: "/learn/testing-tools", value: testingToolsCatalog },
  { key: "cloud-devops", route: "/learn/cloud-devops", value: cloudDevopsCatalog },
  { key: "metrics-estimation", route: "/learn/metrics-estimation", value: metricsEstimationCatalog },
  { key: "sql-quick-reference", route: "/learn/data", value: sqlQuickReference },
  { key: "sql-practical-tasks", route: "/learn/data", value: sqlPracticalTasks },
  { key: "api-integration", route: "/learn/api", value: apiIntegrationCatalog },
  { key: "networking", route: "/learn/networking", value: networkingCatalog },
  { key: "embedded-iot", route: "/learn/embedded", value: embeddedIotCatalog },
  { key: "istqb-ai-testing", route: "/learn/certifications", track: "ct-ai-v2", value: istqbAiTestingCatalog },
] as const;

export default learningRagSources;
