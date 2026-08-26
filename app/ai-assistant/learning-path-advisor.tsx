"use client";

import { useState } from "react";
import { SiteSidebar } from "../site-navigation";
import {
  AI_ASSISTANT_TOPICS,
  LEARNING_PATH_ADVISOR_TOPIC,
  aiAssistantTopicHref,
} from "./assistant-navigation";
import styles from "./learning-path-advisor.module.css";

type ChatRole = "user" | "assistant";
type CardKind = "knowledge" | "learning" | "interview" | "hint";
type MapNodeKind = "topic" | "foundation" | "concept" | "practice" | "source";

type RequestMessage = {
  role: ChatRole;
  content: string;
};

type AdvisorCard = {
  kind: CardKind;
  title: string;
  summary: string;
  sourcePath: string | null;
};

type LearningMapNode = {
  id: string;
  title: string;
  summary: string;
  kind: MapNodeKind;
  sourcePath: string | null;
  durationMinutes: number | null;
};

type LearningMap = {
  title: string;
  nodes: LearningMapNode[];
};

export type LearningPathApiResponse = {
  requestId: string;
  sessionId: string;
  retrievalMode: "repository" | "general";
  response: {
    answer: string;
    cards: AdvisorCard[];
    suggestedPrompts: string[];
    learningMap: LearningMap;
  };
};

type DisplayMessage = RequestMessage & {
  id: string;
  result?: LearningPathApiResponse;
};

type Recommendation = {
  key: string;
  title: string;
  summary: string;
  href: string;
  durationMinutes: number | null;
};

const MAX_REQUEST_MESSAGES = 20;
const MAX_DISPLAY_MESSAGES = 24;
const MAX_CARDS = 12;
const MAX_SUGGESTED_PROMPTS = 6;
const MAX_MAP_NODES = 8;

const SAMPLE_PROMPTS = [
  "Python parallelism",
  "API testing to contract testing",
  "Asyncio for test automation",
];

const SAFE_INTERNAL_PATHS = new Set([
  "/reference/qa-fundamentals",
  "/learn/programming",
  "/reference/programming",
  "/learn/automation",
  "/learn/testing-tools",
  "/learn/cloud-devops",
  "/learn/metrics-estimation",
  "/learn/data",
  "/reference/data",
  "/interview",
  "/interview/python",
]);

