import assert from "node:assert/strict";
import { readFile, writeFile, rm } from "node:fs/promises";

const read = (path) => readFile(path, "utf8");
const write = (path, value) => writeFile(path, value);

async function replaceExact(path, before, after) {
  const source = await read(path);
  assert.ok(source.includes(before), `Expected text not found in ${path}: ${before.slice(0, 120)}`);
  await write(path, source.replace(before, after));
}

async function replaceRegex(path, pattern, after) {
  const source = await read(path);
  assert.match(source, pattern, `Expected pattern not found in ${path}`);
  await write(path, source.replace(pattern, after));
}

const ui = "app/public-site.tsx";
await replaceExact(ui,
  'type InterviewPrevalenceFilter = InterviewPrevalence | "Starred";',
  'type InterviewPrevalenceFilter = InterviewPrevalence;',
);
await replaceExact(ui, '  editorialStar?: boolean;\n', '');
await replaceExact(ui,
`const interviewPrevalenceFilters: Array<{ label: string; value: InterviewPrevalenceFilter }> = [
  { label: "★ Starred", value: "Starred" },
  ...interviewPrevalence.map((value) => ({ label: value, value })),
];`,
`const interviewPrevalenceFilters: Array<{ label: string; value: InterviewPrevalenceFilter }> = interviewPrevalence.map((value) => ({ label: value, value }));`,
);
await replaceExact(ui,
`  const [starBusy, setStarBusy] = useState<string | null>(null);
  const [starError, setStarError] = useState<string | null>(null);`,
`  const [starBusy, setStarBusy] = useState<string | null>(null);
  const [starError, setStarError] = useState<string | null>(null);
  const [starredOnly, setStarredOnly] = useState(false);`,
);
await replaceExact(ui,
`        const isStarred = mode === "personal" ? Boolean(stars[item.id]) : item.editorialStar === true;
        const matchesLevel = levels.length === 0 || levels.includes(item.level);
        const matchesPrevalence = prevalences.length === 0 || prevalences.some((prevalence) => prevalence === "Starred" ? isStarred : prevalence === item.prevalence);
        const matchesCategory = !activeCategory || item.category === activeCategory;
        const matchesTag = selectedTags.length === 0 || tags.some((tag) => selectedTags.includes(tag));
        const matchesSearch = matchesAllSearchTerms(query, [item.question, item.shortAnswer, item.category, topicSearchLabels.get(item.category) ?? "", item.kind ?? "", item.prevalence, isStarred ? "star starred fundamental core" : "", ...tags, ...item.strongAnswerSignals]);
        return matchesLevel && matchesPrevalence && matchesCategory && matchesTag && matchesSearch;`,
`        const isStarred = Boolean(stars[item.id]);
        const matchesLevel = levels.length === 0 || levels.includes(item.level);
        const matchesPrevalence = prevalences.length === 0 || prevalences.includes(item.prevalence);
        const matchesStarred = !starredOnly || (mode === "personal" && isStarred);
        const matchesCategory = !activeCategory || item.category === activeCategory;
        const matchesTag = selectedTags.length === 0 || tags.some((tag) => selectedTags.includes(tag));
        const matchesSearch = matchesAllSearchTerms(query, [item.question, item.shortAnswer, item.category, topicSearchLabels.get(item.category) ?? "", item.kind ?? "", item.prevalence, mode === "personal" && isStarred ? "star starred" : "", ...tags, ...item.strongAnswerSignals]);
        return matchesLevel && matchesPrevalence && matchesStarred && matchesCategory && matchesTag && matchesSearch;`,
);
await replaceExact(ui,
`  }, [activeCategory, catalogOrder, interviewQuestions, learningTopicOrder, levels, mode, prevalences, query, selectedTags, sort, stars, topicSearchLabels]);`,
`  }, [activeCategory, catalogOrder, interviewQuestions, learningTopicOrder, levels, mode, prevalences, query, selectedTags, sort, starredOnly, stars, topicSearchLabels]);`,
);
await replaceExact(ui,
`    setPrevalences([]);
    setSort("prevalence");`,
`    setPrevalences([]);
    setStarredOnly(false);
    setSort("prevalence");`,
);
await replaceExact(ui,
`  const hasActiveFilters = Boolean(activeCategory || selectedTags.length || query || levels.length || prevalences.length || sort !== "prevalence");`,
`  const hasActiveFilters = Boolean(activeCategory || selectedTags.length || query || levels.length || prevalences.length || starredOnly || sort !== "prevalence");`,
);
await replaceExact(ui,
`          <InterviewFilter emptyLabel="All prevalence" helpText={mode === "personal" ? "Starred is your own private set; frequency bands remain unchanged." : "Starred is the editorial core set; frequency bands remain unchanged."} label="Prevalence" onChange={setQuestionPrevalences} onOpenChange={(nextOpen) => setFilterOpen("prevalence", nextOpen)} open={openFilter === "prevalence"} options={interviewPrevalenceFilters} selected={prevalences}/>
          <InterviewFilter emptyLabel="All tags"`,
`          <InterviewFilter emptyLabel="All prevalence" helpText="How often this exact question is likely to appear in interviews." label="Prevalence" onChange={setQuestionPrevalences} onOpenChange={(nextOpen) => setFilterOpen("prevalence", nextOpen)} open={openFilter === "prevalence"} options={interviewPrevalenceFilters} selected={prevalences}/>
          {mode === "personal" && (
            <button
              aria-pressed={starredOnly}
              className={\`iq-star-filter\${starredOnly ? " active" : ""}\`}
              onClick={() => { setStarredOnly((current) => !current); setPage(0); }}
              type="button"
            >
              <span className="iq-star-filter-icon" aria-hidden="true">★</span>
              <span className="iq-star-filter-copy"><small>Personal</small><strong>Starred only</strong></span>
            </button>
          )}
          <InterviewFilter emptyLabel="All tags"`,
);
await replaceExact(ui,
`                {mode === "personal" ? (
                  <button
                    aria-label={stars[item.id] ? "Remove your star" : "Star this question"}
                    aria-pressed={Boolean(stars[item.id])}
                    className={\`iq-star-icon\${stars[item.id] ? " active" : ""}\`}
                    disabled={starBusy === item.id}
                    onClick={(event) => { event.preventDefault(); event.stopPropagation(); void updateStar(item.id, !stars[item.id]); }}
                    type="button"
                  >{stars[item.id] ? "★" : "☆"}</button>
                ) : item.editorialStar && (
                  <span aria-label="Starred fundamental" className="iq-star-icon active" role="img">★</span>
                )}`,
`                {mode === "personal" && (
                  <button
                    aria-label={stars[item.id] ? "Remove your star" : "Star this question"}
                    aria-pressed={Boolean(stars[item.id])}
                    className={\`iq-star-icon\${stars[item.id] ? " active" : ""}\`}
                    disabled={starBusy === item.id}
                    onClick={(event) => { event.preventDefault(); event.stopPropagation(); void updateStar(item.id, !stars[item.id]); }}
                    type="button"
                  >{stars[item.id] ? "★" : "☆"}</button>
                )}`,
);

