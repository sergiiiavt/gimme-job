export function insertPracticalExamples(markdown: string, addition: string): string {
  if (!addition.trim()) return markdown;
  const summary = /\n## (?:Summary|Підсумок)(?=\r?\n|$)/.exec(markdown);
  if (summary) {
    return `${markdown.slice(0, summary.index)}\n\n${addition.trim()}\n${markdown.slice(summary.index)}`;
  }
  return `${markdown.trimEnd()}\n\n${addition.trim()}`;
}
