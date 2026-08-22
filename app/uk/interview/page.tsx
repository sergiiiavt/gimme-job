import { SITE_ORIGIN, bilingualLanguageAlternates, createPageMetadata } from "../../seo";
import { UK_INTERVIEW_INDEX } from "@/content/interview/ukrainian-routes";
import UkrainianInterviewPage from "./ukrainian-interview-page";

export const metadata = createPageMetadata({
  title: UK_INTERVIEW_INDEX.title,
  description: UK_INTERVIEW_INDEX.description,
  path: UK_INTERVIEW_INDEX.path,
}, bilingualLanguageAlternates(UK_INTERVIEW_INDEX.englishPath, UK_INTERVIEW_INDEX.path));

const breadcrumbJsonLd = {
  "@context": "https://schema.org",
  "@type": "BreadcrumbList",
  itemListElement: [
    {
      "@type": "ListItem",
      position: 1,
      name: "Питання для співбесіди",
      item: `${SITE_ORIGIN}${UK_INTERVIEW_INDEX.path}`,
    },
  ],
};

export default async function UkrainianInterviewIndex({ searchParams }: { searchParams: Promise<{ question?: string | string[] }> }) {
  const query = await searchParams;
  const questionId = typeof query.question === "string" ? query.question : undefined;

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbJsonLd).replace(/</g, "\\u003c") }}
      />
      <UkrainianInterviewPage
        description={UK_INTERVIEW_INDEX.description}
        domainId={UK_INTERVIEW_INDEX.domainId}
        englishPath={UK_INTERVIEW_INDEX.englishPath}
        label={UK_INTERVIEW_INDEX.label}
        path={UK_INTERVIEW_INDEX.path}
        questionId={questionId}
        title={UK_INTERVIEW_INDEX.title}
      />
    </>
  );
}
