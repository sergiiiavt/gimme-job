"use client";

import { useEffect, useMemo, useState } from "react";
import {
  OFFICIAL_ADDITIONAL_KEYS,
  OFFICIAL_MAIN_PASSING_SCORE,
  OFFICIAL_MAIN_QUESTIONS,
  OFFICIAL_MAIN_TOTAL_POINTS,
  sameSelection,
  scoreOfficialAdditional,
  scoreOfficialMain,
  type OfficialAdditionalAnswers,
  type OfficialMainAnswers,
  type OfficialSampleOption,
} from "./istqb-ai-official-sample-model";
import MarkdownDocument from "./qa-markdown";
import styles from "./istqb-ai-official-sample-companion.module.css";

const OFFICIAL_QUESTIONS_URL = "https://istqb.org/?download_id=9561&sdm_process_download=1";
const OFFICIAL_ANSWERS_URL = "https://istqb.org/?download_id=9564&sdm_process_download=1";
const EXAM_SECONDS = 60 * 60;
const OPTION_KEYS: OfficialSampleOption[] = ["a", "b", "c", "d", "e"];
const A1_VALUES = ["narrow", "general", "super"];
const A4_VALUES = ["association", "classification", "reinforcement", "regression"];

interface Props {
  markdown: string;
  language: "en" | "uk";
}

const copy = {
  en: {
    title: "Interactive answer sheet",
    intro: "Read the exact question wording in the official ISTQB PDF above, then record your answers here. GimmeJob does not republish the question text.",
    pdfTitle: "Official ISTQB CT-AI v2.2 questions",
    pdfFallback: "If the PDF viewer is blocked by your browser, open the official questions in a new tab.",
    openQuestions: "Open questions PDF",
    openAnswers: "Open answers PDF",
    answered: "answered",
    timer: "60-minute timer",
    start: "Start",
    pause: "Pause",
    resetTimer: "Reset timer",
    selectOne: "select 1",
    selectTwo: "select 2",
    checkMain: "Check 40-question score",
    resetMain: "Reset main answers",
    mainTitle: "Main official sample · Questions 1–40",
    mainNote: "The main sample uses the official 44-point structure. Passing threshold: 29 / 44.",
    correct: "Correct",
    correctAnswer: "Correct answer",
    result: "Result",
    pass: "Pass threshold reached",
    belowPass: "Below the 29-point threshold",
    incomplete: "Unanswered or incomplete questions count as incorrect in this check.",
    additionalTitle: "Additional official questions · A1–A6",
    additionalNote: "These six are extra official examples and are scored separately from the 44-point main sample.",
    usePdf: "Use the corresponding question in the official PDF.",
    example: "Example",
    item: "Item",
    position: "Position",
    earliest: "earliest",
    latest: "latest",
    choose: "Choose…",
    checkAdditional: "Check extra 6",
    resetAdditional: "Reset extra answers",
    extraResult: "Extra result",
    rights: "Question wording and explanations remain in the ISTQB-hosted PDFs. This page stores only your selections in component state; nothing is persisted.",
  },
  uk: {
    title: "Інтерактивний бланк відповідей",
    intro: "Читай точне формулювання запитань в офіційному PDF ISTQB вище та фіксуй відповіді тут. GimmeJob не передруковує текст запитань.",
    pdfTitle: "Офіційні запитання ISTQB CT-AI v2.2",
    pdfFallback: "Якщо браузер блокує вбудований PDF, відкрий офіційні запитання в новій вкладці.",
    openQuestions: "Відкрити PDF із запитаннями",
    openAnswers: "Відкрити PDF із відповідями",
    answered: "відповідано",
    timer: "Таймер 60 хвилин",
    start: "Старт",
    pause: "Пауза",
    resetTimer: "Скинути таймер",
    selectOne: "обери 1",
    selectTwo: "обери 2",
    checkMain: "Перевірити результат 40 запитань",
    resetMain: "Скинути основні відповіді",
    mainTitle: "Основний офіційний sample · Запитання 1–40",
    mainNote: "Основний sample використовує офіційну структуру на 44 бали. Прохідний поріг: 29 / 44.",
    correct: "Правильно",
    correctAnswer: "Правильна відповідь",
    result: "Результат",
    pass: "Прохідний поріг досягнуто",
    belowPass: "Нижче порогу 29 балів",
    incomplete: "Незаповнені або неповні відповіді в цій перевірці рахуються як неправильні.",
    additionalTitle: "Додаткові офіційні запитання · A1–A6",
    additionalNote: "Ці шість запитань є додатковими офіційними прикладами й оцінюються окремо від основного набору на 44 бали.",
    usePdf: "Використовуй відповідне запитання в офіційному PDF.",
    example: "Приклад",
    item: "Елемент",
    position: "Позиція",
    earliest: "найраніше",
    latest: "найпізніше",
    choose: "Обери…",
    checkAdditional: "Перевірити додаткові 6",
    resetAdditional: "Скинути додаткові відповіді",
    extraResult: "Додатковий результат",
    rights: "Формулювання запитань і пояснення залишаються в PDF, розміщених ISTQB. Ця сторінка зберігає вибір лише у стані компонента; нічого не зберігається постійно.",
  },
};

