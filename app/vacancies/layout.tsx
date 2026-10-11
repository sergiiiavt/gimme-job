import { SITE_PAGE_SEO, createPageMetadata } from "../seo";

export const metadata = createPageMetadata(SITE_PAGE_SEO.vacancies);

export default function VacanciesLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return children;
}
