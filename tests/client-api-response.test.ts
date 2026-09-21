import test from "node:test";
import assert from "node:assert/strict";
import { register } from "tsx/esm/api";

register();

const { readJsonApiResponse } = await import("../app/client-api-response.ts");

test("readJsonApiResponse returns successful JSON payloads", async () => {
  const response = Response.json({ ok: true, jobs: 3 });
  assert.deepEqual(await readJsonApiResponse(response), { ok: true, jobs: 3 });
});

test("readJsonApiResponse preserves API JSON errors", async () => {
  const response = Response.json({ error: "Vacancy sync failed." }, { status: 502 });
  await assert.rejects(
    () => readJsonApiResponse(response),
    /Vacancy sync failed\./,
  );
});

test("readJsonApiResponse converts HTML error pages into a stable API error", async () => {
  const response = new Response("<!DOCTYPE html><html><body>upstream failure</body></html>", {
    status: 502,
    headers: { "content-type": "text/html; charset=UTF-8" },
  });

  await assert.rejects(
    () => readJsonApiResponse(response),
    (error: unknown) => {
      assert.ok(error instanceof Error);
      assert.equal(error.message, "Request failed: 502. Server returned HTML instead of JSON.");
      assert.doesNotMatch(error.message, /DOCTYPE|upstream failure/);
      return true;
    },
  );
});

test("readJsonApiResponse reports invalid successful non-JSON responses", async () => {
  const response = new Response("not-json", {
    status: 200,
    headers: { "content-type": "text/plain" },
  });
  await assert.rejects(
    () => readJsonApiResponse(response),
    /Invalid API response \(HTTP 200\)\. Server returned a non-JSON response\./,
  );
});

test("readJsonApiResponse reports empty error responses without JSON parsing noise", async () => {
  const response = new Response(null, { status: 504 });
  await assert.rejects(
    () => readJsonApiResponse(response),
    /^Error: Request failed: 504$/,
  );
});
