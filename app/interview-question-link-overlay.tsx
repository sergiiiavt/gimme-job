"use client";

import { useEffect } from "react";
import { questionDeepLinkHref } from "./content-deep-links";

interface LinkableInterviewQuestion {
  id: string;
  question: string;
  questionUk?: string;
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

function applyLinkLayout(summary: HTMLElement, link: HTMLAnchorElement) {
  const hasStar = Boolean(summary.querySelector(".iq-star-icon"));
  Object.assign(link.style, {
    alignItems: "center",
    background: "#fff",
    border: "1px solid #dfe4df",
    borderRadius: "999px",
    color: "#66736d",
    cursor: "pointer",
    display: "inline-flex",
    height: "28px",
    justifyContent: "center",
    position: "absolute",
    right: hasStar ? "48px" : "14px",
    textDecoration: "none",
    top: "14px",
    width: "28px",
    zIndex: "4",
  });

  const copy = Array.from(summary.children).find((child) => child.tagName === "DIV") as HTMLElement | undefined;
  if (copy) copy.style.paddingRight = hasStar ? "80px" : "48px";
}

function createDirectLink(pathname: string, questionId: string) {
  const link = document.createElement("a");
  link.className = "iq-question-direct-link";
  link.href = questionDeepLinkHref(pathname, questionId);
  link.title = "Direct link";
  link.setAttribute("aria-label", "Open direct link to this question");
  link.dataset.questionId = questionId;
  link.innerHTML = '<svg aria-hidden="true" fill="none" height="14" viewBox="0 0 24 24" width="14"><path d="M10.2 13.8a4 4 0 0 0 5.66 0l2.83-2.83a4 4 0 0 0-5.66-5.66l-1.41 1.41M13.8 10.2a4 4 0 0 0-5.66 0l-2.83 2.83a4 4 0 0 0 5.66 5.66l1.41-1.41" stroke="currentColor" stroke-linecap="round" stroke-width="1.8"/></svg>';
  link.addEventListener("click", (event) => event.stopPropagation());
  return link;
}

export default function InterviewQuestionLinkOverlay({ pathname, questions }: {
  pathname: string;
  questions: LinkableInterviewQuestion[];
}) {
  useEffect(() => {
    const questionIdsByText = new Map<string, string>();
    for (const question of questions) {
      questionIdsByText.set(normalizeQuestionText(question.question), question.id);
      if (question.questionUk) questionIdsByText.set(normalizeQuestionText(question.questionUk), question.id);
    }

    let frame = 0;
    const createdLinks = new Set<HTMLAnchorElement>();

    const syncLinks = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        for (const summary of document.querySelectorAll<HTMLElement>(".iq-question > summary")) {
          const heading = summary.querySelector("h2")?.textContent;
          if (!heading) continue;

          const questionId = questionIdsByText.get(normalizeQuestionText(heading));
          if (!questionId) continue;

          let link = Array.from(summary.children).find((child) => child.classList.contains("iq-question-direct-link")) as HTMLAnchorElement | undefined;
          if (!link) {
            link = createDirectLink(pathname, questionId);
            summary.appendChild(link);
            createdLinks.add(link);
          } else {
            link.href = questionDeepLinkHref(pathname, questionId);
            link.dataset.questionId = questionId;
          }

          applyLinkLayout(summary, link);
        }
      });
    };

    syncLinks();
    const root = document.querySelector(".kb-main") ?? document.body;
    const observer = new MutationObserver(syncLinks);
    observer.observe(root, { childList: true, characterData: true, subtree: true });

    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
      for (const link of createdLinks) {
        const summary = link.parentElement;
        const copy = summary ? Array.from(summary.children).find((child) => child.tagName === "DIV") as HTMLElement | undefined : undefined;
        if (copy) copy.style.removeProperty("padding-right");
        link.remove();
      }
    };
  }, [pathname, questions]);

  return null;
}
