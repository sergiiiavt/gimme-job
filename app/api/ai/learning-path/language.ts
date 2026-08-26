export type AdvisorLanguage = "en" | "uk";

type LanguageMessage = {
  role: "user" | "assistant";
  content: string;
};

const LANGUAGE_CONTROL_PATTERN = /^\[\[gimmejob-language:(en|uk)\]\]$/;

export function parseAdvisorLanguage(value: unknown): AdvisorLanguage | null {
  return value === "en" || value === "uk" ? value : null;
}

function languageControl(message: LanguageMessage): AdvisorLanguage | null {
  if (message.role !== "assistant") return null;
  const match = LANGUAGE_CONTROL_PATTERN.exec(message.content.trim());
  return match ? parseAdvisorLanguage(match[1]) : null;
}

export function selectedLegacyLanguage(messages: LanguageMessage[]): AdvisorLanguage | null {
  for (let index = messages.length - 1; index >= 0; index -= 1) {
    const language = languageControl(messages[index]);
    if (language) return language;
  }
  return null;
}

export function withLanguageControl(
  messages: LanguageMessage[],
  language: AdvisorLanguage,
  maxMessages: number,
): LanguageMessage[] {
  const conversation = messages.filter((message) => languageControl(message) === null);
  const bounded = conversation.slice(-(maxMessages - 1));
  const latest = bounded.at(-1);
  if (!latest || latest.role !== "user") return bounded;
  return [
    ...bounded.slice(0, -1),
    { role: "assistant", content: `[[gimmejob-language:${language}]]` },
    latest,
  ];
}
