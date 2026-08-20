import type { Metadata } from "next";
import InterviewSimulator from "./interview-simulator";

export const metadata: Metadata = {
  title: "AI Interview Simulator | GimmeJob",
  description: "Run a focused QA or Python interview, receive structured feedback, and build a personal progress history.",
  robots: { index: false, follow: false },
};

export default function InterviewSimulatorPage() {
  return <InterviewSimulator/>;
}
