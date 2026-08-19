import assert from "node:assert/strict";
import { readFile, writeFile } from "node:fs/promises";

const migrationPath = "scripts/_agent-apply-personal-stars-prevalence.mjs";
let migrationLines = (await readFile(migrationPath, "utf8")).split("\n");
migrationLines = migrationLines.map((line) =>
  line.includes("assert.match(uiSource") && line.includes("className=") && line.includes("iq-star-filter")
    ? "  assert.match(uiSource, /iq-star-filter/);"
    : line,
);

const brittleBlockStart = migrationLines.findIndex((line, index) =>
  line === "await replaceExact(tests," && migrationLines.slice(index, index + 9).some((candidate) => candidate.includes("prevalences")),
);
assert.ok(brittleBlockStart >= 0, "Could not find the brittle test migration block.");
let brittleBlockEnd = brittleBlockStart + 1;
while (brittleBlockEnd < migrationLines.length && migrationLines[brittleBlockEnd] !== ");") brittleBlockEnd += 1;
assert.ok(brittleBlockEnd < migrationLines.length, "Could not find the end of the brittle test migration block.");
migrationLines.splice(brittleBlockStart, brittleBlockEnd - brittleBlockStart + 1);
await writeFile(migrationPath, migrationLines.join("\n"));

const testsPath = "tests/interview-catalog.test.mjs";
const testLines = (await readFile(testsPath, "utf8")).split("\n");
const migratedTestLines = [];
let insertedStarredState = false;
let replacedIsStarred = false;
let replacedMixedFilter = false;

for (const line of testLines) {
  migratedTestLines.push(line);
  if (!insertedStarredState && line.includes("const \\[prevalences, setPrevalences\\]")) {
    migratedTestLines.push("  assert.match(uiSource, /const \\[starredOnly, setStarredOnly\\] = useState\\(false\\)/);");
    insertedStarredState = true;
    continue;
  }
  if (line.includes('const isStarred = mode === "personal"')) {
    migratedTestLines.pop();
    migratedTestLines.push("  assert.match(uiSource, /const isStarred = Boolean\\(stars\\[item\\.id\\]\\);/);");
    replacedIsStarred = true;
    continue;
  }
  if (line.includes('prevalence === "Starred"')) {
    migratedTestLines.pop();
    migratedTestLines.push("  assert.match(uiSource, /const matchesPrevalence = prevalences\\.length === 0 \\|\\| prevalences\\.includes\\(item\\.prevalence\\);/);");
    migratedTestLines.push("  assert.match(uiSource, /const matchesStarred = !starredOnly \\|\\| \\(mode === \"personal\" && isStarred\\);/);");
    migratedTestLines.push("  assert.match(uiSource, /iq-star-filter/);");
    migratedTestLines.push("  assert.match(uiSource, />Starred only</);");
    replacedMixedFilter = true;
  }
}

assert.ok(insertedStarredState, "Did not find prevalence state assertion.");
assert.ok(replacedIsStarred, "Did not find mixed editorial/personal star assertion.");
assert.ok(replacedMixedFilter, "Did not find mixed prevalence/star assertion.");
await writeFile(testsPath, migratedTestLines.join("\n"));

const historicalStarsMigrationPath = "drizzle/0012_interview_stars.sql";
const historicalStarsSql = await readFile(historicalStarsMigrationPath, "utf8");
const seededQuestionIds = [...historicalStarsSql.matchAll(/SELECT `users`\.`id`, '([^']+)'/g)].map((match) => match[1]);
assert.ok(seededQuestionIds.length >= 1, "Historical interview-star migration must contain the old seed set.");
assert.equal(new Set(seededQuestionIds).size, seededQuestionIds.length, "Historical seeded question ids must be unique.");

const cleanupMigrationPath = "drizzle/0014_remove_editorial_star_seed.sql";
const quotedSeededIds = seededQuestionIds.map((questionId) => `  '${questionId.replaceAll("'", "''")}'`).join(",\n");
await writeFile(cleanupMigrationPath, `-- Remove only the historical editorial defaults that were copied into the legacy owner's\n-- personal star table by 0012. The table remains user-scoped; future stars are created only\n-- by explicit user actions through the personal interview-star API.\nDELETE FROM \`user_interview_stars\`\nWHERE \`user_id\` IN (\n  SELECT \`id\` FROM \`users\` WHERE \`email\` = 'sergii.iavt@gmail.com'\n)\nAND \`question_id\` IN (\n${quotedSeededIds}\n);\n`);

const tenantTestPath = "tests/tenant-isolation.test.ts";
const tenantSource = await readFile(tenantTestPath, "utf8");
const tenantBlockStart = tenantSource.indexOf('test("interview stars migration adds a tenant-scoped table and migrates the current editorial set"');
const tenantBlockEnd = tenantSource.indexOf('test("tenant unavailable response is explicit and non-cacheable"', tenantBlockStart);
assert.ok(tenantBlockStart >= 0 && tenantBlockEnd > tenantBlockStart, "Could not locate interview-star migration test block.");
const replacementTenantTest = `test("interview stars stay tenant-scoped and historical editorial defaults are removed", async () => {\n  const createSql = await readFile(new URL("../drizzle/0012_interview_stars.sql", import.meta.url), "utf8");\n  const cleanupSql = await readFile(new URL("../drizzle/0014_remove_editorial_star_seed.sql", import.meta.url), "utf8");\n  const historicallySeededIds = [...createSql.matchAll(/SELECT \\`users\\`\\.\\`id\\`, '([^']+)'/g)].map((match) => match[1]);\n\n  assert.match(createSql, /CREATE TABLE \\`user_interview_stars\\`/);\n  assert.match(createSql, /PRIMARY KEY \\(\\`user_id\\`, \\`question_id\\`\\)/);\n  assert.match(createSql, /FOREIGN KEY \\(\\`user_id\\`\\) REFERENCES \\`users\\`\\(\\`id\\`\\)[^\\n]*ON DELETE cascade/);\n  assert.ok(historicallySeededIds.length > 0);\n\n  assert.match(cleanupSql, /DELETE FROM \\`user_interview_stars\\`/);\n  assert.match(cleanupSql, /WHERE \\`user_id\\` IN/);\n  assert.match(cleanupSql, /WHERE \\`email\\` = 'sergii\\.iavt@gmail\\.com'/);\n  assert.match(cleanupSql, /AND \\`question_id\\` IN/);\n  for (const questionId of historicallySeededIds) {\n    assert.ok(cleanupSql.includes(\`'\${questionId}'\`), \`Cleanup migration must remove historical default \${questionId}.\`);\n  }\n});\n\n`;
await writeFile(
  tenantTestPath,
  tenantSource.slice(0, tenantBlockStart) + replacementTenantTest + tenantSource.slice(tenantBlockEnd),
);

console.log(`Fixed temporary migration assertions and added cleanup for ${seededQuestionIds.length} historical editorial stars.`);
