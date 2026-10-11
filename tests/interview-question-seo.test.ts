import assert from "node:assert/strict";
import test from "node:test";
import { register as registerTsx } from "tsx/esm/api";

registerTsx();

const {
  allInterviewQuestionPages,
  interviewQuestionBreadcrumbJsonLd,
  interviewQuestionMetadata,
  pythonInterviewQuestionPage,
  qaInterviewQuestionPage,
  questionIdFromSearchParams,
} = await import("../app/interview-question-seo.ts");
const { default: sitemap } = await import("../app/sitemap.ts");
const { PUBLIC_SITEMAP_PATHS, SITE_ORIGIN } = await import("../app/seo.ts");
const { default: interviewCatalog } = await import("../content/interview/catalog.ts");
const { default: pythonInterviewCatalog } = await import("../content/python-interview/catalog.ts");

test("every published QA and Python question has exactly one canonical bilingual page", () => {
  const pages = allInterviewQuestionPages();
  const qaIds = new Set(interviewCatalog.questions.map((question: { id: string }) => question.id));
  const pythonIds = new Set(pythonInterviewCatalog.questions.map((question: { id: string }) => question.id));

  assert.equal(pages.length, qaIds.size + pythonIds.size);
  assert.equal(new Set(pages.map((page) => page.englishPath)).size, pages.length);
  assert.equal(new Set(pages.map((page) => page.ukrainianPath)).size, pages.length);
  for (const id of qaIds) assert.ok(qaInterviewQuestionPage(id), `${id} needs a QA question page`);
  for (const id of pythonIds) assert.ok(pythonInterviewQuestionPage(id), `${id} needs a Python question page`);

  for (const page of pages) {
    assert.equal(page.englishPath, `${page.list.path}?question=${encodeURIComponent(page.id)}`);
    assert.equal(page.ukrainianPath, `/uk${page.englishPath}`);
    assert.doesNotMatch(page.englishPath, /\/interview\/generic-qa\?/, "Generic QA questions are canonical under the /interview hub");
  }
});

test("questions are canonical under the domain that lists them", () => {
  assert.equal(qaInterviewQuestionPage("relational-versus-nonrelational-databases")?.englishPath, "/interview/sql?question=relational-versus-nonrelational-databases");
  assert.equal(qaInterviewQuestionPage("severity-versus-priority")?.englishPath, "/interview?question=severity-versus-priority");
  assert.equal(pythonInterviewQuestionPage("py-core-interpreted-vs-compiled")?.englishPath, "/interview/python?question=py-core-interpreted-vs-compiled");
  assert.equal(qaInterviewQuestionPage("unknown-question"), undefined);
  assert.equal(pythonInterviewQuestionPage("severity-versus-priority"), undefined);
});

test("question metadata uses the question as title and a snippet-sized answer as description", () => {
  const page = qaInterviewQuestionPage("severity-versus-priority");
  assert.ok(page);
  const english = interviewQuestionMetadata(page, "en");
  const ukrainian = interviewQuestionMetadata(page, "uk");
  const languages = { en: page.englishPath, uk: page.ukrainianPath, "x-default": page.englishPath };

  assert.equal(english.title, `${page.question} | GimmeJob`);
  assert.equal(ukrainian.title, `${page.questionUk} | GimmeJob`);
  assert.equal(english.alternates?.canonical, page.englishPath);
  assert.equal(ukrainian.alternates?.canonical, page.ukrainianPath);
  assert.deepEqual(english.alternates?.languages, languages);
  assert.deepEqual(ukrainian.alternates?.languages, languages);
  for (const page of allInterviewQuestionPages()) {
    const description = interviewQuestionMetadata(page, "en").description ?? "";
    assert.ok(description.length >= 50 && description.length <= 155, `${page.id} description length ${description.length}`);
  }
});

test("question breadcrumbs skip the list level when the list is the interview hub", () => {
  const hubQuestion = qaInterviewQuestionPage("severity-versus-priority");
  const sqlQuestion = qaInterviewQuestionPage("relational-versus-nonrelational-databases");
  assert.ok(hubQuestion && sqlQuestion);

  assert.deepEqual(
    interviewQuestionBreadcrumbJsonLd(hubQuestion, "en").itemListElement.map((item) => item.item),
    [`${SITE_ORIGIN}/interview`, `${SITE_ORIGIN}${hubQuestion.englishPath}`],
  );
  assert.deepEqual(
    interviewQuestionBreadcrumbJsonLd(sqlQuestion, "uk").itemListElement.map((item) => item.name),
    ["Питання для співбесіди", sqlQuestion.list.ukLabel, sqlQuestion.questionUk],
  );
});

test("only a single non-empty question search parameter selects a question page", () => {
  assert.equal(questionIdFromSearchParams({ question: "joins" }), "joins");
  assert.equal(questionIdFromSearchParams({ question: "" }), undefined);
  assert.equal(questionIdFromSearchParams({ question: ["a", "b"] }), undefined);
  assert.equal(questionIdFromSearchParams({}), undefined);
});

test("sitemap publishes landing pages and every question page as absolute production URLs", () => {
  const urls = sitemap().map((entry) => entry.url);
  const questionPages = allInterviewQuestionPages();

  assert.equal(urls.length, PUBLIC_SITEMAP_PATHS.length + questionPages.length * 2);
  assert.equal(new Set(urls).size, urls.length);
  assert.ok(urls.every((url) => url.startsWith(`${SITE_ORIGIN}/`)));
  assert.ok(urls.includes(`${SITE_ORIGIN}/interview/sql?question=relational-versus-nonrelational-databases`));
  assert.ok(urls.includes(`${SITE_ORIGIN}/uk/interview?question=severity-versus-priority`));
  assert.equal(urls.includes(`${SITE_ORIGIN}/about`), false);
});
