/**
 * Baseline response headers for every HTTP response the Worker returns.
 *
 * The CSP is deliberately limited to directives that cannot break Vinext's
 * inline bootstrap scripts and styles: it blocks clickjacking of the
 * authenticated workspace, <base> hijacking, and plugin content. Routes that
 * already send a stricter policy (the hand-written auth pages) keep theirs.
 */
const BASELINE_HEADERS: ReadonlyArray<readonly [string, string]> = [
  ["strict-transport-security", "max-age=31536000"],
  ["x-content-type-options", "nosniff"],
  ["referrer-policy", "strict-origin-when-cross-origin"],
  ["x-frame-options", "SAMEORIGIN"],
  // The Learning Path Advisor uses speech recognition, so the microphone stays same-origin.
  ["permissions-policy", "camera=(), geolocation=(), payment=(), usb=(), microphone=(self)"],
  ["content-security-policy", "frame-ancestors 'self'; base-uri 'self'; object-src 'none'"],
];

export function withSecurityHeaders(response: Response): Response {
  // WebSocket upgrades (101) cannot be re-wrapped and carry no document.
  if (response.status === 101 || response.status < 200) return response;
  const secured = new Response(response.body, response);
  for (const [name, value] of BASELINE_HEADERS) {
    if (!secured.headers.has(name)) secured.headers.set(name, value);
  }
  return secured;
}
