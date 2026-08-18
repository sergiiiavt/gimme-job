export interface ClosedVacancyTabResult {
  openIds: string[];
  activeId: string | null;
}

export function openVacancyTab(openIds: string[], id: string) {
  return openIds.includes(id) ? openIds : [...openIds, id];
}

export function closeVacancyTab(openIds: string[], activeId: string | null, id: string): ClosedVacancyTabResult {
  const index = openIds.indexOf(id);
  if (index === -1) return { openIds, activeId };

  const nextOpenIds = openIds.filter((openId) => openId !== id);
  if (activeId !== id) return { openIds: nextOpenIds, activeId };

  return {
    openIds: nextOpenIds,
    activeId: nextOpenIds[index] ?? nextOpenIds[index - 1] ?? null,
  };
}

export function vacancyAnalysisTargets(activeId: string | null, selectedIds: Iterable<string>) {
  return activeId ? [activeId] : [...selectedIds];
}
