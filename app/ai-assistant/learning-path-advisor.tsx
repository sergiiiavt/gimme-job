"use client";

import { useEffect, useState } from "react";
import { SiteSidebar } from "../site-navigation";
import {
  AI_ASSISTANT_TOPICS,
  LEARNING_PATH_ADVISOR_TOPIC,
  aiAssistantTopicHref,
} from "./assistant-navigation";
import AssistantMarkdown from "./assistant-markdown";
import ExecutionTrace, {
  type ExecutionStep,
  type ExecutionTraceData,
  type TraceRetrievalResult,
  type TraceScalar,
  type TraceTokenUsage,
} from "./execution-trace";
import traceStyles from "./execution-trace.module.css";
import styles from "./learning-path-advisor.module.css";

type ChatRole = "user" | "assistant";
type AdvisorLanguage = "en" | "uk";
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

export type LearningPathApiResponse = ExecutionTraceData & {
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
  sourcePrompt?: string;
};

type Recommendation = {
  key: string;
  title: string;
  summary: string;
  href: string;
  durationMinutes: number | null;
};

type SpeechAlternative = { transcript: string };
type SpeechResult = { isFinal: boolean; length: number; [index: number]: SpeechAlternative };
type SpeechResultList = { length: number; [index: number]: SpeechResult };
type SpeechEvent = { resultIndex: number; results: SpeechResultList };
type SpeechRecognitionLike = {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  onend: (() => void) | null;
  onerror: ((event: { error?: string }) => void) | null;
  onresult: ((event: SpeechEvent) => void) | null;
  abort: () => void;
  start: () => void;
  stop: () => void;
};
type SpeechRecognitionConstructor = new () => SpeechRecognitionLike;
type SpeechWindow = Window & {
  SpeechRecognition?: SpeechRecognitionConstructor;
  webkitSpeechRecognition?: SpeechRecognitionConstructor;
};

const MAX_REQUEST_MESSAGES = 20;
const MAX_DISPLAY_MESSAGES = 24;
const MAX_CARDS = 12;
const MAX_SUGGESTED_PROMPTS = 6;
const MAX_MAP_NODES = 8;
const MAX_WORKFLOW_STEPS = 16;
const MAX_TRACE_RESULTS = 8;
const MAX_TRACE_FIELDS = 20;
const MAX_TRACE_FIELD_LENGTH = 4_000;
const MAX_TRACE_DURATION_MS = 300_000;

const SAMPLE_PROMPTS = [
  "Python parallelism",
  "API testing to contract testing",
  "Asyncio for test automation",
];

const CANONICAL_LEARNING_PATH = /^\/(?:learn|reference)\/[a-z0-9][a-z0-9-]*$/;
const SAFE_INTERVIEW_PATHS = new Set(["/interview", "/interview/python"]);

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

function validTraceDuration(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value) && value >= 0 && value <= MAX_TRACE_DURATION_MS;
}

function safeTraceUrl(value: unknown): string | null | undefined {
  if (value === null) return null;
  const text = nonEmptyString(value);
  if (!text || text.length > 2_000) return undefined;
  try {
    const url = new URL(text);
    if (url.protocol !== "https:" || url.username || url.password) return undefined;
    return url.href;
  } catch {
    return undefined;
  }
}

function traceRecord(value: unknown): Record<string, TraceScalar> | null {
  if (!isRecord(value) || Object.keys(value).length > MAX_TRACE_FIELDS) return null;
  const parsed: Record<string, TraceScalar> = {};
  for (const [key, raw] of Object.entries(value)) {
    if (!key.trim() || key.length > 120) return null;
    if (raw === null || typeof raw === "boolean") parsed[key] = raw;
    else if (typeof raw === "number" && Number.isFinite(raw)) parsed[key] = raw;
    else if (typeof raw === "string" && raw.length <= MAX_TRACE_FIELD_LENGTH) parsed[key] = raw;
    else return null;
  }
  return parsed;
}

