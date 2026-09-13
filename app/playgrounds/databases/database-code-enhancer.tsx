"use client";

import { useEffect } from "react";
import { highlightInterviewCode } from "../../interview-code-highlighting";
import { buildDatabaseGuide, stripDatabaseGuideComments, type DatabaseGuideDialect } from "./database-code-guide";
import { MYSQL_SELF_JOIN_LEARNING_EXAMPLES, type MysqlLearningExample } from "./mysql-self-join-learning";

const annotatedByButton = new WeakMap<HTMLButtonElement, string>();
const clickBound = new WeakSet<HTMLButtonElement>();
const editorOverlayByTextarea = new WeakMap<HTMLTextAreaElement, HTMLPreElement>();
const editorValueByTextarea = new WeakMap<HTMLTextAreaElement, string>();
const editorLanguageByTextarea = new WeakMap<HTMLTextAreaElement, string>();
const EXAMPLE_AUTO_RUN_DELAY_MS = 30;
const LEARNING_NOTE_ATTRIBUTE = "data-db-learning-note";

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

function activeRunButton(textarea: HTMLTextAreaElement): HTMLButtonElement | null {
  const editorPane = textarea.closest("section");
  if (!editorPane) return null;
  return [...editorPane.querySelectorAll<HTMLButtonElement>("button")]
    .find((button) => button.textContent?.trim() === "Run SQL" || button.textContent?.trim() === "Run query") ?? null;
}

function exampleSource(card: HTMLElement): string {
  const original = card.querySelector<HTMLElement>("pre:not(.db-example-highlight) code");
  return stripDatabaseGuideComments(original?.textContent || "");
}

function learningNotes(card: HTMLElement): string[] {
  return [...card.querySelectorAll<HTMLElement>(`[${LEARNING_NOTE_ATTRIBUTE}]`)]
    .map((note) => note.textContent?.trim() || "")
    .filter(Boolean);
}

function annotatedExample(card: HTMLElement, raw: string, title: string, description: string, dialect: DatabaseGuideDialect): string {
  const notes = learningNotes(card);
  if (!notes.length) return buildDatabaseGuide(raw, title, description, dialect);
  const prefix = dialect === "mongodb" ? "//" : "--";
  const comments = [description, ...notes].filter(Boolean).map((note) => `${prefix} ${note}`);
  return `${comments.join("\n")}\n\n${stripDatabaseGuideComments(raw).trim()}`;
}

function ensureExampleOverlay(card: HTMLElement, annotated: string, dialect: DatabaseGuideDialect) {
  const originalPre = card.querySelector<HTMLElement>("pre:not(.db-example-highlight)");
  if (!originalPre) return;
  let overlay = card.querySelector<HTMLPreElement>("pre.db-example-highlight");
  if (!overlay) {
    overlay = document.createElement("pre");
    overlay.className = "db-example-highlight";
    overlay.setAttribute("aria-hidden", "true");
    overlay.appendChild(document.createElement("code"));
    originalPre.insertAdjacentElement("beforebegin", overlay);
    originalPre.hidden = true;
  }
  const code = overlay.querySelector<HTMLElement>("code");
  if (code?.textContent !== annotated) appendHighlighted(code!, annotated, dialect);
}

function decorateExample(button: HTMLButtonElement) {
  const card = button.closest<HTMLElement>("article");
  if (!card) return;
  const raw = exampleSource(card);
  if (!raw) return;
  const title = card.querySelector("h2")?.textContent?.trim() || "Database example";
  const description = card.querySelector("p:not([data-db-learning-note])")?.textContent?.trim() || title;
  const dialect = dialectForSource(raw);
  const annotated = annotatedExample(card, raw, title, description, dialect);
  annotatedByButton.set(button, annotated);
  ensureExampleOverlay(card, annotated, dialect);

  if (clickBound.has(button)) return;
  clickBound.add(button);
  button.addEventListener("click", () => {
    const currentAnnotated = annotatedByButton.get(button);
    if (!currentAnnotated) return;
    window.setTimeout(() => {
      const textarea = activeEditor();
      if (!textarea) return;
      setControlledTextareaValue(textarea, currentAnnotated);
      textarea.focus();
      window.setTimeout(() => {
        const runButton = activeRunButton(textarea);
        if (!runButton || runButton.disabled) return;
        runButton.click();
      }, EXAMPLE_AUTO_RUN_DELAY_MS);
    }, 0);
  }, true);
}

function activeExampleCategory(): string {
  return document.querySelector<HTMLButtonElement>('[aria-label="Database example categories"] button[aria-selected="true"]')?.textContent?.trim() || "";
}

function mysqlIsActive(): boolean {
  const engineButtons = [...document.querySelectorAll<HTMLButtonElement>('[aria-label="Database engine"] button')];
  const mysql = engineButtons.find((button) => button.textContent?.trim() === "MySQL 8");
  return Boolean(mysql?.className);
}

function examplesList(): HTMLElement | null {
  const categories = document.querySelector<HTMLElement>('[aria-label="Database example categories"]');
  const firstCard = categories?.parentElement?.querySelector<HTMLElement>("article");
  return firstCard?.parentElement || null;
}

function noteTextsMatch(card: HTMLElement, expected: string[]): boolean {
  const actual = [...card.querySelectorAll<HTMLElement>(`[${LEARNING_NOTE_ATTRIBUTE}]`)]
    .map((note) => note.textContent?.replace(/^Think:\s*/, "").trim() || "");
  return actual.length === expected.length && actual.every((value, index) => value === expected[index]);
}

