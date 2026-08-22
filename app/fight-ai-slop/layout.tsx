import { createPageMetadata } from "../seo";

export const metadata = createPageMetadata({
  title: "Fight AI Slop",
  description: "Fight AI Slop, an experimental interactive GimmeJob project exploring deliberate craft and human judgment in AI-assisted work.",
  path: "/fight-ai-slop",
});

export default function FightAiSlopLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return children;
}
