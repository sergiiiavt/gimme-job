import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const source = await readFile(new URL("../worker/email-forwarding.ts", import.meta.url), "utf8");

test("ordinary email forwarding stores only a bounded text excerpt, never raw MIME or attachments", () => {
  assert.match(source, /extractEmailTextExcerpt/);
  assert.match(source, /MAX_TEXT_EXCERPT_LENGTH\s*=\s*4_000/);
  assert.match(source, /text_excerpt/);
  assert.match(source, /captureGmailForwardingVerification/);
  assert.match(source, /forwarding confirmation/i);
  assert.match(source, /@google\\\.com/);
  assert.doesNotMatch(source, /INSERT INTO user_email_events[\s\S]*`raw`/i);
  assert.doesNotMatch(source, /INSERT INTO user_email_events[\s\S]*attachment/i);
});
