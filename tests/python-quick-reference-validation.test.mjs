import test from "node:test";

// The validator is also run directly by `npm run check:content`. Importing it here keeps the
// same repository contract under node:test so Sonar can attribute coverage to the validator.
test("Python quick-reference catalog passes its repository contract", async () => {
  await import("../scripts/validate-python-quick-reference.mjs");
});
