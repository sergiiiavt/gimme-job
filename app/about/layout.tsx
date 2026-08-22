import { createPageMetadata } from "../seo";

export const metadata = createPageMetadata({
  title: "About GimmeJob",
  description: "About GimmeJob: a practical QA engineering knowledge base and career toolkit covering interview preparation, learning paths, automation, AI, and software quality.",
  path: "/about",
});

export default function AboutLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return children;
}
