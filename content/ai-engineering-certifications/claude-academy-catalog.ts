import { certificationChapter as chapter, type CertificationModule, type CertificationMockExamSettings } from "../certification-catalog";
import claude101CourseMap from "./claude-101/01-course-map.md?raw";
import claude101UsingClaude from "./claude-101/02-using-claude.md?raw";
import claude101ProjectsArtifactsSkills from "./claude-101/03-projects-artifacts-skills.md?raw";
import claude101ConnectorsResearch from "./claude-101/04-connectors-research.md?raw";
import claude101PracticeQuiz from "./claude-101/05-practice-quiz.md?raw";
import claude101FinalReview from "./claude-101/06-final-review.md?raw";
import claudeCode101CourseMap from "./claude-code-101/01-course-map.md?raw";
import claudeCode101HowItWorks from "./claude-code-101/02-how-it-works.md?raw";
import claudeCode101DailyWorkflows from "./claude-code-101/03-daily-workflows.md?raw";
import claudeCode101Customizing from "./claude-code-101/04-customizing.md?raw";
import claudeCode101HandsOnLab from "./claude-code-101/05-hands-on-lab.md?raw";
import claudeCode101PracticeQuiz from "./claude-code-101/06-practice-quiz.md?raw";
import claudeCode101FinalReview from "./claude-code-101/07-final-review.md?raw";
import claudePlatform101CourseMap from "./claude-platform-101/01-course-map.md?raw";
import claudePlatform101FirstRequest from "./claude-platform-101/02-first-request.md?raw";
import claudePlatform101AgentLoop from "./claude-platform-101/03-agent-loop-tools.md?raw";
import claudePlatform101Extending from "./claude-platform-101/04-extending-agents.md?raw";
import claudePlatform101HandsOnLab from "./claude-platform-101/05-hands-on-lab.md?raw";
import claudePlatform101PracticeQuiz from "./claude-platform-101/06-practice-quiz.md?raw";
import claudePlatform101FinalReview from "./claude-platform-101/07-final-review.md?raw";
import { claude101Sources, claudeCode101Sources, claudePlatform101Sources } from "./sources";

const academyBadgeSources = ["anthropic-academy", "claude-academy-guide"];

/** Practice-quiz settings shared by the free Claude Academy course tracks. */
const academyQuiz = (course: string): CertificationMockExamSettings => ({
  scoreNote: `This quiz uses one question = one practice mark. The ${course} course quiz only needs a pass, so use the percentage to decide what to reread.`,
  evaluationTexts: {
    strong: `Take ${course} on Claude Academy now.`,
    close: "Reread the chapter behind each wrong answer, then retake this quiz.",
    gaps: "Redo the study chapters for your weakest topic before retaking this quiz.",
    more: "Read the study chapters again before taking the course.",
  },
});

const claude101Taxonomy: CertificationModule[] = [
  chapter({
    id: "c101-course-map",
    label: "Course map & badge",
    navLabel: "Course map",
    level: "Start here · free",
    description: "What Claude 101 covers, who can take it, how the free badge works and how to list it on a CV.",
    sourceIds: ["claude-101-course", "claude-research-help", "claude-enterprise-search-help", ...academyBadgeSources],
  }, claude101CourseMap),
  chapter({
    id: "c101-using-claude",
    label: "Using Claude well",
    navLabel: "Using Claude well",
    level: "Meet Claude",
    description: "What Claude is, how a chat gets its context, prompting habits that work, and the desktop app's modes.",
    sourceIds: ["claude-101-course", "prompt-engineering-docs", "claude-projects-help"],
  }, claude101UsingClaude),
  chapter({
    id: "c101-projects-artifacts-skills",
    label: "Projects, artifacts & skills",
    navLabel: "Projects & skills",
    level: "Organizing work",
    description: "Project knowledge and instructions, artifacts, skills and progressive disclosure, and when to use which.",
    sourceIds: ["claude-projects-help", "claude-artifacts-help", "claude-artifacts-sharing-help", "claude-skills-help"],
  }, claude101ProjectsArtifactsSkills),
  chapter({
    id: "c101-connectors-research",
    label: "Connectors, enterprise search & Research",
    navLabel: "Connectors & Research",
    level: "Expanding reach",
    description: "Connectors and inherited permissions, Research, enterprise search, and picking the right feature for a request.",
    sourceIds: ["claude-connectors-help", "claude-research-help", "claude-enterprise-search-help"],
  }, claude101ConnectorsResearch),
  chapter({
    id: "c101-mock-exam",
    label: "Practice quiz — 15 questions",
    navLabel: "Practice quiz · 15",
    level: "Quiz practice",
    description: "Fifteen original questions on Claude 101 topics, with an explanation key.",
    sourceIds: ["claude-projects-help", "claude-skills-help", "claude-connectors-help", "claude-research-help"],
  }, claude101PracticeQuiz),
  chapter({
    id: "c101-final-review",
    label: "Final review & next steps",
    navLabel: "Final review",
    level: "Revision",
    description: "Use cases by role, other ways to work with Claude, a checklist before the course quizzes, and what to take next.",
    sourceIds: ["claude-101-course", "claude-skills-help", ...academyBadgeSources],
  }, claude101FinalReview),
];

