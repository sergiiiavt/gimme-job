import type { LearningLanguage } from "./learning-document-ui";
import type { SubnavItem } from "./site-navigation";

type Localized = Readonly<{ label: string; labelUk: string }>;
type NavigableTopic = Localized & Readonly<{ id: string; status: string }>;
type NavigableSupplement = Localized & Readonly<{ id: string }>;

export function localizedLabel(item: Localized, language: LearningLanguage) {
  return language === "uk" ? item.labelUk : item.label;
}

/** Section navigation of a topic page: chapters (placeholders badged in the page language), then supplements. */
export function topicNavigationItems(
  topics: readonly NavigableTopic[],
  supplements: readonly NavigableSupplement[],
  language: LearningLanguage,
): SubnavItem[] {
  return [
    ...topics.map((topic): SubnavItem => (topic.status === "under-construction"
      ? { id: topic.id, label: localizedLabel(topic, language), status: "under-construction", statusLabel: language === "uk" ? "У розробці" : "Under construction" }
      : { id: topic.id, label: localizedLabel(topic, language) })),
    ...supplements.map((supplement): SubnavItem => ({ id: supplement.id, label: localizedLabel(supplement, language) })),
  ];
}
