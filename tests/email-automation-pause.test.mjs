import assert from "node:assert/strict";
import test from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { register } from "tsx/esm/api";

register();

const { emailAutomationPausedResponse } = await import("../app/email-automation.ts");
const { handleIncomingEmail } = await import("../worker/email-forwarding.ts");
const { PausedGmailForwarding } = await import("../app/auth-status-control.ts");
const { EmailResolutionPanel } = await import("../app/email-resolution-portal.tsx");

const request = (path, method = "GET") => new Request(`https://gimme-job.com${path}`, { method });

test("paused email automation answers every email pipeline route with 503", async () => {
  for (const [path, method] of [
    ["/auth/forwarding", "GET"],
    ["/internal/n8n/email-events", "GET"],
    ["/internal/n8n/email-events", "POST"],
    ["/internal/n8n/email-events", "PATCH"],
    ["/internal/n8n/email-classify", "POST"],
    ["/internal/n8n/email-resolve", "POST"],
    ["/internal/n8n/email-stats", "GET"],
    ["/api/email-events/unresolved", "PATCH"],
  ]) {
    const response = emailAutomationPausedResponse(request(path, method), false);
    assert.equal(response?.status, 503, `${method} ${path}`);
    assert.equal(response.headers.get("cache-control"), "no-store");
    assert.deepEqual(await response.json(), { error: "Email automation is paused.", code: "email_automation_paused" });
  }
});

test("paused email automation leaves non-email routes and stored-event reads alone", () => {
  for (const [path, method] of [
    ["/api/email-events/unresolved", "GET"],
    ["/internal/n8n/vacancies-sync", "POST"],
    ["/api/dashboard", "GET"],
    ["/auth/session", "GET"],
  ]) {
    assert.equal(emailAutomationPausedResponse(request(path, method), false), null, `${method} ${path}`);
  }
});

test("enabled email automation passes email routes through", () => {
  assert.equal(emailAutomationPausedResponse(request("/internal/n8n/email-classify", "POST"), true), null);
  assert.equal(emailAutomationPausedResponse(request("/auth/forwarding"), true), null);
});

function incomingMessage() {
  const state = { rejected: "" };
  return {
    state,
    value: {
      from: "recruiter@example.com",
      to: "jobs+abc123def456@gimme-job.com",
      rawSize: 10,
      headers: new Headers({ subject: "Interview", "message-id": "<m@example.com>" }),
      setReject(reason) { state.rejected = reason; },
    },
  };
}

test("paused Worker email handler accepts and discards mail without touching D1", async (t) => {
  t.mock.method(console, "log", () => {});
  let queried = false;
  const db = { prepare() { queried = true; throw new Error("D1 must not be used while paused"); } };
  const incoming = incomingMessage();
  await handleIncomingEmail(incoming.value, { DB: db }, false);
  assert.equal(queried, false);
  assert.equal(incoming.state.rejected, "");
});

test("enabled Worker email handler still processes forwarded mail", async () => {
  const incoming = incomingMessage();
  await handleIncomingEmail(incoming.value, {}, true);
  assert.equal(incoming.state.rejected, "GimmeJob email storage is unavailable");
});

test("account menu shows Gmail forwarding grayed out with no setup actions", () => {
  const markup = renderToStaticMarkup(createElement(PausedGmailForwarding));
  assert.match(markup, /aria-label="Gmail forwarding \(paused\)"/);
  assert.match(markup, />Paused</);
  assert.match(markup, /<button[^>]*disabled=""[^>]*>Check for verification email<\/button>/);
  assert.match(markup, /grayscale/);
  assert.doesNotMatch(markup, /Copy/);
  assert.doesNotMatch(markup, /Forwarding and POP\/IMAP/);
});

const unresolvedEvent = {
  id: "event-1",
  subject: "Interview invitation",
  classification: "INTERVIEW",
  summary: null,
  company: "Acme",
  jobTitle: "QA Engineer",
  receivedAt: "2026-11-10T10:00:00.000Z",
  matchStatus: "UNRESOLVED",
  evidence: { candidates: [] },
};
const panel = (paused) => renderToStaticMarkup(createElement(EmailResolutionPanel, {
  events: [unresolvedEvent],
  jobs: [{ id: "job-1", title: "QA Engineer", company: "Acme", status: "APPLIED" }],
  selection: { "event-1": "job-1" },
  linking: null,
  error: null,
  paused,
  onSelect: () => {},
  onLink: () => {},
}));

test("Needs linking panel is grayed out with disabled controls while paused", () => {
  const markup = panel(true);
  assert.match(markup, /class="email-resolution email-resolution-paused"/);
  assert.match(markup, />Paused</);
  assert.match(markup, /<select[^>]*disabled=""/);
  assert.match(markup, /<button[^>]*disabled=""[^>]*>Link<\/button>/);
});

test("Needs linking panel keeps its controls when email automation is enabled", () => {
  const markup = panel(false);
  assert.match(markup, /class="email-resolution"/);
  assert.doesNotMatch(markup, /Paused/);
  assert.doesNotMatch(markup, /disabled=""/);
  assert.match(markup, /1 job email could not be matched safely/);
});
