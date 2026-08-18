"use client";

import { VacancyFilterEnhancer } from "../vacancy-filter-enhancer";
import VacanciesWorkspace from "../vacancies-workspace";

export default function VacanciesPage() {
  return <><VacanciesWorkspace key="public" mode="public"/><VacancyFilterEnhancer/></>;
}
