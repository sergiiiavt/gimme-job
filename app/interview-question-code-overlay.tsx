"use client";

import { useEffect } from "react";
import { highlightInterviewCode } from "./interview-code-highlighting";

interface InterviewCodeExample {
  title: string;
  titleUk?: string;
  language: string;
  code: string;
  explanation: string;
  explanationUk?: string;
  expectedResult?: string;
  expectedResultUk?: string;
}

interface CodeEnhancedInterviewQuestion {
  id: string;
  question: string;
  questionUk?: string;
  codeExamples?: InterviewCodeExample[];
}

function normalizeQuestionText(value: string) {
  return value.replace(/\s+/g, " ").trim();
}

function applyStyles(element: HTMLElement, styles: Partial<CSSStyleDeclaration>) {
  Object.assign(element.style, styles);
}

function activeLanguage(answer: HTMLElement) {
  const active = answer.querySelector<HTMLButtonElement>(".iq-lang-toggle button.active");
  return active?.textContent?.trim() === "UA" ? "uk" : "en";
}

function appendHighlightedCode(code: HTMLElement, source: string, language: string) {
  for (const token of highlightInterviewCode(source, language)) {
    if (!token.color) {
      code.append(document.createTextNode(token.text));
      continue;
    }
    const span = document.createElement("span");
    span.textContent = token.text;
    span.style.color = token.color;
    code.appendChild(span);
  }
}

function createCopyButton(code: string, language: string) {
  const button = document.createElement("button");
  button.type = "button";
  button.textContent = "Copy";
  const languageLabel = language.toLowerCase() === "sql" ? "SQL" : language.toLowerCase() === "python" ? "Python" : language;
  button.setAttribute("aria-label", `Copy ${languageLabel} example`);
  applyStyles(button, {
    alignItems: "center",
    background: "#ffffff",
    border: "1px solid #d7ddd8",
    borderRadius: "6px",
    color: "#59655e",
    cursor: "pointer",
    display: "inline-flex",
    fontSize: "10px",
    fontWeight: "700",
    minHeight: "26px",
    padding: "0 8px",
  });
  button.addEventListener("click", async () => {
    try {
      await navigator.clipboard.writeText(code);
      button.textContent = "Copied";
      window.setTimeout(() => { button.textContent = "Copy"; }, 1400);
    } catch {
      button.textContent = "Copy failed";
      window.setTimeout(() => { button.textContent = "Copy"; }, 1400);
    }
  });
  return button;
}

function createCodeExampleCard(example: InterviewCodeExample, language: "en" | "uk") {
  const card = document.createElement("article");
  card.className = "iq-code-card";
  applyStyles(card, {
    display: "grid",
    gap: "8px",
    paddingTop: "10px",
  });

  const header = document.createElement("div");
  applyStyles(header, {
    alignItems: "center",
    display: "flex",
    gap: "8px",
    justifyContent: "space-between",
  });

  const title = document.createElement("strong");
  title.textContent = language === "uk" && example.titleUk ? example.titleUk : example.title;
  applyStyles(title, {
    color: "#344039",
    fontSize: "11px",
    lineHeight: "1.3",
  });
  header.append(title, createCopyButton(example.code, example.language));

  const pre = document.createElement("pre");
  pre.className = "iq-code-block";
  applyStyles(pre, {
    background: "#1e1e1e",
    border: "1px solid #3a3a3a",
    borderRadius: "8px",
    color: "#d4d4d4",
    fontFamily: "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace",
    fontSize: "12px",
    lineHeight: "1.6",
    margin: "0",
    maxWidth: "100%",
    overflowX: "auto",
    padding: "13px 14px",
    scrollbarColor: "#3b3b3b transparent",
    tabSize: "2",
    whiteSpace: "pre",
  });
  const code = document.createElement("code");
  appendHighlightedCode(code, example.code, example.language);
  pre.appendChild(code);

  const explanation = document.createElement("p");
  explanation.textContent = language === "uk" && example.explanationUk ? example.explanationUk : example.explanation;
  applyStyles(explanation, {
    color: "#59655e",
    fontSize: "11px",
    lineHeight: "1.5",
    margin: "0",
  });

  card.append(header, pre, explanation);

  const expected = language === "uk" && example.expectedResultUk ? example.expectedResultUk : example.expectedResult;
  if (expected) {
    const result = document.createElement("p");
    result.textContent = `${language === "uk" ? "Очікуваний результат" : "Expected result"}: ${expected}`;
    applyStyles(result, {
      borderTop: "1px solid #e7ebe8",
      color: "#66716a",
      fontSize: "10.5px",
      lineHeight: "1.45",
      margin: "0",
      paddingTop: "7px",
    });
    card.appendChild(result);
  }

  return card;
}

