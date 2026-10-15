"use client";

import { useMemo } from "react";
import { useSearchParams } from "next/navigation";
import interviewCatalog, { interviewCatalogForDomain } from "@/content/interview/catalog";
import { interviewDomainRouteBySlug } from "@/content/interview/domain-routes";
import InterviewDomainSwitcherOverlay from "../interview-domain-switcher-overlay";
import InterviewQuestionCodeOverlay from "../interview-question-code-overlay";
import InterviewQuestionDeepLink from "../interview-question-deep-link";
import InterviewQuestionLinkOverlay from "../interview-question-link-overlay";
import InterviewSeoOverlay from "../interview-seo-overlay";
import PublicSite from "../public-site";
import SqlInterviewRunnableOverlay from "../sql-interview-runnable-overlay";

export default function InterviewDomainPageClient({ canonicalPath = "/interview", domainSlug }: { canonicalPath?: string; domainSlug?: string }) {
  const questionId = useSearchParams().get("question");
  const domainId = interviewDomainRouteBySlug(domainSlug ?? "")?.id ?? "generic-qa";
  const scopedCatalog = useMemo(() => interviewCatalogForDomain(domainId), [domainId]);

  if (questionId) {
    return (
      <InterviewQuestionDeepLink
        backHref={canonicalPath}
        catalog={interviewCatalog}
        eyebrow="QA interview question"
        questionId={questionId}
      />
    );
  }

  return (
    <>
      <PublicSite/>
      <InterviewDomainSwitcherOverlay/>
      <InterviewSeoOverlay domainSlug={domainSlug}/>
      <InterviewQuestionCodeOverlay questions={scopedCatalog.questions}/>
      <SqlInterviewRunnableOverlay questions={scopedCatalog.questions}/>
      <InterviewQuestionLinkOverlay pathname={canonicalPath} questions={scopedCatalog.questions}/>
    </>
  );
}
