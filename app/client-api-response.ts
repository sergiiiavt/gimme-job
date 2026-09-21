export async function readJsonApiResponse<T>(response: Response): Promise<T> {
  const fallback = `Request failed: ${response.status}`;
  const raw = await response.text();

  if (!raw.trim()) {
    if (!response.ok) throw new Error(fallback);
    throw new Error(`Invalid API response: empty body (HTTP ${response.status}).`);
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    const contentType = response.headers.get("content-type")?.toLowerCase() ?? "";
    const looksLikeHtml = contentType.includes("text/html")
      || /^\s*<!doctype\s+html/i.test(raw)
      || /^\s*<html/i.test(raw);
    const detail = looksLikeHtml
      ? "Server returned HTML instead of JSON."
      : "Server returned a non-JSON response.";

    if (!response.ok) throw new Error(`${fallback}. ${detail}`);
    throw new Error(`Invalid API response (HTTP ${response.status}). ${detail}`);
  }

  if (!response.ok) {
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
      const error = (parsed as { error?: unknown }).error;
      if (typeof error === "string" && error.trim()) throw new Error(error);
    }
    throw new Error(fallback);
  }

  return parsed as T;
}
