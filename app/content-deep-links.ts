export type SearchParamUpdate = string | null | undefined;

export function contentHref(pathname: string, currentSearch: string, updates: Record<string, SearchParamUpdate>, hash = "") {
  const params = new URLSearchParams(currentSearch);

  for (const [key, value] of Object.entries(updates)) {
    if (value === null || value === undefined || value === "") params.delete(key);
    else params.set(key, value);
  }

  const query = params.toString();
  const normalizedHash = hash ? (hash.startsWith("#") ? hash : `#${hash}`) : "";
  return `${pathname}${query ? `?${query}` : ""}${normalizedHash}`;
}

export function questionDeepLinkHref(pathname: string, questionId: string) {
  return contentHref(pathname, "", { question: questionId });
}
