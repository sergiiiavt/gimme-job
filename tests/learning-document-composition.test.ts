import assert from "node:assert/strict";
import test from "node:test";
import { insertPracticalExamples } from "../content/learning-document-composition.ts";

for (const summary of ["Summary", "Підсумок"]) {
  test(`practical examples precede the ${summary} section and source registry`, () => {
    const markdown = `# Chapter\n\n## Concept\nExplanation.\n\n## ${summary}\nRecap.\n\n## Sources\nReference.`;
    const addition = ":::details Example\nSteps.\n:::";
    const composed = insertPracticalExamples(markdown, addition);

    assert.ok(composed.indexOf(addition) > composed.indexOf("Explanation."));
    assert.ok(composed.indexOf(addition) < composed.indexOf(`## ${summary}`));
    assert.ok(composed.indexOf(`## ${summary}`) < composed.indexOf("## Sources"));
    assert.equal(composed.split(addition).length, 2);
    assert.ok(composed.endsWith("## Sources\nReference."));
  });
}

test("empty practical additions preserve the chapter exactly", () => {
  const markdown = "# Chapter\n\n## Підсумок\nText.\n";
  assert.equal(insertPracticalExamples(markdown, " \n "), markdown);
});

test("chapters without a summary retain their content before the addition", () => {
  assert.equal(insertPracticalExamples("# Chapter\nText.\n", " Example "), "# Chapter\nText.\n\nExample");
  assert.equal(insertPracticalExamples("# Chapter\n## Summary statistics\nText.", "Example"), "# Chapter\n## Summary statistics\nText.\n\nExample");
});
