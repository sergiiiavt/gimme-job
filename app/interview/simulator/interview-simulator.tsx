"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { AI_ASSISTANT_TOPICS, INTERACTIVE_INTERVIEW_TOPIC, aiAssistantTopicHref } from "../../ai-assistant/assistant-navigation";
import { SiteSidebar } from "../../site-navigation";
import styles from "./interview-simulator.module.css";

type InterviewTrack = "qa" | "python";
type InterviewLanguage = "en" | "uk";
type InterviewStage = "setup" | "question" | "complete";

type InterviewQuestion = {
  id: string;
  question: string;
  track: InterviewTrack;
  category: string;
  level: string;
  prevalence: string;
  kind: string;
};

type InterviewEvaluation = {
  question_id: string;
  score: number;
  rating: "weak" | "partial" | "good" | "strong";
  feedback: string;
  strengths: string[];
  gaps: string[];
  follow_up_question: string | null;
  recommended_topics: string[];
  reference_answer: string;
  strong_answer_signals: string[];
};

type ProgressArea = {
  track: string;
  category: string;
  attempts: number;
  averageScore: number;
  lastAttemptedAt: string;
};

type RecentSession = {
  id: string;
  track: string;
  language: string;
  status: string;
  totalQuestions: number;
  answeredQuestions: number;
  averageScore: number | null;
  updatedAt: string;
};

type ProgressView = {
  persistent: boolean;
  recentSessions: RecentSession[];
  areas: ProgressArea[];
};

type StartResponse = {
  sessionId: string;
  questions: InterviewQuestion[];
  selectedCount: number;
  persistent: boolean;
};

