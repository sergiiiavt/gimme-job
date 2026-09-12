"use client";

import { useEffect } from "react";
import { highlightInterviewCode } from "../../interview-code-highlighting";
import { buildDatabaseGuide, stripDatabaseGuideComments, type DatabaseGuideDialect } from "./database-code-guide";

const annotatedByCode = new WeakMap<HTMLElement, string>();
const clickBound = new WeakSet<HTMLButtonElement>();
const editorOverlayByTextarea = new WeakMap<HTMLTextAreaElement, HTMLPreElement>();
const editorValueByTextarea = new WeakMap<HTMLTextAreaElement, string>();
const editorLanguageByTextarea = new WeakMap<HTMLTextAreaElement, string>();

function dialectForSource(source: string): DatabaseGuideDialect {
  return /^\s*db\./.test(stripDatabaseGuideComments(source)) ? "mongodb" : "sql";
}

function highlightLanguage(dialect: DatabaseGuideDialect): string {
  return dialect === "mongodb" ? "javascript" : "sql";
}

function appendHighlighted(target: HTMLElement, source: string, dialect: DatabaseGuideDialect) {
  target.replaceChildren();
  for (const token of highlightInterviewCode(source, highlightLanguage(dialect))) {
    if (!token.color) {
      target.append(document.createTextNode(token.text));
      continue;
    }
    const span = document.createElement("span");
    span.textContent = token.text;
    span.style.color = token.color;
    target.appendChild(span);
  }
}

function setControlledTextareaValue(textarea: HTMLTextAreaElement, value: string) {
  const setter = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, "value")?.set;
  if (!setter) return;
  setter.call(textarea, value);
  textarea.dispatchEvent(new Event("input", { bubbles: true }));
}

function activeEditor(): HTMLTextAreaElement | null {
  return document.querySelector<HTMLTextAreaElement>('textarea[aria-label="SQL editor"], textarea[aria-label="MongoDB query editor"]');
}

function decorateExample(button: HTMLButtonElement) {
  const card = button.closest<HTMLElement>("article");
  const code = card?.querySelector<HTMLElement>("pre code");
  if (!card || !code) return;

  const raw = stripDatabaseGuideComments(code.textContent || "");
  if (!raw) return;
  const title = card.querySelector("h2")?.textContent?.trim() || "Database example";
  const description = card.querySelector("p")?.textContent?.trim() || "Read the statement from top to bottom and observe how each clause transforms the data.";
  const dialect = dialectForSource(raw);
  const annotated = buildDatabaseGuide(raw, title, description, dialect);

  if (annotatedByCode.get(code) !== annotated || code.textContent !== annotated) {
    appendHighlighted(code, annotated, dialect);
    annotatedByCode.set(code, annotated);
  }

  if (clickBound.has(button)) return;
  clickBound.add(button);
  button.addEventListener("click", () => {
    const currentCode = card.querySelector<HTMLElement>("pre code");
    const currentAnnotated = currentCode ? annotatedByCode.get(currentCode) : undefined;
    if (!currentAnnotated) return;
    window.setTimeout(() => {
      const textarea = activeEditor();
      if (!textarea) return;
      setControlledTextareaValue(textarea, currentAnnotated);
      textarea.focus();
    }, 0);
  }, true);
}

function syncExamples() {
  for (const button of document.querySelectorAll<HTMLButtonElement>("button")) {
    if (button.textContent?.trim() === "Use example") decorateExample(button);
  }
}

function editorDialect(textarea: HTMLTextAreaElement): DatabaseGuideDialect {
  return textarea.getAttribute("aria-label") === "MongoDB query editor" ? "mongodb" : "sql";
}

function syncEditorScroll(textarea: HTMLTextAreaElement, overlay: HTMLPreElement) {
  overlay.scrollTop = textarea.scrollTop;
  overlay.scrollLeft = textarea.scrollLeft;
}

function ensureEditorOverlay(textarea: HTMLTextAreaElement) {
  let overlay = editorOverlayByTextarea.get(textarea);
  if (!overlay || !overlay.isConnected) {
    const parent = textarea.parentElement;
    if (!parent) return;
    overlay = document.createElement("pre");
    overlay.className = "db-query-highlight";
    overlay.setAttribute("aria-hidden", "true");
    const code = document.createElement("code");
    overlay.appendChild(code);
    parent.insertBefore(overlay, textarea);
    textarea.classList.add("db-query-editor-overlay");
    textarea.addEventListener("scroll", () => syncEditorScroll(textarea, overlay!));
    textarea.addEventListener("input", () => syncEditor(textarea));
    editorOverlayByTextarea.set(textarea, overlay);
  }
  syncEditor(textarea);
}

function syncEditor(textarea: HTMLTextAreaElement) {
  const overlay = editorOverlayByTextarea.get(textarea);
  const code = overlay?.querySelector<HTMLElement>("code");
  if (!overlay || !code) return;
  const dialect = editorDialect(textarea);
  const language = highlightLanguage(dialect);
  const value = textarea.value;
  if (editorValueByTextarea.get(textarea) !== value || editorLanguageByTextarea.get(textarea) !== language) {
    appendHighlighted(code, value || " ", dialect);
    editorValueByTextarea.set(textarea, value);
    editorLanguageByTextarea.set(textarea, language);
  }
  syncEditorScroll(textarea, overlay);
}

function syncPlaygroundCode() {
  syncExamples();
  const textarea = activeEditor();
  if (textarea) ensureEditorOverlay(textarea);
}

export default function DatabaseCodeEnhancer() {
  useEffect(() => {
    syncPlaygroundCode();
    const timer = window.setInterval(syncPlaygroundCode, 120);
    const root = document.querySelector(".kb-main") ?? document.body;
    const observer = new MutationObserver(syncPlaygroundCode);
    observer.observe(root, { childList: true, subtree: true });

    return () => {
      window.clearInterval(timer);
      observer.disconnect();
      for (const textarea of document.querySelectorAll<HTMLTextAreaElement>("textarea.db-query-editor-overlay")) {
        textarea.classList.remove("db-query-editor-overlay");
      }
      for (const overlay of document.querySelectorAll(".db-query-highlight")) overlay.remove();
    };
  }, []);

  return null;
}
