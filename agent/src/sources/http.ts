export async function fetchText(url: string): Promise<string> {
  const response = await fetch(url, {
    headers: {
      accept: "application/json, application/rss+xml, application/atom+xml, text/xml, */*",
      "user-agent": "JobSearchAgent/0.1 (+personal job-search assistant)",
    },
    signal: AbortSignal.timeout(20_000),
  });
  if (!response.ok) throw new Error(`${response.status} ${response.statusText} from ${url}`);
  return response.text();
}

export async function fetchJson<T>(url: string): Promise<T> {
  const response = await fetch(url, {
    headers: {
      accept: "application/json",
      "user-agent": "JobSearchAgent/0.1 (+personal job-search assistant)",
    },
    signal: AbortSignal.timeout(20_000),
  });
  if (!response.ok) throw new Error(`${response.status} ${response.statusText} from ${url}`);
  return (await response.json()) as T;
}
