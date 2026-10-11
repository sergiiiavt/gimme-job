import { notFound } from "next/navigation";
import PublicSite from "../../public-site";
import { LEARNING_SEO } from "../../seo";

export default async function PublicLearningSectionPage({ params }: Readonly<{ params: Promise<{ section: string }> }>) {
  const { section } = await params;
  if (!Object.hasOwn(LEARNING_SEO, section)) notFound();

  return <PublicSite key={section}/>;
}
