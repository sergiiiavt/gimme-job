"use client";

import { VacancyFilterEnhancer } from "../vacancy-filter-enhancer";
import VacanciesWorkspace from "../vacancies-workspace";

export default function WorkspacePage() {
  return <><VacanciesWorkspace/><VacancyFilterEnhancer/></>;
}