function traceTokenUsage(value: unknown): TraceTokenUsage | null | undefined {
  if (value === null) return null;
  if (!isRecord(value)) return undefined;
  const inputTokens = value.inputTokens;
  const outputTokens = value.outputTokens;
  const totalTokens = value.totalTokens;
  if (
    typeof inputTokens !== "number" || !Number.isInteger(inputTokens) || inputTokens < 0
    || typeof outputTokens !== "number" || !Number.isInteger(outputTokens) || outputTokens < 0
    || typeof totalTokens !== "number" || !Number.isInteger(totalTokens) || totalTokens < 0
  ) return undefined;
  return { inputTokens, outputTokens, totalTokens };
}

function traceRetrievalResults(value: unknown): TraceRetrievalResult[] | null {
  if (!Array.isArray(value) || value.length > MAX_TRACE_RESULTS) return null;
  return value.flatMap((item) => {
    if (!isRecord(item)) return [];
    const title = nonEmptyString(item.title);
    const sourcePath = nonEmptyString(item.sourcePath);
    const excerpt = nonEmptyString(item.excerpt);
    const score = item.score;
    if (
      !title || !sourcePath || !excerpt
      || (item.kind !== "learning" && item.kind !== "question")
      || typeof score !== "number" || !Number.isFinite(score) || score < 0 || score > 1.5
    ) return [];
    return [{ title, kind: item.kind, score, sourcePath, excerpt }];
  });
}

function traceWorkflowSteps(value: unknown): ExecutionStep[] | null {
  if (!Array.isArray(value) || value.length < 1 || value.length > MAX_WORKFLOW_STEPS) return null;
  const steps = value.flatMap((item) => {
    if (!isRecord(item)) return [];
    const id = nonEmptyString(item.id);
    const label = nonEmptyString(item.label);
    const detail = nonEmptyString(item.detail);
    const input = traceRecord(item.input);
    const output = traceRecord(item.output);
    const retrievalResults = traceRetrievalResults(item.retrievalResults);
    const tokenUsage = traceTokenUsage(item.tokenUsage);
    if (
      !id || !label || !detail || !validTraceDuration(item.durationMs)
      || !input || !output || !retrievalResults || tokenUsage === undefined
    ) return [];
    return [{ id, label, detail, durationMs: item.durationMs, input, output, retrievalResults, tokenUsage }];
  });
  return steps.length === value.length ? steps : null;
}

