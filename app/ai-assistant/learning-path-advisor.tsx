"use client";

import Link from "next/link";
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

type LearningMapEdge = {
  source: string;
  target: string;
  label: string;
};

type LearningMap = {
  title: string;
  nodes: LearningMapNode[];
  edges: LearningMapEdge[];
};

export type LearningPathApiResponse = {
  requestId: string;
  sessionId: string;
  model: string;
  langfuseTracing: boolean;
  orchestration: "langgraph";
  retrievalMode: "repository" | "general";
  workflowSteps: Array<{ id: string; label: string; detail: string }>;
  response: {
    answer: string;
    cards: AdvisorCard[];
    sources: string[];
    suggestedPrompts: string[];
    learningMap: LearningMap;
  };
};

type DisplayMessage = RequestMessage & {
  id: string;
  result?: LearningPathApiResponse;
};

const MAX_REQUEST_MESSAGES = 20;
const MAX_DISPLAY_MESSAGES = 24;
const MAX_WORKFLOW_STEPS = 8;
const MAX_CARDS = 6;
const MAX_SOURCES = 8;
const MAX_SUGGESTED_PROMPTS = 6;
const MAX_MAP_NODES = 8;
const MAX_MAP_EDGES = 12;

const SAMPLE_PROMPTS = [
  "Python parallelism",
  "Build me a path from API testing to contract testing",
  "Help me learn asyncio for test automation",
];

const SAFE_SOURCE_ROUTES: Array<{ prefix: string; href: string }> = [
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

const cardLabels: Record<CardKind, string> = {
  knowledge: "Knowledge",
  learning: "Learn",
  interview: "Practice",
  hint: "Hint",
};

const nodeKindClasses: Record<MapNodeKind, string> = {
  topic: styles.nodeTopic,
  foundation: styles.nodeFoundation,
  concept: styles.nodeConcept,
  practice: styles.nodePractice,
  source: styles.nodeSource,
};

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
  const model = nonEmptyString(value.model);
  const answer = nonEmptyString(value.response.answer);
  const learningMap = value.response.learningMap;
  if (
    !requestId
    || !sessionId
    || !model
    || !answer
    || typeof value.langfuseTracing !== "boolean"
    || value.orchestration !== "langgraph"
    || (value.retrievalMode !== "repository" && value.retrievalMode !== "general")
    || !isRecord(learningMap)
  ) return null;

  const cardKinds = new Set<CardKind>(["knowledge", "learning", "interview", "hint"]);
  const nodeKinds = new Set<MapNodeKind>(["topic", "foundation", "concept", "practice", "source"]);
  const workflowSteps = Array.isArray(value.workflowSteps) ? value.workflowSteps.flatMap((item) => {
    if (!isRecord(item)) return [];
    const id = nonEmptyString(item.id);
    const label = nonEmptyString(item.label);
    const detail = nonEmptyString(item.detail);
    return id && label && detail ? [{ id, label, detail }] : [];
  }).slice(0, MAX_WORKFLOW_STEPS) : [];
  const cards = Array.isArray(value.response.cards) ? value.response.cards.flatMap((item) => {
    if (!isRecord(item)) return [];
    const kind = item.kind as CardKind;
    const title = nonEmptyString(item.title);
    const summary = nonEmptyString(item.summary);
    return cardKinds.has(kind) && title && summary
      ? [{ kind, title, summary, sourcePath: optionalSourcePath(item.sourcePath) }]
      : [];
  }).slice(0, MAX_CARDS) : [];
  const sources = Array.isArray(value.response.sources)
    ? value.response.sources.flatMap((item) => nonEmptyString(item) ?? []).slice(0, MAX_SOURCES)
    : [];
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
      ? Math.max(0, Math.round(item.durationMinutes))
      : null;
    return id && title && summary && nodeKinds.has(kind)
      ? [{ id, title, summary, kind, sourcePath: optionalSourcePath(item.sourcePath), durationMinutes: duration }]
      : [];
  }).slice(0, MAX_MAP_NODES) : [];
  const nodeIds = new Set(nodes.map((node) => node.id));
  const edges = Array.isArray(learningMap.edges) ? learningMap.edges.flatMap((item) => {
    if (!isRecord(item)) return [];
    const source = nonEmptyString(item.source);
    const target = nonEmptyString(item.target);
    const label = nonEmptyString(item.label);
    return source && target && source !== target && label && nodeIds.has(source) && nodeIds.has(target)
      ? [{ source, target, label }]
      : [];
  }).slice(0, MAX_MAP_EDGES) : [];

  return {
    requestId,
    sessionId,
    model,
    langfuseTracing: value.langfuseTracing,
    orchestration: "langgraph",
    retrievalMode: value.retrievalMode,
    workflowSteps,
    response: {
      answer,
      cards,
      sources,
      suggestedPrompts,
      learningMap: {
        title: nonEmptyString(learningMap.title) ?? "Learning map",
        nodes,
        edges,
      },
    },
  };
}

