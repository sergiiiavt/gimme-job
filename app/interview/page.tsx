"use client";

import { useSearchParams } from "next/navigation";
import interviewCatalog from "@/content/interview/catalog";
import InterviewQuestionDeepLink from "../interview-question-deep-link";
import InterviewQuestionLinkOverlay from "../interview-question-link-overlay";
import PublicSite from "../public-site";

export default function InterviewPage() {
  const questionId = useSearchParams().get("question");

  if (questionId) {
    return (
      <InterviewQuestionDeepLink
        backHref="/interview"
        catalog={interviewCatalog}
        eyebrow="QA interview question"
        questionId={questionId}
      />
    );
  }

  return (
    <>
      <PublicSite/>
      <InterviewQuestionLinkOverlay pathname="/interview" questions={interviewCatalog.questions}/>
    </>
  );
}
