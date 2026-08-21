import type { Metadata } from "next";
import AgenticLearningPage from "../../agentic-learning-page";

export const metadata: Metadata = {
  title: "AI Agents & MCP — GimmeJob",
  description: "Practical agentic learning materials with embedded Ukrainian Claude Code and Claude Cowork video resources.",
};

export default function PublicAgenticLearningPage() {
  return <AgenticLearningPage/>;
}
