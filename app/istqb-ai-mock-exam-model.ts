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
  const [questionSection = "", answerSectionWithScore = ""] = markdown.split(/\n## Answer key with explanations\s*\n/);
  const [introduction = "", questionsWithHeadings = ""] = questionSection.split(/\n## Questions 1[–-]10\s*\n/);
  const questionsMarkdown = questionsWithHeadings
    .replace(/^## Questions \d+[–-]\d+\s*$/gm, "")
    .trim();
  const answerSection = answerSectionWithScore.split(/\n## Score interpretation\s*\n/)[0] ?? "";
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

export function evaluateIstqbAiMockExam(score: number): ScoreEvaluation {
  if (score >= 36) {
    return {
      label: "Strong",
      text: "Review every uncertainty, then take the official sample exam under time pressure.",
    };
  }
  if (score >= 32) {
    return {
      label: "Close",
      text: "Revisit the learning-path chapters behind your wrong answers, then repeat the weak areas.",
    };
  }
  if (score >= 28) {
    return {
      label: "Material gaps remain",
      text: "Repeat metric calculations and the distinctions between AI testing techniques before another mock.",
    };
  }
  return {
    label: "More preparation needed",
    text: "Return to the chapter sequence before doing more mock exams, focusing on the concepts behind missed questions.",
  };
}
