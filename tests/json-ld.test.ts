import assert from "node:assert/strict";
import test from "node:test";
import { register as registerTsx } from "tsx/esm/api";

registerTsx();

const { default: JsonLd } = await import("../app/json-ld.tsx");
const { renderToStaticMarkup } = await import("react-dom/server");

test("structured data cannot close its script element and still parses to the original data", () => {
  const data = { name: "</script><script>alert(1)</script>", path: "/interview?question=a<b" };
  const markup = renderToStaticMarkup(JsonLd({ data }));
  const json = markup.replace(/^<script type="application\/ld\+json">/, "").replace(/<\/script>$/, "");

  assert.equal(markup.match(/<\/script>/g)?.length, 1);
  assert.equal(json.includes("<"), false);
  assert.deepEqual(JSON.parse(json), data);
});
