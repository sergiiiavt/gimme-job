"use client";

import { useSearchParams } from "next/navigation";
import pythonInterviewCatalog from "@/content/python-interview/catalog";
import InterviewQuestionCodeOverlay from "../../interview-question-code-overlay";
import InterviewQuestionDeepLink from "../../interview-question-deep-link";
import InterviewQuestionLinkOverlay from "../../interview-question-link-overlay";
import PythonInterviewRunnableOverlay from "../../python-interview-runnable-overlay";
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
      <InterviewQuestionCodeOverlay questions={pythonInterviewCatalog.questions}/>
      <PythonInterviewRunnableOverlay questions={pythonInterviewCatalog.questions}/>
      <InterviewQuestionLinkOverlay pathname="/interview/python" questions={pythonInterviewCatalog.questions}/>
    </>
  );
}
