"use client";

import { useMemo, useState } from "react";
import {
  evaluateMockExam,
  MOCK_EXAM_GROUP_SIZE,
  parseIstqbAiMockExam,
  scoreIstqbAiMockExam,
  type AnswerKey,
  type MockExamAnswers,
  type MockExamEvaluationTexts,
} from "./istqb-ai-mock-exam-model";
import MarkdownDocument from "./qa-markdown";
import styles from "./istqb-ai-mock-exam.module.css";

const GROUP_SIZE = MOCK_EXAM_GROUP_SIZE;
const examCopy = {
  en: {
    progress: "Mock exam progress", answered: "answered", questions: "Questions", correct: "Correct",
    incorrect: "Incorrect · correct answer:", ready: "Ready to evaluate?", check: "Check score",
    score: "Practice score", evaluation: "Evaluation", retry: "Retry exam",
    strong: "Strong", close: "Close", gaps: "Material gaps remain", more: "More preparation needed",
  },
  uk: {
    progress: "Прогрес тесту", answered: "відповідей", questions: "Запитання", correct: "Правильно",
    incorrect: "Неправильно · правильна відповідь:", ready: "Готові перевірити?", check: "Перевірити",
    score: "Навчальний бал", evaluation: "Оцінка", retry: "Повторити",
    strong: "Упевнено", close: "Близько", gaps: "Залишилися суттєві прогалини", more: "Потрібна додаткова підготовка",
  },
};
const ukrainianEvaluation: MockExamEvaluationTexts = {
  strong: "Поясніть невпевнені відповіді й перевірте себе за актуальними офіційними матеріалами.",
  close: "Повторіть теми за помилками та розв’яжіть нові приклади.",
  gaps: "Виконайте практичні вправи зі слабких тем перед наступною спробою.",
  more: "Поверніться до послідовності тем і незалежних очікуваних результатів.",
};

const CT_AI_SCORE_NOTE = "This mock uses one question = one practice mark and is not directly convertible to the official 44-point CT-AI exam score.";

