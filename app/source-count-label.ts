/**
 * Ukrainian nouns agree with the number in three forms: 1, 21, 31... take the
 * singular (джерело), 2–4, 22–24... the "few" form (джерела), and everything
 * else, including 11–14, the genitive plural (джерел).
 */
export function ukrainianPlural(count: number, one: string, few: string, many: string): string {
  const lastTwo = Math.abs(Math.trunc(count)) % 100;
  const last = lastTwo % 10;
  if (last === 1 && lastTwo !== 11) return one;
  if (last >= 2 && last <= 4 && (lastTwo < 12 || lastTwo > 14)) return few;
  return many;
}

export function sourcesNounUk(count: number): string {
  return ukrainianPlural(count, "джерело", "джерела", "джерел");
}

export function chapterReferencesEn(count: number): string {
  return `${count} chapter ${count === 1 ? "reference" : "references"}`;
}

/** The status line of a chapter's source registry, for example "33 джерела цього розділу". */
export function chapterSourcesLabel(count: number, language: string): string {
  return language === "uk" ? `${count} ${sourcesNounUk(count)} цього розділу` : chapterReferencesEn(count);
}
