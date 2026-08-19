"use client";

import { useSearchParams } from "next/navigation";
import pythonInterviewCatalog from "@/content/python-interview/catalog";
import InterviewQuestionDeepLink from "../../interview-question-deep-link";
import InterviewQuestionLinkOverlay from "../../interview-question-link-overlay";
import PublicSite from "../../public-site";

export default function PythonInterviewPage() {
  const questionId = useSearchParams().get("question");

  if (questionId) {
    return (
      <InterviewQuestionDeepLink
        backHref="/interview/python"
        catalog={pythonInterviewCatalog}
        eyebrow="Python interview question"
        questionId={questionId}
      />
    );
  }

  return (
    <>
      <PublicSite/>
      <InterviewQuestionLinkOverlay pathname="/interview/python" questions={pythonInterviewCatalog.questions}/>
    </>
  );
}
