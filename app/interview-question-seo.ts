import type { Metadata } from "next";
import { interviewCatalogForDomain } from "../content/interview/catalog";
import {
  INTERVIEW_DOMAIN_ROUTES,
  INTERVIEW_HUB_PATH,
  canonicalInterviewDomainPath,
} from "../content/interview/domain-routes";
import {
  UK_INTERVIEW_INDEX,
  UK_PYTHON_INTERVIEW,
  ukrainianInterviewDomainRouteBySlug,
  ukrainianInterviewPath,
} from "../content/interview/ukrainian-routes";
import pythonInterviewCatalog from "../content/python-interview/catalog";
import { questionDeepLinkHref } from "./content-deep-links";
import { bilingualLanguageAlternates, breadcrumbJsonLd, createPageMetadata, metaDescription } from "./seo";

type CatalogQuestion = Readonly<{
  id: string;
  question: string;
  questionUk?: string;
  shortAnswer: string;
  shortAnswerUk?: string;
}>;

type InterviewQuestionList = Readonly<{
  /** Interview domain id, or "python" for the Python catalog. */
  id: string;
  path: string;
  label: string;
  ukPath: string;
  ukLabel: string;
}>;

/** One canonical, bilingual page per interview question (`<list>?question=<id>`). */
export type InterviewQuestionPage = Readonly<{
  id: string;
  list: InterviewQuestionList;
  englishPath: string;
  ukrainianPath: string;
  question: string;
  questionUk: string;
  answer: string;
  answerUk: string;
}>;

export type InterviewQuestionLocale = "en" | "uk";

const PYTHON_LIST: InterviewQuestionList = {
  id: "python",
  path: UK_PYTHON_INTERVIEW.englishPath,
  label: "Python",
  ukPath: UK_PYTHON_INTERVIEW.path,
  ukLabel: UK_PYTHON_INTERVIEW.label,
};

function questionPage(question: CatalogQuestion, list: InterviewQuestionList): InterviewQuestionPage {
  return {
    id: question.id,
    list,
    englishPath: questionDeepLinkHref(list.path, question.id),
    ukrainianPath: questionDeepLinkHref(list.ukPath, question.id),
    question: question.question,
    questionUk: question.questionUk ?? question.question,
    answer: question.shortAnswer,
    answerUk: question.shortAnswerUk ?? question.shortAnswer,
  };
}

let qaPages: Map<string, InterviewQuestionPage> | undefined;
let pythonPages: Map<string, InterviewQuestionPage> | undefined;

// A question is canonical under the domain list that scopes it, matching the Ukrainian domain pages.
function qaQuestionPages() {
  if (qaPages) return qaPages;
  const pages = new Map<string, InterviewQuestionPage>();
  for (const route of INTERVIEW_DOMAIN_ROUTES) {
    const path = canonicalInterviewDomainPath(route);
    const list = {
      id: route.id,
      path,
      label: route.label,
      ukPath: ukrainianInterviewPath(path),
      ukLabel: ukrainianInterviewDomainRouteBySlug(route.slug)?.ukLabel ?? route.label,
    };
    for (const question of interviewCatalogForDomain(route.id).questions as CatalogQuestion[]) {
      if (!pages.has(question.id)) pages.set(question.id, questionPage(question, list));
    }
  }
  qaPages = pages;
  return pages;
}

function pythonQuestionPages() {
  pythonPages ??= new Map((pythonInterviewCatalog.questions as CatalogQuestion[]).map((question) => [question.id, questionPage(question, PYTHON_LIST)]));
  return pythonPages;
}

export function questionIdFromSearchParams(searchParams: Readonly<{ question?: string | string[] }>): string | undefined {
  return typeof searchParams.question === "string" && searchParams.question ? searchParams.question : undefined;
}

export function qaInterviewQuestionPage(questionId: string): InterviewQuestionPage | undefined {
  return qaQuestionPages().get(questionId);
}

export function pythonInterviewQuestionPage(questionId: string): InterviewQuestionPage | undefined {
  return pythonQuestionPages().get(questionId);
}

export function allInterviewQuestionPages(): InterviewQuestionPage[] {
  return [...qaQuestionPages().values(), ...pythonQuestionPages().values()];
}

export function interviewQuestionMetadata(page: InterviewQuestionPage, locale: InterviewQuestionLocale): Metadata {
  const english = locale === "en";
  return createPageMetadata({
    title: english ? page.question : page.questionUk,
    description: metaDescription(english ? page.answer : page.answerUk),
    path: english ? page.englishPath : page.ukrainianPath,
  }, bilingualLanguageAlternates(page.englishPath, page.ukrainianPath));
}

export function interviewQuestionBreadcrumbJsonLd(page: InterviewQuestionPage, locale: InterviewQuestionLocale) {
  const english = locale === "en";
  const hub = english
    ? { name: "Interview questions", path: INTERVIEW_HUB_PATH }
    : { name: "Питання для співбесіди", path: UK_INTERVIEW_INDEX.path };
  const list = english
    ? { name: page.list.label, path: page.list.path }
    : { name: page.list.ukLabel, path: page.list.ukPath };
  const question = english
    ? { name: page.question, path: page.englishPath }
    : { name: page.questionUk, path: page.ukrainianPath };
  return breadcrumbJsonLd(list.path === hub.path ? [hub, question] : [hub, list, question]);
}
