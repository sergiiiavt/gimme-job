import type { CertificationSource } from "../ai-engineering-certifications/sources";

const checkedAt = "2026-11-25";

export const ctflCertificationSources: CertificationSource[] = [

  {
    id: "istqb-ctfl-syllabus-v401",
    title: "CTFL Syllabus v4.0.1",
    url: "https://istqb.org/wp-content/uploads/2024/11/ISTQB_CTFL_Syllabus_v4.0.1.pdf",
    publisher: "ISTQB",
    kind: "official-syllabus",
    role: "Primary learning objectives, K levels, definitions and applied technique requirements for this track.",
    checkedAt,
  },
  {
    id: "istqb-bva-clarification",
    title: "ISTQB Boundary Value Analysis clarification",
    url: "https://istqb.org/wp-content/uploads/2025/10/Boundary-Value-Analysis-white-paper.pdf",
    publisher: "ISTQB",
    kind: "official-clarification",
    role: "Clarifies both partition boundaries at a shared border and the required 3-value neighbours.",
    checkedAt,
  },

  {
    id: "istqb-ctfl-page",
    title: "Certified Tester Foundation Level (CTFL) v4.0",
    url: "https://istqb.org/certifications/certified-tester-foundation-level-ctfl-v4-0",
    publisher: "ISTQB",
    kind: "official-certification-page",
    role: "Primary authority for the CTFL v4.0 syllabus, exam structure (40 questions, 26 to pass) and the official sample exams A to D.",
    checkedAt,
  },
  {
    id: "istqb-glossary",
    title: "ISTQB Glossary",
    url: "https://glossary.istqb.org/",
    publisher: "ISTQB",
    kind: "official-glossary",
    role: "Authoritative definitions of the testing terms used in every CTFL question.",
    checkedAt,
  },
];

export const ctGenAiCertificationSources: CertificationSource[] = [
  {
    id: "owasp-prompt-injection",
    title: "OWASP LLM01: Prompt Injection",
    url: "https://genai.owasp.org/llmrisk/llm01-prompt-injection/",
    publisher: "OWASP",
    kind: "primary-security-guidance",
    role: "Direct and indirect prompt injection, attack boundaries and mitigation limitations.",
    checkedAt,
  },
  {
    id: "isqi-ct-genai",
    title: "ISTQB Certified Tester – Testing with Generative AI (CT-GenAI)",
    url: "https://isqi.org/ISTQB-Certified-Tester-Testing-with-Generative-AI-CT-GenAI/CT-GenAI.40",
    publisher: "iSQI",
    kind: "exam-provider-page",
    role: "Exam format, prerequisite, validity, the v1.1 update of 27 April 2026, and links to the official syllabus and sample exam.",
    checkedAt,
  },
  {
    id: "ct-genai-syllabus-v11",
    title: "CT-GenAI Syllabus v1.1",
    url: "https://isqi.org/media/89/ff/da/1786528951/ISTQB-CT-GenAI-Syllabus-v1.1_en_.pdf",
    publisher: "ISTQB",
    kind: "official-syllabus",
    role: "Primary exam authority: learning objectives, keywords, training times and every definition used in this track.",
    checkedAt,
  },
  {
    id: "ct-genai-sample-questions-v11",
    title: "CT-GenAI Sample Exam A Questions v1.1",
    url: "https://isqi.org/media/33/e3/7e/1786529388/ISTQB-CT-GenAI_Sample-Exam-A-Questions_v1.1_en_.pdf",
    publisher: "ISTQB",
    kind: "official-sample-exam",
    role: "Official example of question style and difficulty. Use after the chapters and the mock exam.",
    checkedAt,
  },
  {
    id: "ct-genai-sample-answers-v11",
    title: "CT-GenAI Sample Exam A Answers v1.1",
    url: "https://isqi.org/media/5f/1c/ef/1786529395/ISTQB-CT-GenAI_Sample-Exam-A-Answers_v1.1_en_.pdf",
    publisher: "ISTQB",
    kind: "official-sample-exam-answers",
    role: "Official answers and rationales for sample exam A.",
    checkedAt,
  },
];
