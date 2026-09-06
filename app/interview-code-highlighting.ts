export interface InterviewCodeToken {
  text: string;
  color?: string;
}

const sqlKeywords = new Set([
  "ALL", "ALTER", "AND", "AS", "ASC", "BEGIN", "BETWEEN", "BY", "CASE", "COMMIT", "CREATE", "DELETE", "DESC",
  "DISTINCT", "DROP", "ELSE", "END", "EXCEPT", "EXISTS", "FALSE", "FROM", "FULL", "GROUP", "HAVING", "IN", "INDEX",
  "INNER", "INSERT", "INTERSECT", "INTO", "IS", "JOIN", "LEFT", "LIKE", "LIMIT", "NOT", "NULL", "ON", "OR", "ORDER",
  "OUTER", "OVER", "PARTITION", "RIGHT", "ROLLBACK", "SELECT", "SET", "TABLE", "THEN", "TRUE", "UNION", "UNIQUE", "UPDATE",
  "VALUES", "WHEN", "WHERE", "WITH",
]);

const pythonKeywords = new Set([
  "and", "as", "assert", "async", "await", "break", "case", "class", "continue", "def", "del", "elif", "else", "except",
  "False", "finally", "for", "from", "global", "if", "import", "in", "is", "lambda", "match", "None", "nonlocal", "not", "or",
  "pass", "raise", "return", "True", "try", "while", "with", "yield",
]);

const pythonBuiltins = new Set([
  "all", "any", "bool", "dict", "enumerate", "filter", "float", "getattr", "hasattr", "int", "isinstance", "issubclass", "iter",
  "len", "list", "map", "max", "min", "next", "object", "print", "range", "repr", "set", "setattr", "sorted", "str", "sum",
  "tuple", "type", "vars", "zip",
]);

const genericKeywords = new Set([
  "abstract", "and", "as", "async", "await", "break", "case", "catch", "class", "const", "continue", "default", "def", "delete",
  "do", "else", "enum", "export", "extends", "false", "finally", "for", "from", "function", "if", "implements", "import", "in",
  "interface", "internal", "is", "let", "new", "not", "null", "or", "override", "private", "protected", "public", "readonly", "return",
  "static", "switch", "this", "throw", "true", "try", "typeof", "using", "var", "virtual", "void", "while", "with", "yield",
]);

const sqlTokenPattern = /(--[^\n]*|'(?:''|[^'])*'|\b[A-Za-z_]+\b)/g;
const pythonTokenPattern = /(#[^\n]*|"""[\s\S]*?"""|'''[\s\S]*?'''|"(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'|@[A-Za-z_]\w*(?:\.[A-Za-z_]\w*)*|\b\d+(?:\.\d+)?\b|\b[A-Za-z_]\w*\b)/g;
const genericTokenPattern = /(\/\*[^]*?\*\/|\/\/[^\n]*|#[^\n]*|["'`][^"'`\n]*["'`]?|\b\d+(?:\.\d+)?\b|\b\w+\b)/g;

function tokenize(source: string, pattern: RegExp, colorForToken: (token: string) => string): InterviewCodeToken[] {
  const tokens: InterviewCodeToken[] = [];
  let lastIndex = 0;
  let match: RegExpExecArray | null;
  pattern.lastIndex = 0;

  while ((match = pattern.exec(source)) !== null) {
    if (match.index > lastIndex) tokens.push({ text: source.slice(lastIndex, match.index) });
    const token = match[0];
    tokens.push({ text: token, color: colorForToken(token) });
    lastIndex = pattern.lastIndex;
  }

  if (lastIndex < source.length) tokens.push({ text: source.slice(lastIndex) });
  return tokens;
}

function sqlColor(token: string) {
  if (token.startsWith("--")) return "#6a9955";
  if (token.startsWith("'")) return "#ce9178";
  if (sqlKeywords.has(token.toUpperCase())) return "#569cd6";
  return "#d4d4d4";
}

function pythonColor(token: string) {
  if (token.startsWith("#")) return "#6a9955";
  if (token.startsWith("\"") || token.startsWith("'")) return "#ce9178";
  if (token.startsWith("@")) return "#dcdcaa";
  if (/^\d/.test(token)) return "#b5cea8";
  if (pythonKeywords.has(token)) return "#569cd6";
  if (pythonBuiltins.has(token)) return "#4ec9b0";
  return "#d4d4d4";
}

function genericColor(token: string) {
  if (token.startsWith("//") || token.startsWith("/*") || token.startsWith("#")) return "#6a9955";
  if (token.startsWith("\"") || token.startsWith("'") || token.startsWith("`")) return "#ce9178";
  if (/^\d/.test(token)) return "#b5cea8";
  if (genericKeywords.has(token.toLowerCase())) return "#569cd6";
  return "#d4d4d4";
}

export function highlightInterviewCode(source: string, language: string): InterviewCodeToken[] {
  const normalizedLanguage = language.toLowerCase();
  if (normalizedLanguage === "python" || normalizedLanguage === "py") {
    return tokenize(source, pythonTokenPattern, pythonColor);
  }
  if (normalizedLanguage === "sql") {
    return tokenize(source, sqlTokenPattern, sqlColor);
  }
  if (normalizedLanguage === "text" || normalizedLanguage === "plain" || normalizedLanguage === "plaintext") {
    return [{ text: source }];
  }
  return tokenize(source, genericTokenPattern, genericColor);
}
