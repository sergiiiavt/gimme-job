import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { UK_INTERVIEW_INDEX } from "@/content/interview/ukrainian-routes";
import JsonLd from "../../json-ld";
import {
  interviewQuestionBreadcrumbJsonLd,
  interviewQuestionMetadata,
  qaInterviewQuestionPage,
  questionIdFromSearchParams,
} from "../../interview-question-seo";
import { bilingualLanguageAlternates, breadcrumbJsonLd, createPageMetadata, noIndexMetadata } from "../../seo";
import UkrainianInterviewPage from "./ukrainian-interview-page";

type UkrainianInterviewIndexProps = { searchParams: Promise<{ question?: string | string[] }> };

async function resolveQuestion(searchParams: UkrainianInterviewIndexProps["searchParams"]) {
  const questionId = questionIdFromSearchParams(await searchParams);
  const question = questionId ? qaInterviewQuestionPage(questionId) : undefined;
  // The index lists the Generic QA domain only.
  const questionMissing = Boolean(questionId) && question?.list.id !== UK_INTERVIEW_INDEX.domainId;
  return { questionId, question: questionMissing ? undefined : question, questionMissing };
}

export async function generateMetadata({ searchParams }: UkrainianInterviewIndexProps): Promise<Metadata> {
  const { question, questionMissing } = await resolveQuestion(searchParams);
  if (questionMissing) return noIndexMetadata("Interview question", "Unknown Ukrainian interview question.");
  if (question) return interviewQuestionMetadata(question, "uk");

  return createPageMetadata({
    title: UK_INTERVIEW_INDEX.title,
    description: UK_INTERVIEW_INDEX.description,
    path: UK_INTERVIEW_INDEX.path,
  }, bilingualLanguageAlternates(UK_INTERVIEW_INDEX.englishPath, UK_INTERVIEW_INDEX.path));
}

export default async function UkrainianInterviewIndex({ searchParams }: UkrainianInterviewIndexProps) {
  const { questionId, question, questionMissing } = await resolveQuestion(searchParams);
  if (questionMissing) notFound();

  const structuredData = question
    ? interviewQuestionBreadcrumbJsonLd(question, "uk")
    : breadcrumbJsonLd([{ name: "Питання для співбесіди", path: UK_INTERVIEW_INDEX.path }]);

  return (
    <>
      <JsonLd data={structuredData}/>
      <UkrainianInterviewPage
        description={UK_INTERVIEW_INDEX.description}
        domainId={UK_INTERVIEW_INDEX.domainId}
        englishPath={question?.englishPath ?? UK_INTERVIEW_INDEX.englishPath}
        label={UK_INTERVIEW_INDEX.label}
        path={UK_INTERVIEW_INDEX.path}
        questionId={questionId}
        title={UK_INTERVIEW_INDEX.title}
      />
    </>
  );
}
