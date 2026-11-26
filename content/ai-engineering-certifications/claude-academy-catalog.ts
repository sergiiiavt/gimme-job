import { certificationChapter as chapter, certificationTranslation as translation, type CertificationModule, type CertificationMockExamSettings } from "../certification-catalog";
import claude101CourseMap from "./claude-101/01-course-map.md?raw";
import claude101CourseMapUk from "./claude-101/01-course-map.uk.md?raw";
import claude101UsingClaude from "./claude-101/02-using-claude.md?raw";
import claude101UsingClaudeUk from "./claude-101/02-using-claude.uk.md?raw";
import claude101ProjectsArtifactsSkills from "./claude-101/03-projects-artifacts-skills.md?raw";
import claude101ProjectsArtifactsSkillsUk from "./claude-101/03-projects-artifacts-skills.uk.md?raw";
import claude101ConnectorsResearch from "./claude-101/04-connectors-research.md?raw";
import claude101ConnectorsResearchUk from "./claude-101/04-connectors-research.uk.md?raw";
import claude101PracticeQuiz from "./claude-101/05-practice-quiz.md?raw";
import claude101PracticeQuizUk from "./claude-101/05-practice-quiz.uk.md?raw";
import claude101FinalReview from "./claude-101/06-final-review.md?raw";
import claude101FinalReviewUk from "./claude-101/06-final-review.uk.md?raw";
import claudeCode101CourseMap from "./claude-code-101/01-course-map.md?raw";
import claudeCode101CourseMapUk from "./claude-code-101/01-course-map.uk.md?raw";
import claudeCode101HowItWorks from "./claude-code-101/02-how-it-works.md?raw";
import claudeCode101HowItWorksUk from "./claude-code-101/02-how-it-works.uk.md?raw";
import claudeCode101DailyWorkflows from "./claude-code-101/03-daily-workflows.md?raw";
import claudeCode101DailyWorkflowsUk from "./claude-code-101/03-daily-workflows.uk.md?raw";
import claudeCode101Customizing from "./claude-code-101/04-customizing.md?raw";
import claudeCode101CustomizingUk from "./claude-code-101/04-customizing.uk.md?raw";
import claudeCode101HandsOnLab from "./claude-code-101/05-hands-on-lab.md?raw";
import claudeCode101HandsOnLabUk from "./claude-code-101/05-hands-on-lab.uk.md?raw";
import claudeCode101PracticeQuiz from "./claude-code-101/06-practice-quiz.md?raw";
import claudeCode101PracticeQuizUk from "./claude-code-101/06-practice-quiz.uk.md?raw";
import claudeCode101FinalReview from "./claude-code-101/07-final-review.md?raw";
import claudeCode101FinalReviewUk from "./claude-code-101/07-final-review.uk.md?raw";
import claudePlatform101CourseMap from "./claude-platform-101/01-course-map.md?raw";
import claudePlatform101CourseMapUk from "./claude-platform-101/01-course-map.uk.md?raw";
import claudePlatform101FirstRequest from "./claude-platform-101/02-first-request.md?raw";
import claudePlatform101FirstRequestUk from "./claude-platform-101/02-first-request.uk.md?raw";
import claudePlatform101AgentLoop from "./claude-platform-101/03-agent-loop-tools.md?raw";
import claudePlatform101AgentLoopUk from "./claude-platform-101/03-agent-loop-tools.uk.md?raw";
import claudePlatform101Extending from "./claude-platform-101/04-extending-agents.md?raw";
import claudePlatform101ExtendingUk from "./claude-platform-101/04-extending-agents.uk.md?raw";
import claudePlatform101HandsOnLab from "./claude-platform-101/05-hands-on-lab.md?raw";
import claudePlatform101HandsOnLabUk from "./claude-platform-101/05-hands-on-lab.uk.md?raw";
import claudePlatform101PracticeQuiz from "./claude-platform-101/06-practice-quiz.md?raw";
import claudePlatform101PracticeQuizUk from "./claude-platform-101/06-practice-quiz.uk.md?raw";
import claudePlatform101FinalReview from "./claude-platform-101/07-final-review.md?raw";
import claudePlatform101FinalReviewUk from "./claude-platform-101/07-final-review.uk.md?raw";
import { claude101Sources, claudeCode101Sources, claudePlatform101Sources } from "./sources";

