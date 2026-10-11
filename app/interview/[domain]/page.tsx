import type { Metadata } from "next";
import { notFound } from "next/navigation";
import {
  INTERVIEW_DOMAIN_ROUTES,
  INTERVIEW_HUB_PATH,
  canonicalInterviewDomainPath,
  interviewDomainRouteBySlug,
} from "@/content/interview/domain-routes";
import JsonLd from "../../json-ld";
import {
  interviewQuestionBreadcrumbJsonLd,
  interviewQuestionMetadata,
  qaInterviewQuestionPage,
  questionIdFromSearchParams,
} from "../../interview-question-seo";
import { bilingualLanguageAlternates, breadcrumbJsonLd, createPageMetadata, noIndexMetadata } from "../../seo";
import InterviewDomainPageClient from "../interview-domain-page-client";

type InterviewDomainPageProps = {
  params: Promise<{ domain: string }>;
  searchParams: Promise<{ question?: string | string[] }>;
};

export function generateStaticParams() {
  return INTERVIEW_DOMAIN_ROUTES.map((route) => ({ domain: route.slug }));
}

export async function generateMetadata({ params, searchParams }: InterviewDomainPageProps): Promise<Metadata> {
  const { domain } = await params;
  const route = interviewDomainRouteBySlug(domain);
  if (!route) return noIndexMetadata("Interview domain", "Unknown interview question domain.");

  const questionId = questionIdFromSearchParams(await searchParams);
  if (questionId) {
    const question = qaInterviewQuestionPage(questionId);
    return question ? interviewQuestionMetadata(question, "en") : noIndexMetadata("Interview question", "Unknown interview question.");
  }

  const canonicalPath = canonicalInterviewDomainPath(route);
  return createPageMetadata({
    title: route.title,
    description: route.description,
    path: canonicalPath,
  }, bilingualLanguageAlternates(canonicalPath, `/uk${canonicalPath}`));
}

export default async function InterviewDomainPage({ params, searchParams }: InterviewDomainPageProps) {
  const { domain } = await params;
  const route = interviewDomainRouteBySlug(domain);
  if (!route) notFound();

  const questionId = questionIdFromSearchParams(await searchParams);
  const question = questionId ? qaInterviewQuestionPage(questionId) : undefined;
  if (questionId && !question) notFound();

  const structuredData = question
    ? interviewQuestionBreadcrumbJsonLd(question, "en")
    : breadcrumbJsonLd([
      { name: "Interview questions", path: INTERVIEW_HUB_PATH },
      { name: route.label, path: route.path },
    ]);

  return (
    <>
      <JsonLd data={structuredData}/>
      <InterviewDomainPageClient canonicalPath={route.path} domainSlug={route.slug}/>
    </>
  );
}
