import { certificationChapter as chapter, type CertificationModule, type CertificationMockExamSettings } from "../certification-catalog";
import ctGenAiExamPlan from "./ct-genai/01-exam-plan.md?raw";
import ctGenAiFoundations from "./ct-genai/02-foundations.md?raw";
import ctGenAiPromptEngineering from "./ct-genai/03-prompt-engineering.md?raw";
import ctGenAiRisks from "./ct-genai/04-risks.md?raw";
import ctGenAiTestInfrastructure from "./ct-genai/05-test-infrastructure.md?raw";
import ctGenAiAdoption from "./ct-genai/06-adoption.md?raw";
import ctGenAiHandsOnLabs from "./ct-genai/07-hands-on-labs.md?raw";
import ctGenAiMockExam from "./ct-genai/08-mock-exam.md?raw";
import ctGenAiFinalReview from "./ct-genai/09-final-review.md?raw";
import ctflExamPlan from "./ctfl/01-exam-plan.md?raw";
import ctflFundamentals from "./ctfl/02-fundamentals.md?raw";
import ctflSdlc from "./ctfl/03-sdlc.md?raw";
import ctflStaticTesting from "./ctfl/04-static-testing.md?raw";
import ctflTestTechniques from "./ctfl/05-test-techniques.md?raw";
import ctflTestManagement from "./ctfl/06-test-management.md?raw";
import ctflTestTools from "./ctfl/07-test-tools.md?raw";
import ctflMockExam from "./ctfl/08-mock-exam.md?raw";
import ctflFinalReview from "./ctfl/09-final-review.md?raw";
import { ctflCertificationSources, ctGenAiCertificationSources } from "./sources";

const ctflTaxonomy: CertificationModule[] = [
  chapter({
    id: "ctfl-exam-plan",
    label: "Exam map & study plan",
    navLabel: "Exam map",
    level: "Start here",
    description: "CTFL v4.0 exam facts, K-levels, the six chapters and how to pace this track.",
    sourceIds: ["istqb-ctfl-page"],
  }, ctflExamPlan),
  chapter({
    id: "ctfl-fundamentals",
    label: "Fundamentals of testing",
    navLabel: "Fundamentals",
    level: "Chapter 1",
    description: "Test objectives, errors, defects and failures, the seven principles, test activities, testware and roles.",
    sourceIds: ["istqb-ctfl-page", "istqb-glossary"],
  }, ctflFundamentals),
  chapter({
    id: "ctfl-sdlc",
    label: "Testing throughout the SDLC",
    navLabel: "SDLC",
    level: "Chapter 2",
    description: "Test-first approaches, DevOps, shift left, test levels and types, confirmation, regression and maintenance testing.",
    sourceIds: ["istqb-ctfl-page", "istqb-glossary"],
  }, ctflSdlc),
  chapter({
    id: "ctfl-static-testing",
    label: "Static testing",
    navLabel: "Static testing",
    level: "Chapter 3",
    description: "Why static testing pays, the review process, review roles and the four review types.",
    sourceIds: ["istqb-ctfl-page", "istqb-glossary"],
  }, ctflStaticTesting),
  chapter({
    id: "ctfl-test-techniques",
    label: "Test analysis and design",
    navLabel: "Test techniques",
    level: "Chapter 4",
    description: "Equivalence partitioning, boundary values, decision tables, state transitions, coverage, experience- and collaboration-based techniques.",
    sourceIds: ["istqb-ctfl-page", "istqb-glossary"],
  }, ctflTestTechniques),
  chapter({
    id: "ctfl-test-management",
    label: "Managing the test activities",
    navLabel: "Test management",
    level: "Chapter 5",
    description: "Planning, entry and exit criteria, estimation, prioritisation, the pyramid and quadrants, risk, reporting and defect reports.",
    sourceIds: ["istqb-ctfl-page", "istqb-glossary"],
  }, ctflTestManagement),
  chapter({
    id: "ctfl-test-tools",
    label: "Test tools",
    navLabel: "Test tools",
    level: "Chapter 6",
    description: "Tool categories and the benefits and risks of test automation.",
    sourceIds: ["istqb-ctfl-page"],
  }, ctflTestTools),
  chapter({
    id: "ctfl-mock-exam",
    label: "Original mock exam — 40 questions",
    navLabel: "Mock exam · 40",
    level: "Exam practice",
    description: "Forty original CTFL-style questions weighted like the real exam, with an explanation key.",
    sourceIds: ["istqb-ctfl-page"],
  }, ctflMockExam),
  chapter({
    id: "ctfl-final-review",
    label: "Final review & exam-day checklist",
    navLabel: "Final review",
    level: "Revision",
    description: "Terms the exam swaps, formulas and counts, and a readiness checklist.",
    sourceIds: ["istqb-ctfl-page", "istqb-glossary"],
  }, ctflFinalReview),
];

