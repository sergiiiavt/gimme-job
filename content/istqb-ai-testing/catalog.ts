import { istqbAiTestingModules } from "./modules";
import { istqbAiOfficialSampleExam } from "./official-sample";
import { istqbAiTestingSources } from "./sources";
import { istqbAiTestingSupplements } from "./supplements";

const EXAM_PLAN_SUMMARY = "The final two sections add **hands-on labs**, a **40-question original mock exam**, and an **exam-day review sheet**.";
const UPDATED_EXAM_PLAN_SUMMARY = "The final sections add **hands-on labs**, the **official ISTQB v2.2 sample exam with 46 published questions**, a **40-question original mock exam**, and an **exam-day review sheet**.";

const baseTaxonomy = istqbAiTestingModules.map((module) => {
  const markdown = `${module.markdown}${istqbAiTestingSupplements[module.id] ?? ""}`;

  return {
    ...module,
    ...(module.id === "mock-exam"
      ? {
          label: "Original mock exam — 40 questions",
          navLabel: "Original mock · 40",
        }
      : {}),
    markdown: module.id === "exam-plan"
      ? markdown.replace(EXAM_PLAN_SUMMARY, UPDATED_EXAM_PLAN_SUMMARY)
      : markdown,
  };
});

const mockExamIndex = baseTaxonomy.findIndex((module) => module.id === "mock-exam");
const taxonomy = mockExamIndex >= 0
  ? [
      ...baseTaxonomy.slice(0, mockExamIndex),
      istqbAiOfficialSampleExam,
      ...baseTaxonomy.slice(mockExamIndex),
    ]
  : [...baseTaxonomy, istqbAiOfficialSampleExam];

export const istqbAiTestingCatalog = {
  version: 3,
  title: "ISTQB CT-AI v2.0 Exam Preparation",
  description: "A complete self-study path for ISTQB Certified Tester AI Testing v2.0: every syllabus chapter, exam-focused theory, worked examples, hands-on labs, all 46 official ISTQB v2.2 sample questions, a separate original mock exam, official references, and selected video explanations.",
  lastReviewedAt: "2026-09-06",
  taxonomy,
  sources: istqbAiTestingSources,
};

export default istqbAiTestingCatalog;
