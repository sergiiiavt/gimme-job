const GUIDE_LINE_PATTERN = /^\s*(?:--|\/\/)\s*\[Guide\]\s*/;

/**
 * Remove only the generated Database Playground guide lines while preserving
 * every executable statement and any ordinary comments written by the user.
 * @param {string} source
 * @returns {string}
 */
export function stripDatabaseGuideComments(source) {
  return source
    .split(/\r?\n/)
    .filter((line) => !GUIDE_LINE_PATTERN.test(line))
    .join("\n")
    .trim();
}
