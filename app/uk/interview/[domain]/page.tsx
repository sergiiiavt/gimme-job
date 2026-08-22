import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { SITE_ORIGIN, bilingualLanguageAlternates, createPageMetadata, noIndexMetadata } from "../../../seo";
import {
  UKRAINIAN_INTERVIEW_DOMAIN_ROUTES,
  ukrainianInterviewDomainRouteBySlug,
} from "@/content/interview/ukrainian-routes";
import UkrainianInterviewPage from "../ukrainian-interview-page";

export function generateStaticParams() {
  return UKRAINIAN_INTERVIEW_DOMAIN_ROUTES.map((route) => ({ domain: route.slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ domain: string }> }): Promise<Metadata> {
  const { domain } = await params;
  const route = ukrainianInterviewDomainRouteBySlug(domain);
  if (!route) return noIndexMetadata("Interview domain", "Unknown Ukrainian interview question domain.");

  return createPageMetadata({
    title: route.ukTitle,
    description: route.ukDescription,
    path: route.path,
  }, bilingualLanguageAlternates(route.englishPath, route.path));
}

export default async function UkrainianInterviewDomainPage({
  params,
  searchParams,
}: {
  params: Promise<{ domain: string }>;
  searchParams: Promise<{ question?: string | string[] }>;
}) {
  const { domain } = await params;
  const query = await searchParams;
  const route = ukrainianInterviewDomainRouteBySlug(domain);
  if (!route) notFound();
  const questionId = typeof query.question === "string" ? query.question : undefined;

  const breadcrumbJsonLd = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      {
        "@type": "ListItem",
        position: 1,
        name: "Питання для співбесіди",
        item: `${SITE_ORIGIN}/uk/interview`,
      },
      {
        "@type": "ListItem",
        position: 2,
        name: route.ukLabel,
        item: `${SITE_ORIGIN}${route.path}`,
      },
    ],
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbJsonLd).replace(/</g, "\\u003c") }}
      />
      <UkrainianInterviewPage
        description={route.ukDescription}
        domainId={route.id}
        englishPath={route.englishPath}
        label={route.ukLabel}
        path={route.path}
        questionId={questionId}
        title={route.ukTitle}
      />
    </>
  );
}
