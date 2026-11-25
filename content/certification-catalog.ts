import type { IstqbAiTestingModule } from "./istqb-ai-testing/modules";

/** Shared shape for certification tracks on /learn/certifications. */
export interface CertificationTranslation {
  labelUk: string;
  navLabelUk: string;
  levelUk: string;
  descriptionUk: string;
  markdownUk: string;
}

export type CertificationModule = IstqbAiTestingModule & Partial<CertificationTranslation>;

export type CertificationModuleFields = Omit<CertificationModule, "count" | "markdown">;

export interface CertificationMockExamSettings {
  scoreNote: string;
  evaluationTexts: { strong: string; close: string; gaps: string; more: string };
}

/** Mock exam chapters end in `mock-exam`; topic ids stay unique across tracks on the shared route. */
export const isMockExamModuleId = (id: string) => id === "mock-exam" || id.endsWith("-mock-exam");

const sectionCount = (markdown: string) => (markdown.match(/^## /gm) ?? []).length;
const mockQuestionCount = (markdown: string) => (markdown.match(/^\*\*\d+\.\*\*/gm) ?? []).length;

/** A chapter's count is its question count for a mock exam, otherwise its number of sections. */
export const certificationTranslation = (markdownUk: string, levelUk: string): CertificationTranslation => {
  const labelUk = markdownUk.match(/^# (.+)$/m)?.[1] ?? "Навчальний матеріал";
  return {
    labelUk,
    navLabelUk: labelUk,
    levelUk,
    descriptionUk: (markdownUk.split(/\n\s*\n/)[1] ?? labelUk).replace(/\[([^\]]+)\]\([^)]+\)/g, "$1").replaceAll("**", ""),
    markdownUk,
  };
};

export const certificationChapter = (fields: CertificationModuleFields, markdown: string, translation?: CertificationTranslation): CertificationModule => ({
  ...fields,
  ...translation,
  count: isMockExamModuleId(fields.id) ? mockQuestionCount(markdown) : sectionCount(markdown),
  markdown,
});
