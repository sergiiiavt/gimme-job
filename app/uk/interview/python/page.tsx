import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { UK_INTERVIEW_INDEX, UK_PYTHON_INTERVIEW } from "@/content/interview/ukrainian-routes";
import JsonLd from "../../../json-ld";
import {
  interviewQuestionBreadcrumbJsonLd,
  interviewQuestionMetadata,
  pythonInterviewQuestionPage,
  questionIdFromSearchParams,
} from "../../../interview-question-seo";
import { bilingualLanguageAlternates, breadcrumbJsonLd, createPageMetadata, noIndexMetadata } from "../../../seo";
import UkrainianInterviewPage from "../ukrainian-interview-page";

type UkrainianPythonInterviewPageProps = Readonly<{ searchParams: Promise<{ question?: string | string[] }> }>;

export async function generateMetadata({ searchParams }: UkrainianPythonInterviewPageProps): Promise<Metadata> {
  const questionId = questionIdFromSearchParams(await searchParams);
  if (questionId) {
    const question = pythonInterviewQuestionPage(questionId);
    return question ? interviewQuestionMetadata(question, "uk") : noIndexMetadata("Python interview question", "Unknown Ukrainian Python interview question.");
  }

  return createPageMetadata({
    title: UK_PYTHON_INTERVIEW.title,
    description: UK_PYTHON_INTERVIEW.description,
    path: UK_PYTHON_INTERVIEW.path,
  }, bilingualLanguageAlternates(UK_PYTHON_INTERVIEW.englishPath, UK_PYTHON_INTERVIEW.path));
}

export default async function UkrainianPythonInterviewPage({ searchParams }: UkrainianPythonInterviewPageProps) {
  const questionId = questionIdFromSearchParams(await searchParams);
  const question = questionId ? pythonInterviewQuestionPage(questionId) : undefined;
  if (questionId && !question) notFound();

  const structuredData = question
    ? interviewQuestionBreadcrumbJsonLd(question, "uk")
    : breadcrumbJsonLd([
      { name: "Питання для співбесіди", path: UK_INTERVIEW_INDEX.path },
      { name: "Python", path: UK_PYTHON_INTERVIEW.path },
    ]);

  return (
    <>
      <JsonLd data={structuredData}/>
      <UkrainianInterviewPage
        description={UK_PYTHON_INTERVIEW.description}
        englishPath={question?.englishPath ?? UK_PYTHON_INTERVIEW.englishPath}
        label={UK_PYTHON_INTERVIEW.label}
        path={UK_PYTHON_INTERVIEW.path}
        python
        questionId={questionId}
        title={UK_PYTHON_INTERVIEW.title}
      />
    </>
  );
}
