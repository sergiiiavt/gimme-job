import fs from "node:fs";

function read(path) { return fs.readFileSync(path, "utf8"); }
function write(path, value) { fs.writeFileSync(path, value); }
function replaceOnce(source, before, after, label) {
  if (!source.includes(before)) throw new Error(`Missing patch target: ${label}`);
  return source.replace(before, after);
}

// Public interview routes must stay public even when the browser has an authenticated session.
{
  const path = "app/public-site.tsx";
  let source = read(path);
  source = replaceOnce(
    source,
    '  const personalHref = sectionNavigationHref(section, "personal");\n\n  return (',
    '  const personalHref = sectionNavigationHref(section, "personal");\n  const contentMode: SiteMode = (section === "interview" || section === "python-interview") ? mode : effectiveMode;\n\n  return (',
    "derive explicit interview content mode",
  );
  source = replaceOnce(source, '          mode={effectiveMode}\n          onSelect={openSection}', '          mode={contentMode}\n          onSelect={openSection}', "sidebar content mode");
  source = replaceOnce(source, '            mode={effectiveMode}\n            onTopicChange={setSubsection}', '            mode={contentMode}\n            onTopicChange={setSubsection}', "knowledge content mode");
  write(path, source);
}

// Apply one prevalence policy to every catalog question and make regeneration persistent.
{
  const path = "scripts/generate-interview-expansion.mjs";
  let source = read(path);
  source = replaceOnce(
    source,
    'import { readFile, writeFile } from "node:fs/promises";\n',
    'import { readFile, writeFile } from "node:fs/promises";\nimport { reviewInterviewPrevalence } from "./interview-prevalence-policy.mjs";\n',
    "prevalence policy import",
  );
  source = replaceOnce(
    source,
    'const generatedSpecialistCategories = new Set(["Embedded and IoT", "AI, ML and LLM", "Regulated domains"]);\nconst generatedPrevalence = (question) => {\n  if (question.category === "Practical tasks") return "Common";\n  if (generatedSpecialistCategories.has(question.category)) return "Specialist";\n  return "Occasional";\n};\n\n',
    '',
    "remove old generated-only prevalence policy",
  );
  source = replaceOnce(
    source,
    'function reviewedPrevalence(question) {\n  if (question.id.startsWith("expanded-")) return generatedPrevalence(question);\n  assert.ok(question.prevalence, `Authored question ${question.id} must have an explicitly reviewed prevalence.`);\n  return question.prevalence;\n}\n',
    'function reviewedPrevalence(question) {\n  return reviewInterviewPrevalence(question);\n}\n',
    "apply review policy to every question",
  );
  source = replaceOnce(
    source,
    'restoredCoverage.questions = restoredCoverage.questions.map((question) => enrichedById.get(question.id));\nexpanded.questions = [',
    'restoredCoverage.questions = restoredCoverage.questions.map((question) => enrichedById.get(question.id));\ntestingFoundations.questions = testingFoundations.questions.map((question) => enrichedById.get(question.id));\nembedded.questions = embedded.questions.map((question) => enrichedById.get(question.id));\nmodernSdet.questions = modernSdet.questions.map((question) => enrichedById.get(question.id));\ncoreFoundations.questions = coreFoundations.questions.map((question) => enrichedById.get(question.id));\nexpanded.questions = [',
    "persist reviewed authored collections",
  );
  source = replaceOnce(
    source,
    '  writeJson("content/interview/embedded-qa.json", embedded),\n  writeJson("content/interview/expanded-qa.json", expanded),',
    '  writeJson("content/interview/embedded-qa.json", embedded),\n  writeJson("content/interview/modern-sdet-qa.json", modernSdet),\n  writeJson("content/interview/core-foundations-qa.json", coreFoundations),\n  writeJson("content/interview/expanded-qa.json", expanded),',
    "write all reviewed collections",
  );
  write(path, source);
}

