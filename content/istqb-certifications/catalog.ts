import { certificationChapter as chapter, certificationTranslation as translation, type CertificationModule, type CertificationMockExamSettings } from "../certification-catalog";
import ctGenAiExamPlan from "./ct-genai/01-exam-plan.md?raw";
import ctGenAiExamPlanUk from "./ct-genai/01-exam-plan.uk.md?raw";
import ctGenAiFoundations from "./ct-genai/02-foundations.md?raw";
import ctGenAiFoundationsUk from "./ct-genai/02-foundations.uk.md?raw";
import ctGenAiPromptEngineering from "./ct-genai/03-prompt-engineering.md?raw";
import ctGenAiPromptEngineeringUk from "./ct-genai/03-prompt-engineering.uk.md?raw";
import ctGenAiRisks from "./ct-genai/04-risks.md?raw";
import ctGenAiRisksUk from "./ct-genai/04-risks.uk.md?raw";
import ctGenAiTestInfrastructure from "./ct-genai/05-test-infrastructure.md?raw";
import ctGenAiTestInfrastructureUk from "./ct-genai/05-test-infrastructure.uk.md?raw";
import ctGenAiAdoption from "./ct-genai/06-adoption.md?raw";
import ctGenAiAdoptionUk from "./ct-genai/06-adoption.uk.md?raw";
import ctGenAiHandsOnLabs from "./ct-genai/07-hands-on-labs.md?raw";
import ctGenAiHandsOnLabsUk from "./ct-genai/07-hands-on-labs.uk.md?raw";
import ctGenAiMockExam from "./ct-genai/08-mock-exam.md?raw";
import ctGenAiMockExamUk from "./ct-genai/08-mock-exam.uk.md?raw";
import ctGenAiFinalReview from "./ct-genai/09-final-review.md?raw";
import ctGenAiFinalReviewUk from "./ct-genai/09-final-review.uk.md?raw";
import ctflExamPlan from "./ctfl/01-exam-plan.md?raw";
import ctflExamPlanUk from "./ctfl/01-exam-plan.uk.md?raw";
import ctflFundamentals from "./ctfl/02-fundamentals.md?raw";
import ctflFundamentalsUk from "./ctfl/02-fundamentals.uk.md?raw";
import ctflSdlc from "./ctfl/03-sdlc.md?raw";
import ctflSdlcUk from "./ctfl/03-sdlc.uk.md?raw";
import ctflStaticTesting from "./ctfl/04-static-testing.md?raw";
import ctflStaticTestingUk from "./ctfl/04-static-testing.uk.md?raw";
import ctflTestTechniques from "./ctfl/05-test-techniques.md?raw";
import ctflTestTechniquesUk from "./ctfl/05-test-techniques.uk.md?raw";
import ctflTestManagement from "./ctfl/06-test-management.md?raw";
import ctflTestManagementUk from "./ctfl/06-test-management.uk.md?raw";
import ctflTestTools from "./ctfl/07-test-tools.md?raw";
import ctflTestToolsUk from "./ctfl/07-test-tools.uk.md?raw";
import ctflMockExam from "./ctfl/08-mock-exam.md?raw";
import ctflMockExamUk from "./ctfl/08-mock-exam.uk.md?raw";
import ctflHandsOnLab from "./ctfl/10-hands-on-lab.md?raw";
import ctflHandsOnLabUk from "./ctfl/10-hands-on-lab.uk.md?raw";
import ctflFinalReview from "./ctfl/09-final-review.md?raw";
import ctflFinalReviewUk from "./ctfl/09-final-review.uk.md?raw";
import { ctflCertificationSources, ctGenAiCertificationSources } from "./sources";