const academyBadgeSources = ["anthropic-academy", "claude-academy-guide"];

/** Practice-quiz settings shared by the free Claude Academy course tracks. */
const academyQuiz = (course: string): CertificationMockExamSettings => ({
  scoreNote: `This quiz uses one question = one practice mark. This is a diagnostic practice set, separate from the ${course} assessment.`,
  evaluationTexts: {
    strong: "Strong result on this practice set.",
    close: "Some answers need review.",
    gaps: "Several topics have gaps.",
    more: "Many topics have gaps.",
  },
});

const claude101Taxonomy: CertificationModule[] = [
  chapter({
    id: "c101-course-map",
    label: "Course map & badge",
    navLabel: "Course map",
    level: "Start here · free",
    description: "Claude 101 topics, prerequisites and completion badge.",
    sourceIds: ["claude-101-course", "claude-research-help", "claude-enterprise-search-help", ...academyBadgeSources],
  }, claude101CourseMap, translation(claude101CourseMapUk, "Початок · безкоштовно")),
  chapter({
    id: "c101-using-claude",
    label: "Using Claude well",
    navLabel: "Using Claude well",
    level: "Meet Claude",
    description: "What Claude is, how a chat gets its context, prompting habits that work, and the desktop app's modes.",
    sourceIds: ["claude-101-course", "prompt-engineering-docs", "claude-projects-help"],
  }, claude101UsingClaude, translation(claude101UsingClaudeUk, "Знайомство з Claude")),
  chapter({
    id: "c101-projects-artifacts-skills",
    label: "Projects, artifacts & skills",
    navLabel: "Projects & skills",
    level: "Organizing work",
    description: "Project knowledge and instructions, artifacts, skills and progressive disclosure, and when to use which.",
    sourceIds: ["claude-projects-help", "claude-artifacts-help", "claude-artifacts-sharing-help", "claude-skills-help"],
  }, claude101ProjectsArtifactsSkills, translation(claude101ProjectsArtifactsSkillsUk, "Організація роботи")),
  chapter({
    id: "c101-connectors-research",
    label: "Connectors, enterprise search & Research",
    navLabel: "Connectors & Research",
    level: "Expanding reach",
    description: "Connectors and inherited permissions, Research, enterprise search, and picking the right feature for a request.",
    sourceIds: ["claude-connectors-help", "claude-research-help", "claude-enterprise-search-help"],
  }, claude101ConnectorsResearch, translation(claude101ConnectorsResearchUk, "Доступ до джерел")),
  chapter({
    id: "c101-mock-exam",
    label: "Practice quiz — 15 questions",
    navLabel: "Practice quiz · 15",
    level: "Quiz practice",
    description: "Fifteen original questions on Claude 101 topics, with an explanation key.",
    sourceIds: ["claude-projects-help", "claude-skills-help", "claude-connectors-help", "claude-research-help"],
  }, claude101PracticeQuiz, translation(claude101PracticeQuizUk, "Пробний тест")),
  chapter({
    id: "c101-final-review",
    label: "Final review",
    navLabel: "Final review",
    level: "Revision",
    description: "Use cases by role and other ways to work with Claude.",
    sourceIds: ["claude-101-course", "claude-skills-help", ...academyBadgeSources],
  }, claude101FinalReview, translation(claude101FinalReviewUk, "Повторення")),
];

