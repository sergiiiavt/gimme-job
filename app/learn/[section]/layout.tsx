import type { Metadata } from "next";
import { createPageMetadata, LEARNING_SEO, noIndexMetadata } from "../../seo";

export async function generateMetadata({ params }: { params: Promise<{ section: string }> }): Promise<Metadata> {
  const { section } = await params;
  return Object.hasOwn(LEARNING_SEO, section)
    ? createPageMetadata(LEARNING_SEO[section])
    : noIndexMetadata("Learning section", "Unknown learning section.");
}

export default function LearningSectionLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return children;
}
