import { istqbAiTestingModules } from "./modules";
import { istqbAiTestingSources } from "./sources";

export const istqbAiTestingCatalog = {
  version: 2,
  title: "ISTQB CT-AI v2.0 Exam Preparation",
  description: "A complete self-study path for ISTQB Certified Tester AI Testing v2.0: every syllabus chapter, exam-focused theory, worked examples, hands-on labs, a full original mock exam, official references, and selected video explanations.",
  lastReviewedAt: "2026-08-26",
  taxonomy: istqbAiTestingModules,
  sources: istqbAiTestingSources,
};

export default istqbAiTestingCatalog;
