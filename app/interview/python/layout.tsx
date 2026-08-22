import { SITE_ORIGIN, bilingualLanguageAlternates, createPageMetadata } from "../../seo";

export const metadata = createPageMetadata({
  title: "Python Interview Questions for QA Automation",
  description: "Practical Python interview questions and answers for QA automation engineers, with code examples, runnable exercises, core language concepts, and testing scenarios.",
  path: "/interview/python",
}, bilingualLanguageAlternates("/interview/python", "/uk/interview/python"));

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
      name: "Python",
      item: `${SITE_ORIGIN}/interview/python`,
    },
  ],
};

export default function PythonInterviewLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbJsonLd).replace(/</g, "\\u003c") }}
      />
      {children}
    </>
  );
}
