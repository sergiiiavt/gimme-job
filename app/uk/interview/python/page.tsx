import { SITE_ORIGIN, bilingualLanguageAlternates, createPageMetadata } from "../../../seo";
import { UK_PYTHON_INTERVIEW } from "@/content/interview/ukrainian-routes";
import UkrainianInterviewPage from "../ukrainian-interview-page";

export const metadata = createPageMetadata({
  title: UK_PYTHON_INTERVIEW.title,
  description: UK_PYTHON_INTERVIEW.description,
  path: UK_PYTHON_INTERVIEW.path,
}, bilingualLanguageAlternates(UK_PYTHON_INTERVIEW.englishPath, UK_PYTHON_INTERVIEW.path));

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
      name: "Python",
      item: `${SITE_ORIGIN}${UK_PYTHON_INTERVIEW.path}`,
    },
  ],
};

export default async function UkrainianPythonInterviewPage({ searchParams }: { searchParams: Promise<{ question?: string | string[] }> }) {
  const query = await searchParams;
  const questionId = typeof query.question === "string" ? query.question : undefined;

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbJsonLd).replace(/</g, "\\u003c") }}
      />
      <UkrainianInterviewPage
        description={UK_PYTHON_INTERVIEW.description}
        englishPath={UK_PYTHON_INTERVIEW.englishPath}
        label={UK_PYTHON_INTERVIEW.label}
        path={UK_PYTHON_INTERVIEW.path}
        python
        questionId={questionId}
        title={UK_PYTHON_INTERVIEW.title}
      />
    </>
  );
}
