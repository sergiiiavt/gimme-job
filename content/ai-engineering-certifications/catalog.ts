import { certificationChapter as chapter, type CertificationModule, type CertificationMockExamSettings } from "../certification-catalog";
import claudeExamPlan from "./claude/01-exam-plan.md?raw";
import claudeAgenticArchitecture from "./claude/02-agentic-architecture.md?raw";
import claudeCode from "./claude/03-claude-code.md?raw";
import claudePromptsStructuredOutput from "./claude/04-prompts-structured-output.md?raw";
import claudeToolsMcp from "./claude/05-tools-mcp.md?raw";
import claudeContextReliability from "./claude/06-context-reliability.md?raw";
import claudeDeveloperApi from "./claude/07-developer-api.md?raw";
import claudeHandsOnLabs from "./claude/08-hands-on-labs.md?raw";
import claudeMockExam from "./claude/09-mock-exam.md?raw";
import claudeFinalReview from "./claude/10-final-review.md?raw";
import copilotExamPlan from "./copilot/01-exam-plan.md?raw";
import copilotFeatures from "./copilot/02-copilot-features.md?raw";
import copilotResponsibleUse from "./copilot/03-responsible-use.md?raw";
import copilotDataArchitecture from "./copilot/04-data-architecture.md?raw";
import copilotPromptingProductivity from "./copilot/05-prompting-productivity.md?raw";
import copilotPrivacySafeguards from "./copilot/06-privacy-safeguards.md?raw";
import copilotHandsOnLab from "./copilot/07-hands-on-lab.md?raw";
import copilotMockExam from "./copilot/08-mock-exam.md?raw";
import copilotFinalReview from "./copilot/09-final-review.md?raw";
import { claudeCertificationSources, githubCopilotCertificationSources } from "./sources";

const claudeTaxonomy: CertificationModule[] = [
  chapter({
    id: "claude-exam-plan",
    label: "Exam map & study plan",
    navLabel: "Exam map",
    level: "Start here",
    description: "The four Claude certifications, who can sit them, exam rules, CCAR-F and CCDV-F domains, and how to pace this track.",
    sourceIds: ["anthropic-certification-faq", "anthropic-certification-announcement", "anthropic-academy", "pearson-anthropic", "aim-ccar-f-launch", "ccar-domain-weights", "ccdv-f-domains"],
  }, claudeExamPlan),
  chapter({
    id: "agentic-architecture",
    label: "Agentic architecture & orchestration",
    navLabel: "Agentic architecture",
    level: "CCAR-F · 27%",
    description: "The agent loop, coordinator and subagents, hooks for rules that must always hold, escalation and sessions.",
    sourceIds: ["claude-docs", "aim-ccar-f-launch"],
  }, claudeAgenticArchitecture),
  chapter({
    id: "claude-code",
    label: "Claude Code configuration & workflows",
    navLabel: "Claude Code",
    level: "CCAR-F · 20%",
    description: "The CLAUDE.md hierarchy, path-scoped rules, commands and skills, plan mode, and Claude Code in CI/CD.",
    sourceIds: ["claude-docs", "anthropic-academy"],
  }, claudeCode),
  chapter({
    id: "prompts-structured-output",
    label: "Prompt engineering & structured output",
    navLabel: "Prompts & output",
    level: "CCAR-F · 20%",
    description: "Explicit criteria, few-shot examples, honest schemas, validation and retry, and the Message Batches API.",
    sourceIds: ["claude-docs"],
  }, claudePromptsStructuredOutput),
  chapter({
    id: "tools-mcp",
    label: "Tool design & MCP integration",
    navLabel: "Tools & MCP",
    level: "CCAR-F · 18%",
    description: "Tool descriptions, scoped tool sets, tool_choice, structured errors, MCP configuration and built-in tools.",
    sourceIds: ["claude-docs", "mcp-specification"],
  }, claudeToolsMcp),
  chapter({
    id: "context-reliability",
    label: "Context management & reliability",
    navLabel: "Context & reliability",
    level: "CCAR-F · 15%",
    description: "Case facts that survive summarisation, trimmed tool output, error propagation, stratified evaluation and provenance.",
    sourceIds: ["claude-docs"],
  }, claudeContextReliability),
  chapter({
    id: "developer-api",
    label: "Developer API depth (CCDV-F)",
    navLabel: "Developer API",
    level: "CCDV-F",
    description: "Request shape, streaming events, stop reasons, retries, batches, prompt caching, model tiers, platforms and security.",
    sourceIds: ["claude-docs", "ccdv-f-domains"],
  }, claudeDeveloperApi),
  chapter({
    id: "claude-hands-on-labs",
    label: "Hands-on labs",
    navLabel: "Labs",
    level: "Practice",
    description: "Five labs that cover every CCAR-F scenario and each leave a working GimmeJob feature behind.",
    sourceIds: ["claude-docs", "mcp-specification", "anthropic-academy"],
  }, claudeHandsOnLabs),
  chapter({
    id: "claude-mock-exam",
    label: "Original mock exam — 40 questions",
    navLabel: "Mock exam · 40",
    level: "Exam practice",
    description: "Forty original scenario questions across the six CCAR-F scenarios and the CCDV-F API delta, with an explanation key.",
    sourceIds: ["aim-ccar-f-launch", "ccar-domain-weights", "ccdv-f-domains"],
  }, claudeMockExam),
  chapter({
    id: "claude-final-review",
    label: "Final review & exam-day checklist",
    navLabel: "Final review",
    level: "Revision",
    description: "The meta-rule, six distractor patterns, high-yield distinctions and a readiness checklist.",
    sourceIds: ["anthropic-certification-faq", "pearson-anthropic"],
  }, claudeFinalReview),
];