const styles = "app/globals.css";
await replaceExact(styles,
`.iq-clear { background: #fff; border: 1px solid #d6ddd7; border-radius: 10px; color: #526059; cursor: pointer; font-size: 9px; font-weight: 750; min-height: 54px; padding: 0 15px; white-space: nowrap; }`,
`.iq-star-filter { align-items: center; background: #f7f9f6; border: 1px solid #dce2dc; border-radius: 10px; color: #1e2925; cursor: pointer; display: flex; gap: 10px; min-height: 54px; padding: 7px 12px; text-align: left; }
.iq-star-filter:hover { background: #fff; border-color: #aab8aa; }
.iq-star-filter:focus-visible { outline: 3px solid rgba(95,126,53,.16); outline-offset: 2px; }
.iq-star-filter.active { background: #fff8e8; border-color: #d5bd78; box-shadow: 0 0 0 3px rgba(173,134,39,.08); }
.iq-star-filter-icon { align-items: center; background: #edf1eb; border-radius: 50%; color: #657168; display: flex; flex: 0 0 auto; font-size: 15px; height: 26px; justify-content: center; width: 26px; }
.iq-star-filter.active .iq-star-filter-icon { background: #f5dfaa; color: #785d18; }
.iq-star-filter-copy { display: block; min-width: 0; }
.iq-star-filter-copy small { color: #839087; display: block; font-size: 8px; font-weight: 750; letter-spacing: .09em; line-height: 1; margin-bottom: 6px; text-transform: uppercase; }
.iq-star-filter-copy strong { display: block; font-size: 11px; font-weight: 700; line-height: 1.15; white-space: nowrap; }
.iq-clear { background: #fff; border: 1px solid #d6ddd7; border-radius: 10px; color: #526059; cursor: pointer; font-size: 9px; font-weight: 750; min-height: 54px; padding: 0 15px; white-space: nowrap; }`,
);