function createCodeSection(question: CodeEnhancedInterviewQuestion, language: "en" | "uk") {
  const section = document.createElement("section");
  section.className = "iq-code-examples-overlay";
  section.dataset.questionId = question.id;
  section.dataset.language = language;
  applyStyles(section, {
    display: "grid",
    gap: "10px",
  });

  for (const example of question.codeExamples ?? []) {
    section.appendChild(createCodeExampleCard(example, language));
  }
  return section;
}

function restoreLegacyExample(details: HTMLElement | null) {
  const copy = details?.querySelector<HTMLElement>(":scope > .iq-answer-copy");
  if (copy?.dataset.codeExampleHidden === "true") {
    copy.style.removeProperty("display");
    delete copy.dataset.codeExampleHidden;
  }
}

export default function InterviewQuestionCodeOverlay({ questions }: { questions: CodeEnhancedInterviewQuestion[] }) {
  useEffect(() => {
    const questionsByText = new Map<string, CodeEnhancedInterviewQuestion>();
    for (const question of questions) {
      if (!question.codeExamples?.length) continue;
      questionsByText.set(normalizeQuestionText(question.question), question);
      if (question.questionUk) questionsByText.set(normalizeQuestionText(question.questionUk), question);
    }

    let frame = 0;
    const syncCodeExamples = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        for (const details of document.querySelectorAll<HTMLElement>(".iq-question")) {
          const heading = details.querySelector(":scope > summary h2")?.textContent;
          const answer = details.querySelector<HTMLElement>(":scope > .iq-answer");
          if (!heading || !answer) continue;

          const question = questionsByText.get(normalizeQuestionText(heading));
          const practicalExample = answer.querySelector<HTMLElement>(":scope > .iq-example");
          const existing = practicalExample?.querySelector<HTMLElement>(":scope > .iq-code-examples-overlay") ?? null;
          if (!question?.codeExamples?.length || !practicalExample) {
            existing?.remove();
            restoreLegacyExample(practicalExample);
            continue;
          }

          const legacyCopy = practicalExample.querySelector<HTMLElement>(":scope > .iq-answer-copy");
          if (legacyCopy) {
            legacyCopy.style.display = "none";
            legacyCopy.dataset.codeExampleHidden = "true";
          }

          const language = activeLanguage(answer);
          if (existing?.dataset.questionId === question.id && existing.dataset.language === language) continue;
          existing?.remove();
          practicalExample.appendChild(createCodeSection(question, language));
        }
      });
    };

    syncCodeExamples();
    const root = document.querySelector(".kb-main") ?? document.body;
    const observer = new MutationObserver(syncCodeExamples);
    observer.observe(root, { childList: true, characterData: true, subtree: true, attributes: true, attributeFilter: ["class"] });

    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
      for (const section of document.querySelectorAll(".iq-code-examples-overlay")) section.remove();
      for (const details of document.querySelectorAll<HTMLElement>(".iq-example")) restoreLegacyExample(details);
    };
  }, [questions]);

  return null;
}
