"use client";

import { useEffect } from "react";

const USE_EXAMPLE_LABEL = "Use example";
const AUTO_RUN_DELAY_MS = 30;

function activeRunButton(): HTMLButtonElement | null {
  const editor = document.querySelector<HTMLTextAreaElement>(
    'textarea[aria-label="SQL editor"], textarea[aria-label="MongoDB query editor"]',
  );
  if (!editor) return null;

  const editorPane = editor.closest("section");
  if (!editorPane) return null;

  return [...editorPane.querySelectorAll<HTMLButtonElement>("button")]
    .find((button) => button.textContent?.trim() === "Run SQL" || button.textContent?.trim() === "Run query") ?? null;
}

export default function DatabaseExampleAutoRun() {
  useEffect(() => {
    function handleClick(event: MouseEvent) {
      const target = event.target;
      if (!(target instanceof Element)) return;
      const button = target.closest<HTMLButtonElement>("button");
      if (!button || button.textContent?.trim() !== USE_EXAMPLE_LABEL) return;

      window.setTimeout(() => {
        const runButton = activeRunButton();
        if (!runButton || runButton.disabled) return;
        runButton.click();
      }, AUTO_RUN_DELAY_MS);
    }

    document.addEventListener("click", handleClick, true);
    return () => document.removeEventListener("click", handleClick, true);
  }, []);

  return null;
}
