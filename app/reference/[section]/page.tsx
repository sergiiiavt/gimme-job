import { notFound } from "next/navigation";
import QuickReferencePage from "../../quick-reference-page";
import ProgrammingReferenceTrackOverlay from "../../programming-reference-track-overlay";

const publishedQuickReferenceIds = new Set(["qa-fundamentals", "programming", "data"]);

export default async function ReferencePage({ params }: { params: Promise<{ section: string }> }) {
  const { section } = await params;
  if (!publishedQuickReferenceIds.has(section)) notFound();

  return (
    <>
      <QuickReferencePage referenceId={section}/>
      {section === "programming" ? <ProgrammingReferenceTrackOverlay/> : null}
    </>
  );
}
