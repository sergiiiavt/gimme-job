export type OfficialSampleOption = "a" | "b" | "c" | "d" | "e";

export interface OfficialMainQuestionKey {
  number: number;
  correct: OfficialSampleOption[];
  points: 1 | 2;
  optionCount: 4 | 5;
}

export const OFFICIAL_MAIN_TOTAL_POINTS = 44;
export const OFFICIAL_MAIN_PASSING_SCORE = 29;

export const OFFICIAL_MAIN_QUESTIONS: OfficialMainQuestionKey[] = [
  { number: 1, correct: ["a"], points: 1, optionCount: 4 },
  { number: 2, correct: ["c", "e"], points: 1, optionCount: 5 },
  { number: 3, correct: ["a"], points: 1, optionCount: 4 },
  { number: 4, correct: ["b"], points: 1, optionCount: 4 },
  { number: 5, correct: ["a"], points: 1, optionCount: 4 },
  { number: 6, correct: ["b"], points: 1, optionCount: 4 },
  { number: 7, correct: ["c"], points: 1, optionCount: 4 },
  { number: 8, correct: ["b"], points: 1, optionCount: 4 },
  { number: 9, correct: ["c"], points: 1, optionCount: 4 },
  { number: 10, correct: ["c"], points: 1, optionCount: 4 },
  { number: 11, correct: ["d"], points: 1, optionCount: 4 },
  { number: 12, correct: ["d"], points: 1, optionCount: 4 },
  { number: 13, correct: ["c"], points: 1, optionCount: 4 },
  { number: 14, correct: ["b"], points: 1, optionCount: 4 },
  { number: 15, correct: ["c"], points: 2, optionCount: 4 },
  { number: 16, correct: ["a"], points: 1, optionCount: 4 },
  { number: 17, correct: ["a"], points: 1, optionCount: 4 },
  { number: 18, correct: ["b"], points: 1, optionCount: 4 },
  { number: 19, correct: ["b"], points: 1, optionCount: 4 },
  { number: 20, correct: ["b"], points: 1, optionCount: 4 },
  { number: 21, correct: ["d"], points: 2, optionCount: 4 },
  { number: 22, correct: ["b"], points: 1, optionCount: 4 },
  { number: 23, correct: ["a"], points: 1, optionCount: 4 },
  { number: 24, correct: ["a"], points: 1, optionCount: 4 },
  { number: 25, correct: ["c"], points: 1, optionCount: 4 },
  { number: 26, correct: ["d"], points: 1, optionCount: 4 },
  { number: 27, correct: ["b"], points: 1, optionCount: 4 },
  { number: 28, correct: ["c"], points: 2, optionCount: 4 },
  { number: 29, correct: ["b"], points: 1, optionCount: 4 },
  { number: 30, correct: ["b"], points: 1, optionCount: 4 },
  { number: 31, correct: ["a"], points: 1, optionCount: 4 },
  { number: 32, correct: ["a"], points: 1, optionCount: 4 },
  { number: 33, correct: ["c"], points: 1, optionCount: 4 },
  { number: 34, correct: ["b"], points: 2, optionCount: 4 },
  { number: 35, correct: ["b"], points: 1, optionCount: 4 },
  { number: 36, correct: ["c"], points: 1, optionCount: 4 },
  { number: 37, correct: ["c"], points: 1, optionCount: 4 },
  { number: 38, correct: ["d"], points: 1, optionCount: 4 },
  { number: 39, correct: ["b", "d"], points: 1, optionCount: 5 },
  { number: 40, correct: ["b"], points: 1, optionCount: 4 },
];

export const OFFICIAL_ADDITIONAL_KEYS = {
  A1: ["super", "general", "general", "narrow", "narrow"],
  A2: ["a"],
  A3: ["c"],
  A4: ["regression", "reinforcement", "classification", "association"],
  A5: ["1", "4", "2", "5", "3"],
  A6: ["c"],
} as const;

export type OfficialMainAnswers = Record<number, string[]>;
export type OfficialAdditionalAnswers = Partial<Record<keyof typeof OFFICIAL_ADDITIONAL_KEYS, string[]>>;

export function sameOrderedSelection(actual: readonly string[] = [], expected: readonly string[] = []): boolean {
  return actual.length === expected.length && actual.every((value, index) => value === expected[index]);
}

export function sameSelection(actual: readonly string[] = [], expected: readonly string[] = []): boolean {
  if (actual.length !== expected.length) return false;
  const isLetterAnswerSet = expected.every((value) => /^[a-e]$/.test(value));
  if (!isLetterAnswerSet) return sameOrderedSelection(actual, expected);
  const compareAlphabetically = (left: string, right: string) => left.localeCompare(right);
  const normalizedActual = [...actual].sort(compareAlphabetically);
  const normalizedExpected = [...expected].sort(compareAlphabetically);
  return normalizedActual.every((value, index) => value === normalizedExpected[index]);
}

export function scoreOfficialMain(answers: OfficialMainAnswers): { points: number; correctQuestions: number } {
  return OFFICIAL_MAIN_QUESTIONS.reduce(
    (score, question) => {
      if (!sameSelection(answers[question.number], question.correct)) return score;
      return {
        points: score.points + question.points,
        correctQuestions: score.correctQuestions + 1,
      };
    },
    { points: 0, correctQuestions: 0 },
  );
}

export function scoreOfficialAdditional(answers: OfficialAdditionalAnswers): number {
  return (Object.entries(OFFICIAL_ADDITIONAL_KEYS) as [keyof typeof OFFICIAL_ADDITIONAL_KEYS, readonly string[]][])
    .filter(([id, expected]) => sameOrderedSelection(answers[id], expected))
    .length;
}
