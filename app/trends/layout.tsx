import { createPageMetadata } from "../seo";

export const metadata = createPageMetadata({
  title: "QA Engineering Trends",
  description: "QA engineering trends across testing, automation, AI, tools, skills, and the software quality job market.",
  path: "/trends",
});

export default function TrendsLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return children;
}
