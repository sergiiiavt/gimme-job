export type AnswerKey = "A" | "B" | "C" | "D";

export interface MockExamOption {
  key: AnswerKey;
  text: string;
}

export interface MockExamQuestion {
  correctAnswer?: AnswerKey;
  explanation?: string;
  number: number;
  options: MockExamOption[];
  prompt: string;
}

export interface ParsedMockExam {
  introduction: string;
  questions: MockExamQuestion[];
}

export interface ScoreEvaluation {
  label: string;
  text: string;
}

export type MockExamAnswers = Record<number, AnswerKey>;

const cleanText = (value: string) => value
  .replace(/ {2,}$/gm, "")
  .replace(/\n+/g, " ")
  .trim();

export function parseIstqbAiMockExam(markdown: string): ParsedMockExam {
  const [questionSection = "", answerSectionWithScore = ""] = markdown.split(/\n## (?:Answer key with explanations|Відповіді з поясненнями)\s*\n/);
  const [introduction = "", questionsWithHeadings = ""] = questionSection.split(/\n## (?:Questions|Запитання) 1[–-]10\s*\n/);
  const questionsMarkdown = questionsWithHeadings
    .replace(/^## (?:Questions|Запитання) \d+[–-]\d+\s*$/gm, "")
    .trim();
  const answerSection = answerSectionWithScore.split(/\n## (?:Score interpretation|Оцінювання результату)\s*\n/)[0] ?? "";
  const answers = new Map<number, { answer: AnswerKey; explanation: string }>();

  for (const match of answerSection.matchAll(/^(\d+)\.\s+\*\*([A-D])\*\*\s+—\s+(.+?)\s*$/gm)) {
    answers.set(Number(match[1]), {
      answer: match[2] as AnswerKey,
      explanation: cleanText(match[3]),
    });
  }

  const questions: MockExamQuestion[] = [];
  for (const match of questionsMarkdown.matchAll(/\*\*(\d+)\.\*\*\s+([\s\S]*?)(?=\n\n\*\*\d+\.\*\*|$)/g)) {
    const number = Number(match[1]);
    const block = match[2];
    const optionMatches = [...block.matchAll(/^([A-D])\.\s+(.+?)\s*$/gm)];
    const firstOptionIndex = optionMatches[0]?.index ?? block.length;
    const answer = answers.get(number);

    questions.push({
      correctAnswer: answer?.answer,
      explanation: answer?.explanation,
      number,
      options: optionMatches.map((optionMatch) => ({
        key: optionMatch[1] as AnswerKey,
        text: cleanText(optionMatch[2]),
      })),
      prompt: cleanText(block.slice(0, firstOptionIndex)),
    });
  }

  return {
    introduction: introduction.trim(),
    questions,
  };
}

export function scoreIstqbAiMockExam(questions: MockExamQuestion[], answers: MockExamAnswers): number {
  return questions.filter((question) => answers[question.number] === question.correctAnswer).length;
}

export interface MockExamEvaluationTexts {
  strong: string;
  close: string;
  gaps: string;
  more: string;
}

const istqbAiEvaluationTexts: MockExamEvaluationTexts = {
  strong: "Strong result on this practice set.",
  close: "Some answers need review.",
  gaps: "Several topics have gaps.",
  more: "Many topics have gaps.",
};

/** Bands at 90%, 80% and 70% of the questions; for 40 questions these are 36, 32 and 28. */
export function evaluateMockExam(score: number, total: number, texts: MockExamEvaluationTexts = istqbAiEvaluationTexts): ScoreEvaluation {
  if (score * 10 >= total * 9) return { label: "Strong", text: texts.strong };
  if (score * 10 >= total * 8) return { label: "Close", text: texts.close };
  if (score * 10 >= total * 7) return { label: "Material gaps remain", text: texts.gaps };
  return { label: "More preparation needed", text: texts.more };
}

export function evaluateIstqbAiMockExam(score: number): ScoreEvaluation {
  return evaluateMockExam(score, 40);
}

export const MOCK_EXAM_GROUP_SIZE = 10;

/** Rail headings matching the question groups the mock exam renders. */
export function mockExamGroupHeadings(questionCount: number, groupSize = MOCK_EXAM_GROUP_SIZE, language: "en" | "uk" = "en"): Array<{ id: string; text: string }> {
  return Array.from({ length: Math.ceil(questionCount / groupSize) }, (_, index) => {
    const first = index * groupSize + 1;
    const last = Math.min(questionCount, first + groupSize - 1);
    return { id: `questions-${first}-${last}`, text: `${language === "uk" ? "Запитання" : "Questions"} ${first}–${last}` };
  });
}

/** Localized presentation data lives with the directly testable assessment model. */
export const mockExamCopy = {
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
export const ukrainianMockExamEvaluationTexts: MockExamEvaluationTexts = {
  strong: "Високий результат у цьому тренувальному тесті.",
  close: "Є окремі помилки у відповідях.",
  gaps: "Є прогалини в кількох темах.",
  more: "Є прогалини в багатьох темах.",
};
