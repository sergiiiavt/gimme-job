import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const resumeSource = await readFile(new URL("../app/resume-page.tsx", import.meta.url), "utf8");

test("Resume preserves public contact boundaries and canonical experience content", () => {
  assert.match(resumeSource, /fetch\("\/api\/settings"\)/);
  assert.match(resumeSource, /mode === "personal" && contact\?\.phone/);
  assert.match(resumeSource, /mode === "personal" && contact\?\.email/);
  assert.match(resumeSource, /PUBLIC RESUME \/ LINKEDIN ONLY/);
  assert.match(resumeSource, /Lead QA Engineer/);
  assert.match(resumeSource, /TIETO UKRAINE LTD/);
  assert.match(resumeSource, /National Technical University of Ukraine/);
  assert.doesNotMatch(resumeSource, /sergii\.iavt@gmail\.com/i);
  assert.doesNotMatch(resumeSource, /095[^\n]{0,20}574/);
});
