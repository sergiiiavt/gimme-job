const LEGACY_GUIDE_LINE_PATTERN = /^\s*(?:--|\/\/)\s*\[Guide\]\s*/;
const LEADING_COMMENT_PATTERN = /^\s*(?:--|\/\/)\s*/;

/**
 * Remove leading explanatory comments before a Database Playground query is
 * sent to the real database. Legacy [Guide] comments from saved tabs are also
 * accepted so older local sessions keep working after the UI change.
 * @param {string} source
 * @returns {string}
 */
export function stripDatabaseGuideComments(source) {
  const lines = source.split(/\r?\n/);
  let index = 0;
  let sawComment = false;

  while (index < lines.length) {
    const line = lines[index];
    if (LEGACY_GUIDE_LINE_PATTERN.test(line) || LEADING_COMMENT_PATTERN.test(line)) {
      sawComment = true;
      index += 1;
      continue;
    }
    if (sawComment && !line.trim()) {
      index += 1;
      continue;
    }
    break;
  }

  return lines.slice(index).join("\n").trim();
}