export function normalizedLearningPathResponse(value: unknown): LearningPathApiResponse | null {
  if (!isRecord(value) || !isRecord(value.response)) return null;
  const requestId = nonEmptyString(value.requestId);
  const sessionId = nonEmptyString(value.sessionId);
  const model = nonEmptyString(value.model);
  const answer = nonEmptyString(value.response.answer);
  const learningMap = value.response.learningMap;
  const workflowSteps = traceWorkflowSteps(value.workflowSteps);
  const langfuseTraceUrl = safeTraceUrl(value.langfuseTraceUrl);
  if (
    !requestId
    || !sessionId
    || !model
    || !answer
    || typeof value.langfuseTracing !== "boolean"
    || langfuseTraceUrl === undefined
    || value.orchestration !== "langgraph"
    || !workflowSteps
    || (value.retrievalMode !== "repository" && value.retrievalMode !== "general")
    || !validTraceDuration(value.totalDurationMs)
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
    model,
    langfuseTracing: value.langfuseTracing,
    langfuseTraceUrl,
    orchestration: "langgraph",
    retrievalMode: value.retrievalMode,
    totalDurationMs: value.totalDurationMs,
    workflowSteps,
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
    : new Set(["topic", "section", "track"]);
  return keys.every((key) => allowed.has(key));
}

function safeInternalPath(pathname: string): boolean {
  return SAFE_INTERVIEW_PATHS.has(pathname) || CANONICAL_LEARNING_PATH.test(pathname);
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
      if (url.origin !== base || url.hash || !safeInternalPath(url.pathname)) return null;
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
    if (seen.has(item.href)) return;
    seen.add(item.href);
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
        <AssistantMarkdown markdown={result.response.answer}/>
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

function speechRecognitionConstructor(): SpeechRecognitionConstructor | null {
  if (typeof window === "undefined") return null;
  const speechWindow = window as SpeechWindow;
  return speechWindow.SpeechRecognition ?? speechWindow.webkitSpeechRecognition ?? null;
}

function MicrophoneIcon() {
  return (
    <svg aria-hidden="true" fill="none" height="17" viewBox="0 0 24 24" width="17">
      <path d="M12 3a3 3 0 0 0-3 3v6a3 3 0 1 0 6 0V6a3 3 0 0 0-3-3Z" stroke="currentColor" strokeWidth="1.8"/>
      <path d="M6.5 11.5v.5a5.5 5.5 0 0 0 11 0v-.5M12 17.5V21M9.5 21h5" stroke="currentColor" strokeLinecap="round" strokeWidth="1.8"/>
    </svg>
  );
}

function ConversationTurn({ busy, message, onInspectTrace, onSuggestedPrompt, selectedForTrace }: Readonly<{
  busy: boolean;
  message: DisplayMessage;
  onInspectTrace: () => void;
  onSuggestedPrompt: (prompt: string) => void;
  selectedForTrace: boolean;
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
      <div className={traceStyles.turnTraceAction}>
        <button
          aria-pressed={selectedForTrace}
          className={traceStyles.selectButton}
          onClick={onInspectTrace}
          type="button"
        >
          {selectedForTrace ? "Trace selected" : "Inspect trace"}
        </button>
      </div>
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
  const [language, setLanguage] = useState<AdvisorLanguage>("en");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [listening, setListening] = useState(false);
  const [recognition, setRecognition] = useState<SpeechRecognitionLike | null>(null);
  const [traceMessageId, setTraceMessageId] = useState("");

  useEffect(() => () => {
    recognition?.abort();
  }, [recognition]);

  function selectAssistantTopic(topic: string) {
    setMobileNav(false);
    if (topic !== LEARNING_PATH_ADVISOR_TOPIC) window.location.assign(aiAssistantTopicHref(topic));
  }

  function changeLanguage(nextLanguage: AdvisorLanguage) {
    if (language === nextLanguage) return;
    recognition?.abort();
    setRecognition(null);
    setListening(false);
    setLanguage(nextLanguage);
    setError("");
  }

  function toggleDictation() {
    if (recognition && listening) {
      recognition.stop();
      return;
    }

    const Recognition = speechRecognitionConstructor();
    if (!Recognition) {
      setError("Voice input is not supported in this browser.");
      return;
    }

    const instance = new Recognition();
    instance.lang = language === "uk" ? "uk-UA" : "en-US";
    instance.continuous = true;
    instance.interimResults = false;
    instance.onresult = (event) => {
      let transcript = "";
      for (let index = event.resultIndex; index < event.results.length; index += 1) {
        const result = event.results[index];
        if (result?.isFinal) transcript += result[0]?.transcript ?? "";
      }
      const cleaned = transcript.trim();
      if (cleaned) setDraft((current) => `${current}${current.trim() ? " " : ""}${cleaned}`.slice(0, 20_000));
    };
    instance.onerror = (event) => {
      setListening(false);
      setRecognition(null);
      if (event.error === "not-allowed" || event.error === "service-not-allowed") {
        setError("Microphone permission was denied.");
      }
    };
    instance.onend = () => {
      setListening(false);
      setRecognition(null);
    };

    setError("");
    setRecognition(instance);
    setListening(true);
    try {
      instance.start();
    } catch {
      setListening(false);
      setRecognition(null);
      setError("Voice input could not be started.");
    }
  }

  async function sendPrompt(rawPrompt: string) {
    const prompt = rawPrompt.trim().slice(0, 20_000);
    if (!prompt || busy) return;

    recognition?.stop();
    const previousMessages = messages;
    const userMessage: DisplayMessage = { id: messageId("user"), role: "user", content: prompt };
    const pendingMessages = [...previousMessages, userMessage].slice(-MAX_DISPLAY_MESSAGES);
    const requestMessages = pendingMessages
      .map(({ role, content }) => ({ role, content }))
      .slice(-MAX_REQUEST_MESSAGES);
    if (requestMessages.at(-1)?.role !== "user") return;
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
        body: JSON.stringify({ messages: requestMessages, language, ...(sessionId ? { sessionId } : {}) }),
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
        sourcePrompt: prompt,
      };
      setSessionId(result.sessionId);
      setTraceMessageId(assistantMessage.id);
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
    recognition?.abort();
    setRecognition(null);
    setListening(false);
    setMessages([]);
    setSessionId("");
    setDraft("");
    setError("");
    setTraceMessageId("");
  }

  const selectedTraceMessage = messages.find((message) => message.id === traceMessageId && message.result)
    ?? [...messages].reverse().find((message) => message.role === "assistant" && message.result);

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

          <div className={traceStyles.workspace}>
            <section aria-label="Learning Path Advisor chat" className={styles.chat}>
              <div className={styles.chatTopline}>
                <span>{busy ? "Building your path…" : "Ready"}</span>
                <div className="ai-assistant-topline-actions">
                  <div aria-label="Response language" className="ai-assistant-language-selector" role="group">
                    <button aria-pressed={language === "en"} disabled={busy} onClick={() => changeLanguage("en")} type="button">EN</button>
                    <button aria-pressed={language === "uk"} disabled={busy} onClick={() => changeLanguage("uk")} type="button">UA</button>
                  </div>
                  {messages.length > 0 && <button disabled={busy} onClick={resetConversation} type="button">New path</button>}
                </div>
              </div>

              <div aria-live="polite" className={styles.conversation}>
                {messages.length === 0 && !busy && (
                  <section className={styles.emptyState}>
                    <h2>What do you want to learn?</h2>
                    <p>Choose a topic. The advisor will organize relevant site materials first and interview practice second.</p>
                    <div>
                      {SAMPLE_PROMPTS.map((samplePrompt) => <button key={samplePrompt} onClick={() => void sendPrompt(samplePrompt)} type="button">{samplePrompt}</button>)}
                    </div>
                  </section>
                )}

                {messages.map((message) => (
                  <ConversationTurn
                    busy={busy}
                    key={message.id}
                    message={message}
                    onInspectTrace={() => setTraceMessageId(message.id)}
                    onSuggestedPrompt={(suggestedPrompt) => void sendPrompt(suggestedPrompt)}
                    selectedForTrace={message.id === selectedTraceMessage?.id}
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
                  <span id="learning-path-prompt-help">{listening ? "Listening… click the microphone to stop" : "Enter to send · Shift + Enter for a new line"}</span>
                  <div className="ai-assistant-composer-actions">
                    <button
                      aria-label={listening ? "Stop voice input" : "Dictate learning topic"}
                      aria-pressed={listening}
                      className="ai-assistant-voice-button"
                      disabled={busy}
                      onClick={toggleDictation}
                      title={listening ? "Stop voice input" : `Dictate in ${language === "uk" ? "Ukrainian" : "English"}`}
                      type="button"
                    >
                      <MicrophoneIcon/>
                    </button>
                    <button disabled={busy || !draft.trim()} type="submit">{busy ? "Working…" : "Build path"}</button>
                  </div>
                </div>
              </form>
            </section>

            <ExecutionTrace
              prompt={selectedTraceMessage?.sourcePrompt ?? ""}
              result={selectedTraceMessage?.result ?? null}
            />
          </div>
        </div>
      </section>
      {mobileNav && <button aria-label="Close navigation" className="kb-backdrop" onClick={() => setMobileNav(false)} type="button"/>}
    </main>
  );
}