const ctGenAiTaxonomy: CertificationModule[] = [
  chapter({
    id: "genai-exam-plan",
    label: "Exam map & study plan",
    navLabel: "Exam map",
    level: "Start here",
    description: "CT-GenAI v1.1 exam facts, K and H levels, the five chapters and their training time.",
    sourceIds: ["isqi-ct-genai", "ct-genai-syllabus-v11", "ct-genai-sample-questions-v11"],
  }, ctGenAiExamPlan),
  chapter({
    id: "genai-foundations",
    label: "Introduction to GenAI for software testing",
    navLabel: "GenAI foundations",
    level: "Chapter 1",
    description: "The AI spectrum, tokens, embeddings and context windows, LLM types, multimodal models, chatbots vs LLM-powered tools.",
    sourceIds: ["ct-genai-syllabus-v11"],
  }, ctGenAiFoundations),
  chapter({
    id: "genai-prompt-engineering",
    label: "Prompt engineering for effective testing",
    navLabel: "Prompt engineering",
    level: "Chapter 2",
    description: "The six prompt components, chaining, zero-, one- and few-shot, meta prompting, prompts for test tasks, evaluation metrics.",
    sourceIds: ["ct-genai-syllabus-v11"],
  }, ctGenAiPromptEngineering),
  chapter({
    id: "genai-risks",
    label: "Managing risks of GenAI in testing",
    navLabel: "Risks",
    level: "Chapter 3",
    description: "Hallucinations, reasoning errors and bias, non-determinism, privacy and security, energy use, regulations and standards.",
    sourceIds: ["ct-genai-syllabus-v11"],
  }, ctGenAiRisks),
  chapter({
    id: "genai-test-infrastructure",
    label: "LLM-powered test infrastructure",
    navLabel: "Test infrastructure",
    level: "Chapter 4",
    description: "Architecture components, retrieval-augmented generation, agents, fine-tuning and LLMOps.",
    sourceIds: ["ct-genai-syllabus-v11"],
  }, ctGenAiTestInfrastructure),
  chapter({
    id: "genai-adoption",
    label: "Deploying GenAI in test organisations",
    navLabel: "Adoption",
    level: "Chapter 5",
    description: "Shadow AI, GenAI test strategy, model selection, adoption phases, skills and changing roles.",
    sourceIds: ["ct-genai-syllabus-v11"],
  }, ctGenAiAdoption),
  chapter({
    id: "genai-hands-on-labs",
    label: "Hands-on labs",
    navLabel: "Labs",
    level: "Practice",
    description: "Six labs following the syllabus hands-on objectives, using non-sensitive data.",
    sourceIds: ["ct-genai-syllabus-v11"],
  }, ctGenAiHandsOnLabs),
  chapter({
    id: "genai-mock-exam",
    label: "Original mock exam — 40 questions",
    navLabel: "Mock exam · 40",
    level: "Exam practice",
    description: "Forty original CT-GenAI-style questions weighted by syllabus training time, with an explanation key.",
    sourceIds: ["ct-genai-syllabus-v11", "ct-genai-sample-questions-v11", "ct-genai-sample-answers-v11"],
  }, ctGenAiMockExam),
  chapter({
    id: "genai-final-review",
    label: "Final review & exam-day checklist",
    navLabel: "Final review",
    level: "Revision",
    description: "Distinctions the exam tests, lists worth memorising and a readiness checklist.",
    sourceIds: ["isqi-ct-genai", "ct-genai-syllabus-v11"],
  }, ctGenAiFinalReview),
];

const istqbMockExamTexts = {
  close: "Revisit the chapters behind your wrong answers, then retake this mock.",
  more: "Return to the chapter sequence before doing more mock exams.",
};

export const ctflCertificationCatalog = {
  trackId: "ctfl-v4",
  trackLabel: "CTFL v4.0",
  version: 1,
  title: "ISTQB CTFL v4.0 Exam Preparation",
  titleUk: "Підготовка до іспиту ISTQB CTFL v4.0",
  description: "A self-study path for ISTQB Certified Tester Foundation Level v4.0: all six syllabus chapters with worked calculations, a 40-question original mock exam weighted like the real exam, and a final review.",
  descriptionUk: "Self-study learning path для ISTQB Certified Tester Foundation Level v4.0: усі шість розділів syllabus з розібраними розрахунками, 40 авторських питань mock exam і фінальне повторення.",
  lastReviewedAt: "2026-11-24",
  taxonomy: ctflTaxonomy,
  sources: ctflCertificationSources,
  mockExam: {
    scoreNote: "This mock uses one question = one mark, like the real CTFL exam, where 26 of 40 passes.",
    evaluationTexts: {
      ...istqbMockExamTexts,
      strong: "Take the official sample exams A to D under a 60-minute timer.",
      gaps: "Redo the chapter 4 calculations by hand before another mock.",
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
  lastReviewedAt: "2026-11-24",
  taxonomy: ctGenAiTaxonomy,
  sources: ctGenAiCertificationSources,
  mockExam: {
    scoreNote: "This mock uses one question = one mark; the real CT-GenAI exam passes at 65%.",
    evaluationTexts: {
      ...istqbMockExamTexts,
      strong: "Take the official v1.1 sample exam under a 60-minute timer.",
      gaps: "Redo the hands-on labs and reread chapter 2 before another mock.",
    },
  } satisfies CertificationMockExamSettings,
};

export const istqbCertificationCatalogs = [ctflCertificationCatalog, ctGenAiCertificationCatalog];
