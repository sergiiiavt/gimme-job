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
  const star = summary.querySelector<HTMLElement>(".iq-star-icon");
  const hasStar = Boolean(star);

  if (star) {
    Object.assign(star.style, {
      alignItems: "center",
      display: "inline-flex",
      height: "28px",
      justifyContent: "center",
      lineHeight: "28px",
      padding: "0 0 1px",
      right: "14px",
      textAlign: "center",
      top: "14px",
      width: "28px",
    });
  }

  Object.assign(link.style, {
    alignItems: "center",
    background: "#fff",
    border: "1px solid #dfe4df",
    borderRadius: "999px",
    color: "#69766f",
    cursor: "pointer",
    display: "inline-flex",
    height: "28px",
    justifyContent: "center",
    lineHeight: "0",
    padding: "0",
    position: "absolute",
    right: hasStar ? "48px" : "14px",
    textDecoration: "none",
    top: "14px",
    width: "28px",
    zIndex: "4",
  });

  const svg = link.querySelector<SVGElement>("svg");
  if (svg) svg.style.display = "block";

  const copy = Array.from(summary.children).find((child) => child.tagName === "DIV") as HTMLElement | undefined;
  if (copy) copy.style.paddingRight = hasStar ? "80px" : "46px";
}

function createDirectLink(pathname: string, questionId: string) {
  const link = document.createElement("a");
  link.className = "iq-question-direct-link";
  link.href = questionDeepLinkHref(pathname, questionId);
  link.target = "_blank";
  link.rel = "noopener noreferrer";
  link.title = "Open direct link in a new tab";
  link.setAttribute("aria-label", "Open direct link to this question");
  link.dataset.questionId = questionId;
  link.innerHTML = '<svg aria-hidden="true" fill="none" height="16" viewBox="0 0 24 24" width="16"><path d="M9 7H7a5 5 0 0 0 0 10h2M15 7h2a5 5 0 0 1 0 10h-2M8.5 12h7" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="1.8"/></svg>';
  link.addEventListener("mouseenter", () => {
    link.style.background = "#f5f8f6";
    link.style.borderColor = "#cbd5cf";
    link.style.color = "#315e9c";
  });
  link.addEventListener("mouseleave", () => {
    link.style.background = "#fff";
    link.style.borderColor = "#dfe4df";
    link.style.color = "#69766f";
  });
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
            link.target = "_blank";
            link.rel = "noopener noreferrer";
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