const catalog = "content/interview/catalog.ts";
await replaceExact(catalog, 'import editorialStars from "./editorial-starred-question-ids.json";\n', '');
await replaceExact(catalog,
`const editorialStarredIds = new Set(editorialStars.questionIds);
const questions = [...common.questions, ...canonical.questions, ...databaseSql.questions, ...observabilityProduction.questions, ...restoredCoverage.questions, ...testingFoundations.questions, ...embedded.questions, ...modernSdet.questions, ...coreFoundations.questions, ...expanded.questions]
  .map((question) => editorialStarredIds.has(question.id) ? { ...question, editorialStar: true } : question);`,
`const questions = [...common.questions, ...canonical.questions, ...databaseSql.questions, ...observabilityProduction.questions, ...restoredCoverage.questions, ...testingFoundations.questions, ...embedded.questions, ...modernSdet.questions, ...coreFoundations.questions, ...expanded.questions];`,
);
await replaceExact(catalog, '  version: 11,', '  version: 12,');
await replaceExact(catalog, '  lastReviewedAt: "2026-08-14",', '  lastReviewedAt: "2026-08-19",');
await replaceRegex(catalog,
/    prevalence: "Prevalence is an editorial four-band signal,[^\n]+",/,
`    prevalence: "Prevalence is a reviewed four-band signal for how likely the exact question is to appear in interviews, not a fabricated percentage. Authored questions keep explicit reviewed bands. Generated scenario variants are classified conservatively: classic practical exercises are Common, broad generated variants are Occasional, and role-specific generated variants are Specialist. Personal stars are private user state and never alter prevalence.",`,
);

const generator = "scripts/generate-interview-expansion.mjs";
await replaceRegex(generator,
/const prevalenceByPosition = \(position\) => \{[\s\S]*?\n\};\n\n/,
`const generatedSpecialistCategories = new Set(["Embedded and IoT", "AI, ML and LLM", "Regulated domains"]);
const generatedPrevalence = (question) => {
  if (question.category === "Practical tasks") return "Common";
  if (generatedSpecialistCategories.has(question.category)) return "Specialist";
  return "Occasional";
};

`,
);
await replaceExact(generator, 'const canonicalPrevalence = new Map(canonical.questions.map((question) => [question.id, question.prevalence]));\n', '');
await replaceRegex(generator,
/function addPrevalence\(questions\) \{[\s\S]*?\n\}\n\nconst combinedEditorialOrder/,
`function reviewedPrevalence(question) {
  if (question.id.startsWith("expanded-")) return generatedPrevalence(question);
  assert.ok(question.prevalence, \`Authored question \${question.id} must have an explicitly reviewed prevalence.\`);
  return question.prevalence;
}

function addPrevalence(questions) {
  return questions.map((question) => ({
    ...question,
    prevalence: reviewedPrevalence(question),
  }));
}

const combinedEditorialOrder`,
);

const validator = "scripts/validate-interview-content.mjs";
await replaceExact(validator,
`const [common, canonical, databaseSql, observabilityProduction, restoredCoverage, testingFoundations, embedded, modernSdet, coreFoundations, editorialStars, expanded, sources, taxonomy] = await Promise.all([`,
`const [common, canonical, databaseSql, observabilityProduction, restoredCoverage, testingFoundations, embedded, modernSdet, coreFoundations, expanded, sources, taxonomy] = await Promise.all([`,
);
await replaceExact(validator, '  readJson("../content/interview/editorial-starred-question-ids.json"),\n', '');
await replaceRegex(validator,
/assert\.equal\(new Set\(editorialStars\.questionIds\)\.size,[\s\S]*?\n\}\n\nconst referencedSourceIds/,
`const generatedSpecialistCategories = new Set(["Embedded and IoT", "AI, ML and LLM", "Regulated domains"]);
for (const question of questions.filter((item) => item.id.startsWith("expanded-"))) {
  assert.notEqual(question.prevalence, "Very common", \`Generated scenario must not be Very common: \${question.id}\`);
  const expected = question.category === "Practical tasks"
    ? "Common"
    : generatedSpecialistCategories.has(question.category)
      ? "Specialist"
      : "Occasional";
  assert.equal(question.prevalence, expected, \`Generated prevalence must follow the reviewed policy for \${question.id}\`);
}

const referencedSourceIds`,
);

