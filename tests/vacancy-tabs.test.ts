import assert from "node:assert/strict";
import test from "node:test";
import { closeVacancyTab, openVacancyTab, vacancyAnalysisTargets } from "../app/vacancy-tabs.ts";

test("opening a vacancy appends it once", () => {
  const first = openVacancyTab([], "job-1");
  assert.deepEqual(first, ["job-1"]);
  assert.equal(openVacancyTab(first, "job-1"), first);
  assert.deepEqual(openVacancyTab(first, "job-2"), ["job-1", "job-2"]);
});

test("closing an inactive vacancy keeps the active tab", () => {
  assert.deepEqual(
    closeVacancyTab(["job-1", "job-2", "job-3"], "job-3", "job-1"),
    { openIds: ["job-2", "job-3"], activeId: "job-3" },
  );
});

test("closing the active vacancy prefers the tab to its right", () => {
  assert.deepEqual(
    closeVacancyTab(["job-1", "job-2", "job-3"], "job-2", "job-2"),
    { openIds: ["job-1", "job-3"], activeId: "job-3" },
  );
});

test("closing the last active vacancy falls back left then to Board", () => {
  assert.deepEqual(
    closeVacancyTab(["job-1", "job-2"], "job-2", "job-2"),
    { openIds: ["job-1"], activeId: "job-1" },
  );
  assert.deepEqual(
    closeVacancyTab(["job-1"], "job-1", "job-1"),
    { openIds: [], activeId: null },
  );
});

test("analysis targets the active vacancy tab before board selections", () => {
  assert.deepEqual(vacancyAnalysisTargets("job-2", ["job-1", "job-3"]), ["job-2"]);
  assert.deepEqual(vacancyAnalysisTargets(null, ["job-1", "job-3"]), ["job-1", "job-3"]);
});
