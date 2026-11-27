"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";

type SearchResult = { id: string; title: string; snippet: string; href: string; kind: string; language: string; category: string };
type SearchResponse = { results: SearchResult[]; mode: string; semanticAvailable: boolean };
const OPEN_EVENT = "gimmejob:open-search";

function SearchIcon() {
  return <svg aria-hidden="true" fill="none" height="18" stroke="currentColor" strokeWidth="1.7" viewBox="0 0 24 24" width="18"><circle cx="10.5" cy="10.5" r="6.5"/><path d="m16 16 5 5"/></svg>;
}

export function GlobalSearchTrigger({ mobile = false }: { mobile?: boolean }) {
  return <button aria-haspopup="dialog" aria-label="Search all learning material and questions" className={mobile ? "site-search-mobile" : "site-search-trigger"} onClick={() => window.dispatchEvent(new Event(OPEN_EVENT))} type="button">
    <SearchIcon/>{!mobile && <><span>Search the site</span><kbd>⌘ / Ctrl K</kbd></>}
  </button>;
}

export function SearchHighlights({ text, query }: { text: string; query: string }) {
  const terms = [...new Set(query.toLowerCase().match(/[\p{L}\p{N}+#.]{2,}/gu) ?? [])].slice(0, 12);
  const parts: ReactNode[] = [];
  let cursor = 0;
  while (cursor < text.length) {
    const lower = text.toLowerCase();
    const matches = terms.map((term) => ({ term, index: lower.indexOf(term, cursor) })).filter((match) => match.index >= 0)
      .sort((a, b) => a.index - b.index || b.term.length - a.term.length);
    const match = matches[0];
    if (!match) { parts.push(text.slice(cursor)); break; }
    parts.push(text.slice(cursor, match.index));
    parts.push(<mark key={match.index}>{text.slice(match.index, match.index + match.term.length)}</mark>);
    cursor = match.index + match.term.length;
  }
  return <>{parts}</>;
}

export function SearchResultList({ results, query, onNavigate }: { results: SearchResult[]; query: string; onNavigate?: () => void }) {
  return <ol className="site-search-results" id="site-search-results">
    {results.map((result) => <li key={result.id}>
      <a href={result.href} onClick={onNavigate} onKeyDown={(event) => {
        const links = Array.from(event.currentTarget.closest("ol")!.querySelectorAll("a"));
        const index = links.indexOf(event.currentTarget);
        if (event.key === "ArrowDown" || event.key === "ArrowUp") {
          event.preventDefault();
          links[(index + (event.key === "ArrowDown" ? 1 : -1) + links.length) % links.length]?.focus();
        }
      }}>
        <span className="site-search-meta">{result.kind === "question" ? "Interview question" : "Learning / reference"}<span>{result.language === "uk" ? "UA" : "EN"}</span></span>
        <strong><SearchHighlights text={result.title} query={query}/></strong>
        <p><SearchHighlights text={result.snippet} query={query}/></p>
      </a>
    </li>)}
  </ol>;
}

export default function GlobalSearch() {
  const dialog = useRef<HTMLDialogElement>(null);
  const input = useRef<HTMLInputElement>(null);
  const opener = useRef<HTMLElement | null>(null);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [kind, setKind] = useState("");
  const [language, setLanguage] = useState("");
  const [semantic, setSemantic] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const [response, setResponse] = useState<{ key: string; value: SearchResponse } | null>(null);
  const [error, setError] = useState<{ key: string; message: string } | null>(null);
  const normalized = query.trim();
  const key = JSON.stringify([normalized, kind, language, semantic, attempt]);
  const valid = normalized.length >= 2;
  const current = response?.key === key ? response.value : null;
  const currentError = error?.key === key ? error.message : null;
  const busy = open && valid && !current && !currentError;

  useEffect(() => {
    const show = () => {
      if (dialog.current?.open) return;
      opener.current = document.activeElement as HTMLElement | null;
      dialog.current?.showModal();
      setOpen(true);
      input.current?.focus();
    };
    const shortcut = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "k") {
        event.preventDefault(); show();
      }
    };
    window.addEventListener(OPEN_EVENT, show);
    document.addEventListener("keydown", shortcut);
    return () => { window.removeEventListener(OPEN_EVENT, show); document.removeEventListener("keydown", shortcut); };
  }, []);

  useEffect(() => {
    if (!open || !valid) return;
    const controller = new AbortController();
    const timer = window.setTimeout(async () => {
      const params = new URLSearchParams({ q: normalized, semantic: semantic ? "1" : "0" });
      if (kind) params.set("kind", kind);
      if (language) params.set("language", language);
      try {
        const result = await fetch(`/api/public/search?${params}`, { signal: controller.signal });
        if (!result.ok) throw new Error(result.status === 429 ? "Too many searches. Please try again shortly." : "Search is unavailable. Please try again.");
        const value = await result.json() as SearchResponse;
        if (!controller.signal.aborted) setResponse({ key, value });
      } catch (cause) {
        if (!controller.signal.aborted) setError({ key, message: cause instanceof Error ? cause.message : "Search is unavailable." });
      }
    }, semantic ? 0 : 450);
    return () => { window.clearTimeout(timer); controller.abort(); };
  }, [open, valid, normalized, kind, language, semantic, key]);

  const close = () => dialog.current?.close();
  return <>
    <GlobalSearchTrigger mobile/>
    <dialog onKeyDown={(event) => { if (event.key === "Escape") { event.preventDefault(); close(); } }} aria-labelledby="site-search-title" className="site-search-dialog" onClick={(event) => { if (event.target === event.currentTarget) close(); }} onClose={() => { setOpen(false); opener.current?.focus(); }} ref={dialog}>
      <div className="site-search-content">
        <header><h2 id="site-search-title">Search GimmeJob</h2><button aria-label="Close search" onClick={close} type="button">✕</button></header>
        <form onSubmit={(event) => { event.preventDefault(); if (valid) { setSemantic(true); setAttempt((value) => value + 1); } }} role="search">
          <label className="site-search-label" htmlFor="site-search-query">Lessons, reference and interview questions</label>
          <div className="site-search-input-row"><SearchIcon/><input autoComplete="off" id="site-search-query" maxLength={240} onChange={(event) => { setQuery(event.target.value); setSemantic(false); }} onKeyDown={(event) => {
            if (event.key === "ArrowDown") { event.preventDefault(); dialog.current?.querySelector<HTMLAnchorElement>(".site-search-results a")?.focus(); }
          }} placeholder="Python fixtures, k8s, параметризація…" ref={input} type="search" value={query}/><button disabled={!valid} type="submit">Search</button></div>
          <div className="site-search-filters">
            <label>Content<select onChange={(event) => setKind(event.target.value)} value={kind}><option value="">All material</option><option value="learning">Learning / reference</option><option value="question">Interview questions</option></select></label>
            <label>Language<select onChange={(event) => setLanguage(event.target.value)} value={language}><option value="">EN + UA</option><option value="en">English</option><option value="uk">Українська</option></select></label>
          </div>
        </form>
        <div aria-live="polite" className="site-search-status" role="status">
          {!valid ? "Type at least 2 characters. Enter also searches by meaning." : busy ? "Searching…" : currentError ?? (current?.results.length ? `${current.results.length} results${current.mode === "hybrid" ? " · including matches by meaning" : ""}${current.mode === "fallback" ? " · basic search, full index is temporarily unavailable" : semantic && !current.semanticAvailable ? " · search by meaning is temporarily unavailable" : ""}` : "No results. Try another phrase or language.")}
        </div>
        {current && <SearchResultList onNavigate={close} query={normalized} results={current.results}/>}
      </div>
    </dialog>
  </>;
}
