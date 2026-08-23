"use client";

import { useEffect, type ReactNode } from "react";
import { createRoot, type Root } from "react-dom/client";

export type RunnableInterviewCodeExample = {
  language: string;
  code: string;
  execution?: unknown;
};

type RunnableInterviewQuestion = {
  id: string;
  codeExamples?: RunnableInterviewCodeExample[];
};

type InterviewRunnableOverlayProps = {
  questions: RunnableInterviewQuestion[];
  hostClassName: string;
  copyAriaLabel: string;
  isRunnable: (example: RunnableInterviewCodeExample) => boolean;
  renderRunner: (example: RunnableInterviewCodeExample) => ReactNode;
};

function normalizeCode(value: string) {
  return value.replace(/\r\n/g, "\n").trim();
}

export default function InterviewRunnableOverlay({
  questions,
  hostClassName,
  copyAriaLabel,
  isRunnable,
  renderRunner,
}: InterviewRunnableOverlayProps) {
  useEffect(() => {
    const examplesByQuestionId = new Map(
      questions
        .filter((question) => question.codeExamples?.length)
        .map((question) => [question.id, question.codeExamples ?? []] as const),
    );
    const roots = new Map<HTMLElement, Root>();

    let frame = 0;
    const syncRunners = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        for (const [host, root] of roots) {
          if (host.isConnected) continue;
          root.unmount();
          roots.delete(host);
        }

        for (const section of document.querySelectorAll<HTMLElement>(
          '.iq-code-examples-overlay[data-variant="structured"][data-question-id]',
        )) {
          const questionId = section.dataset.questionId;
          if (!questionId) continue;
          const examples = examplesByQuestionId.get(questionId);
          if (!examples?.length) continue;

          const cards = Array.from(section.querySelectorAll<HTMLElement>(":scope > .iq-code-card"));
          examples.forEach((example, index) => {
            if (!isRunnable(example)) return;

            const card = cards[index];
            if (!card || card.querySelector(`:scope > .${hostClassName}`)) return;
            const codeBlock = card.querySelector<HTMLElement>(":scope > .iq-code-block");
            if (!codeBlock || normalizeCode(codeBlock.textContent ?? "") !== normalizeCode(example.code)) return;

            const host = document.createElement("div");
            host.className = hostClassName;
            host.dataset.questionId = questionId;
            host.dataset.codeIndex = String(index);
            codeBlock.replaceWith(host);

            const copyButton = card.querySelector<HTMLButtonElement>(`button[aria-label="${copyAriaLabel}"]`);
            if (copyButton) copyButton.style.display = "none";

            const root = createRoot(host);
            roots.set(host, root);
            root.render(renderRunner(example));
          });
        }
      });
    };

    syncRunners();
    const root = document.querySelector(".kb-main") ?? document.body;
    const observer = new MutationObserver(syncRunners);
    observer.observe(root, { childList: true, subtree: true });

    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
      for (const root of roots.values()) root.unmount();
      roots.clear();
    };
  }, [copyAriaLabel, hostClassName, isRunnable, questions, renderRunner]);

  return null;
}
