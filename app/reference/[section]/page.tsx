import QuickReferencePage from "../../quick-reference-page";

export default async function ReferencePage({ params }: { params: Promise<{ section: string }> }) {
  const { section } = await params;
  return <QuickReferencePage referenceId={section}/>;
}
