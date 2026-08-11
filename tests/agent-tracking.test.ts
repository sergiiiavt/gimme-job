import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { register } from "tsx/esm/api";

register();

const { JobDatabase } = await import("../agent/src/db.ts");
const { JobTrackingUpdateSchema } = await import("../agent/src/domain.ts");

test("local-agent tracking persists pipeline status and feedback independently", () => {
  const database = new JobDatabase(":memory:");
  try {
    const { id } = database.upsertJob({
      source: "manual:test",
      externalId: "tracking-test",
      title: "QA Engineer",
      company: "Example",
      location: "Remote",
      remote: true,
      url: "https://example.com/jobs/qa",
      applyUrl: "https://example.com/jobs/qa/apply",
      description: "Test a web platform.",
      salaryText: null,
      postedAt: "2026-08-11T00:00:00.000Z",
      contactEmail: null,
      raw: {},
    });

    assert.equal(database.getJobTracking(id), null);

    const applied = database.updateJobTracking(id, {
      status: "APPLIED",
      feedback: "RELEVANT",
    });
    assert.equal(applied.status, "APPLIED");
    assert.equal(applied.feedback, "RELEVANT");
    assert.match(applied.statusUpdatedAt ?? "", /^20\d{2}-/);
    assert.match(applied.feedbackAt ?? "", /^20\d{2}-/);

    const cleared = database.updateJobTracking(id, { feedback: null });
    assert.equal(cleared.status, "APPLIED");
    assert.equal(cleared.statusUpdatedAt, applied.statusUpdatedAt);
    assert.equal(cleared.feedback, null);
    assert.equal(cleared.feedbackAt, null);
  } finally {
    database.close();
  }
});

test("local-agent tracking validates updates and exposes the PATCH route through CORS", async () => {
  assert.throws(() => JobTrackingUpdateSchema.parse({}), /Provide status or feedback/);
  assert.throws(() => JobTrackingUpdateSchema.parse({ status: "REVIEWED" }));
  assert.deepEqual(JobTrackingUpdateSchema.parse({ feedback: null }), { feedback: null });

  const serverSource = await readFile(new URL("../agent/server.ts", import.meta.url), "utf8");
  const databaseSource = await readFile(new URL("../agent/src/db.ts", import.meta.url), "utf8");
  assert.match(serverSource, /"GET, POST, PUT, PATCH, OPTIONS"/);
  assert.match(serverSource, /request\.method === "PATCH" && jobMatch/);
  assert.match(serverSource, /db\.updateJobTracking\(jobIdValue, update\)/);
  assert.match(databaseSource, /PRAGMA busy_timeout = 5000/);
  assert.match(databaseSource, /updateJobTracking[\s\S]*?BEGIN IMMEDIATE[\s\S]*?COMMIT[\s\S]*?ROLLBACK/);
});
