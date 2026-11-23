import type { IstqbAiTestingModule } from "./istqb-ai-testing/modules";

/** Shared shape for certification tracks on /learn/certifications. */
export type CertificationModule = IstqbAiTestingModule;

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
export const certificationChapter = (fields: CertificationModuleFields, markdown: string): CertificationModule => ({
  ...fields,
  count: isMockExamModuleId(fields.id) ? mockQuestionCount(markdown) : sectionCount(markdown),
  markdown,
});