export default function IstqbAiMockExam({
  evaluationTexts,
  language = "en",
  markdown,
  scoreNote = CT_AI_SCORE_NOTE,
}: {
  evaluationTexts?: MockExamEvaluationTexts;
  language?: "en" | "uk";
  markdown: string;
  scoreNote?: string;
}) {
  const exam = useMemo(() => parseIstqbAiMockExam(markdown), [markdown]);
  const [answers, setAnswers] = useState<MockExamAnswers>({});
  const [submitted, setSubmitted] = useState(false);
  const [validationMessage, setValidationMessage] = useState("");
  const answeredCount = Object.keys(answers).length;
  const score = submitted ? scoreIstqbAiMockExam(exam.questions, answers) : 0;
  const uk = language === "uk";
  const labels = examCopy[language];
  const evaluation = evaluateMockExam(score, exam.questions.length, uk ? ukrainianEvaluation : evaluationTexts);
  const evaluationLabel = ({ Strong: labels.strong, Close: labels.close,
    "Material gaps remain": labels.gaps, "More preparation needed": labels.more } as Record<string, string>)[evaluation.label];
  const groups = Array.from(
    { length: Math.ceil(exam.questions.length / GROUP_SIZE) },
    (_, index) => exam.questions.slice(index * GROUP_SIZE, (index + 1) * GROUP_SIZE),
  );

  const selectAnswer = (questionNumber: number, answer: AnswerKey) => {
    setAnswers((current) => ({ ...current, [questionNumber]: answer }));
    setValidationMessage("");
    if (submitted) setSubmitted(false);
  };

  const checkScore = () => {
    if (answeredCount !== exam.questions.length) {
      const firstUnanswered = exam.questions.find((question) => !answers[question.number]);
      setValidationMessage(uk
        ? `Дайте відповіді на всі ${exam.questions.length} запитань. Залишилося: ${exam.questions.length - answeredCount}.`
        : `Answer all ${exam.questions.length} questions before checking the score. ${exam.questions.length - answeredCount} remaining.`);
      document.getElementById(`mock-question-${firstUnanswered?.number ?? 1}`)?.scrollIntoView({ behavior: "smooth", block: "center" });
      return;
    }

    setValidationMessage("");
    setSubmitted(true);
    window.setTimeout(() => {
      document.getElementById("exam-results")?.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 0);
  };

  const retry = () => {
    setAnswers({});
    setSubmitted(false);
    setValidationMessage("");
    document.getElementById("questions-1-10")?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  return (
    <div className={styles.exam}>
      <div className={styles.introduction}>
        <MarkdownDocument markdown={exam.introduction}/>
      </div>

      <div className={styles.progress} aria-label={labels.progress}>
        <div>
          <strong>{answeredCount}</strong> / {exam.questions.length} {labels.answered}
        </div>
        <div className={styles.progressTrack} aria-hidden="true">
          <span style={{ width: `${exam.questions.length ? (answeredCount / exam.questions.length) * 100 : 0}%` }}/>
        </div>
      </div>

      {groups.map((group, groupIndex) => {
        const firstNumber = group[0]?.number ?? groupIndex * GROUP_SIZE + 1;
        const lastNumber = group.at(-1)?.number ?? firstNumber;
        return (
          <section className={styles.group} id={`questions-${firstNumber}-${lastNumber}`} key={firstNumber}>
            <h2>{labels.questions} {firstNumber}–{lastNumber}</h2>
            <div className={styles.questionList}>
              {group.map((question) => {
                const selectedAnswer = answers[question.number];
                const isCorrect = submitted && selectedAnswer === question.correctAnswer;
                return (
                  <fieldset
                    className={`${styles.question} ${submitted ? (isCorrect ? styles.correctQuestion : styles.incorrectQuestion) : ""}`}
                    id={`mock-question-${question.number}`}
                    key={question.number}
                  >
                    <legend><span>{question.number}.</span> {question.prompt}</legend>
                    <div className={styles.options}>
                      {question.options.map((option) => {
                        const selected = selectedAnswer === option.key;
                        const correct = submitted && option.key === question.correctAnswer;
                        const wrongSelected = submitted && selected && !correct;
                        return (
                          <label
                            className={`${styles.option} ${selected ? styles.selectedOption : ""} ${correct ? styles.correctOption : ""} ${wrongSelected ? styles.incorrectOption : ""}`}
                            key={option.key}
                          >
                            <input
                              checked={selected}
                              name={`mock-question-${question.number}`}
                              onChange={() => selectAnswer(question.number, option.key)}
                              type="radio"
                              value={option.key}
                            />
                            <span className={styles.optionKey}>{option.key}</span>
                            <span>{option.text}</span>
                          </label>
                        );
                      })}
                    </div>

                    {submitted ? (
                      <div className={styles.feedback}>
                        <strong>{isCorrect ? labels.correct : `${labels.incorrect} ${question.correctAnswer}`}</strong>
                        <span>{question.explanation}</span>
                      </div>
                    ) : null}
                  </fieldset>
                );
              })}
            </div>
          </section>
        );
      })}

      <div className={styles.submitPanel}>
        <div>
          <strong>{labels.ready}</strong>
          <span>{uk ? `Відповіді й пояснення з’являться після всіх ${exam.questions.length} відповідей.` : `Your answer key stays hidden until you submit all ${exam.questions.length} answers.`}</span>
        </div>
        <button onClick={checkScore} type="button">{labels.check}</button>
      </div>
      <p className={styles.validation} aria-live="polite">{validationMessage}</p>

      {submitted ? (
        <section className={styles.results} id="exam-results" aria-live="polite">
          <div className={styles.scoreBlock}>
            <span>{labels.score}</span>
            <strong>{score}<small> / {exam.questions.length}</small></strong>
            <span>{Math.round((score / exam.questions.length) * 100)}%</span>
          </div>
          <div className={styles.evaluation}>
            <span>{labels.evaluation}</span>
            <h2>{evaluationLabel}</h2>
            <p>{evaluation.text}</p>
            <p className={styles.scoreNote}>{uk ? "Це діагностична навчальна оцінка, а не прогноз чи перерахунок офіційного результату." : scoreNote}</p>
            <button onClick={retry} type="button">{labels.retry}</button>
          </div>
        </section>
      ) : null}
    </div>
  );
}