const ctflTaxonomy: CertificationModule[] = [
  chapter({
    id: "ctfl-exam-plan",
    label: "Exam map",
    navLabel: "Exam map",
    level: "Start here",
    description: "CTFL v4.0 exam facts, K-levels, the six chapters and learning objectives.",
    sourceIds: ["istqb-ctfl-syllabus-v401", "istqb-ctfl-page"],
  }, ctflExamPlan, translation(ctflExamPlanUk, "Початок")),
  chapter({
    id: "ctfl-fundamentals",
    label: "Fundamentals of testing",
    navLabel: "Fundamentals",
    level: "Chapter 1",
    description: "Test objectives, errors, defects and failures, the seven principles, test activities, testware and roles.",
    sourceIds: ["istqb-ctfl-syllabus-v401", "istqb-ctfl-page", "istqb-glossary"],
  }, ctflFundamentals, translation(ctflFundamentalsUk, "Розділ 1")),
  chapter({
    id: "ctfl-sdlc",
    label: "Testing throughout the SDLC",
    navLabel: "SDLC",
    level: "Chapter 2",
    description: "Test-first approaches, DevOps, shift left, test levels and types, confirmation, regression and maintenance testing.",
    sourceIds: ["istqb-ctfl-syllabus-v401", "istqb-ctfl-page", "istqb-glossary"],
  }, ctflSdlc, translation(ctflSdlcUk, "Розділ 2")),
  chapter({
    id: "ctfl-static-testing",
    label: "Static testing",
    navLabel: "Static testing",
    level: "Chapter 3",
    description: "Why static testing pays, the review process, review roles and the four review types.",
    sourceIds: ["istqb-ctfl-syllabus-v401", "istqb-ctfl-page", "istqb-glossary"],
  }, ctflStaticTesting, translation(ctflStaticTestingUk, "Розділ 3")),
  chapter({
    id: "ctfl-test-techniques",
    label: "Test analysis and design",
    navLabel: "Test techniques",
    level: "Chapter 4",
    description: "Equivalence partitioning, boundary values, decision tables, state transitions, coverage, experience- and collaboration-based techniques.",
    sourceIds: ["istqb-ctfl-syllabus-v401", "istqb-ctfl-page", "istqb-glossary", "istqb-bva-clarification"],
  }, ctflTestTechniques, translation(ctflTestTechniquesUk, "Розділ 4")),
  chapter({
    id: "ctfl-test-management",
    label: "Managing the test activities",
    navLabel: "Test management",
    level: "Chapter 5",
    description: "Planning, entry and exit criteria, estimation, prioritisation, the pyramid and quadrants, risk, reporting and defect reports.",
    sourceIds: ["istqb-ctfl-syllabus-v401", "istqb-ctfl-page", "istqb-glossary"],
  }, ctflTestManagement, translation(ctflTestManagementUk, "Розділ 5")),
  chapter({
    id: "ctfl-test-tools",
    label: "Test tools",
    navLabel: "Test tools",
    level: "Chapter 6",
    description: "Tool categories and the benefits and risks of test automation.",
    sourceIds: ["istqb-ctfl-syllabus-v401", "istqb-ctfl-page"],
  }, ctflTestTools, translation(ctflTestToolsUk, "Розділ 6")),
  chapter({
    id: "ctfl-hands-on-lab",
    label: "Hands-on practice lab",
    navLabel: "Practice lab",
    level: "Practice",
    description: "Fixed requirements, boundary and rule tables, state transitions and executable reference checks.",
    sourceIds: ["istqb-ctfl-syllabus-v401", "istqb-bva-clarification"],
  }, ctflHandsOnLab, translation(ctflHandsOnLabUk, "Практика")),
  chapter({
    id: "ctfl-mock-exam",
    label: "Original mock exam — 40 questions",
    navLabel: "Mock exam · 40",
    level: "Exam practice",
    description: "Forty original CTFL-style questions weighted like the real exam, with an explanation key.",
    sourceIds: ["istqb-ctfl-syllabus-v401", "istqb-ctfl-page"],
  }, ctflMockExam, translation(ctflMockExamUk, "Пробний тест")),
  chapter({
    id: "ctfl-final-review",
    label: "Final review",
    navLabel: "Final review",
    level: "Revision",
    description: "Terms the exam swaps, formulas and counts.",
    sourceIds: ["istqb-ctfl-syllabus-v401", "istqb-ctfl-page", "istqb-glossary"],
  }, ctflFinalReview, translation(ctflFinalReviewUk, "Повторення")),
];

