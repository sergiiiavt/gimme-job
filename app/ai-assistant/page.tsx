import type { Metadata } from "next";
import LearningPathAdvisor from "./learning-path-advisor";

export const metadata: Metadata = {
  title: "Learning Path Advisor | GimmeJob",
  description: "Build a source-backed learning map from GimmeJob's Git-versioned knowledge with an observable LangGraph workflow.",
  robots: { index: false, follow: false, nocache: true },
};

export default function LearningPathAdvisorPage() {
  return <LearningPathAdvisor/>;
}