function formatTime(seconds: number): string {
  const minutes = Math.floor(seconds / 60);
  const remainder = seconds % 60;
  return `${String(minutes).padStart(2, "0")}:${String(remainder).padStart(2, "0")}`;
}

function emptyAdditionalAnswers(): OfficialAdditionalAnswers {
  return {
    A1: Array(5).fill(""),
    A2: [],
    A3: [],
    A4: Array(4).fill(""),
    A5: Array(5).fill(""),
    A6: [],
  };
}

export default function IstqbAiOfficialSampleCompanion({ markdown, language }: Props) {
  const text = copy[language];
  const [mainAnswers, setMainAnswers] = useState<OfficialMainAnswers>({});
  const [mainSubmitted, setMainSubmitted] = useState(false);
  const [additionalAnswers, setAdditionalAnswers] = useState<OfficialAdditionalAnswers>(emptyAdditionalAnswers);
  const [additionalSubmitted, setAdditionalSubmitted] = useState(false);
  const [timerRunning, setTimerRunning] = useState(false);
  const [remainingSeconds, setRemainingSeconds] = useState(EXAM_SECONDS);

  useEffect(() => {
    if (!timerRunning) return undefined;
    const timer = window.setInterval(() => {
      setRemainingSeconds((current) => Math.max(0, current - 1));
    }, 1000);
    return () => window.clearInterval(timer);
  }, [timerRunning]);

  const answeredCount = useMemo(
    () => OFFICIAL_MAIN_QUESTIONS.filter((question) => (mainAnswers[question.number]?.length ?? 0) === question.correct.length).length,
    [mainAnswers],
  );
  const mainScore = useMemo(() => scoreOfficialMain(mainAnswers), [mainAnswers]);
  const extraScore = useMemo(() => scoreOfficialAdditional(additionalAnswers), [additionalAnswers]);

  const selectMainAnswer = (number: number, option: OfficialSampleOption) => {
    const question = OFFICIAL_MAIN_QUESTIONS.find((candidate) => candidate.number === number);
    if (!question) return;

    setMainAnswers((current) => {
      const existing = current[number] ?? [];
      if (question.correct.length === 1) return { ...current, [number]: [option] };
      if (existing.includes(option)) return { ...current, [number]: existing.filter((value) => value !== option) };
      if (existing.length >= question.correct.length) return current;
      return { ...current, [number]: [...existing, option] };
    });
    setMainSubmitted(false);
  };

  const setAdditionalValue = (id: keyof typeof OFFICIAL_ADDITIONAL_KEYS, index: number, value: string) => {
    setAdditionalAnswers((current) => {
      const expectedLength = OFFICIAL_ADDITIONAL_KEYS[id].length;
      const next = [...(current[id] ?? Array(expectedLength).fill(""))];
      next[index] = value;
      return { ...current, [id]: next };
    });
    setAdditionalSubmitted(false);
  };

  const resetMain = () => {
    setMainAnswers({});
    setMainSubmitted(false);
  };

  const resetAdditional = () => {
    setAdditionalAnswers(emptyAdditionalAnswers());
    setAdditionalSubmitted(false);
  };

  const resetTimer = () => {
    setTimerRunning(false);
    setRemainingSeconds(EXAM_SECONDS);
  };

  const feedback = (id: keyof typeof OFFICIAL_ADDITIONAL_KEYS) => {
    if (!additionalSubmitted) return null;
    const expected = OFFICIAL_ADDITIONAL_KEYS[id];
    const isCorrect = sameSelection(additionalAnswers[id], expected);
    return (
      <span className={isCorrect ? styles.correctText : styles.incorrectText}>
        {isCorrect ? text.correct : `${text.correctAnswer}: ${expected.join(" · ")}`}
      </span>
    );
  };

  return (
    <div className={styles.root}>
      <MarkdownDocument markdown={markdown}/>

      <section className={styles.companion} id="official-sample-companion">
        <div className={styles.companionHeader}>
          <div>
            <span className={styles.eyebrow}>ISTQB CT-AI v2.2</span>
            <h2>{text.title}</h2>
            <p>{text.intro}</p>
          </div>
          <div className={styles.sourceActions}>
            <a href={OFFICIAL_QUESTIONS_URL} rel="noreferrer" target="_blank">{text.openQuestions}</a>
            <a href={OFFICIAL_ANSWERS_URL} rel="noreferrer" target="_blank">{text.openAnswers}</a>
          </div>
        </div>

        <div className={styles.pdfPanel}>
          <iframe
            className={styles.pdfFrame}
            loading="lazy"
            referrerPolicy="no-referrer"
            src={OFFICIAL_QUESTIONS_URL}
            title={text.pdfTitle}
          />
          <p className={styles.pdfFallback}>{text.pdfFallback} <a href={OFFICIAL_QUESTIONS_URL} rel="noreferrer" target="_blank">{text.openQuestions}</a></p>
        </div>

        <section className={styles.answerSheet} id="official-sample-main">
          <div className={styles.sectionHeader}>
            <div>
              <h2>{text.mainTitle}</h2>
              <p>{text.mainNote}</p>
            </div>
            <div className={styles.timer}>
              <span>{text.timer}</span>
              <strong>{formatTime(remainingSeconds)}</strong>
              <div>
                <button onClick={() => setTimerRunning((current) => !current)} type="button">
                  {timerRunning ? text.pause : text.start}
                </button>
                <button className={styles.secondaryButton} onClick={resetTimer} type="button">{text.resetTimer}</button>
              </div>
            </div>
          </div>

          <div className={styles.progress} aria-label={`${answeredCount} / 40 ${text.answered}`}>
            <div><strong>{answeredCount}</strong> / 40 {text.answered}</div>
            <div className={styles.progressTrack} aria-hidden="true"><span style={{ width: `${answeredCount * 2.5}%` }}/></div>
          </div>

          <div className={styles.questionGroups}>
            {[0, 10, 20, 30].map((offset) => (
              <section className={styles.questionGroup} key={offset}>
                <h3>{offset + 1}–{offset + 10}</h3>
                {OFFICIAL_MAIN_QUESTIONS.slice(offset, offset + 10).map((question) => {
                  const selected = mainAnswers[question.number] ?? [];
                  const correct = sameSelection(selected, question.correct);
                  return (
                    <div className={`${styles.questionRow} ${mainSubmitted ? (correct ? styles.correctRow : styles.incorrectRow) : ""}`} id={`official-question-${question.number}`} key={question.number}>
                      <div className={styles.questionMeta}>
                        <strong>Q{question.number}</strong>
                        <span>{question.points} pt · {question.correct.length === 2 ? text.selectTwo : text.selectOne}</span>
                      </div>
                      <div className={styles.optionButtons} role="group" aria-label={`Question ${question.number}`}>
                        {OPTION_KEYS.slice(0, question.optionCount).map((option) => (
                          <button
                            aria-pressed={selected.includes(option)}
                            className={selected.includes(option) ? styles.selectedChoice : ""}
                            key={option}
                            onClick={() => selectMainAnswer(question.number, option)}
                            type="button"
                          >
                            {option.toUpperCase()}
                          </button>
                        ))}
                      </div>
                      {mainSubmitted ? (
                        <span className={correct ? styles.correctText : styles.incorrectText}>
                          {correct ? text.correct : `${text.correctAnswer}: ${question.correct.map((value) => value.toUpperCase()).join(" + ")}`}
                        </span>
                      ) : null}
                    </div>
                  );
                })}
              </section>
            ))}
          </div>

          <div className={styles.actionBar}>
            <div>
              <strong>{answeredCount} / 40 {text.answered}</strong>
              <span>{text.incomplete}</span>
            </div>
            <div>
              <button onClick={() => setMainSubmitted(true)} type="button">{text.checkMain}</button>
              <button className={styles.secondaryButton} onClick={resetMain} type="button">{text.resetMain}</button>
            </div>
          </div>

          {mainSubmitted ? (
            <div className={styles.result} aria-live="polite">
              <div>
                <span>{text.result}</span>
                <strong>{mainScore.points}<small> / {OFFICIAL_MAIN_TOTAL_POINTS}</small></strong>
                <span>{mainScore.correctQuestions} / 40</span>
              </div>
              <div>
                <h3>{mainScore.points >= OFFICIAL_MAIN_PASSING_SCORE ? text.pass : text.belowPass}</h3>
                <p>{text.mainNote}</p>
              </div>
            </div>
          ) : null}
        </section>

        <section className={styles.additional} id="official-sample-additional">
          <div className={styles.sectionHeader}>
            <div>
              <h2>{text.additionalTitle}</h2>
              <p>{text.additionalNote}</p>
            </div>
          </div>

          <div className={styles.additionalQuestion}>
            <div className={styles.additionalHeading}><strong>A1</strong><span>{text.usePdf}</span>{feedback("A1")}</div>
            <div className={styles.selectGrid}>
              {Array.from({ length: 5 }, (_, index) => (
                <label key={index}>{text.example} {index + 1}
                  <select value={additionalAnswers.A1?.[index] ?? ""} onChange={(event) => setAdditionalValue("A1", index, event.target.value)}>
                    <option value="">{text.choose}</option>
                    {A1_VALUES.map((value) => <option key={value} value={value}>{value}</option>)}
                  </select>
                </label>
              ))}
            </div>
          </div>

          {(["A2", "A3", "A6"] as const).map((id) => (
            <div className={styles.additionalQuestion} key={id}>
              <div className={styles.additionalHeading}><strong>{id}</strong><span>{text.usePdf}</span>{feedback(id)}</div>
              <div className={styles.optionButtons} role="group" aria-label={`Question ${id}`}>
                {OPTION_KEYS.slice(0, 4).map((option) => (
                  <button
                    aria-pressed={additionalAnswers[id]?.[0] === option}
                    className={additionalAnswers[id]?.[0] === option ? styles.selectedChoice : ""}
                    key={option}
                    onClick={() => setAdditionalValue(id, 0, option)}
                    type="button"
                  >{option.toUpperCase()}</button>
                ))}
              </div>
            </div>
          ))}

          <div className={styles.additionalQuestion}>
            <div className={styles.additionalHeading}><strong>A4</strong><span>{text.usePdf}</span>{feedback("A4")}</div>
            <div className={styles.selectGrid}>
              {Array.from({ length: 4 }, (_, index) => (
                <label key={index}>{text.example} {index + 1}
                  <select value={additionalAnswers.A4?.[index] ?? ""} onChange={(event) => setAdditionalValue("A4", index, event.target.value)}>
                    <option value="">{text.choose}</option>
                    {A4_VALUES.map((value) => <option key={value} value={value}>{value}</option>)}
                  </select>
                </label>
              ))}
            </div>
          </div>

          <div className={styles.additionalQuestion}>
            <div className={styles.additionalHeading}><strong>A5</strong><span>{text.usePdf}</span>{feedback("A5")}</div>
            <div className={styles.selectGrid}>
              {Array.from({ length: 5 }, (_, index) => (
                <label key={index}>{text.position} {index + 1}{index === 0 ? ` (${text.earliest})` : index === 4 ? ` (${text.latest})` : ""}
                  <select value={additionalAnswers.A5?.[index] ?? ""} onChange={(event) => setAdditionalValue("A5", index, event.target.value)}>
                    <option value="">{text.choose}</option>
                    {["1", "2", "3", "4", "5"].map((value) => <option key={value} value={value}>{text.item} {value}</option>)}
                  </select>
                </label>
              ))}
            </div>
          </div>

          <div className={styles.actionBar}>
            <div><strong>{text.additionalTitle}</strong><span>{text.additionalNote}</span></div>
            <div>
              <button onClick={() => setAdditionalSubmitted(true)} type="button">{text.checkAdditional}</button>
              <button className={styles.secondaryButton} onClick={resetAdditional} type="button">{text.resetAdditional}</button>
            </div>
          </div>

          {additionalSubmitted ? (
            <div className={styles.extraResult} aria-live="polite"><strong>{text.extraResult}: {extraScore} / 6</strong></div>
          ) : null}
        </section>

        <p className={styles.rightsNote}>{text.rights}</p>
      </section>
    </div>
  );
}
