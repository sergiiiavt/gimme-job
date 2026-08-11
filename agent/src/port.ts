import type { Server } from "node:net";

export const MIN_PORT = 1;
export const MAX_PORT = 65_535;

export function getPortCandidates(initialPort: number, attempts = 5): number[] {
  if (!Number.isInteger(initialPort) || initialPort < MIN_PORT || initialPort > MAX_PORT) {
    throw new RangeError(`Port must be an integer between ${MIN_PORT} and ${MAX_PORT}.`);
  }
  if (!Number.isInteger(attempts) || attempts < 1) {
    throw new RangeError("Port attempts must be a positive integer.");
  }

  const finalPort = Math.min(MAX_PORT, initialPort + attempts - 1);
  return Array.from(
    { length: finalPort - initialPort + 1 },
    (_, offset) => initialPort + offset,
  );
}

function isRetryableBindError(error: unknown): error is NodeJS.ErrnoException {
  return error instanceof Error
    && "code" in error
    && (error.code === "EADDRINUSE" || error.code === "EACCES");
}

function listen(server: Server, port: number, host: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const onError = (error: Error) => {
      cleanup();
      reject(error);
    };
    const onListening = () => {
      cleanup();
      resolve();
    };
    const cleanup = () => {
      server.off("error", onError);
      server.off("listening", onListening);
    };

    server.once("error", onError);
    server.once("listening", onListening);
    try {
      server.listen({ host, port });
    } catch (error) {
      cleanup();
      reject(error);
    }
  });
}

export async function listenOnAvailablePort(
  server: Server,
  initialPort: number,
  host = "127.0.0.1",
  attempts = 5,
): Promise<number> {
  const candidates = getPortCandidates(initialPort, attempts);
  let lastBindError: NodeJS.ErrnoException | undefined;

  for (const candidate of candidates) {
    try {
      await listen(server, candidate, host);
      return candidate;
    } catch (error) {
      if (!isRetryableBindError(error)) throw error;
      lastBindError = error;
    }
  }

  throw new Error(
    `Unable to bind the local agent to ports ${candidates[0]}-${candidates.at(-1)}.`,
    { cause: lastBindError },
  );
}
