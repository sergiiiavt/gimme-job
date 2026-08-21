export type PracticalExampleSegment =
  | { type: "prose"; text: string }
  | { type: "code"; text: string };

const inlineCodePattern = /`([^`]+)`/g;

function looksLikePythonCode(value: string) {
  const snippet = value.trim();
  if (!snippet) return false;
  if (snippet.includes("\n")) return true;

  return /(^|\s)(?:async\s+def|def|class|for|while|if|elif|else|try|except|finally|with|import|from|return|yield|await|raise|assert)\b|(?:==|!=|<=|>=|:=|->)|[=()\[\]{}]|\.[A-Za-z_]\w*\s*\(/.test(snippet);
}

function appendProse(segments: PracticalExampleSegment[], value: string) {
  const text = value.trim();
  if (!text) return;
  const previous = segments.at(-1);
  if (previous?.type === "prose") {
    previous.text = `${previous.text} ${text}`.trim();
    return;
  }
  segments.push({ type: "prose", text });
}

export function splitPythonPracticalExample(value: string): PracticalExampleSegment[] {
  const segments: PracticalExampleSegment[] = [];
  let cursor = 0;
  let match: RegExpExecArray | null;
  inlineCodePattern.lastIndex = 0;

  while ((match = inlineCodePattern.exec(value)) !== null) {
    appendProse(segments, value.slice(cursor, match.index));
    const snippet = match[1].trim();
    if (looksLikePythonCode(snippet)) {
      segments.push({ type: "code", text: snippet });
    } else {
      appendProse(segments, `\`${snippet}\``);
    }
    cursor = inlineCodePattern.lastIndex;
  }

  appendProse(segments, value.slice(cursor));
  return segments;
}

export function hasPythonPracticalCode(value?: string) {
  if (!value) return false;
  return splitPythonPracticalExample(value).some((segment) => segment.type === "code");
}
