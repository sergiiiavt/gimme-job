import { createPageMetadata } from "../seo";

export const metadata = createPageMetadata({
  title: "QA & Software Testing News",
  description: "Curated QA, software testing, automation, AI, tooling, and quality engineering news and updates.",
  path: "/news",
});

export default function NewsLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return children;
}
