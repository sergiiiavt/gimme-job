"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
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

const emptyProgress: ProgressView = { persistent: false, recentSessions: [], areas: [] };
const levelOptions = ["Any", "Junior", "Middle", "Senior", "Lead"] as const;
const countOptions = [5, 10] as const;

async function api<T>(input: RequestInit = {}): Promise<T> {
  const response = await fetch("/api/ai/interviews", {
    ...input,
    headers: { "content-type": "application/json", ...(input.headers ?? {}) },
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
      setStage("question");
      setAuthRequired(false);
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

  function reset() {
    setStage("setup");
    setSessionId("");
    setQuestions([]);
    setQuestionIndex(0);
    setAnswer("");
    setEvaluation(null);
    setResults([]);
    setError("");
    void refreshProgress();
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  return (
    <main className="kb-shell">
      <SiteSidebar
        activeSection="interview"
        activeSubsection=""
        hideSecondary
        mobileOpen={mobileNav}
        mode="personal"
        onSelectSubsection={() => undefined}
        secondaryItems={[]}
        secondaryTitle="Interview simulator"
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
          <header className={styles.hero}>
            <div>
              <p className={styles.eyebrow}>GimmeJob AI · Interview</p>
              <h1>Interview simulator</h1>
              <p className={styles.lead}>Answer real questions from the GimmeJob catalog. AI evaluates the answer against maintained reference material and remembers your weak areas.</p>
            </div>
            <Link className={styles.questionBankLink} href="/interview">Question bank</Link>
          </header>

          {authRequired && (
            <div className={styles.authBanner}>
              <div>
                <strong>Sign in to run an AI interview.</strong>
                <span>Your attempts and skill progress are private and stored per account.</span>
              </div>
              <Link href="/login">Sign in</Link>
            </div>
          )}
          {error && <div className={styles.errorBanner} role="alert">{error}</div>}

          {stage === "setup" && (
            <div className={styles.setupGrid}>
              <section className={styles.panel}>
                <div className={styles.panelHeader}>
                  <div><p className={styles.kicker}>New session</p><h2>Configure interview</h2></div>
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
                <p className={styles.helper}>Questions are weighted toward common interview topics. Reference answers stay hidden until you submit your answer.</p>
              </section>

              <section className={styles.panel}>
                <div className={styles.panelHeader}>
                  <div><p className={styles.kicker}>Progress memory</p><h2>Areas to practice</h2></div>
                  {progress.persistent && <span className={styles.savedBadge}>Saved</span>}
                </div>
                {progressLoading ? (
                  <div className={styles.emptyState}>Loading your interview history…</div>
                ) : progress.areas.length ? (
                  <div className={styles.areaList}>
                    {progress.areas.slice(0, 6).map((area) => (
                      <div className={styles.areaRow} key={`${area.track}-${area.category}`}>
                        <div><strong>{area.category}</strong><span>{readableTrack(area.track)} · {area.attempts} answer{area.attempts === 1 ? "" : "s"}</span></div>
                        <span className={`${styles.miniScore} ${scoreClass(area.averageScore)}`}>{area.averageScore}%</span>
                      </div>
                    ))}
                  </div>
                ) : <div className={styles.emptyState}>Complete an interview and your weakest categories will appear here.</div>}
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
            </div>
          )}

          {stage === "question" && currentQuestion && (
            <section className={styles.interviewLayout}>
              <div className={styles.sessionTopline}>
                <div><span>{readableTrack(currentQuestion.track)}</span><span>{currentQuestion.level}</span><span>{currentQuestion.category}</span></div>
                <strong>{questionIndex + 1} / {questions.length}</strong>
              </div>
              <div className={styles.progressBar} aria-label={`Question ${questionIndex + 1} of ${questions.length}`}>
                <span style={{ width: `${((questionIndex + (evaluation ? 1 : 0)) / questions.length) * 100}%` }}/>
              </div>
              <article className={styles.questionCard}>
                <div className={styles.questionMeta}><span>{currentQuestion.prevalence}</span><span>{currentQuestion.kind}</span></div>
                <h2>{currentQuestion.question}</h2>
                {!evaluation ? (
                  <>
                    <label className={styles.answerField}>
                      <span>Your answer</span>
                      <textarea autoFocus maxLength={20_000} onChange={(event) => setAnswer(event.target.value)} placeholder="Answer as you would in a real interview. A concise answer is fine if it covers the key points." rows={9} value={answer}/>
                    </label>
                    <div className={styles.answerActions}>
                      <span>{answer.length.toLocaleString()} / 20,000</span>
                      <button className={styles.primaryButton} disabled={busy || !answer.trim()} onClick={() => void submit()} type="button">{busy ? "Evaluating…" : "Submit answer"}</button>
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
                      <span>Answer saved to your interview progress.</span>
                      <button className={styles.primaryButton} onClick={() => void next()} type="button">{questionIndex === questions.length - 1 ? "Finish interview" : "Next question"}</button>
                    </div>
                  </div>
                )}
              </article>
            </section>
          )}

          {stage === "complete" && (
            <section className={styles.completeCard}>
              <p className={styles.kicker}>Interview complete</p>
              <div className={styles.completeHeadline}>
                <div className={`${styles.finalScore} ${scoreClass(averageScore ?? 0)}`}><strong>{averageScore ?? 0}</strong><span>/100 average</span></div>
                <div><h2>{readableTrack(track)} interview result</h2><p>{results.length} answers evaluated. These results are now part of your progress history.</p></div>
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
                <Link className={styles.secondaryButton} href="/interview">Review question bank</Link>
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
