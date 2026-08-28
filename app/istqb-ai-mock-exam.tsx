"use client";

import { useMemo, useState } from "react";
import {
  evaluateIstqbAiMockExam,
  parseIstqbAiMockExam,
  scoreIstqbAiMockExam,
  type AnswerKey,
  type MockExamAnswers,
} from "./istqb-ai-mock-exam-model";
import MarkdownDocument from "./qa-markdown";
import styles from "./istqb-ai-mock-exam.module.css";

const GROUP_SIZE = 10;

export default function IstqbAiMockExam({ markdown }: { markdown: string }) {
  const exam = useMemo(() => parseIstqbAiMockExam(markdown), [markdown]);
  const [answers, setAnswers] = useState<MockExamAnswers>({});
  const [submitted, setSubmitted] = useState(false);
  const [validationMessage, setValidationMessage] = useState("");
  const answeredCount = Object.keys(answers).length;
  const score = submitted ? scoreIstqbAiMockExam(exam.questions, answers) : 0;
  const evaluation = evaluateIstqbAiMockExam(score);
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
      setValidationMessage(`Answer all ${exam.questions.length} questions before checking the score. ${exam.questions.length - answeredCount} remaining.`);
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

      <div className={styles.progress} aria-label="Mock exam progress">
        <div>
          <strong>{answeredCount}</strong> / {exam.questions.length} answered
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
            <h2>Questions {firstNumber}–{lastNumber}</h2>
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
                        <strong>{isCorrect ? "Correct" : `Incorrect · correct answer: ${question.correctAnswer}`}</strong>
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
          <strong>Ready to evaluate?</strong>
          <span>Your answer key stays hidden until you submit all 40 answers.</span>
        </div>
        <button onClick={checkScore} type="button">Check score</button>
      </div>
      <p className={styles.validation} aria-live="polite">{validationMessage}</p>

      {submitted ? (
        <section className={styles.results} id="exam-results" aria-live="polite">
          <div className={styles.scoreBlock}>
            <span>Practice score</span>
            <strong>{score}<small> / {exam.questions.length}</small></strong>
            <span>{Math.round((score / exam.questions.length) * 100)}%</span>
          </div>
          <div className={styles.evaluation}>
            <span>Evaluation</span>
            <h2>{evaluation.label}</h2>
            <p>{evaluation.text}</p>
            <p className={styles.scoreNote}>This mock uses one question = one practice mark and is not directly convertible to the official 44-point CT-AI exam score.</p>
            <button onClick={retry} type="button">Retry exam</button>
          </div>
        </section>
      ) : null}
    </div>
  );
}
