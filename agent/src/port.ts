import { createConnection } from "node:net";

export async function resolvePort(initialPort: number, host = "127.0.0.1", attempts = 5): Promise<number> {
  for (let offset = 0; offset < attempts; offset += 1) {
    const candidate = initialPort + offset;
    const available = await new Promise<boolean>((resolve) => {
      const socket = createConnection({ host, port: candidate });
      socket.once("connect", () => {
        socket.destroy();
        resolve(false);
      });
      socket.once("error", (error: NodeJS.ErrnoException) => {
        if (error.code === "ECONNREFUSED") {
          resolve(true);
          return;
        }
        if (error.code === "EADDRNOTAVAIL") {
          resolve(false);
          return;
        }
        resolve(false);
      });
    });

    if (available) return candidate;
  }

  throw new Error(`Unable to find a free port after ${attempts} attempts.`);
}