const tests = "tests/interview-catalog.test.mjs";
await replaceExact(tests,
`  const [common, canonical, databaseSql, observabilityProduction, restoredCoverage, testingFoundations, embedded, modernSdet, coreFoundations, editorialStars, expanded, sources, taxonomy] = await Promise.all([`,
`  const [common, canonical, databaseSql, observabilityProduction, restoredCoverage, testingFoundations, embedded, modernSdet, coreFoundations, expanded, sources, taxonomy] = await Promise.all([`,
);
await replaceExact(tests, '    readFile(projectFile("content/interview/editorial-starred-question-ids.json"), "utf8").then(JSON.parse),\n', '');
await replaceExact(tests,
`  assert.equal(new Set(editorialStars.questionIds).size, editorialStars.questionIds.length);
  assert.ok(editorialStars.questionIds.length >= 40);
  assert.ok(editorialStars.questionIds.every((id) => questions.some((question) => question.id === id)));
`,
'',
);
await replaceExact(tests,
`  assert.match(generatorSource, /const MINIMUM_QUESTION_COUNT = 672;/);
  assert.match(generatorSource, /baseQuestions\\.length \\+ generated\\.length >= MINIMUM_QUESTION_COUNT/);
  assert.doesNotMatch(generatorSource, /contain exactly 520 questions/);`,
`  assert.match(generatorSource, /const MINIMUM_QUESTION_COUNT = 672;/);
  assert.match(generatorSource, /baseQuestions\\.length \\+ generated\\.length >= MINIMUM_QUESTION_COUNT/);
  assert.match(generatorSource, /const generatedPrevalence = \\(question\\) =>/);
  assert.match(generatorSource, /question\\.category === "Practical tasks"/);
  assert.doesNotMatch(generatorSource, /prevalenceByPosition/);
  assert.doesNotMatch(generatorSource, /contain exactly 520 questions/);`,
);
await replaceExact(tests,
`  assert.match(uiSource, /type InterviewPrevalenceFilter = InterviewPrevalence \\| "Starred"/);
  assert.match(uiSource, /label: "★ Starred"/);
  assert.match(uiSource, /item\\.editorialStar === true/);
  assert.match(uiSource, /aria-label="Starred fundamental"/);
  assert.match(stylesSource, /\\.iq-star-icon \\{/);`,
`  assert.match(uiSource, /type InterviewPrevalenceFilter = InterviewPrevalence;/);
  assert.doesNotMatch(uiSource, /editorialStar/);
  assert.doesNotMatch(uiSource, /Starred fundamental/);
  assert.match(stylesSource, /\\.iq-star-icon \\{/);
  assert.match(stylesSource, /\\.iq-star-filter \\{/);`,
);
await replaceExact(tests,
`  assert.match(uiSource, /const \\[prevalences, setPrevalences\\] = useState<InterviewPrevalenceFilter\\[]>\\(\\[\\]\\)/);
  assert.match(uiSource, /const isStarred = mode === "personal" \\? Boolean\\(stars\\[item\\.id\\]\\) : item\\.editorialStar === true;/);
  assert.match(uiSource, /prevalence === "Starred" \\? isStarred : prevalence === item\\.prevalence/);`,
`  assert.match(uiSource, /const \\[prevalences, setPrevalences\\] = useState<InterviewPrevalenceFilter\\[]>\\(\\[\\]\\)/);
  assert.match(uiSource, /const \\[starredOnly, setStarredOnly\\] = useState\\(false\\)/);
  assert.match(uiSource, /const isStarred = Boolean\\(stars\\[item\\.id\\]\\);/);
  assert.match(uiSource, /const matchesPrevalence = prevalences\\.length === 0 \\|\\| prevalences\\.includes\\(item\\.prevalence\\);/);
  assert.match(uiSource, /const matchesStarred = !starredOnly \\|\\| \\(mode === "personal" && isStarred\\);/);
  assert.match(uiSource, /className=\\{`iq-star-filter/);
  assert.match(uiSource, />Starred only</);`,
);

const readme = "README.md";
await replaceExact(readme,
'- an editorial Starred foundation set that remains separate from frequency-based prevalence and future personal stars;',
'- personal stars stored only as private user state, with a separate starred-only filter that does not change question prevalence;',
);
await replaceExact(readme,
'- prevalence, seniority, tag, topic and full-text filters;',
'- prevalence, personal-star, seniority, tag, topic and full-text filters;',
);
await replaceExact(readme,
'Public interview content remains in Git; D1 stores private vacancy data, interview progress, notes and bookmarks.',
'Public interview content remains in Git; D1 stores private vacancy data plus user-specific interview progress and stars.',
);

const knowledgeDoc = "docs/interview-knowledge-base.md";
await replaceExact(knowledgeDoc,
`The catalog currently contains 672 canonical questions across 19 topics and 67 sources. The generator preserves every existing stable question ID and allows reviewed additions to increase the total; the validated minimum advances with the catalog so the count cannot regress. Its four prevalence bands are editorial signals, not invented percentages: **Very common**, **Common**, **Occasional**, and **Specialist**. The separate **Starred** filter identifies an editorial core-foundation set without overwriting those frequency bands; personal stars can later be added as private state. Sorting supports a guided learning path, most-common first, Junior-to-Lead, and alphabetical order.`,
`The catalog is protected by a rolling non-destructive question floor across 20 topics and a researched source registry. The generator preserves every existing stable question ID and allows reviewed additions to increase the total. Its four prevalence bands are reviewed likelihood signals, not invented percentages: **Very common**, **Common**, **Occasional**, and **Specialist**. Authored questions keep explicit reviewed values. Generated scenario variants are intentionally conservative: classic practical exercises are **Common**, broad generated variants are **Occasional**, and role-specific generated variants are **Specialist**. Stars are independent private user state and never change prevalence. Sorting supports a guided learning path, most-common first, Junior-to-Lead, and alphabetical order.`,
);
await replaceExact(knowledgeDoc,
`interview_progress
  question_id
  status          # new, learning, ready, revisit
  confidence      # 1-5
  private_notes
  bookmarked
  last_reviewed_at
  next_review_at`,
`user_interview_progress
  user_id
  question_id
  status
  updated_at

