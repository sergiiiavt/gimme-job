export const DEFAULT_LOCAL_AGENT_PORT = 4317;
export const LOCAL_AGENT_PORT_ATTEMPTS = 5;
export const LOCAL_AGENT_API_VERSION = 1;
export const LOCAL_AGENT_CACHE_TTL_MS = 5_000;

type FetchLike = (input: string, init?: RequestInit) => Promise<Response>;

export interface LocalAgentDiscoveryOptions {
  attempts?: number;
  fetchImpl?: FetchLike;
  host?: string;
  instanceId?: string;
  startPort?: number;
  timeoutMs?: number;
}

interface LocalAgentMatch {
  apiBase: string;
  port: number;
  startedAt: number;
}

type DiscoverLocalAgent = (options?: LocalAgentDiscoveryOptions) => Promise<string>;

export function createLocalAgentApiResolver(
  discover: DiscoverLocalAgent = discoverLocalAgentApiBase,
  {
    cacheTtlMs = LOCAL_AGENT_CACHE_TTL_MS,
    now = Date.now,
  }: { cacheTtlMs?: number; now?: () => number } = {},
) {
  let resolvedApiBase: string | null = null;
  let resolvedAt = 0;
  let pendingDiscovery: Promise<string> | null = null;

  return {
    async resolve(options?: LocalAgentDiscoveryOptions) {
      if (resolvedApiBase && now() - resolvedAt < cacheTtlMs) return resolvedApiBase;
      pendingDiscovery ??= discover(options);
      try {
        resolvedApiBase = await pendingDiscovery;
        resolvedAt = now();
        return resolvedApiBase;
      } finally {
        pendingDiscovery = null;
      }
    },
    invalidate() {
      resolvedApiBase = null;
      resolvedAt = 0;
    },
  };
}

export function localAgentCandidatePorts(
  startPort = DEFAULT_LOCAL_AGENT_PORT,
  attempts = LOCAL_AGENT_PORT_ATTEMPTS,
): number[] {
  if (!Number.isInteger(startPort) || startPort < 1 || startPort > 65_535) {
    throw new RangeError(`Invalid local agent port: ${startPort}.`);
  }
  if (!Number.isInteger(attempts) || attempts < 1) {
    throw new RangeError(`Invalid local agent attempt count: ${attempts}.`);
  }

  return Array.from(
    { length: Math.min(attempts, 65_536 - startPort) },
    (_, offset) => startPort + offset,
  );
}

export async function discoverLocalAgentApiBase({
  attempts = LOCAL_AGENT_PORT_ATTEMPTS,
  fetchImpl = fetch,
  host = "127.0.0.1",
  instanceId,
  startPort = DEFAULT_LOCAL_AGENT_PORT,
  timeoutMs = 500,
}: LocalAgentDiscoveryOptions = {}): Promise<string> {
  if (!instanceId) throw new Error("A local agent instance ID is required for discovery.");
  const candidates = localAgentCandidatePorts(startPort, attempts);
  const matches = await Promise.all(candidates.map(async (port) => {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);
    const apiBase = `http://${host}:${port}/api`;

    try {
      const response = await fetchImpl(`${apiBase}/health`, {
        cache: "no-store",
        signal: controller.signal,
      });
      if (!response.ok) return null;
      const payload = await response.json() as {
        apiVersion?: unknown;
        instanceId?: unknown;
        ok?: unknown;
        service?: unknown;
        startedAt?: unknown;
      };
      return payload.ok === true
        && payload.service === "job-search-agent"
        && payload.apiVersion === LOCAL_AGENT_API_VERSION
        && payload.instanceId === instanceId
        && typeof payload.startedAt === "number"
        && Number.isFinite(payload.startedAt)
        ? { apiBase, port, startedAt: payload.startedAt } satisfies LocalAgentMatch
        : null;
    } catch {
      return null;
    } finally {
      clearTimeout(timeout);
    }
  }));

  const match = matches
    .filter((candidate): candidate is LocalAgentMatch => candidate !== null)
    .sort((left, right) => right.startedAt - left.startedAt || left.port - right.port)[0];
  if (!match) {
    throw new Error(`Local job-search agent was not found on ports ${candidates.join(", ")}.`);
  }
  return match.apiBase;
}
