import type { Metadata } from "next";
import { referenceSectionMetadata } from "../../seo";

export async function generateMetadata({ params }: { params: Promise<{ section: string }> }): Promise<Metadata> {
  const { section } = await params;
  return referenceSectionMetadata(section);
}

export default function ReferenceSectionLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return children;
}
