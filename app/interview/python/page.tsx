import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { INTERVIEW_HUB_PATH } from "@/content/interview/domain-routes";
import JsonLd from "../../json-ld";
import {
  interviewQuestionBreadcrumbJsonLd,
  interviewQuestionMetadata,
  pythonInterviewQuestionPage,
  questionIdFromSearchParams,
} from "../../interview-question-seo";
import { breadcrumbJsonLd, noIndexMetadata } from "../../seo";
import PythonInterviewPageClient from "./python-interview-page-client";

type PythonInterviewPageProps = Readonly<{ searchParams: Promise<{ question?: string | string[] }> }>;

export async function generateMetadata({ searchParams }: PythonInterviewPageProps): Promise<Metadata> {
  const questionId = questionIdFromSearchParams(await searchParams);
  if (!questionId) return {};
  const question = pythonInterviewQuestionPage(questionId);
  return question ? interviewQuestionMetadata(question, "en") : noIndexMetadata("Python interview question", "Unknown Python interview question.");
}

export default async function PythonInterviewPage({ searchParams }: PythonInterviewPageProps) {
  const questionId = questionIdFromSearchParams(await searchParams);
  const question = questionId ? pythonInterviewQuestionPage(questionId) : undefined;
  if (questionId && !question) notFound();

  const structuredData = question
    ? interviewQuestionBreadcrumbJsonLd(question, "en")
    : breadcrumbJsonLd([
      { name: "Interview questions", path: INTERVIEW_HUB_PATH },
      { name: "Python", path: "/interview/python" },
    ]);

  return (
    <>
      <JsonLd data={structuredData}/>
      <PythonInterviewPageClient/>
    </>
  );
}
