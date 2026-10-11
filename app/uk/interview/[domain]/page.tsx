import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { canonicalInterviewDomainPath } from "@/content/interview/domain-routes";
import {
  UK_INTERVIEW_INDEX,
  UKRAINIAN_INTERVIEW_DOMAIN_ROUTES,
  ukrainianInterviewDomainRouteBySlug,
  ukrainianInterviewPath,
} from "@/content/interview/ukrainian-routes";
import JsonLd from "../../../json-ld";
import {
  interviewQuestionBreadcrumbJsonLd,
  interviewQuestionMetadata,
  qaInterviewQuestionPage,
  questionIdFromSearchParams,
} from "../../../interview-question-seo";
import { bilingualLanguageAlternates, breadcrumbJsonLd, createPageMetadata, noIndexMetadata } from "../../../seo";
import UkrainianInterviewPage from "../ukrainian-interview-page";

type UkrainianInterviewDomainPageProps = Readonly<{
  params: Promise<{ domain: string }>;
  searchParams: Promise<{ question?: string | string[] }>;
}>;

export function generateStaticParams() {
  return UKRAINIAN_INTERVIEW_DOMAIN_ROUTES.map((route) => ({ domain: route.slug }));
}

async function resolvePage({ params, searchParams }: UkrainianInterviewDomainPageProps) {
  const { domain } = await params;
  const route = ukrainianInterviewDomainRouteBySlug(domain);
  const questionId = questionIdFromSearchParams(await searchParams);
  const question = questionId ? qaInterviewQuestionPage(questionId) : undefined;
  // Each Ukrainian domain page lists only its own questions.
  const questionMissing = Boolean(questionId) && question?.list.id !== route?.id;
  return { route, questionId, question: questionMissing ? undefined : question, questionMissing };
}

export async function generateMetadata(props: UkrainianInterviewDomainPageProps): Promise<Metadata> {
  const { route, question, questionMissing } = await resolvePage(props);
  if (!route) return noIndexMetadata("Interview domain", "Unknown Ukrainian interview question domain.");
  if (questionMissing) return noIndexMetadata("Interview question", "Unknown Ukrainian interview question.");
  if (question) return interviewQuestionMetadata(question, "uk");

  const canonicalEnglishPath = canonicalInterviewDomainPath({ id: route.id, path: route.englishPath });
  return createPageMetadata({
    title: route.ukTitle,
    description: route.ukDescription,
    path: ukrainianInterviewPath(canonicalEnglishPath),
  }, bilingualLanguageAlternates(canonicalEnglishPath, ukrainianInterviewPath(canonicalEnglishPath)));
}

export default async function UkrainianInterviewDomainPage(props: UkrainianInterviewDomainPageProps) {
  const { route, questionId, question, questionMissing } = await resolvePage(props);
  if (!route || questionMissing) notFound();

  const structuredData = question
    ? interviewQuestionBreadcrumbJsonLd(question, "uk")
    : breadcrumbJsonLd([
      { name: "Питання для співбесіди", path: UK_INTERVIEW_INDEX.path },
      { name: route.ukLabel, path: route.path },
    ]);

  return (
    <>
      <JsonLd data={structuredData}/>
      <UkrainianInterviewPage
        description={route.ukDescription}
        domainId={route.id}
        englishPath={question?.englishPath ?? route.englishPath}
        label={route.ukLabel}
        path={route.path}
        questionId={questionId}
        title={route.ukTitle}
      />
    </>
  );
}