const claudeCode101Taxonomy: CertificationModule[] = [
  chapter({
    id: "cc101-course-map",
    label: "Course map & badge",
    navLabel: "Course map",
    level: "Start here · free",
    description: "What Claude Code 101 covers, what you need, how the free badge works and a study plan.",
    sourceIds: ["claude-code-101-course", "claude-code-101-coursera", ...academyBadgeSources],
  }, claudeCode101CourseMap),
  chapter({
    id: "cc101-how-it-works",
    label: "How Claude Code works",
    navLabel: "How it works",
    level: "Getting started",
    description: "The agent loop, where Claude Code runs, permission modes and Plan Mode, and good first prompts.",
    sourceIds: ["claude-code-101-course", "claude-code-docs", "claude-code-permission-modes"],
  }, claudeCode101HowItWorks),
  chapter({
    id: "cc101-daily-workflows",
    label: "Daily workflows",
    navLabel: "Daily workflows",
    level: "Workflows",
    description: "Explore → plan → code → commit, managing context with /context, /compact and /clear, and code review.",
    sourceIds: ["claude-code-101-course", "claude-code-docs", "claude-code-subagents"],
  }, claudeCode101DailyWorkflows),
  chapter({
    id: "cc101-customizing",
    label: "Customizing Claude Code",
    navLabel: "Customizing",
    level: "Customization",
    description: "CLAUDE.md, subagents, skills, MCP and hooks, and which one fits which job.",
    sourceIds: ["claude-code-101-course", "claude-code-subagents", "claude-code-hooks", "mcp-specification"],
  }, claudeCode101Customizing),
  chapter({
    id: "cc101-hands-on-lab",
    label: "Hands-on lab in the gimme-job repository",
    navLabel: "Lab",
    level: "Practice",
    description: "Project memory, Plan Mode, a reviewer subagent, a blocking hook and context commands in one lab.",
    sourceIds: ["claude-code-docs", "claude-code-subagents", "claude-code-hooks"],
  }, claudeCode101HandsOnLab),
  chapter({
    id: "cc101-mock-exam",
    label: "Practice quiz — 15 questions",
    navLabel: "Practice quiz · 15",
    level: "Quiz practice",
    description: "Fifteen original questions on Claude Code 101 topics, with an explanation key.",
    sourceIds: ["claude-code-permission-modes", "claude-code-subagents", "claude-code-hooks"],
  }, claudeCode101PracticeQuiz),
  chapter({
    id: "cc101-final-review",
    label: "Final review & checklist",
    navLabel: "Final review",
    level: "Revision",
    description: "High-yield distinctions, distractors to expect and a checklist before the course quiz.",
    sourceIds: ["claude-code-101-course", ...academyBadgeSources],
  }, claudeCode101FinalReview),
];

