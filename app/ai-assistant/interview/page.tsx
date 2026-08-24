import type { Metadata } from "next";
import InterviewSimulator from "../../interview/simulator/interview-simulator";

export const metadata: Metadata = {
  title: "Interactive Interview | GimmeJob",
  description: "Run a focused QA or Python interview, receive structured feedback, and build a personal progress history.",
  robots: { index: false, follow: false, nocache: true },
};

export default function InteractiveInterviewPage() {
  return <InterviewSimulator/>;
}
