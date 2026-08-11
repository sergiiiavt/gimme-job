import test from "node:test";
import assert from "node:assert/strict";
import { createServer } from "node:net";
import { resolvePort } from "../agent/src/port.js";

test("resolvePort picks the next free port when the requested one is busy", async () => {
  const blocker = createServer();
  const occupiedPort = await new Promise<number>((resolve, reject) => {
    blocker.once("error", reject);
    blocker.listen(0, "127.0.0.1", () => {
      const address = blocker.address();
      if (typeof address === "object" && address) {
        resolve(address.port);
      } else {
        reject(new Error("Failed to resolve an ephemeral port."));
      }
    });
  });

  try {
    const port = await resolvePort(occupiedPort, "127.0.0.1", 3);
    assert.ok(port > occupiedPort);
  } finally {
    await new Promise<void>((resolve, reject) => {
      blocker.close((error) => (error ? reject(error) : resolve()));
    });
  }
});
