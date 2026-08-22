import { createPageMetadata } from "../seo";

export const metadata = createPageMetadata({
  title: "QA Interview Questions & Answers",
  description: "Practical QA interview questions and answers covering software testing, test design, APIs, databases, automation, strategy, metrics, and real engineering scenarios.",
  path: "/interview",
});

export default function InterviewLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return children;
}
