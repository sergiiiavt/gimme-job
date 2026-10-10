const LOOPBACK_HOSTNAMES = new Set(["localhost", "127.0.0.1", "terminal.local"]);

/**
 * The agent binds 127.0.0.1 only, but a DNS-rebinding page can still reach it
 * under its own hostname, and same-origin GETs carry no Origin header. Accepting
 * only loopback Host values closes that path without affecting the browser UI.
 */
export function isLoopbackHost(hostHeader: string | undefined): boolean {
  if (!hostHeader) return false;
  try {
    return LOOPBACK_HOSTNAMES.has(new URL(`http://${hostHeader}`).hostname.toLowerCase());
  } catch {
    return false;
  }
}

/** Restricts a user-influenced value to characters that are safe in a quoted header parameter. */
export function safeDownloadName(value: string): string {
  return value.replace(/[^A-Za-z0-9._-]/g, "_");
}
