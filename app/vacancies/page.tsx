"use client";

import { VacancyFilterEnhancer } from "../vacancy-filter-enhancer";
import VacancyWorkspaceRoute from "../vacancy-workspace-route";

export default function VacanciesPage() {
  return <><VacancyWorkspaceRoute/><VacancyFilterEnhancer/></>;
}
