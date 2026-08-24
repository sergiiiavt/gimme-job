import type { SubnavItem } from "../site-navigation";

export const INTERACTIVE_INTERVIEW_TOPIC = "interactive-interview";
export const LEARNING_PATH_ADVISOR_TOPIC = "learning-path-advisor";

export const AI_ASSISTANT_TOPICS: SubnavItem[] = [
  { id: INTERACTIVE_INTERVIEW_TOPIC, label: "Interactive interview" },
  { id: LEARNING_PATH_ADVISOR_TOPIC, label: "Learning Path Advisor" },
];

export function aiAssistantTopicHref(topic: string): string {
  return topic === INTERACTIVE_INTERVIEW_TOPIC ? "/ai-assistant/interview" : "/ai-assistant";
}