// Validation must reject any question whose stored band differs from the full-catalog policy.
{
  const path = "scripts/validate-interview-content.mjs";
  let source = read(path);
  source = replaceOnce(
    source,
    'import { access, readFile } from "node:fs/promises";\n',
    'import { access, readFile } from "node:fs/promises";\nimport { reviewInterviewPrevalence } from "./interview-prevalence-policy.mjs";\n',
    "validator policy import",
  );
  source = replaceOnce(
    source,
    '  assert.ok(prevalenceLevels.has(question.prevalence), `Invalid prevalence for ${question.id}`);\n',
    '  assert.ok(prevalenceLevels.has(question.prevalence), `Invalid prevalence for ${question.id}`);\n  assert.equal(question.prevalence, reviewInterviewPrevalence(question), `Prevalence is not reviewed by current policy for ${question.id}`);\n',
    "validate every prevalence",
  );
  write(path, source);
}

// Keep catalog methodology truthful about what was actually reviewed.
{
  const path = "content/interview/catalog.ts";
  let source = read(path);
  source = replaceOnce(source, "  version: 12,", "  version: 13,", "catalog version");
  source = source.replace(
    /    prevalence: "[^"]*",/,
    '    prevalence: "Every published question is reclassified by the maintained full-catalog review policy. The policy evaluates exact question wording, recurrence in the DOU, Katalon, Indeed and GeeksforGeeks interview banks, breadth across QA roles, and role-specificity. Very common is reserved for repeatedly recurring foundations; generated scenario variants cannot become Very common automatically; Embedded/IoT, AI/ML/LLM and regulated-domain questions remain Specialist. Personal stars are private user state and never affect prevalence.",',
  );
  write(path, source);
}

// Regression contracts for public stars, full prevalence review, and the one-time database reset.
{
  const path = "tests/interview-catalog.test.mjs";
  let source = read(path);
  source = replaceOnce(
    source,
    '  assert.match(generatorSource, /const generatedPrevalence = \\(question\\) =>/);\n  assert.match(generatorSource, /question\\.category === "Practical tasks"/);',
    '  assert.match(generatorSource, /reviewInterviewPrevalence/);\n  assert.match(generatorSource, /modernSdet\\.questions = modernSdet\\.questions\\.map/);\n  assert.match(generatorSource, /coreFoundations\\.questions = coreFoundations\\.questions\\.map/);',
    "generator prevalence regression",
  );
  source = replaceOnce(
    source,
    '  assert.match(uiSource, /type InterviewPrevalenceFilter = InterviewPrevalence;/);\n',
    '  assert.match(uiSource, /type InterviewPrevalenceFilter = InterviewPrevalence;/);\n  assert.match(uiSource, /const contentMode: SiteMode = \\(section === "interview" \\|\\| section === "python-interview"\\) \\? mode : effectiveMode;/);\n',
    "public interview mode regression",
  );
  write(path, source);
}

{
  const path = "tests/tenant-isolation.test.ts";
  let source = read(path);
  const marker = 'test("tenant unavailable response is explicit and non-cacheable", async () => {';
  const testBlock = [
    'test("interview star cleanup migration removes every pre-existing star", async () => {',
    '  const sql = await readFile(new URL("../drizzle/0013_clear_interview_stars.sql", import.meta.url), "utf8");',
    '  assert.match(sql, /DELETE FROM `user_interview_stars`/);',
    '  assert.doesNotMatch(sql, /WHERE/);',
    '});',
    '',
    '',
  ].join("\n");
  source = replaceOnce(source, marker, testBlock + marker, "star cleanup migration regression");
  write(path, source);
}

// Remove the abandoned audit-export helper from the final branch.
fs.rmSync(".github/workflows/tmp-interview-prevalence-export.yml", { force: true });
fs.rmSync(".tmp-audit", { recursive: true, force: true });

console.log("Applied interview star cleanup and full-catalog prevalence review patches.");