const claudeCode101Taxonomy: CertificationModule[] = [
  chapter({
    id: "cc101-course-map",
    label: "Course map & badge",
    navLabel: "Course map",
    level: "Start here · free",
    description: "Claude Code 101 topics, prerequisites and completion badge.",
    sourceIds: ["claude-code-101-course", "claude-code-101-coursera", ...academyBadgeSources],
  }, claudeCode101CourseMap, translation(claudeCode101CourseMapUk, "Початок · безкоштовно")),
  chapter({
    id: "cc101-how-it-works",
    label: "How Claude Code works",
    navLabel: "How it works",
    level: "Getting started",
    description: "The agent loop, where Claude Code runs, permission modes and Plan Mode, and good first prompts.",
    sourceIds: ["claude-code-101-course", "claude-code-docs", "claude-code-permission-modes"],
  }, claudeCode101HowItWorks, translation(claudeCode101HowItWorksUk, "Початок")),
  chapter({
    id: "cc101-daily-workflows",
    label: "Daily workflows",
    navLabel: "Daily workflows",
    level: "Workflows",
    description: "Explore → plan → code → commit, managing context with /context, /compact and /clear, and code review.",
    sourceIds: ["claude-code-101-course", "claude-code-docs", "claude-code-subagents"],
  }, claudeCode101DailyWorkflows, translation(claudeCode101DailyWorkflowsUk, "Робочі процеси")),
  chapter({
    id: "cc101-customizing",
    label: "Customizing Claude Code",
    navLabel: "Customizing",
    level: "Customization",
    description: "CLAUDE.md, subagents, skills, MCP and hooks, and which one fits which job.",
    sourceIds: ["claude-code-101-course", "claude-code-subagents", "claude-code-hooks", "mcp-specification"],
  }, claudeCode101Customizing, translation(claudeCode101CustomizingUk, "Налаштування")),
  chapter({
    id: "cc101-hands-on-lab",
    label: "Hands-on lab in the gimme-job repository",
    navLabel: "Lab",
    level: "Practice",
    description: "Project memory, Plan Mode, a reviewer subagent, a blocking hook and context commands in one lab.",
    sourceIds: ["claude-code-docs", "claude-code-subagents", "claude-code-hooks"],
  }, claudeCode101HandsOnLab, translation(claudeCode101HandsOnLabUk, "Практика")),
  chapter({
    id: "cc101-mock-exam",
    label: "Practice quiz — 15 questions",
    navLabel: "Practice quiz · 15",
    level: "Quiz practice",
    description: "Fifteen original questions on Claude Code 101 topics, with an explanation key.",
    sourceIds: ["claude-code-permission-modes", "claude-code-subagents", "claude-code-hooks"],
  }, claudeCode101PracticeQuiz, translation(claudeCode101PracticeQuizUk, "Пробний тест")),
  chapter({
    id: "cc101-final-review",
    label: "Final review",
    navLabel: "Final review",
    level: "Revision",
    description: "High-yield distinctions and common misconceptions.",
    sourceIds: ["claude-code-101-course", ...academyBadgeSources],
  }, claudeCode101FinalReview, translation(claudeCode101FinalReviewUk, "Повторення")),
];

const claudePlatform101Taxonomy: CertificationModule[] = [
  chapter({
    id: "cp101-course-map",
    label: "Course map & badge",
    navLabel: "Course map",
    level: "Start here · free",
    description: "Claude Platform 101 topics, prerequisites and completion badge.",
    sourceIds: ["claude-platform-101-course", ...academyBadgeSources],
  }, claudePlatform101CourseMap, translation(claudePlatform101CourseMapUk, "Початок · безкоштовно")),
  chapter({
    id: "cp101-first-request",
    label: "First request & model choice",
    navLabel: "First request",
    level: "Platform basics",
    description: "Request and response shape, stop reasons and usage, choosing a model on evidence, and keeping spend predictable.",
    sourceIds: ["claude-platform-101-course", "claude-docs"],
  }, claudePlatform101FirstRequest, translation(claudePlatform101FirstRequestUk, "Навчальний матеріал")),
  chapter({
    id: "cp101-agent-loop",
    label: "Agent loop & tools",
    navLabel: "Agent loop & tools",
    level: "Teaching your agent",
    description: "The tool-use loop, tool definitions and tool_choice, thinking, and moving from a hand-written loop to the Tool Runner.",
    sourceIds: ["claude-platform-101-course", "claude-docs", "tool-runner-docs"],
  }, claudePlatform101AgentLoop, translation(claudePlatform101AgentLoopUk, "Навчальний матеріал")),
  chapter({
    id: "cp101-extending",
    label: "Extending your agent",
    navLabel: "Extending your agent",
    level: "Extending & managed agents",
    description: "Built-in tools, skills, MCP, context management and Claude Managed Agents.",
    sourceIds: ["claude-platform-101-course", "mcp-specification", "managed-agents-docs"],
  }, claudePlatform101Extending, translation(claudePlatform101ExtendingUk, "Навчальний матеріал")),
  chapter({
    id: "cp101-hands-on-lab",
    label: "Hands-on lab: a vacancy-research agent",
    navLabel: "Lab",
    level: "Practice",
    description: "A first call, a model comparison, a hand-written loop, the Tool Runner, built-in tools and an optional managed agent.",
    sourceIds: ["claude-docs", "tool-runner-docs", "managed-agents-docs"],
  }, claudePlatform101HandsOnLab, translation(claudePlatform101HandsOnLabUk, "Практика")),
  chapter({
    id: "cp101-mock-exam",
    label: "Practice quiz — 15 questions",
    navLabel: "Practice quiz · 15",
    level: "Quiz practice",
    description: "Fifteen original questions on Claude Platform 101 topics, with an explanation key.",
    sourceIds: ["claude-docs", "tool-runner-docs", "managed-agents-docs"],
  }, claudePlatform101PracticeQuiz, translation(claudePlatform101PracticeQuizUk, "Пробний тест")),
  chapter({
    id: "cp101-final-review",
    label: "Final review",
    navLabel: "Final review",
    level: "Revision",
    description: "High-yield distinctions and common misconceptions.",
    sourceIds: ["claude-platform-101-course", ...academyBadgeSources],
  }, claudePlatform101FinalReview, translation(claudePlatform101FinalReviewUk, "Повторення")),
];