export function sourcePathToHref(sourcePath: string | null): string | null {
  if (!sourcePath) return null;
  let normalized = sourcePath.trim().replaceAll("\\", "/").replace(/^\.\/+/, "");
  if (normalized.startsWith("content/")) normalized = normalized.slice("content/".length);
  if (!normalized || normalized.startsWith("/") || normalized.includes("..") || normalized.includes(":") || normalized.includes("//")) return null;
  return SAFE_SOURCE_ROUTES.find((entry) => normalized.startsWith(entry.prefix))?.href ?? null;
}

function sourceLabel(sourcePath: string): string {
  const normalized = sourcePath.replaceAll("\\", "/");
  return normalized.split("/").filter(Boolean).at(-1) ?? sourcePath;
}

function SourceLink({ sourcePath }: { sourcePath: string }) {
  const href = sourcePathToHref(sourcePath);
  return href ? (
    <Link className={styles.sourceLink} href={href} title={sourcePath}>
      <span>{sourceLabel(sourcePath)}</span><b aria-hidden="true">↗</b>
    </Link>
  ) : <span className={styles.sourceUnavailable} title={sourcePath}>{sourceLabel(sourcePath)}</span>;
}

function ExecutionEvidence({ result }: { result: LearningPathApiResponse }) {
  const repositoryRetrieval = result.retrievalMode === "repository";
  return (
    <section aria-label="AI execution evidence" className={styles.executionPanel}>
      <div className={styles.executionHeading}>
        <div><span>Execution</span><h3>How this answer was built</h3></div>
        <small>{result.model}</small>
      </div>
      <div className={styles.technologyGrid}>
        <article><span>01</span><strong>LangGraph</strong><small>{result.orchestration === "langgraph" ? "Workflow executed" : "Not reported"}</small></article>
        <article><span>02</span><strong>{repositoryRetrieval ? "Git-backed retrieval" : "General model knowledge"}</strong><small>{repositoryRetrieval ? `${result.response.sources.length} repository sources` : "Repository match not used"}</small></article>
        <article><span>03</span><strong>LangChain</strong><small>Structured output validated</small></article>
        <article className={result.langfuseTracing ? styles.traceActive : styles.traceInactive}><span>04</span><strong>Langfuse</strong><small>{result.langfuseTracing ? "Tracing enabled" : "Not traced / not configured"}</small></article>
      </div>
      {result.workflowSteps.length > 0 && (
        <ol aria-label="LangGraph workflow steps" className={styles.workflow}>
          {result.workflowSteps.map((step, index) => (
            <li key={step.id}>
              <span>{String(index + 1).padStart(2, "0")}</span>
              <div><strong>{step.label}</strong><small>{step.detail}</small></div>
              {index < result.workflowSteps.length - 1 && <b aria-hidden="true">→</b>}
            </li>
          ))}
        </ol>
      )}
      <p className={styles.executionMeta}>Request {result.requestId.slice(0, 12)} · Session {result.sessionId.slice(0, 12)}</p>
    </section>
  );
}