user_interview_stars
  user_id
  question_id
  created_at`,
);
await replaceExact(knowledgeDoc,
'`npm run check:content` enforces the current 672-question minimum, 19 topics, 67 sources, the curated editorial-star set, five specialist topics, prevalence values, duplicate IDs, known categories and sources, complete answers, answer signals, and valid media.',
'`npm run check:content` enforces the current non-regression question floor, 20 topics, the researched source floor, the generated-question prevalence policy, prevalence values, duplicate IDs, known categories and sources, complete answers, answer signals, and valid media.',
);

const qualityDoc = "docs/interview-content-quality.md";
await replaceRegex(qualityDoc,
/## Core foundations and editorial stars[\s\S]*?## Readability and media policy/,
`## Core foundations, personal stars and prevalence audit

\`content/interview/core-foundations-qa.json\` adds 18 direct questions for acceptance and integration testing, static and dynamic techniques, experience-based and cause-effect design, structural coverage, test plans, test-case quality, testing work products, requirement quality and review, verification methods, and test-estimation techniques. NASA's requirements guidance adds a primary reference for clarity, completeness, consistency, feasibility, singularity, traceability and verifiability.

The former public editorial-star set has been removed. A star is now exclusively user-specific state stored privately in \`user_interview_stars\`; public catalog data contains no star field and public question cards render no star. In Personal view, starring and the separate **Starred only** control are independent from prevalence, so a starred question can still be Very common, Common, Occasional or Specialist.

The prevalence audit also removes the generator's old position-based fallback. Exact generated scenario variants are no longer promoted merely because they appeared early in a topic. Classic practical interview exercises are classified **Common**; broad generated variants are **Occasional**; generated variants in Embedded and IoT, AI/ML/LLM, and Regulated domains are **Specialist**. Authored questions retain an explicit reviewed prevalence and can use **Very common** when the direct question is supported as a recurring interview prompt.

## Readability and media policy`,
);

await rm("content/interview/editorial-starred-question-ids.json");

console.log("Applied personal-star separation and prevalence audit source changes.");
