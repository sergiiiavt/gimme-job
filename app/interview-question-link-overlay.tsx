"use client";

import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { questionDeepLinkHref } from "./content-deep-links";

interface LinkableInterviewQuestion {
  id: string;
  question: string;
  questionUk?: string;
}

interface QuestionLinkTarget {
  questionId: string;
  summary: HTMLElement;
}

function normalizeQuestionText(value: string) {
  return value.replace(/\s+/g, " ").trim();
}

export function questionIdForVisibleText(questions: LinkableInterviewQuestion[], visibleText: string) {
  const normalized = normalizeQuestionText(visibleText);
  return questions.find((question) => (
    normalizeQuestionText(question.question) === normalized
    || (question.questionUk ? normalizeQuestionText(question.questionUk) === normalized : false)
  ))?.id ?? null;
}

export default function InterviewQuestionLinkOverlay({ pathname, questions }: {
  pathname: string;
  questions: LinkableInterviewQuestion[];
}) {
  const questionIdsByText = useMemo(() => {
    const lookup = new Map<string, string>();
    for (const question of questions) {
      lookup.set(normalizeQuestionText(question.question), question.id);
      if (question.questionUk) lookup.set(normalizeQuestionText(question.questionUk), question.id);
    }
    return lookup;
  }, [questions]);
  const [targets, setTargets] = useState<QuestionLinkTarget[]>([]);

  useEffect(() => {
    let frame = 0;

    const collectTargets = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        const next = Array.from(document.querySelectorAll<HTMLElement>(".iq-question > summary"))
          .map((summary) => {
            const heading = summary.querySelector("h2")?.textContent;
            if (!heading) return null;
            const questionId = questionIdsByText.get(normalizeQuestionText(heading));
            return questionId ? { questionId, summary } : null;
          })
          .filter((target): target is QuestionLinkTarget => Boolean(target));

        setTargets((current) => (
          current.length === next.length
          && current.every((target, index) => target.questionId === next[index]?.questionId && target.summary === next[index]?.summary)
            ? current
            : next
        ));
      });
    };

    collectTargets();
    const root = document.querySelector(".kb-main") ?? document.body;
    const observer = new MutationObserver(collectTargets);
    observer.observe(root, { childList: true, characterData: true, subtree: true });

    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
    };
  }, [questionIdsByText]);

  return (
    <>
      {targets.map(({ questionId, summary }) => createPortal(
        <a
          aria-label="Open direct link to this question"
          className="iq-question-direct-link"
          href={questionDeepLinkHref(pathname, questionId)}
          onClick={(event) => event.stopPropagation()}
          title="Direct link"
        >
          <svg aria-hidden="true" fill="none" height="14" viewBox="0 0 24 24" width="14">
            <path d="M10.2 13.8a4 4 0 0 0 5.66 0l2.83-2.83a4 4 0 0 0-5.66-5.66l-1.41 1.41M13.8 10.2a4 4 0 0 0-5.66 0l-2.83 2.83a4 4 0 0 0 5.66 5.66l1.41-1.41" stroke="currentColor" strokeLinecap="round" strokeWidth="1.8"/>
          </svg>
        </a>,
        summary,
        `question-link-${questionId}`,
      ))}
      <style jsx global>{`
        .iq-question-direct-link {
          align-items: center;
          background: #fff;
          border: 1px solid #dfe4df;
          border-radius: 999px;
          color: #66736d;
          display: inline-flex;
          height: 28px;
          justify-content: center;
          position: absolute;
          right: 14px;
          top: 14px;
          width: 28px;
          z-index: 2;
        }
        .iq-question-direct-link:hover {
          background: #edf3fb;
          border-color: #b8cae1;
          color: #315e9c;
        }
        .iq-question > summary:has(.iq-star-icon) > .iq-question-direct-link {
          right: 48px;
        }
        .iq-question > summary:has(> .iq-question-direct-link) > div {
          padding-right: 48px;
        }
        .iq-question > summary:has(.iq-star-icon):has(> .iq-question-direct-link) > div {
          padding-right: 80px;
        }
        @media (max-width: 720px) {
          .iq-question-direct-link {
            right: 10px;
            top: 10px;
          }
          .iq-question > summary:has(.iq-star-icon) > .iq-question-direct-link {
            right: 44px;
          }
        }
      `}</style>
    </>
  );
}
