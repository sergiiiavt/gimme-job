"use client";

import { useEffect } from "react";
import { createRoot, type Root } from "react-dom/client";
import ExecutableSqlBlock from "./executable-sql-block";
import { isRunnableSqlSource } from "./interview-sql-execution";

interface RunnableInterviewCodeExample {
  language: string;
  code: string;
}

interface RunnableInterviewQuestion {
  id: string;
  codeExamples?: RunnableInterviewCodeExample[];
}

function normalizeCode(value: string) {
  return value.replace(/\r\n/g, "\n").trim();
}

export default function SqlInterviewRunnableOverlay({ questions }: { questions: RunnableInterviewQuestion[] }) {
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
            if (!isRunnableSqlSource(example.language, example.code)) return;

            const card = cards[index];
            if (!card || card.querySelector(":scope > .iq-sql-runner-host")) return;
            const codeBlock = card.querySelector<HTMLElement>(":scope > .iq-code-block");
            if (!codeBlock || normalizeCode(codeBlock.textContent ?? "") !== normalizeCode(example.code)) return;

            const host = document.createElement("div");
            host.className = "iq-sql-runner-host";
            host.dataset.questionId = questionId;
            host.dataset.codeIndex = String(index);
            codeBlock.replaceWith(host);

            const copyButton = card.querySelector<HTMLButtonElement>('button[aria-label="Copy SQL example"]');
            if (copyButton) copyButton.style.display = "none";

            const root = createRoot(host);
            roots.set(host, root);
            root.render(<ExecutableSqlBlock code={example.code} />);
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
  }, [questions]);

  return null;
}