function syncReasoning(card: HTMLElement, reasoning: string[]) {
  if (noteTextsMatch(card, reasoning)) return;
  for (const note of card.querySelectorAll(`[${LEARNING_NOTE_ATTRIBUTE}]`)) note.remove();
  const summary = card.querySelector<HTMLElement>("p");
  if (!summary) return;
  let anchor: Element = summary;
  for (const text of reasoning) {
    const note = document.createElement("p");
    note.setAttribute(LEARNING_NOTE_ATTRIBUTE, "true");
    note.textContent = `Think: ${text}`;
    anchor.insertAdjacentElement("afterend", note);
    anchor = note;
  }
}

function applyLearningExample(card: HTMLElement, entry: MysqlLearningExample) {
  const description = card.querySelector<HTMLElement>("p:not([data-db-learning-note])");
  const code = card.querySelector<HTMLElement>("pre:not(.db-example-highlight) code");
  if (description && description.textContent !== entry.description) description.textContent = entry.description;
  if (code && code.textContent !== entry.sql) code.textContent = entry.sql;
  syncReasoning(card, entry.reasoning);
  card.dataset.dbLearningTitle = entry.title;
}

function createInjectedLearningCard(list: HTMLElement, entry: MysqlLearningExample) {
  const card = document.createElement("article");
  card.className = list.querySelector<HTMLElement>("article")?.className || "";
  card.dataset.dbInjectedLearning = "true";
  card.dataset.dbLearningTitle = entry.title;

  const heading = document.createElement("h2");
  heading.textContent = entry.title;
  card.appendChild(heading);

  const description = document.createElement("p");
  description.textContent = entry.description;
  card.appendChild(description);

  for (const text of entry.reasoning) {
    const note = document.createElement("p");
    note.setAttribute(LEARNING_NOTE_ATTRIBUTE, "true");
    note.textContent = `Think: ${text}`;
    card.appendChild(note);
  }

  const pre = document.createElement("pre");
  const code = document.createElement("code");
  code.textContent = entry.sql;
  pre.appendChild(code);
  card.appendChild(pre);

  const button = document.createElement("button");
  button.type = "button";
  button.textContent = "Use example";
  button.addEventListener("click", () => {
    document.querySelector<HTMLButtonElement>('[aria-label="New query tab"]')?.click();
  });
  card.appendChild(button);
  list.appendChild(card);
}

function syncMysqlLearningExamples() {
  const category = activeExampleCategory();
  const mysql = mysqlIsActive();
  const list = examplesList();

  if (!mysql || category !== "Tables & data") {
    for (const card of document.querySelectorAll<HTMLElement>('[data-db-injected-learning="true"]')) card.remove();
  }
  if (!mysql || !list) return;

  if (category === "Joins") {
    const cards = [...list.querySelectorAll<HTMLElement>("article")];
    for (const entry of MYSQL_SELF_JOIN_LEARNING_EXAMPLES.filter((candidate) => candidate.category === "Joins")) {
      const card = cards.find((candidate) => candidate.querySelector("h2")?.textContent?.trim() === entry.title);
      if (card) applyLearningExample(card, entry);
    }
    return;
  }

  if (category !== "Tables & data") return;
  const setupExamples = MYSQL_SELF_JOIN_LEARNING_EXAMPLES.filter((entry) => entry.category === "Tables & data");
  for (const entry of setupExamples) {
    const existing = [...list.querySelectorAll<HTMLElement>("article")]
      .find((card) => card.dataset.dbLearningTitle === entry.title || card.querySelector("h2")?.textContent?.trim() === entry.title);
    if (existing) {
      applyLearningExample(existing, entry);
      continue;
    }
    createInjectedLearningCard(list, entry);
  }
}

function syncExamples() {
  for (const button of document.querySelectorAll<HTMLButtonElement>("button")) {
    if (button.textContent?.trim() === "Use example") decorateExample(button);
  }
}

function closeAllQueryTabs(tabList: HTMLElement) {
  let remaining = tabList.querySelectorAll<HTMLButtonElement>('button[title="Close query tab"]').length;
  if (!remaining) return;

  const closeNext = () => {
    if (remaining <= 0) return;
    const close = tabList.querySelector<HTMLButtonElement>('button[title="Close query tab"]');
    if (!close) return;
    remaining -= 1;
    close.click();
    if (remaining > 0) window.setTimeout(closeNext, 0);
  };

  closeNext();
}

function ensureCloseAllTabsButton() {
  const tabList = document.querySelector<HTMLElement>('[aria-label="Query tabs"]');
  if (!tabList || tabList.querySelector(".db-query-close-all")) return;

  const button = document.createElement("button");
  button.type = "button";
  button.className = "db-query-close-all";
  button.setAttribute("aria-label", "Close all query tabs");
  button.title = "Close all query tabs";
  button.textContent = "×";
  button.addEventListener("click", () => closeAllQueryTabs(tabList));
  tabList.insertBefore(button, tabList.firstChild);
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
  syncMysqlLearningExamples();
  syncExamples();
  ensureCloseAllTabsButton();
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
      for (const overlay of document.querySelectorAll(".db-query-highlight, .db-example-highlight, .db-query-close-all")) overlay.remove();
      for (const original of document.querySelectorAll<HTMLElement>("article pre[hidden]")) original.hidden = false;
      for (const card of document.querySelectorAll<HTMLElement>('[data-db-injected-learning="true"]')) card.remove();
    };
  }, []);

  return null;
}