const ctGenAiTaxonomy: CertificationModule[] = [
  chapter({
    id: "genai-exam-plan",
    label: "Exam map",
    navLabel: "Exam map",
    level: "Start here",
    description: "CT-GenAI v1.1 exam facts, K and H levels, the five chapters and their training time.",
    sourceIds: ["isqi-ct-genai", "ct-genai-syllabus-v11", "ct-genai-sample-questions-v11"],
  }, ctGenAiExamPlan, translation(ctGenAiExamPlanUk, "Початок")),
  chapter({
    id: "genai-foundations",
    label: "Introduction to GenAI for software testing",
    navLabel: "GenAI foundations",
    level: "Chapter 1",
    description: "The AI spectrum, tokens, embeddings and context windows, LLM types, multimodal models, chatbots vs LLM-powered tools.",
    sourceIds: ["ct-genai-syllabus-v11"],
  }, ctGenAiFoundations, translation(ctGenAiFoundationsUk, "Розділ 1")),
  chapter({
    id: "genai-prompt-engineering",
    label: "Prompt engineering for effective testing",
    navLabel: "Prompt engineering",
    level: "Chapter 2",
    description: "The six prompt components, chaining, zero-, one- and few-shot, meta prompting, prompts for test tasks, evaluation metrics.",
    sourceIds: ["ct-genai-syllabus-v11"],
  }, ctGenAiPromptEngineering, translation(ctGenAiPromptEngineeringUk, "Розділ 2")),
  chapter({
    id: "genai-risks",
    label: "Managing risks of GenAI in testing",
    navLabel: "Risks",
    level: "Chapter 3",
    description: "Hallucinations, reasoning errors and bias, non-determinism, privacy and security, energy use, regulations and standards.",
    sourceIds: ["ct-genai-syllabus-v11", "owasp-prompt-injection"],
  }, ctGenAiRisks, translation(ctGenAiRisksUk, "Розділ 3")),
  chapter({
    id: "genai-test-infrastructure",
    label: "LLM-powered test infrastructure",
    navLabel: "Test infrastructure",
    level: "Chapter 4",
    description: "Architecture components, retrieval-augmented generation, agents, fine-tuning and LLMOps.",
    sourceIds: ["ct-genai-syllabus-v11"],
  }, ctGenAiTestInfrastructure, translation(ctGenAiTestInfrastructureUk, "Розділ 4")),
  chapter({
    id: "genai-adoption",
    label: "Deploying GenAI in test organisations",
    navLabel: "Adoption",
    level: "Chapter 5",
    description: "Shadow AI, GenAI test strategy, model selection, adoption phases, skills and changing roles.",
    sourceIds: ["ct-genai-syllabus-v11"],
  }, ctGenAiAdoption, translation(ctGenAiAdoptionUk, "Розділ 5")),
  chapter({
    id: "genai-hands-on-labs",
    label: "Hands-on labs",
    navLabel: "Labs",
    level: "Practice",
    description: "Six labs following the syllabus hands-on objectives, using non-sensitive data.",
    sourceIds: ["ct-genai-syllabus-v11"],
  }, ctGenAiHandsOnLabs, translation(ctGenAiHandsOnLabsUk, "Практика")),
  chapter({
    id: "genai-mock-exam",
    label: "Original mock exam — 40 questions",
    navLabel: "Mock exam · 40",
    level: "Exam practice",
    description: "Forty original CT-GenAI-style questions weighted by syllabus training time, with an explanation key.",
    sourceIds: ["ct-genai-syllabus-v11", "ct-genai-sample-questions-v11", "ct-genai-sample-answers-v11"],
  }, ctGenAiMockExam, translation(ctGenAiMockExamUk, "Пробний тест")),
  chapter({
    id: "genai-final-review",
    label: "Final review",
    navLabel: "Final review",
    level: "Revision",
    description: "Key distinctions, prompt components and reference lists.",
    sourceIds: ["isqi-ct-genai", "ct-genai-syllabus-v11"],
  }, ctGenAiFinalReview, translation(ctGenAiFinalReviewUk, "Повторення")),
];

const istqbMockExamTexts = {
  close: "Some answers need review.",
  more: "Many topics have gaps.",
};

export const ctflCertificationCatalog = {
  trackId: "ctfl-v4",
  trackLabel: "CTFL v4.0",
  version: 1,
  title: "ISTQB CTFL v4.0 Exam Preparation",
  titleUk: "Підготовка до іспиту ISTQB CTFL v4.0",
  description: "A self-study path for ISTQB Certified Tester Foundation Level v4.0: all six syllabus chapters with worked calculations, a 40-question original mock exam weighted like the real exam, and a final review.",
  descriptionUk: "Self-study learning path для ISTQB Certified Tester Foundation Level v4.0: усі шість розділів syllabus з розібраними розрахунками, 40 авторських питань mock exam і фінальне повторення.",
  lastReviewedAt: "2026-11-25",
  taxonomy: ctflTaxonomy,
  sources: ctflCertificationSources,
  mockExam: {
    scoreNote: "This mock uses one question = one mark, like the real CTFL exam, where 26 of 40 passes.",
    evaluationTexts: {
      ...istqbMockExamTexts,
      strong: "Strong result on this practice set.",
      gaps: "Several topics have gaps.",
    },
  } satisfies CertificationMockExamSettings,
};

export const ctGenAiCertificationCatalog = {
  trackId: "ct-genai-v1",
  trackLabel: "CT-GenAI v1.1",
  version: 1,
  title: "ISTQB CT-GenAI v1.1 Exam Preparation",
  titleUk: "Підготовка до іспиту ISTQB CT-GenAI v1.1",
  description: "A self-study path for ISTQB Certified Tester – Testing with Generative AI v1.1: all five syllabus chapters, hands-on labs, a 40-question original mock exam weighted by training time, and a final review.",
  descriptionUk: "Self-study learning path для ISTQB Certified Tester – Testing with Generative AI v1.1: усі п'ять розділів syllabus, практичні лабораторні, 40 авторських питань mock exam і фінальне повторення.",
  lastReviewedAt: "2026-11-25",
  taxonomy: ctGenAiTaxonomy,
  sources: ctGenAiCertificationSources,
  mockExam: {
    scoreNote: "This mock uses one question = one mark; the real CT-GenAI exam passes at 65%.",
    evaluationTexts: {
      ...istqbMockExamTexts,
      strong: "Strong result on this practice set.",
      gaps: "Several topics have gaps.",
    },
  } satisfies CertificationMockExamSettings,
};

export const istqbCertificationCatalogs = [ctflCertificationCatalog, ctGenAiCertificationCatalog];
