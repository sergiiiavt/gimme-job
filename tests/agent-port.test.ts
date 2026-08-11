import test from "node:test";
import assert from "node:assert/strict";
import { createServer, type Server } from "node:net";
import {
  getPortCandidates,
  listenOnAvailablePort,
  MAX_PORT,
} from "../agent/src/port.ts";

function listenOnEphemeralPort(server: Server): Promise<number> {
  return new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", () => {
      server.off("error", reject);
      const address = server.address();
      if (typeof address === "object" && address) {
        resolve(address.port);
      } else {
        reject(new Error("Failed to resolve an ephemeral port."));
      }
    });
  });
}

function closeServer(server: Server): Promise<void> {
  if (!server.listening) return Promise.resolve();
  return new Promise((resolve, reject) => {
    server.close((error) => (error ? reject(error) : resolve()));
  });
}

test("getPortCandidates never returns an invalid port", () => {
  assert.deepEqual(getPortCandidates(MAX_PORT - 1, 5), [MAX_PORT - 1, MAX_PORT]);
  assert.throws(() => getPortCandidates(MAX_PORT + 1), RangeError);
  assert.throws(() => getPortCandidates(4_317, 0), RangeError);
});

test("listenOnAvailablePort retries Windows reserved-port errors", async () => {
  const permissionError = Object.assign(new Error("Permission denied"), { code: "EACCES" });
  let listenCalls = 0;
  const fakeServer = {
    once() {
      return this;
    },
    off() {
      return this;
    },
    listen() {
      listenCalls += 1;
      throw permissionError;
    },
  } as unknown as Server;

  await assert.rejects(
    listenOnAvailablePort(fakeServer, 4_317, "127.0.0.1", 3),
    (error: unknown) => error instanceof Error && error.cause === permissionError,
  );
  assert.equal(listenCalls, 3);
});

test("listenOnAvailablePort does not retry non-port errors", async () => {
  const addressError = Object.assign(new Error("Address is unavailable"), { code: "EADDRNOTAVAIL" });
  let listenCalls = 0;
  const fakeServer = {
    once() { return this; },
    off() { return this; },
    listen() {
      listenCalls += 1;
      throw addressError;
    },
  } as unknown as Server;

  await assert.rejects(
    listenOnAvailablePort(fakeServer, 4_317, "127.0.0.1", 5),
    (error) => error === addressError,
  );
  assert.equal(listenCalls, 1);
});

test("listenOnAvailablePort binds the next available port when the requested one is busy", async () => {
  let blocker = createServer();
  const agentServer = createServer();
  let occupiedPort = await listenOnEphemeralPort(blocker);
  while (occupiedPort === MAX_PORT) {
    await closeServer(blocker);
    blocker = createServer();
    occupiedPort = await listenOnEphemeralPort(blocker);
  }
  const attempts = Math.min(100, MAX_PORT - occupiedPort + 1);

  try {
    const port = await listenOnAvailablePort(
      agentServer,
      occupiedPort,
      "127.0.0.1",
      attempts,
    );
    const address = agentServer.address();

    assert.ok(port > occupiedPort);
    assert.equal(typeof address === "object" && address?.port, port);
    assert.equal(agentServer.listening, true);
  } finally {
    await Promise.all([closeServer(agentServer), closeServer(blocker)]);
  }
});
