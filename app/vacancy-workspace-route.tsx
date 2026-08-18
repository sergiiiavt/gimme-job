"use client";

import { useEffect, useState } from "react";
import VacanciesWorkspace from "./vacancies-workspace";

type VacancyViewMode = "public" | "personal";

let currentVacancyView: VacancyViewMode | null = null;

async function resolveVacancyView(): Promise<VacancyViewMode> {
  const response = await fetch("/api/auth-state", {
    cache: "no-store",
    headers: { accept: "application/json" },
  });
  if (response.ok) return "personal";
  if (response.status === 401) return "public";
  throw new Error(`Auth state request failed: ${response.status}`);
}

export default function VacancyWorkspaceRoute() {
  const [mode, setMode] = useState<VacancyViewMode | null>(() => currentVacancyView);

  useEffect(() => {
    let active = true;
    void resolveVacancyView()
      .then((nextMode) => {
        currentVacancyView = nextMode;
        if (active) setMode(nextMode);
      })
      .catch(() => {
        const fallbackMode = currentVacancyView ?? "public";
        currentVacancyView = fallbackMode;
        if (active) setMode(fallbackMode);
      });
    return () => { active = false; };
  }, []);

  if (!mode) return null;
  return <VacanciesWorkspace key={mode} mode={mode}/>;
}