const LEGACY_SOURCE_ROUTES: Array<{ prefix: string; href: string }> = [
  { prefix: "python-learning/", href: "/reference/programming" },
  { prefix: "python-interview/", href: "/interview/python" },
  { prefix: "interview/", href: "/interview" },
  { prefix: "qa-fundamentals/", href: "/reference/qa-fundamentals" },
  { prefix: "automation-learning/", href: "/learn/automation" },
  { prefix: "testing-tools/", href: "/learn/testing-tools" },
  { prefix: "cloud-devops/", href: "/learn/cloud-devops" },
  { prefix: "metrics-estimation/", href: "/learn/metrics-estimation" },
  { prefix: "data-learning/", href: "/reference/data" },
];

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function nonEmptyString(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function optionalSourcePath(value: unknown): string | null {
  return value === null ? null : nonEmptyString(value);
}

function normalizedLearningPathResponse(value: unknown): LearningPathApiResponse | null {
  if (!isRecord(value) || !isRecord(value.response)) return null;
  const requestId = nonEmptyString(value.requestId);
  const sessionId = nonEmptyString(value.sessionId);
  const answer = nonEmptyString(value.response.answer);
  const learningMap = value.response.learningMap;
  if (
    !requestId
    || !sessionId
    || !answer
    || (value.retrievalMode !== "repository" && value.retrievalMode !== "general")
    || !isRecord(learningMap)
  ) return null;

  const cardKinds = new Set<CardKind>(["knowledge", "learning", "interview", "hint"]);
  const nodeKinds = new Set<MapNodeKind>(["topic", "foundation", "concept", "practice", "source"]);
  const cards = Array.isArray(value.response.cards) ? value.response.cards.flatMap((item) => {
    if (!isRecord(item)) return [];
    const kind = item.kind as CardKind;
    const title = nonEmptyString(item.title);
    const summary = nonEmptyString(item.summary);
    return cardKinds.has(kind) && title && summary
      ? [{ kind, title, summary, sourcePath: optionalSourcePath(item.sourcePath) }]
      : [];
  }).slice(0, MAX_CARDS) : [];
  const suggestedPrompts = Array.isArray(value.response.suggestedPrompts)
    ? value.response.suggestedPrompts.flatMap((item) => nonEmptyString(item) ?? []).slice(0, MAX_SUGGESTED_PROMPTS)
    : [];
  const nodes = Array.isArray(learningMap.nodes) ? learningMap.nodes.flatMap((item) => {
    if (!isRecord(item)) return [];
    const id = nonEmptyString(item.id);
    const title = nonEmptyString(item.title);
    const summary = nonEmptyString(item.summary);
    const kind = item.kind as MapNodeKind;
    const duration = typeof item.durationMinutes === "number" && Number.isFinite(item.durationMinutes)
      ? Math.max(1, Math.round(item.durationMinutes))
      : null;
    return id && title && summary && nodeKinds.has(kind)
      ? [{ id, title, summary, kind, sourcePath: optionalSourcePath(item.sourcePath), durationMinutes: duration }]
      : [];
  }).slice(0, MAX_MAP_NODES) : [];

  return {
    requestId,
    sessionId,
    retrievalMode: value.retrievalMode,
    response: {
      answer,
      cards,
      suggestedPrompts,
      learningMap: {
        title: nonEmptyString(learningMap.title) ?? "Learning path",
        nodes,
      },
    },
  };
}

function queryKeysAllowed(pathname: string, keys: string[]): boolean {
  const allowed = pathname.startsWith("/interview")
    ? new Set(["question", "topic"])
    : new Set(["topic", "section"]);
  return keys.every((key) => allowed.has(key));
}

export function sourcePathToHref(sourcePath: string | null): string | null {
  if (!sourcePath) return null;
  const trimmed = sourcePath.trim();
  if (!trimmed || trimmed.includes("\\") || trimmed.includes("\0")) return null;

  if (trimmed.startsWith("/")) {
    if (trimmed.startsWith("//")) return null;
    try {
      const base = "https://gimme-job.invalid";
      const url = new URL(trimmed, base);
      if (url.origin !== base || url.hash || !SAFE_INTERNAL_PATHS.has(url.pathname)) return null;
      const keys = [...url.searchParams.keys()];
      if (!queryKeysAllowed(url.pathname, keys)) return null;
      if ([...url.searchParams.values()].some((value) => !value.trim())) return null;
      return `${url.pathname}${url.search}`;
    } catch {
      return null;
    }
  }

  let normalized = trimmed.replaceAll("\\", "/").replace(/^\.\/+/, "");
  if (normalized.startsWith("content/")) normalized = normalized.slice("content/".length);
  if (!normalized || normalized.startsWith("/") || normalized.includes("..") || normalized.includes(":") || normalized.includes("//")) return null;
  return LEGACY_SOURCE_ROUTES.find((entry) => normalized.startsWith(entry.prefix))?.href ?? null;
}

function isInterviewHref(href: string): boolean {
  return href === "/interview" || href.startsWith("/interview?") || href === "/interview/python" || href.startsWith("/interview/python?");
}

function recommendations(result: LearningPathApiResponse) {
  const learning: Recommendation[] = [];
  const interview: Recommendation[] = [];
  const seen = new Set<string>();

  const add = (item: Recommendation) => {
    const identity = `${item.href}|${item.title.toLowerCase()}`;
    if (seen.has(identity)) return;
    seen.add(identity);
    (isInterviewHref(item.href) ? interview : learning).push(item);
  };

  result.response.learningMap.nodes.forEach((node) => {
    const href = sourcePathToHref(node.sourcePath);
    if (!href) return;
    add({
      key: `node-${node.id}`,
      title: node.title,
      summary: node.summary,
      href,
      durationMinutes: node.durationMinutes,
    });
  });

  result.response.cards.forEach((card, index) => {
    const href = sourcePathToHref(card.sourcePath);
    if (!href) return;
    add({
      key: `card-${card.kind}-${index}-${href}`,
      title: card.title,
      summary: card.summary,
      href,
      durationMinutes: null,
    });
  });

  return { learning: learning.slice(0, 8), interview: interview.slice(0, 8) };
}

function ContentLink({ href, interview }: Readonly<{ href: string; interview: boolean }>) {
  return (
    <a
      className={styles.contentLink}
      href={href}
      rel="noreferrer"
      target="_blank"
      title={interview ? "Open interview question in a new tab" : "Open learning topic in a new tab"}
    >
      {interview ? "Open question" : "Open topic"}
    </a>
  );
}

function RecommendationList({ interview = false, items }: Readonly<{
  interview?: boolean;
  items: Recommendation[];
}>) {
  return (
    <ol className={styles.recommendationList}>
      {items.map((item, index) => (
        <li key={item.key}>
          <span className={styles.stepNumber}>{String(index + 1).padStart(2, "0")}</span>
          <div className={styles.recommendationCopy}>
            <div className={styles.recommendationTitle}>
              <h4>{item.title}</h4>
              {item.durationMinutes !== null && <small>{item.durationMinutes} min</small>}
            </div>
            <p>{item.summary}</p>
          </div>
          <ContentLink href={item.href} interview={interview}/>
        </li>
      ))}
    </ol>
  );
}

export function LearningPathResponseView({ busy = false, onSuggestedPrompt, result }: Readonly<{
  busy?: boolean;
  onSuggestedPrompt?: (prompt: string) => void;
  result: LearningPathApiResponse;
}>) {
  const { learning, interview } = recommendations(result);
  const prompts = result.response.suggestedPrompts.slice(0, MAX_SUGGESTED_PROMPTS);

  return (
    <div className={styles.assistantResponse}>
      <div className={styles.responseIntro}>
        <span>Learning Path Advisor</span>
        <h2>{result.response.learningMap.title}</h2>
        <p>{result.response.answer}</p>
      </div>

      {learning.length > 0 && (
        <section aria-label="Learning path from GimmeJob materials" className={styles.recommendationSection}>
          <header className={styles.sectionHeader}>
            <div><span>Learning path</span><h3>GimmeJob materials</h3></div>
            <small>{learning.length} {learning.length === 1 ? "topic" : "topics"}</small>
          </header>
          <RecommendationList items={learning}/>
        </section>
      )}

      {interview.length > 0 && (
        <section aria-label="Relevant interview questions" className={styles.recommendationSection}>
          <header className={styles.sectionHeader}>
            <div><span>Practice</span><h3>Interview questions</h3></div>
            <small>{interview.length} {interview.length === 1 ? "question" : "questions"}</small>
          </header>
          <RecommendationList interview items={interview}/>
        </section>
      )}

      {result.retrievalMode === "repository" && learning.length === 0 && interview.length === 0 && (
        <p className={styles.noLinks}>Relevant GimmeJob material was found, but no direct topic link was returned. Try a narrower topic.</p>
      )}

      {prompts.length > 0 && (
        <section aria-label="Suggested follow-up prompts" className={styles.followUps}>
          <span>Continue with</span>
          <div>
            {prompts.map((prompt) => (
              <button disabled={busy} key={prompt} onClick={() => onSuggestedPrompt?.(prompt)} type="button">{prompt}</button>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

function messageId(role: ChatRole): string {
  return `${role}-${globalThis.crypto.randomUUID()}`;
}

function ConversationTurn({ busy, message, onSuggestedPrompt }: Readonly<{
  busy: boolean;
  message: DisplayMessage;
  onSuggestedPrompt: (prompt: string) => void;
}>) {
  if (message.role === "user") {
    return (
      <article className={styles.userTurn}>
        <span>You</span><p>{message.content}</p>
      </article>
    );
  }
  if (!message.result) return null;
  return (
    <article className={styles.assistantTurn}>
      <LearningPathResponseView busy={busy} onSuggestedPrompt={onSuggestedPrompt} result={message.result}/>
    </article>
  );
}

function apiErrorMessage(value: unknown, fallback: string): string {
  if (!isRecord(value)) return fallback;
  return nonEmptyString(value.error) ?? nonEmptyString(value.detail) ?? fallback;
}

export default function LearningPathAdvisor() {
  const [mobileNav, setMobileNav] = useState(false);
  const [messages, setMessages] = useState<DisplayMessage[]>([]);
  const [draft, setDraft] = useState("");
  const [sessionId, setSessionId] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  function selectAssistantTopic(topic: string) {
    setMobileNav(false);
    if (topic !== LEARNING_PATH_ADVISOR_TOPIC) window.location.assign(aiAssistantTopicHref(topic));
  }

  async function sendPrompt(rawPrompt: string) {
    const prompt = rawPrompt.trim().slice(0, 20_000);
    if (!prompt || busy) return;

    const previousMessages = messages;
    const userMessage: DisplayMessage = { id: messageId("user"), role: "user", content: prompt };
    const pendingMessages = [...previousMessages, userMessage].slice(-MAX_DISPLAY_MESSAGES);
    const requestMessages = pendingMessages
      .map(({ role, content }) => ({ role, content }))
      .slice(-MAX_REQUEST_MESSAGES);
    setMessages(pendingMessages);
    setDraft("");
    setBusy(true);
    setError("");

    try {
      const response = await fetch("/api/ai/learning-path", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-gimmejob-session-scope": "ephemeral",
        },
        cache: "no-store",
        body: JSON.stringify({ messages: requestMessages, ...(sessionId ? { sessionId } : {}) }),
      });
      const payload = await response.json().catch(() => null) as unknown;
      if (!response.ok) throw new Error(apiErrorMessage(payload, "The Learning Path Advisor is temporarily unavailable."));
      const result = normalizedLearningPathResponse(payload);
      if (!result) throw new Error("The Learning Path Advisor returned an invalid response.");

      const assistantMessage: DisplayMessage = {
        id: messageId("assistant"),
        role: "assistant",
        content: result.response.answer,
        result,
      };
      setSessionId(result.sessionId);
      setMessages([...pendingMessages, assistantMessage].slice(-MAX_DISPLAY_MESSAGES));
    } catch (requestError) {
      setMessages(previousMessages);
      setDraft(prompt);
      setError(requestError instanceof Error ? requestError.message : "The Learning Path Advisor is temporarily unavailable.");
    } finally {
      setBusy(false);
    }
  }

  function resetConversation() {
    setMessages([]);
    setSessionId("");
    setDraft("");
    setError("");
  }

  return (
    <main className="kb-shell">
      <SiteSidebar
        activeExternalId="ai-assistant"
        activeSection={null}
        activeSubsection={LEARNING_PATH_ADVISOR_TOPIC}
        mobileOpen={mobileNav}
        mode="public"
        onSelectSubsection={selectAssistantTopic}
        personalHref="/ai-assistant"
        secondaryItems={AI_ASSISTANT_TOPICS}
        secondaryTitle="AI Assistant"
      />

      <section className="kb-main">
        <button aria-expanded={mobileNav} aria-label="Toggle navigation" className="kb-floating-menu" onClick={() => setMobileNav((value) => !value)} type="button">☰</button>
        <div className={`kb-content ${styles.page}`}>
          <header className={styles.hero}>
            <span>Learning</span>
            <h1>Learning Path Advisor</h1>
            <p>Build a focused path from materials already available on GimmeJob.</p>
          </header>

          <section aria-label="Learning Path Advisor chat" className={styles.chat}>
            <div className={styles.chatTopline}>
              <span>{busy ? "Building your path…" : "Ready"}</span>
              {messages.length > 0 && <button disabled={busy} onClick={resetConversation} type="button">New path</button>}
            </div>

            <div aria-live="polite" className={styles.conversation}>
              {messages.length === 0 && !busy && (
                <section className={styles.emptyState}>
                  <h2>What do you want to learn?</h2>
                  <p>Choose a topic. The advisor will organize relevant site materials first and interview practice second.</p>
                  <div>
                    {SAMPLE_PROMPTS.map((prompt) => <button key={prompt} onClick={() => void sendPrompt(prompt)} type="button">{prompt}</button>)}
                  </div>
                </section>
              )}

              {messages.map((message) => (
                <ConversationTurn
                  busy={busy}
                  key={message.id}
                  message={message}
                  onSuggestedPrompt={(prompt) => void sendPrompt(prompt)}
                />
              ))}

              {busy && (
                <output aria-label="Building a learning path from GimmeJob materials" className={styles.loading}>
                  <span aria-hidden="true"><i/><i/><i/></span>
                  <div><strong>Building your learning path</strong><small>Finding the most relevant GimmeJob topics and interview questions.</small></div>
                </output>
              )}
            </div>

            {error && <div className={styles.errorBanner} role="alert"><strong>Could not build the learning path.</strong><span>{error}</span></div>}

            <form className={styles.composer} onSubmit={(event) => { event.preventDefault(); void sendPrompt(draft); }}>
              <label className={styles.visuallyHidden} htmlFor="learning-path-prompt">Ask the Learning Path Advisor</label>
              <textarea
                aria-describedby="learning-path-prompt-help"
                disabled={busy}
                id="learning-path-prompt"
                maxLength={20_000}
                onChange={(event) => setDraft(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter" && !event.shiftKey && !event.nativeEvent.isComposing) {
                    event.preventDefault();
                    event.currentTarget.form?.requestSubmit();
                  }
                }}
                placeholder="For example: Python parallelism"
                rows={2}
                value={draft}
              />
              <div>
                <span id="learning-path-prompt-help">Enter to send · Shift + Enter for a new line</span>
                <button disabled={busy || !draft.trim()} type="submit">{busy ? "Working…" : "Build path"}</button>
              </div>
            </form>
          </section>
        </div>
      </section>
      {mobileNav && <button aria-label="Close navigation" className="kb-backdrop" onClick={() => setMobileNav(false)} type="button"/>}
    </main>
  );
}
