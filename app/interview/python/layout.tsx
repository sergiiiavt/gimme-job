import { createPageMetadata } from "../../seo";

export const metadata = createPageMetadata({
  title: "Python Interview Questions for QA Automation",
  description: "Practical Python interview questions and answers for QA automation engineers, with code examples, runnable exercises, core language concepts, and testing scenarios.",
  path: "/interview/python",
});

export default function PythonInterviewLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return children;
}
