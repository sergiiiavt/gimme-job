import assert from "node:assert/strict";
import { registerHooks } from "node:module";
import test from "node:test";
import { register } from "tsx/esm/api";

registerHooks({
  resolve(specifier, context, nextResolve) {
    if (specifier === "cloudflare:workers") {
      return { shortCircuit: true, url: `data:text/javascript,${encodeURIComponent("export const env = {};")}` };
    }
    return nextResolve(specifier, context);
  },
});
register();

const { DEFAULT_PROFILE } = await import("../app/api/_jobpilot.ts");
const { CandidateProfileSchema } = await import("../agent/src/domain.ts");

test("the default candidate profile is a valid generic starter profile", () => {
  const profile = CandidateProfileSchema.parse(DEFAULT_PROFILE);
  assert.ok(profile.targetRoles.length > 0);
  assert.ok(profile.skills.length > 0);
});

test("the default candidate profile carries no personal or contact details", () => {
  // Every account without a saved profile receives this default, and it is committed
  // to a public repository, so it must not describe a real person.
  assert.equal(DEFAULT_PROFILE.name, "");
  assert.equal(DEFAULT_PROFILE.summary, "");
  assert.deepEqual(DEFAULT_PROFILE.contact, { email: "", phone: "", location: "" });
  for (const field of ["links", "experience", "education", "facts", "locations", "languages", "preferredSignals"] as const) {
    assert.deepEqual(DEFAULT_PROFILE[field], [], `${field} must be empty`);
  }
  assert.doesNotMatch(JSON.stringify(DEFAULT_PROFILE), /@|linkedin\.com|https?:\/\//i);
});