const claudePlatform101Taxonomy: CertificationModule[] = [
  chapter({
    id: "cp101-course-map",
    label: "Course map & badge",
    navLabel: "Course map",
    level: "Start here · free",
    description: "What Claude Platform 101 covers, what you need, how the free badge works and a study plan.",
    sourceIds: ["claude-platform-101-course", ...academyBadgeSources],
  }, claudePlatform101CourseMap),
  chapter({
    id: "cp101-first-request",
    label: "First request & model choice",
    navLabel: "First request",
    level: "Platform basics",
    description: "Request and response shape, stop reasons and usage, choosing a model on evidence, and keeping spend predictable.",
    sourceIds: ["claude-platform-101-course", "claude-docs"],
  }, claudePlatform101FirstRequest),
  chapter({
    id: "cp101-agent-loop",
    label: "Agent loop & tools",
    navLabel: "Agent loop & tools",
    level: "Teaching your agent",
    description: "The tool-use loop, tool definitions and tool_choice, thinking, and moving from a hand-written loop to the Tool Runner.",
    sourceIds: ["claude-platform-101-course", "claude-docs", "tool-runner-docs"],
  }, claudePlatform101AgentLoop),
  chapter({
    id: "cp101-extending",
    label: "Extending your agent",
    navLabel: "Extending your agent",
    level: "Extending & managed agents",
    description: "Built-in tools, skills, MCP, context management and Claude Managed Agents.",
    sourceIds: ["claude-platform-101-course", "mcp-specification", "managed-agents-docs"],
  }, claudePlatform101Extending),
  chapter({
    id: "cp101-hands-on-lab",
    label: "Hands-on lab: a vacancy-research agent",
    navLabel: "Lab",
    level: "Practice",
    description: "A first call, a model comparison, a hand-written loop, the Tool Runner, built-in tools and an optional managed agent.",
    sourceIds: ["claude-docs", "tool-runner-docs", "managed-agents-docs"],
  }, claudePlatform101HandsOnLab),
  chapter({
    id: "cp101-mock-exam",
    label: "Practice quiz — 15 questions",
    navLabel: "Practice quiz · 15",
    level: "Quiz practice",
    description: "Fifteen original questions on Claude Platform 101 topics, with an explanation key.",
    sourceIds: ["claude-docs", "tool-runner-docs", "managed-agents-docs"],
  }, claudePlatform101PracticeQuiz),
  chapter({
    id: "cp101-final-review",
    label: "Final review & checklist",
    navLabel: "Final review",
    level: "Revision",
    description: "High-yield distinctions, distractors to expect and a checklist before the course quiz.",
    sourceIds: ["claude-platform-101-course", ...academyBadgeSources],
  }, claudePlatform101FinalReview),
];

export const claude101Catalog = {
  trackId: "claude-101",
  trackLabel: "Claude 101",
  version: 1,
  title: "Claude 101 Course Preparation",
  titleUk: "Підготовка до курсу Claude 101",
  description: "Everything for the free Claude 101 badge on Claude Academy: course map, study notes on prompting, projects, artifacts, skills, connectors and Research, a 15-question practice quiz and a final checklist.",
  descriptionUk: "Усе для безкоштовного бейджа Claude 101 на Claude Academy: карта курсу, конспекти про промптинг, projects, artifacts, skills, connectors і Research, 15 тренувальних питань і фінальний чеклист.",
  lastReviewedAt: "2026-11-24",
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
  description: "Everything for the free Claude Code 101 badge on Claude Academy: course map, study notes on the agent loop, permission modes, daily workflows and customization, a hands-on lab in this repository, a 15-question practice quiz and a final checklist.",
  descriptionUk: "Усе для безкоштовного бейджа Claude Code 101 на Claude Academy: карта курсу, конспекти про agent loop, permission modes, щоденні workflows і налаштування, лабораторна в цьому репозиторії, 15 тренувальних питань і фінальний чеклист.",
  lastReviewedAt: "2026-11-24",
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
  description: "Everything for the free Claude Platform 101 badge on Claude Academy: course map, study notes on requests, model choice, the agent loop, tools, MCP and managed agents, a hands-on lab, a 15-question practice quiz and a final checklist.",
  descriptionUk: "Усе для безкоштовного бейджа Claude Platform 101 на Claude Academy: карта курсу, конспекти про запити, вибір моделі, agent loop, tools, MCP і managed agents, лабораторна, 15 тренувальних питань і фінальний чеклист.",
  lastReviewedAt: "2026-11-24",
  taxonomy: claudePlatform101Taxonomy,
  sources: claudePlatform101Sources,
  mockExam: academyQuiz("Claude Platform 101"),
};

export const claudeAcademyCatalogs = [claude101Catalog, claudeCode101Catalog, claudePlatform101Catalog];
