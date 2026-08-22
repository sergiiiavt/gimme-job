import { createPageMetadata } from "../seo";

export const metadata = createPageMetadata({
  title: "QA Vacancies & Job Search",
  description: "QA and test automation vacancies with practical filtering and job-search tooling for quality engineers.",
  path: "/vacancies",
});

export default function VacanciesLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return children;
}
