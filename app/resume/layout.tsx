import { createPageMetadata } from "../seo";

export const metadata = createPageMetadata({
  title: "QA Engineer Resume",
  description: "QA engineering resume covering test leadership, automation, Python, Playwright, API testing, AI and LLM testing, and quality engineering experience.",
  path: "/resume",
});

export default function ResumeLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return children;
}
