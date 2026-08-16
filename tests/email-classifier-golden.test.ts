import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { EMAIL_CLASSIFICATIONS } from "../app/internal/n8n/email-events/email-event.ts";
import { preAiClassification } from "../app/internal/n8n/email-classify/rules.ts";

type GoldenCase = {
  id: string;
  senderName: string | null;
  senderEmail: string | null;
  subject: string;
  textExcerpt: string | null;
  expectedClassification: string;
  expectedPreAi: boolean;
};

async function goldenCases(): Promise<GoldenCase[]> {
  const url = new URL("./fixtures/email-classifier-golden.json", import.meta.url);
  const value = JSON.parse(await readFile(url, "utf8")) as unknown;
  assert.ok(Array.isArray(value), "golden dataset must be an array");
  return value as GoldenCase[];
}

test("email classifier golden dataset is well formed and has unique ids", async () => {
  const cases = await goldenCases();
  assert.ok(cases.length >= 10, "golden dataset should cover representative email classes");

  const ids = new Set<string>();
  for (const fixture of cases) {
    assert.ok(fixture.id.trim(), "golden case id is required");
    assert.equal(ids.has(fixture.id), false, `duplicate golden case id: ${fixture.id}`);
    ids.add(fixture.id);
    assert.ok(
      EMAIL_CLASSIFICATIONS.includes(fixture.expectedClassification as (typeof EMAIL_CLASSIFICATIONS)[number]),
      `unsupported expected classification: ${fixture.expectedClassification}`,
    );
  }
});

test("pre-AI gate handles only the golden cases explicitly approved for deterministic classification", async () => {
  const cases = await goldenCases();

  for (const fixture of cases) {
    const result = preAiClassification({
      sender_name: fixture.senderName,
      sender_email: fixture.senderEmail,
      subject: fixture.subject,
      text_excerpt: fixture.textExcerpt,
    });

    if (fixture.expectedPreAi) {
      assert.ok(result, `${fixture.id}: expected deterministic pre-AI classification`);
      assert.equal(
        result.classification,
        fixture.expectedClassification,
        `${fixture.id}: deterministic classification drifted`,
      );
      assert.match(result.source, /^RULE:/, `${fixture.id}: deterministic result must identify its rule source`);
    } else {
      assert.equal(
        result,
        null,
        `${fixture.id}: should remain available for AI rather than being aggressively gated`,
      );
    }
  }
});
