import type { Metadata } from "next";
import { learningSectionMetadata, legacyReferenceMetadata } from "../../seo";

export async function generateMetadata({ params }: { params: Promise<{ section: string }> }): Promise<Metadata> {
  const { section } = await params;
  if (section === "data") return legacyReferenceMetadata("data");
  return learningSectionMetadata(section);
}

export default function LearningSectionLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return children;
}
