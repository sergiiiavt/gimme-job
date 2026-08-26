import type { Metadata } from "next";
import LearningPathAdvisor from "./learning-path-advisor";

export const metadata: Metadata = {
  title: "Learning Path Advisor | GimmeJob",
  description: "Build a focused learning path from GimmeJob materials and relevant interview questions.",
  robots: { index: false, follow: false, nocache: true },
};

export default function LearningPathAdvisorPage() {
  return <LearningPathAdvisor/>;
}