export const claude101Catalog = {
  trackId: "claude-101",
  trackLabel: "Claude 101",
  version: 1,
  title: "Claude 101 Course Preparation",
  titleUk: "Підготовка до курсу Claude 101",
  description: "Everything for the free Claude 101 badge on Claude Academy: course map, study notes on prompting, projects, artifacts, skills, connectors and Research, a 15-question practice quiz and a final review.",
  descriptionUk: "Усе для безкоштовного бейджа Claude 101 на Claude Academy: карта курсу, конспекти про промптинг, projects, artifacts, skills, connectors і Research, 15 тренувальних питань і фінальне повторення.",
  lastReviewedAt: "2026-11-25",
  taxonomy: claude101Taxonomy,
  sources: claude101Sources,
  mockExam: academyQuiz("Claude 101"),
};

export const claudeCode101Catalog = {
  trackId: "claude-code-101",
  trackLabel: "Claude Code 101",
  version: 1,
  title: "Claude Code 101 Course Preparation",
  titleUk: "Підготовка до курсу Claude Code 101",
  description: "Everything for the free Claude Code 101 badge on Claude Academy: course map, study notes on the agent loop, permission modes, daily workflows and customization, a hands-on lab in this repository, a 15-question practice quiz and a final review.",
  descriptionUk: "Усе для безкоштовного бейджа Claude Code 101 на Claude Academy: карта курсу, конспекти про agent loop, permission modes, щоденні workflows і налаштування, лабораторна в цьому репозиторії, 15 тренувальних питань і фінальне повторення.",
  lastReviewedAt: "2026-11-25",
  taxonomy: claudeCode101Taxonomy,
  sources: claudeCode101Sources,
  mockExam: academyQuiz("Claude Code 101"),
};

export const claudePlatform101Catalog = {
  trackId: "claude-platform-101",
  trackLabel: "Claude Platform 101",
  version: 1,
  title: "Claude Platform 101 Course Preparation",
  titleUk: "Підготовка до курсу Claude Platform 101",
  description: "Everything for the free Claude Platform 101 badge on Claude Academy: course map, study notes on requests, model choice, the agent loop, tools, MCP and managed agents, a hands-on lab, a 15-question practice quiz and a final review.",
  descriptionUk: "Усе для безкоштовного бейджа Claude Platform 101 на Claude Academy: карта курсу, конспекти про запити, вибір моделі, agent loop, tools, MCP і managed agents, лабораторна, 15 тренувальних питань і фінальне повторення.",
  lastReviewedAt: "2026-11-25",
  taxonomy: claudePlatform101Taxonomy,
  sources: claudePlatform101Sources,
  mockExam: academyQuiz("Claude Platform 101"),
};

export const claudeAcademyCatalogs = [claude101Catalog, claudeCode101Catalog, claudePlatform101Catalog];
