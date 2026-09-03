import assert from "node:assert/strict";
import test from "node:test";
import { createServer } from "vite";
import react from "@vitejs/plugin-react";

const SIDEBAR_ID = "\0learning-path-canonical-links-sidebar";
const COMPONENT_SUFFIX = "/app/ai-assistant/learning-path-advisor.tsx";

const testDoubles = {
  name: "learning-path-canonical-links-test-doubles",
  enforce: "pre",
  resolveId(id, importer) {
    if (!importer?.endsWith(COMPONENT_SUFFIX)) return null;
    if (id === "../site-navigation") return SIDEBAR_ID;
    return null;
  },
  load(id) {
    if (id === SIDEBAR_ID) return "export function SiteSidebar() { return null; }";
    return null;
  },
};

const server = await createServer({
  appType: "custom",
  configFile: false,
  root: process.cwd(),
  logLevel: "silent",
  plugins: [testDoubles, react()],
  server: { middlewareMode: true },
});

const { sourcePathToHref } = await server.ssrLoadModule(COMPONENT_SUFFIX);

test.after(async () => {
  await server.close();
});

test("Learning Advisor accepts canonical current and future learning routes without a route allowlist", () => {
  assert.equal(
    sourcePathToHref("/learn/api?topic=http-foundations&section=http-status-codes"),
    "/learn/api?topic=http-foundations&section=http-status-codes",
  );
  assert.equal(
    sourcePathToHref("/learn/programming?topic=csharp-methods-parameters&section=ref-out-and-in&track=csharp"),
    "/learn/programming?topic=csharp-methods-parameters&section=ref-out-and-in&track=csharp",
  );
  assert.equal(
    sourcePathToHref("/learn/future-area?topic=future-topic&section=core-concept"),
    "/learn/future-area?topic=future-topic&section=core-concept",
  );
  assert.equal(
    sourcePathToHref("/reference/future-reference?topic=future-topic"),
    "/reference/future-reference?topic=future-topic",
  );
});

test("Learning Advisor still rejects unsafe paths and unsupported query keys", () => {
  assert.equal(sourcePathToHref("/admin?topic=hidden"), null);
  assert.equal(sourcePathToHref("/learn/future_area?topic=future-topic"), null);
  assert.equal(sourcePathToHref("/learn/future-area?redirect=https://evil.test"), null);
  assert.equal(sourcePathToHref("//malicious.example/path"), null);
  assert.equal(sourcePathToHref("https://malicious.example/path"), null);
});
