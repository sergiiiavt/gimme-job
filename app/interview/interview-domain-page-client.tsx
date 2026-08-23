"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import interviewCatalog from "@/content/interview/catalog";
import InterviewDomainSwitcherOverlay from "../interview-domain-switcher-overlay";
import InterviewQuestionCodeOverlay from "../interview-question-code-overlay";
import InterviewQuestionDeepLink from "../interview-question-deep-link";
import InterviewQuestionLinkOverlay from "../interview-question-link-overlay";
import InterviewSeoOverlay from "../interview-seo-overlay";
import PublicSite from "../public-site";
import SqlInterviewRunnableOverlay from "../sql-interview-runnable-overlay";
import styles from "./interview-page.module.css";

export default function InterviewDomainPageClient({ canonicalPath = "/interview", domainSlug }: { canonicalPath?: string; domainSlug?: string }) {
  const questionId = useSearchParams().get("question");

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
      <InterviewQuestionCodeOverlay questions={interviewCatalog.questions}/>
      <SqlInterviewRunnableOverlay questions={interviewCatalog.questions}/>
      <InterviewQuestionLinkOverlay pathname={canonicalPath} questions={interviewCatalog.questions}/>
      <Link className={styles.simulatorLink} href="/interview/simulator">Run AI interview</Link>
    </>
  );
}
