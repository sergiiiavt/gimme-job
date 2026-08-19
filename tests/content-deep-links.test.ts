import assert from "node:assert/strict";
import test from "node:test";
import { contentHref, questionDeepLinkHref } from "../app/content-deep-links.ts";

test("contentHref preserves unrelated query parameters and updates topic", () => {
  assert.equal(
    contentHref("/reference/programming", "track=python&view=compact", { topic: "functions", track: "python" }),
    "/reference/programming?track=python&view=compact&topic=functions",
  );
});

test("contentHref removes parameters and appends a stable heading hash", () => {
  assert.equal(
    contentHref("/reference/qa-fundamentals", "topic=old&track=python", { topic: "requirements-test-design", track: null }, "decision-table-testing"),
    "/reference/qa-fundamentals?topic=requirements-test-design#decision-table-testing",
  );
});

test("learning section links preserve the selected topic and track", () => {
  assert.equal(
    contentHref("/learn/qa-fundamentals", "topic=requirements-test-design", {}, "decision-table-testing"),
    "/learn/qa-fundamentals?topic=requirements-test-design#decision-table-testing",
  );
  assert.equal(
    contentHref("/learn/programming", "track=python&topic=functions", {}, "decorators"),
    "/learn/programming?track=python&topic=functions#decorators",
  );
});

test("questionDeepLinkHref uses the stable question id", () => {
  assert.equal(
    questionDeepLinkHref("/interview", "testing-principle-context-dependent"),
    "/interview?question=testing-principle-context-dependent",
  );
  assert.equal(
    questionDeepLinkHref("/interview/python", "python-generators-yield"),
    "/interview/python?question=python-generators-yield",
  );
});