type EvaluateResponse = {
  sessionId: string;
  evaluation: InterviewEvaluation;
  model: string | null;
  langfuseTracing: boolean;
  progress: {
    answered: number;
    total: number;
    averageScore: number;
    complete: boolean;
  } | null;
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

const emptyProgress: ProgressView = { persistent: false, recentSessions: [], areas: [] };
const levelOptions = ["Any", "Junior", "Middle", "Senior", "Lead"] as const;
const countOptions = [5, 10] as const;

async function api<T>(input: RequestInit = {}): Promise<T> {
  const response = await fetch("/api/ai/interviews", {
    ...input,
    headers: {
      "content-type": "application/json",
      "x-gimmejob-session-scope": "ephemeral",
      ...(input.headers ?? {}),
    },
    cache: "no-store",
  });
  const body = await response.json().catch(() => ({})) as { error?: string } & T;
  if (!response.ok) {
    const error = new Error(body.error || "Interview request failed.") as Error & { status?: number };
    error.status = response.status;
    throw error;
  }
  return body;
}

function scoreClass(score: number): string {
  if (score >= 85) return styles.scoreStrong;
  if (score >= 65) return styles.scoreGood;
  if (score >= 40) return styles.scorePartial;
  return styles.scoreWeak;
}

function readableTrack(track: string): string {
  return track === "python" ? "Python" : track === "all" ? "QA + Python" : "QA";
}

function shortDate(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return new Intl.DateTimeFormat(undefined, { day: "numeric", month: "short" }).format(date);
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

export default function InterviewSimulator() {
  const [mobileNav, setMobileNav] = useState(false);
  const [stage, setStage] = useState<InterviewStage>("setup");
  const [track, setTrack] = useState<InterviewTrack>("qa");
  const [language, setLanguage] = useState<InterviewLanguage>("en");
  const [level, setLevel] = useState<(typeof levelOptions)[number]>("Any");
  const [questionCount, setQuestionCount] = useState<(typeof countOptions)[number]>(5);
  const [sessionId, setSessionId] = useState("");
  const [questions, setQuestions] = useState<InterviewQuestion[]>([]);
  const [questionIndex, setQuestionIndex] = useState(0);
  const [answer, setAnswer] = useState("");
  const [evaluation, setEvaluation] = useState<InterviewEvaluation | null>(null);
  const [results, setResults] = useState<InterviewEvaluation[]>([]);
  const [progress, setProgress] = useState<ProgressView>(emptyProgress);
  const [progressLoading, setProgressLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [authRequired, setAuthRequired] = useState(false);
  const [stopped, setStopped] = useState(false);
  const [listening, setListening] = useState(false);
  const [recognition, setRecognition] = useState<SpeechRecognitionLike | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function loadInitialProgress() {
      try {
        const view = await api<ProgressView>({ method: "GET", headers: {} });
        if (cancelled) return;
        setProgress(view);
        setAuthRequired(false);
      } catch (requestError) {
        if (cancelled) return;
        const typed = requestError as Error & { status?: number };
        if (typed.status === 401) setAuthRequired(true);
        else setError(typed.message);
        setProgress(emptyProgress);
      } finally {
        if (!cancelled) setProgressLoading(false);
      }
    }
    void loadInitialProgress();
    return () => { cancelled = true; };
  }, []);

  async function refreshProgress() {
    setProgressLoading(true);
    try {
      const view = await api<ProgressView>({ method: "GET", headers: {} });
      setProgress(view);
      setAuthRequired(false);
    } catch (requestError) {
      const typed = requestError as Error & { status?: number };
      if (typed.status === 401) setAuthRequired(true);
      else setError(typed.message);
      setProgress(emptyProgress);
    } finally {
      setProgressLoading(false);
    }
  }

  const currentQuestion = questions[questionIndex];
  const averageScore = useMemo(() => {
    if (!results.length) return null;
    return Math.round(results.reduce((sum, item) => sum + item.score, 0) / results.length);
  }, [results]);

  const categoryScores = useMemo(() => {
    const byCategory = new Map<string, number[]>();
    questions.forEach((question, index) => {
      const result = results[index];
      if (!result) return;
      const scores = byCategory.get(question.category) ?? [];
      scores.push(result.score);
      byCategory.set(question.category, scores);
    });
    return [...byCategory.entries()]
      .map(([category, scores]) => ({
        category,
        score: Math.round(scores.reduce((sum, value) => sum + value, 0) / scores.length),
      }))
      .sort((left, right) => right.score - left.score);
  }, [questions, results]);

  async function start() {
    setBusy(true);
    setError("");
    try {
      const response = await api<StartResponse>({
        method: "POST",
        body: JSON.stringify({
          action: "start",
          track,
          language,
          questionCount,
          levels: level === "Any" ? [] : [level],
        }),
      });
      setSessionId(response.sessionId);
      setQuestions(response.questions);
      setQuestionIndex(0);
      setAnswer("");
      setEvaluation(null);
      setResults([]);
      setStopped(false);
      setStage("question");
      setAuthRequired(false);
      setProgress((current) => ({ ...current, persistent: response.persistent || current.persistent }));
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch (requestError) {
      const typed = requestError as Error & { status?: number };
      if (typed.status === 401) setAuthRequired(true);
      setError(typed.message);
    } finally {
      setBusy(false);
    }
  }

  async function submit() {
    if (!currentQuestion || !answer.trim()) return;
    setBusy(true);
    setError("");
    try {
      const response = await api<EvaluateResponse>({
        method: "POST",
        body: JSON.stringify({
          action: "evaluate",
          sessionId,
          questionId: currentQuestion.id,
          track: currentQuestion.track,
          language,
          answer,
        }),
      });
      setEvaluation(response.evaluation);
      setResults((current) => [...current, response.evaluation]);
    } catch (requestError) {
      const typed = requestError as Error & { status?: number };
      if (typed.status === 401) setAuthRequired(true);
      setError(typed.message);
    } finally {
      setBusy(false);
    }
  }

  async function next() {
    if (questionIndex >= questions.length - 1) {
      setStage("complete");
      setEvaluation(null);
      setStopped(false);
      await refreshProgress();
      window.scrollTo({ top: 0, behavior: "smooth" });
      return;
    }
    setQuestionIndex((value) => value + 1);
    setAnswer("");
    setEvaluation(null);
    setError("");
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function stopInterview() {
    if (busy) return;
    recognition?.abort();
    setRecognition(null);
    setListening(false);
    setBusy(true);
    setError("");
    try {
      if (sessionId) {
        await api({
          method: "POST",
          body: JSON.stringify({ action: "stop", sessionId }),
        });
      }
      setStopped(true);
      setEvaluation(null);
      setStage("complete");
      await refreshProgress();
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch (requestError) {
      const typed = requestError as Error & { status?: number };
      if (typed.status === 401) setAuthRequired(true);
      setError(typed.message);
    } finally {
      setBusy(false);
    }
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
      if (cleaned) setAnswer((current) => `${current}${current.trim() ? " " : ""}${cleaned}`.slice(0, 20_000));
    };
    instance.onerror = () => {
      setListening(false);
      setRecognition(null);
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

  function reset() {
    recognition?.abort();
    setRecognition(null);
    setListening(false);
    setStage("setup");
    setSessionId("");
    setQuestions([]);
    setQuestionIndex(0);
    setAnswer("");
    setEvaluation(null);
    setResults([]);
    setStopped(false);
    setError("");
    void refreshProgress();
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function selectAssistantTopic(topic: string) {
    setMobileNav(false);
    if (topic !== INTERACTIVE_INTERVIEW_TOPIC) window.location.assign(aiAssistantTopicHref(topic));
  }

  return (
    <main className="kb-shell">
      <SiteSidebar
        activeExternalId="ai-assistant"
        activeSection={null}
        activeSubsection={INTERACTIVE_INTERVIEW_TOPIC}
        mobileOpen={mobileNav}
        mode={progress.persistent ? "personal" : "public"}
        onSelectSubsection={selectAssistantTopic}
        personalHref="/ai-assistant/interview"
        publicHref="/ai-assistant/interview"
        secondaryItems={AI_ASSISTANT_TOPICS}
        secondaryTitle="AI Assistant"
      />

      <section className="kb-main">
        <button
          aria-expanded={mobileNav}
          aria-label="Toggle navigation"
          className="kb-floating-menu"
          onClick={() => setMobileNav((value) => !value)}
          type="button"
        >☰</button>

        <div className={`kb-content ${styles.page}`}>
          {stage === "setup" && (
            <header className={styles.hero} style={{ marginBottom: 18 }}>
              <div>
                <p className={styles.eyebrow}>GimmeJob AI</p>
                <h1 style={{ fontSize: "clamp(26px, 3.5vw, 36px)", marginBottom: 0 }}>AI interview</h1>
              </div>
              <Link className={styles.questionBankLink} href="/interview">Question bank</Link>
            </header>
          )}

          {authRequired && (
            <div className={styles.authBanner}>
              <div>
                <strong>Sign in to run an AI interview.</strong>
                <span>Public session access could not be established. Signing in also saves your progress.</span>
              </div>
              <Link href="/login">Sign in</Link>
            </div>
          )}
          {error && <div className={styles.errorBanner} role="alert">{error}</div>}

          {stage === "setup" && (
            <div className={styles.setupGrid} style={progress.persistent ? undefined : { gridTemplateColumns: "1fr" }}>
              <section className={styles.panel}>
                <div className={styles.panelHeader}>
                  <div><h2 style={{ marginTop: 0 }}>Configure interview</h2></div>
                </div>
                <div className={styles.formGrid}>
                  <fieldset className={styles.fieldset}>
                    <legend>Track</legend>
                    <div className={styles.segmented}>
                      <button className={track === "qa" ? styles.selected : ""} onClick={() => setTrack("qa")} type="button">QA</button>
                      <button className={track === "python" ? styles.selected : ""} onClick={() => setTrack("python")} type="button">Python</button>
                    </div>
                  </fieldset>
                  <label className={styles.field}>
                    <span>Level</span>
                    <select onChange={(event) => setLevel(event.target.value as (typeof levelOptions)[number])} value={level}>
                      {levelOptions.map((option) => <option key={option} value={option}>{option}</option>)}
                    </select>
                  </label>
                  <fieldset className={styles.fieldset}>
                    <legend>Questions</legend>
                    <div className={styles.segmented}>
                      {countOptions.map((count) => <button className={questionCount === count ? styles.selected : ""} key={count} onClick={() => setQuestionCount(count)} type="button">{count}</button>)}
                    </div>
                  </fieldset>
                  <fieldset className={styles.fieldset}>
                    <legend>Language</legend>
                    <div className={styles.segmented}>
                      <button className={language === "en" ? styles.selected : ""} onClick={() => setLanguage("en")} type="button">EN</button>
                      <button className={language === "uk" ? styles.selected : ""} onClick={() => setLanguage("uk")} type="button">UA</button>
                    </div>
                  </fieldset>
                </div>
                <button className={styles.primaryButton} disabled={busy || authRequired} onClick={() => void start()} type="button">
                  {busy ? "Starting…" : `Start ${questionCount}-question interview`}
                </button>
                {!progress.persistent && <p className={styles.helper}>Public session · results disappear when the session ends. Sign in to keep progress.</p>}
              </section>

              {progress.persistent && (
                <section className={styles.panel}>
                  <div className={styles.panelHeader}>
                    <div><p className={styles.kicker}>Progress</p><h2>Areas to practice</h2></div>
                    <span className={styles.savedBadge}>Saved</span>
                  </div>
                  {progressLoading ? (
                    <div className={styles.emptyState}>Loading interview history…</div>
                  ) : progress.areas.length ? (
                    <div className={styles.areaList}>
                      {progress.areas.slice(0, 6).map((area) => (
                        <div className={styles.areaRow} key={`${area.track}-${area.category}`}>
                          <div><strong>{area.category}</strong><span>{readableTrack(area.track)} · {area.attempts} answer{area.attempts === 1 ? "" : "s"}</span></div>
                          <span className={`${styles.miniScore} ${scoreClass(area.averageScore)}`}>{area.averageScore}%</span>
                        </div>
                      ))}
                    </div>
                  ) : <div className={styles.emptyState}>Your weakest categories will appear here after an interview.</div>}
                  {progress.recentSessions.length > 0 && (
                    <div className={styles.recentBlock}>
                      <h3>Recent interviews</h3>
                      {progress.recentSessions.slice(0, 3).map((session) => (
                        <div className={styles.recentRow} key={session.id}>
                          <span>{readableTrack(session.track)} · {session.answeredQuestions}/{session.totalQuestions}</span>
                          <span>{session.averageScore === null ? "—" : `${session.averageScore}%`} · {shortDate(session.updatedAt)}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </section>
              )}
            </div>
          )}

          {stage === "question" && currentQuestion && (
            <section className={styles.interviewLayout}>
              <div className={styles.sessionTopline}>
                <div><span>{readableTrack(currentQuestion.track)}</span><span>{currentQuestion.level}</span><span>{currentQuestion.category}</span></div>
                <span style={{ alignItems: "center", display: "flex", gap: 10 }}>
                  <strong>{questionIndex + 1} / {questions.length}</strong>
                  <button className={styles.secondaryButton} disabled={busy} onClick={() => void stopInterview()} style={{ minHeight: 32, padding: "0 10px" }} type="button">Stop</button>
                </span>
              </div>
              <div className={styles.progressBar} aria-label={`Question ${questionIndex + 1} of ${questions.length}`}>
                <span style={{ width: `${((questionIndex + (evaluation ? 1 : 0)) / questions.length) * 100}%` }}/>
              </div>
              <article className={styles.questionCard}>
                <h2>{currentQuestion.question}</h2>
                {!evaluation ? (
                  <>
                    <label className={styles.answerField}>
                      <span>Your answer</span>
                      <textarea autoFocus maxLength={20_000} onChange={(event) => setAnswer(event.target.value)} placeholder="Answer as you would in a real interview." rows={8} value={answer}/>
                    </label>
                    <div className={styles.answerActions}>
                      <span>{answer.length.toLocaleString()} / 20,000</span>
                      <div style={{ display: "flex", gap: 8 }}>
                        <button
                          aria-label={listening ? "Stop voice input" : "Dictate answer"}
                          aria-pressed={listening}
                          className={styles.secondaryButton}
                          disabled={busy}
                          onClick={toggleDictation}
                          style={{ minHeight: 42, minWidth: 42, padding: 0 }}
                          title={listening ? "Stop voice input" : "Dictate answer"}
                          type="button"
                        >
                          <MicrophoneIcon/>
                        </button>
                        <button className={styles.primaryButton} disabled={busy || !answer.trim()} onClick={() => void submit()} type="button">{busy ? "Evaluating…" : "Submit answer"}</button>
                      </div>
                    </div>
                  </>
                ) : (
                  <div className={styles.evaluation}>
                    <div className={styles.scoreHeader}>
                      <div className={`${styles.score} ${scoreClass(evaluation.score)}`}><strong>{evaluation.score}</strong><span>/100</span></div>
                      <div><p className={styles.rating}>{evaluation.rating}</p><p>{evaluation.feedback}</p></div>
                    </div>
                    <div className={styles.feedbackGrid}>
                      <div className={styles.feedbackCard}><h3>What was strong</h3>{evaluation.strengths.length ? <ul>{evaluation.strengths.map((item) => <li key={item}>{item}</li>)}</ul> : <p>No clear strength identified yet.</p>}</div>
                      <div className={styles.feedbackCard}><h3>What to improve</h3>{evaluation.gaps.length ? <ul>{evaluation.gaps.map((item) => <li key={item}>{item}</li>)}</ul> : <p>No material gap identified.</p>}</div>
                    </div>
                    <details className={styles.referenceAnswer}>
                      <summary>Reference answer</summary>
                      <p>{evaluation.reference_answer}</p>
                      {evaluation.strong_answer_signals.length > 0 && <div className={styles.signalList}>{evaluation.strong_answer_signals.map((signal) => <span key={signal}>{signal}</span>)}</div>}
                    </details>
                    {evaluation.follow_up_question && <div className={styles.followUp}><span>Likely follow-up</span><strong>{evaluation.follow_up_question}</strong></div>}
                    {evaluation.recommended_topics.length > 0 && <div className={styles.topicList}><span>Review next</span><div>{evaluation.recommended_topics.map((topic) => <span key={topic}>{topic}</span>)}</div></div>}
                    <div className={styles.nextRow}>
                      <span>{progress.persistent ? "Saved to your progress." : "Kept in this session only."}</span>
                      <button className={styles.primaryButton} onClick={() => void next()} type="button">{questionIndex === questions.length - 1 ? "Finish interview" : "Next question"}</button>
                    </div>
                  </div>
                )}
              </article>
            </section>
          )}

          {stage === "complete" && (
            <section className={styles.completeCard}>
              <p className={styles.kicker}>{stopped ? "Interview stopped" : "Interview complete"}</p>
              <div className={styles.completeHeadline}>
                <div className={`${styles.finalScore} ${scoreClass(averageScore ?? 0)}`}><strong>{averageScore ?? 0}</strong><span>/100 average</span></div>
                <div><h2>{readableTrack(track)} interview result</h2><p>{results.length} answer{results.length === 1 ? "" : "s"} evaluated. {progress.persistent ? "Saved to your progress history." : "This result exists only in the current session."}</p></div>
              </div>
              <div className={styles.summaryGrid}>
                <div>
                  <h3>Strongest areas</h3>
                  {categoryScores.filter((item) => item.score >= 65).slice(0, 4).map((item) => <div className={styles.summaryRow} key={item.category}><span>{item.category}</span><strong>{item.score}%</strong></div>)}
                  {!categoryScores.some((item) => item.score >= 65) && <p className={styles.muted}>No area reached 65% in this session.</p>}
                </div>
                <div>
                  <h3>Focus next</h3>
                  {categoryScores.filter((item) => item.score < 65).slice(0, 4).map((item) => <div className={styles.summaryRow} key={item.category}><span>{item.category}</span><strong>{item.score}%</strong></div>)}
                  {!categoryScores.some((item) => item.score < 65) && <p className={styles.muted}>No weak category in this session.</p>}
                </div>
              </div>
              <div className={styles.completeActions}>
                <Link className={styles.secondaryButton} href="/interview">Question bank</Link>
                <button className={styles.primaryButton} onClick={reset} type="button">Start another interview</button>
              </div>
            </section>
          )}
        </div>
      </section>
      {mobileNav && <button aria-label="Close navigation" className="kb-backdrop" onClick={() => setMobileNav(false)}/>} 
    </main>
  );
}