const githubCopilotTaxonomy: CertificationModule[] = [
  chapter({
    id: "gh300-exam-plan",
    label: "Exam map & study plan",
    navLabel: "Exam map",
    level: "Start here",
    description: "GH-300 format, scoring, domains, where candidates lose points, and how to pace this track.",
    sourceIds: ["gh300-study-guide", "gh300-certification-page", "theserverside-gh300"],
  }, copilotExamPlan),
  chapter({
    id: "copilot-features",
    label: "Copilot features",
    navLabel: "Features",
    level: "GH-300 · 25–30%",
    description: "Every Copilot surface, chat vocabulary, agent mode with MCP and sub-agents, customisation files and organization administration.",
    sourceIds: ["gh300-study-guide", "ms-copilot-security-controls"],
  }, copilotFeatures),
  chapter({
    id: "responsible-use",
    label: "Responsible use",
    navLabel: "Responsible use",
    level: "GH-300 · 15–20%",
    description: "Generative AI risks, validating output, operating Copilot responsibly and ownership of what ships.",
    sourceIds: ["gh300-study-guide"],
  }, copilotResponsibleUse),
  chapter({
    id: "data-architecture",
    label: "Data & architecture",
    navLabel: "Data & architecture",
    level: "GH-300 · 10–15%",
    description: "The suggestion lifecycle from context to display, how context is chosen, data usage and model limitations.",
    sourceIds: ["gh300-study-guide", "ms-copilot-security-controls"],
  }, copilotDataArchitecture),
  chapter({
    id: "prompting-productivity",
    label: "Prompting, productivity & testing",
    navLabel: "Prompting & testing",
    level: "GH-300 · 20–30%",
    description: "The 4 S's, zero-shot and few-shot, prompt files, productivity uses and generating tests that do not mirror bugs.",
    sourceIds: ["gh300-study-guide"],
  }, copilotPromptingProductivity),
  chapter({
    id: "privacy-safeguards",
    label: "Privacy, content exclusion & safeguards",
    navLabel: "Privacy & safeguards",
    level: "GH-300 · 10–15%",
    description: "Content exclusion and its limits, the 2026 change on agentic surfaces, the public-code filter and troubleshooting.",
    sourceIds: ["github-content-exclusion", "github-configure-content-exclusion", "github-exclusion-changelog", "ms-copilot-security-controls"],
  }, copilotPrivacySafeguards),
  chapter({
    id: "gh300-hands-on-lab",
    label: "Hands-on lab in the gimme-job repository",
    navLabel: "Lab",
    level: "Practice",
    description: "One lab in this repository that exercises instructions, prompt files, agent mode, code review, the CLI and safeguards.",
    sourceIds: ["gh300-study-guide"],
  }, copilotHandsOnLab),
  chapter({
    id: "gh300-mock-exam",
    label: "Original mock exam — 30 questions",
    navLabel: "Mock exam · 30",
    level: "Exam practice",
    description: "Thirty original GH-300-style questions across all domains, with an explanation key.",
    sourceIds: ["gh300-study-guide", "github-content-exclusion"],
  }, copilotMockExam),
  chapter({
    id: "gh300-final-review",
    label: "Final review & exam-day checklist",
    navLabel: "Final review",
    level: "Revision",
    description: "High-yield distinctions, distractor patterns and a readiness checklist.",
    sourceIds: ["gh300-study-guide", "gh300-certification-page"],
  }, copilotFinalReview),
];

