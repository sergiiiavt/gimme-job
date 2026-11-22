import { notFound } from "next/navigation";
import QuickReferencePage from "../../quick-reference-page";

const publishedQuickReferenceIds = new Set(["qa-fundamentals", "programming", "data"]);

type ReferencePageProps = Readonly<{
  params: Promise<{ section: string }>;
  searchParams: Promise<Readonly<Record<string, string | string[] | undefined>>>;
}>;

function single(value: string | string[] | undefined): string | undefined {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

export default async function ReferencePage({ params, searchParams }: ReferencePageProps) {
  const [{ section }, query] = await Promise.all([params, searchParams]);
  if (!publishedQuickReferenceIds.has(section)) notFound();

  // `?topic=` opens one card; a new target remounts the page so its filters and expansion follow the link.
  const topic = single(query.topic);
  const track = single(query.track);
  return <QuickReferencePage key={`${topic ?? ""}\n${track ?? ""}`} referenceId={section} topic={topic} track={track}/>;
}