function LearningMapView({ learningMap }: { learningMap: LearningMap }) {
  const nodes = learningMap.nodes.slice(0, MAX_MAP_NODES);
  const nodeById = new Map(nodes.map((node) => [node.id, node]));
  const edges = learningMap.edges
    .filter((edge) => edge.source !== edge.target && nodeById.has(edge.source) && nodeById.has(edge.target))
    .slice(0, MAX_MAP_EDGES);

  return (
    <section aria-label={`Connected learning map: ${learningMap.title}`} className={styles.mapPanel}>
      <header className={styles.mapHeader}>
        <div><span>Connected learning map</span><h3>{learningMap.title}</h3></div>
        <small>{nodes.length} nodes · {edges.length} relationships</small>
      </header>

      {edges.length > 0 && (
        <div aria-hidden="true" className={styles.edgeCanvas}>
          {edges.map((edge, index) => {
            const source = nodeById.get(edge.source) as LearningMapNode;
            const target = nodeById.get(edge.target) as LearningMapNode;
            return (
              <div className={styles.edgeFlow} key={`${edge.source}-${edge.target}-${index}`}>
                <span className={styles.edgeNode}>{source.title}</span>
                <span className={styles.edgeArrow}><small>{edge.label}</small><b>→</b></span>
                <span className={styles.edgeNode}>{target.title}</span>
              </div>
            );
          })}
        </div>
      )}

      <div className={styles.nodeGrid}>
        {nodes.map((node, index) => (
          <article className={`${styles.node} ${nodeKindClasses[node.kind]}`} key={node.id}>
            <div className={styles.nodeTopline}>
              <span>{String(index + 1).padStart(2, "0")} · {node.kind}</span>
              {node.durationMinutes !== null && <small>{node.durationMinutes} min</small>}
            </div>
            <h4>{node.title}</h4>
            <p>{node.summary}</p>
            {node.sourcePath && <SourceLink sourcePath={node.sourcePath}/>}
          </article>
        ))}
      </div>

      {edges.length > 0 && (
        <details className={styles.relationships}>
          <summary>Relationship list</summary>
          <ol>
            {edges.map((edge, index) => (
              <li key={`${edge.source}-${edge.target}-accessible-${index}`}>
                <strong>{nodeById.get(edge.source)?.title}</strong>
                <span>{edge.label}</span>
                <strong>{nodeById.get(edge.target)?.title}</strong>
              </li>
            ))}
          </ol>
        </details>
      )}
    </section>
  );
}