export const claudeCertificationCatalog = {
  trackId: "claude-architect",
  trackLabel: "Claude CCAR-F",
  version: 1,
  title: "Claude Certified Architect & Developer Exam Preparation",
  titleUk: "Підготовка до іспитів Claude Certified Architect і Developer",
  description: "A self-study path for Anthropic's Claude Certified Architect – Foundations exam with the API delta for Developer – Foundations: every domain, worked examples, hands-on labs that build GimmeJob features, a 40-question original mock exam, and a final review.",
  descriptionUk: "Self-study learning path для іспиту Claude Certified Architect – Foundations з доповненням для Developer – Foundations: усі домени, розібрані приклади, практичні лабораторні, 40 авторських питань mock exam і фінальне повторення.",
  lastReviewedAt: "2026-11-23",
  taxonomy: claudeTaxonomy,
  sources: claudeCertificationSources,
  mockExam: {
    scoreNote: "This mock uses one question = one practice mark. Claude exams report a scaled score from 100 to 1,000 with 720 to pass, so treat this percentage as a diagnostic.",
    evaluationTexts: {
      strong: "Take the official practice exam and book once it reports 900 or more.",
      close: "Reread the chapters behind every wrong answer, then retake this mock.",
      gaps: "Redo the hands-on labs for your weakest domain before another mock.",
      more: "Return to the chapter sequence before doing more mock exams.",
    },
  } satisfies CertificationMockExamSettings,
};

export const githubCopilotCertificationCatalog = {
  trackId: "github-copilot-gh-300",
  trackLabel: "GitHub Copilot GH-300",
  version: 1,
  title: "GitHub Copilot (GH-300) Exam Preparation",
  titleUk: "Підготовка до іспиту GitHub Copilot (GH-300)",
  description: "A self-study path for Microsoft's GH-300 GitHub Copilot exam: features, responsible use, data flow, prompting and testing, privacy and safeguards, a hands-on lab in this repository, a 30-question original mock exam, and a final review.",
  descriptionUk: "Self-study learning path для іспиту GH-300 GitHub Copilot: функції, відповідальне використання, потік даних, промптинг і тестування, приватність і запобіжники, лабораторна в цьому репозиторії, 30 авторських питань mock exam і фінальне повторення.",
  lastReviewedAt: "2026-11-23",
  taxonomy: githubCopilotTaxonomy,
  sources: githubCopilotCertificationSources,
  mockExam: {
    scoreNote: "This mock uses one question = one practice mark. GH-300 reports a scaled score out of 1,000 with 700 to pass, so treat this percentage as a diagnostic.",
    evaluationTexts: {
      strong: "Take Microsoft's free practice assessment, then book the exam.",
      close: "Reread the chapters behind every wrong answer, then retake this mock.",
      gaps: "Redo the Copilot lab in the gimme-job repository before another mock.",
      more: "Return to the chapter sequence before doing more mock exams.",
    },
  } satisfies CertificationMockExamSettings,
};

export const aiEngineeringCertificationCatalogs = [claudeCertificationCatalog, githubCopilotCertificationCatalog];
