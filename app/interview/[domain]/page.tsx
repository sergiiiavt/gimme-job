import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { INTERVIEW_DOMAIN_ROUTES, interviewDomainRouteBySlug } from "@/content/interview/domain-routes";
import { SITE_ORIGIN, createPageMetadata, noIndexMetadata } from "../../seo";
import InterviewDomainPageClient from "../interview-domain-page-client";

export function generateStaticParams() {
  return INTERVIEW_DOMAIN_ROUTES.map((route) => ({ domain: route.slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ domain: string }> }): Promise<Metadata> {
  const { domain } = await params;
  const route = interviewDomainRouteBySlug(domain);
  if (!route) return noIndexMetadata("Interview domain", "Unknown interview question domain.");

  return createPageMetadata({
    title: route.title,
    description: route.description,
    path: route.path,
  });
}

export default async function InterviewDomainPage({ params }: { params: Promise<{ domain: string }> }) {
  const { domain } = await params;
  const route = interviewDomainRouteBySlug(domain);
  if (!route) notFound();

  const breadcrumbJsonLd = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      {
        "@type": "ListItem",
        position: 1,
        name: "Interview questions",
        item: `${SITE_ORIGIN}/interview`,
      },
      {
        "@type": "ListItem",
        position: 2,
        name: route.label,
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
      <InterviewDomainPageClient canonicalPath={route.path} domainSlug={route.slug}/>
    </>
  );
}
