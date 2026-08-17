import { notFound } from "next/navigation";
import QuickReferencePage from "../../quick-reference-page";

const publishedQuickReferenceIds = new Set(["programming", "data"]);

export default async function ReferencePage({ params }: { params: Promise<{ section: string }> }) {
  const { section } = await params;
  if (!publishedQuickReferenceIds.has(section)) notFound();
  return <QuickReferencePage referenceId={section}/>;
}
