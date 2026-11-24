/** Eval topics about how a test asks (not what the AI did). A snippet of such an eval is also about them. */
const SETTING_TOPICS = new Set(['jailbreaks', 'prompt_injection', 'agentic_misuse', 'auditing']);

/** A snippet's topics: its category (the topic of the AI's act), then the setting topics of its eval. */
export function snippetTopics(category: string, evalTopics: readonly string[] = []): string[] {
  return [...new Set([category, ...evalTopics.filter((t) => SETTING_TOPICS.has(t))])];
}