export function LearningPathResponseView({ busy = false, onSuggestedPrompt, result }: {
  busy?: boolean;
  onSuggestedPrompt?: (prompt: string) => void;
  result: LearningPathApiResponse;
}) {
  const cards = result.response.cards.slice(0, MAX_CARDS);
  const sources = [...new Set(result.response.sources)].slice(0, MAX_SOURCES);
  const prompts = result.response.suggestedPrompts.slice(0, MAX_SUGGESTED_PROMPTS);
  return (
    <div className={styles.assistantResponse}>
      <div className={styles.assistantLabel}><span aria-hidden="true">AI</span><strong>Learning Path Advisor</strong></div>
      <p className={styles.answerText}>{result.response.answer}</p>
      <ExecutionEvidence result={result}/>
      <LearningMapView learningMap={result.response.learningMap}/>

      {cards.length > 0 && (
        <section aria-label="Recommended learning cards" className={styles.cardGrid}>
          {cards.map((card, index) => (
            <article key={`${card.kind}-${card.title}-${index}`}>
              <span>{cardLabels[card.kind]}</span>
              <h3>{card.title}</h3>
              <p>{card.summary}</p>
              {card.sourcePath && <SourceLink sourcePath={card.sourcePath}/>}
            </article>
          ))}
        </section>
      )}

      {sources.length > 0 && (
        <section aria-label="GimmeJob sources" className={styles.sources}>
          <strong>Sources used</strong>
          <div>{sources.map((source) => <SourceLink key={source} sourcePath={source}/>)}</div>
        </section>
      )}

      {prompts.length > 0 && (
        <section aria-label="Suggested follow-up prompts" className={styles.followUps}>
          <strong>Explore next</strong>
          <div>
            {prompts.map((prompt) => (
              <button disabled={busy} key={prompt} onClick={() => onSuggestedPrompt?.(prompt)} type="button">{prompt}<span aria-hidden="true">→</span></button>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

function messageId(role: ChatRole): string {
  const randomId = typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`;
  return `${role}-${randomId}`;
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
  const [authRequired, setAuthRequired] = useState(false);

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
    setAuthRequired(false);

    try {
      const response = await fetch("/api/ai/learning-path", {
        method: "POST",
        headers: { "content-type": "application/json" },
        cache: "no-store",
        body: JSON.stringify({ messages: requestMessages, ...(sessionId ? { sessionId } : {}) }),
      });
      const payload = await response.json().catch(() => null) as unknown;
      if (!response.ok) {
        const requestError = new Error(apiErrorMessage(payload, "The Learning Path Advisor is temporarily unavailable.")) as Error & { status?: number };
        requestError.status = response.status;
        throw requestError;
      }
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
      const typed = requestError as Error & { status?: number };
      setMessages(previousMessages);
      setDraft(prompt);
      if (typed.status === 401) {
        setAuthRequired(true);
        setError("");
      } else {
        setError(typed.message || "The Learning Path Advisor is temporarily unavailable.");
      }
    } finally {
      setBusy(false);
    }
  }

  function resetConversation() {
    setMessages([]);
    setSessionId("");
    setDraft("");
    setError("");
    setAuthRequired(false);
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
            <div>
              <p>GimmeJob AI · Source-backed learning</p>
              <h1>Learning Path Advisor</h1>
              <span>Ask for a topic. A LangGraph workflow searches GimmeJob&apos;s Git-versioned knowledge, builds a connected learning map, and shows exactly how the answer was produced.</span>
            </div>
            <div className={styles.heroBadge}><span>Workflow</span><strong>Graph → knowledge → path</strong><small>Observable with Langfuse when configured</small></div>
          </header>

          <section aria-label="Learning Path Advisor chat" className={styles.chat}>
            <div className={styles.chatTopline}>
              <div><i aria-hidden="true"/><span>{busy ? "Building your map…" : "Ready for a learning topic"}</span></div>
              {messages.length > 0 && <button disabled={busy} onClick={resetConversation} type="button">New conversation</button>}
            </div>

            <div aria-live="polite" className={styles.conversation}>
              {messages.length === 0 && !busy && (
                <section className={styles.emptyState}>
                  <div className={styles.emptyMark} aria-hidden="true"><span/><span/><span/></div>
                  <p>Start with a skill, concept, or gap. The result is a navigable map rather than a wall of generated text.</p>
                  <div>
                    {SAMPLE_PROMPTS.map((prompt) => <button key={prompt} onClick={() => void sendPrompt(prompt)} type="button">{prompt}<span aria-hidden="true">↗</span></button>)}
                  </div>
                </section>
              )}

              {messages.map((message) => message.role === "user" ? (
                <article className={styles.userTurn} key={message.id}>
                  <span>You</span><p>{message.content}</p>
                </article>
              ) : message.result ? (
                <article className={styles.assistantTurn} key={message.id}>
                  <LearningPathResponseView busy={busy} onSuggestedPrompt={(prompt) => void sendPrompt(prompt)} result={message.result}/>
                </article>
              ) : null)}

              {busy && (
                <div aria-label="Building a source-backed learning map" className={styles.loading} role="status">
                  <span aria-hidden="true"><i/><i/><i/></span>
                  <div><strong>Building your connected learning map</strong><small>Running the workflow and retrieving relevant GimmeJob material…</small></div>
                </div>
              )}
            </div>

            {authRequired && (
              <div className={styles.authBanner} role="alert">
                <div><strong>Sign in to use the Learning Path Advisor.</strong><span>The Worker keeps the AI service token private and applies your authenticated user boundary.</span></div>
                <Link href="/login">Sign in</Link>
              </div>
            )}
            {error && <div className={styles.errorBanner} role="alert"><strong>Could not build the learning map.</strong><span>{error}</span></div>}

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
                placeholder="Ask about a topic — for example, Python parallelism"
                rows={2}
                value={draft}
              />
              <div>
                <span id="learning-path-prompt-help">Enter to send · Shift + Enter for a new line</span>
                <button disabled={busy || !draft.trim()} type="submit">{busy ? "Working…" : "Build learning map"}<b aria-hidden="true">→</b></button>
              </div>
            </form>
          </section>
        </div>
      </section>
      {mobileNav && <button aria-label="Close navigation" className="kb-backdrop" onClick={() => setMobileNav(false)} type="button"/>}
    </main>
  );
}
