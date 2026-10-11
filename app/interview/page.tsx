import type { Metadata } from "next";
import { notFound } from "next/navigation";
import JsonLd from "../json-ld";
import {
  interviewQuestionBreadcrumbJsonLd,
  interviewQuestionMetadata,
  qaInterviewQuestionPage,
  questionIdFromSearchParams,
} from "../interview-question-seo";
import { noIndexMetadata } from "../seo";
import InterviewDomainPageClient from "./interview-domain-page-client";

type InterviewPageProps = { searchParams: Promise<{ question?: string | string[] }> };

export async function generateMetadata({ searchParams }: InterviewPageProps): Promise<Metadata> {
  const questionId = questionIdFromSearchParams(await searchParams);
  if (!questionId) return {};
  const question = qaInterviewQuestionPage(questionId);
  return question ? interviewQuestionMetadata(question, "en") : noIndexMetadata("Interview question", "Unknown interview question.");
}

export default async function InterviewPage({ searchParams }: InterviewPageProps) {
  const questionId = questionIdFromSearchParams(await searchParams);
  const question = questionId ? qaInterviewQuestionPage(questionId) : undefined;
  if (questionId && !question) notFound();

  return (
    <>
      {question ? <JsonLd data={interviewQuestionBreadcrumbJsonLd(question, "en")}/> : null}
      <InterviewDomainPageClient/>
    </>
  );
}
