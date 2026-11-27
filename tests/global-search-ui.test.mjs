import assert from "node:assert/strict";
import test from "node:test";
import { setTimeout as pause } from "node:timers/promises";
import { register } from "tsx/esm/api";
import { Window } from "happy-dom";
import React, { act } from "react";

import { renderToStaticMarkup } from "react-dom/server";
register();
globalThis.React = React;
globalThis.IS_REACT_ACT_ENVIRONMENT = true;
const { default: GlobalSearch, GlobalSearchTrigger, SearchHighlights, SearchResultList } = await import("../app/global-search.tsx");
const result = { id: "one", title: "Pytest fixtures <script>", snippet: "A fixture controls setup & teardown", href: "/learn/automation?topic=pytest&section=fixtures", kind: "learning", language: "en", category: "automation" };

test("search results render safe highlights, labels and canonical anchors", () => {
  const html = renderToStaticMarkup(React.createElement(SearchResultList, { results: [result, { ...result, id: "two", kind: "question", language: "uk" }], query: "fixture" }));
  assert.match(html, /<mark>fixture<\/mark>/);
  assert.match(html, /&lt;script&gt;/);
  assert.match(html, /Interview question/);
  assert.match(html, /UA/);
  assert.match(html, /href="\/learn\/automation\?topic=pytest&amp;section=fixtures"/);
  assert.equal(renderToStaticMarkup(React.createElement(SearchHighlights, { text: "", query: "" })), "");
});

test("global search opens, debounces, aborts stale requests, filters, submits semantics and restores focus", async () => {
  const window = new Window({ url: "https://example.test" });
  const previous = new Map();
  for (const name of ["window", "document", "HTMLElement", "HTMLDialogElement", "Event", "KeyboardEvent", "MouseEvent", "InputEvent"]) {
    previous.set(name, Object.getOwnPropertyDescriptor(globalThis, name));
    Object.defineProperty(globalThis, name, { configurable: true, writable: true, value: name === "window" ? window : name === "document" ? window.document : window[name] });
  }
  window.HTMLDialogElement.prototype.showModal = function () { this.open = true; };
  window.HTMLDialogElement.prototype.close = function () { this.open = false; this.dispatchEvent(new window.Event("close")); };
  const { createRoot } = await import("react-dom/client");
  const host = window.document.createElement("div");
  window.document.body.append(host);
  const root = createRoot(host);
  const beforeFetch = globalThis.fetch;
  const requests = [];
  let failure = null;
  globalThis.fetch = async (url, options) => {
    requests.push({ url: String(url), signal: options.signal });
    if (failure) return new Response("failure", { status: failure });
    return Response.json({ mode: String(url).includes("semantic=1") ? "hybrid" : "typesense", semanticAvailable: true, results: [result, { ...result, id: "two" }] });
  };
  const tick = async (milliseconds = 0) => act(async () => { await pause(milliseconds); });
  const change = async (element, value) => act(async () => {
    if (element.tagName === "INPUT") Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value").set.call(element, value);
    else element.value = value;
    element.dispatchEvent(new window.Event(element.tagName === "INPUT" ? "input" : "change", { bubbles: true }));
  });
  try {
    await act(async () => root.render(React.createElement(React.Fragment, null, React.createElement(GlobalSearchTrigger), React.createElement(GlobalSearch))));
    const opener = host.querySelector(".site-search-trigger");
    opener.focus();
    await act(async () => opener.click());
    const dialog = host.querySelector("dialog");
    const input = host.querySelector("input");
    assert.equal(dialog.open, true);
    assert.equal(window.document.activeElement, input);
    await act(async () => window.document.dispatchEvent(new window.KeyboardEvent("keydown", { ctrlKey: true, key: "k", bubbles: true })));
    await change(input, "pytest");
    await tick(480);
    assert.equal(requests.length, 1);
    assert.match(requests[0].url, /q=pytest/);
    assert.match(host.textContent, /2 results/);
    await act(async () => input.dispatchEvent(new window.KeyboardEvent("keydown", { key: "ArrowDown", bubbles: true })));
    const links = [...host.querySelectorAll(".site-search-results a")];
    assert.equal(window.document.activeElement, links[0]);
    await act(async () => links[0].dispatchEvent(new window.KeyboardEvent("keydown", { key: "ArrowDown", bubbles: true })));
    assert.equal(window.document.activeElement, links[1]);
    await act(async () => links[1].dispatchEvent(new window.KeyboardEvent("keydown", { key: "ArrowUp", bubbles: true })));
    assert.equal(window.document.activeElement, links[0]);
    const selects = host.querySelectorAll("select");
    await change(selects[0], "question");
    await change(selects[1], "uk");
    await tick(480);
    assert.match(requests.at(-1).url, /kind=question/);
    assert.match(requests.at(-1).url, /language=uk/);
    await act(async () => host.querySelector("form").dispatchEvent(new window.Event("submit", { bubbles: true, cancelable: true })));
    await tick(20);
    assert.match(requests.at(-1).url, /semantic=1/);
    assert.match(host.textContent, /including matches by meaning/);
    await change(input, "short");
    await change(input, "newer");
    await tick(480);
    assert.ok(requests.slice(0, -1).every((request) => request.signal.aborted));
    failure = 429;
    await change(input, "limited");
    await tick(480);
    assert.match(host.textContent, /Too many searches/);
    failure = 503;
    await change(input, "failed");
    await tick(480);
    assert.match(host.textContent, /Search is unavailable/);
    await act(async () => host.querySelector('[aria-label="Close search"]').click());
    assert.equal(dialog.open, false);
    assert.equal(window.document.activeElement, opener);
    await act(async () => window.document.dispatchEvent(new window.KeyboardEvent("keydown", { metaKey: true, key: "k", bubbles: true })));
    assert.equal(dialog.open, true);
    await act(async () => input.dispatchEvent(new window.KeyboardEvent("keydown", { key: "Escape", bubbles: true, cancelable: true })));
    assert.equal(dialog.open, false);
    await act(async () => opener.click());
    await act(async () => dialog.click());
    assert.equal(dialog.open, false);
    await change(input, "x");
    assert.match(host.textContent, /at least 2 characters/);
  } finally {
    await act(async () => root.unmount());
    globalThis.fetch = beforeFetch;
    await window.happyDOM.close();
    for (const [name, descriptor] of previous) {
      if (descriptor) Object.defineProperty(globalThis, name, descriptor);
      else delete globalThis[name];
    }
  }
});
