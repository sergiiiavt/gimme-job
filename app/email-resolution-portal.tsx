"use client";

import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";

type Candidate = {
  jobId: string;
  title: string;
  company: string;
  status: string;
  score: number;
  signals: string[];
};

type ResolutionEvent = {
  id: string;
  subject: string;
  classification: string;
  summary: string | null;
  company: string | null;
  jobTitle: string | null;
  receivedAt: string;
  matchStatus: string;
  evidence: { candidates?: Candidate[] };
};

type Job = {
  id: string;
  title: string;
  company: string;
  status: string;
  postedAt?: string | null;
  discoveredAt?: string | null;
};

type DashboardPayload = { jobs?: Job[] };
type ResolutionPayload = { events?: ResolutionEvent[]; error?: string };

const REFRESH_MS = 15_000;
const ACTIVE_STATUSES = new Set(["NEW", "INTERESTED", "APPLIED", "INTERVIEW", "OFFER"]);

function targetElement(): Element | null {
  return document.querySelector(".vacancy-workspace-personal .vacancy-page-intro");
}

function formatDate(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("en", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }).format(date);
}

function titleCase(value: string): string {
  return value.toLowerCase().replace(/_/g, " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function jobLabel(job: Pick<Job, "title" | "company" | "status">): string {
  return `${job.title} — ${job.company} · ${titleCase(job.status)}`;
}

export default function EmailResolutionPortal({ enabled }: { enabled: boolean }) {
  const [target, setTarget] = useState<Element | null>(null);
  const [events, setEvents] = useState<ResolutionEvent[]>([]);
  const [jobs, setJobs] = useState<Job[]>([]);
  const [selection, setSelection] = useState<Record<string, string>>({});
  const [linking, setLinking] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!enabled) return;
    const update = () => setTarget((current) => {
      const next = targetElement();
      return current === next ? current : next;
    });
    update();
    const observer = new MutationObserver(update);
    observer.observe(document.body, { childList: true, subtree: true });
    return () => observer.disconnect();
  }, [enabled]);

  useEffect(() => {
    if (!enabled) return;
    const controller = new AbortController();
    let loading = false;

    const load = async () => {
      if (loading) return;
      loading = true;
      try {
        const [resolutionResponse, dashboardResponse] = await Promise.all([
          fetch("/api/email-events/unresolved", { cache: "no-store", headers: { accept: "application/json" }, signal: controller.signal }),
          fetch("/api/dashboard", { cache: "no-store", headers: { accept: "application/json" }, signal: controller.signal }),
        ]);
        const resolution = await resolutionResponse.json() as ResolutionPayload;
        const dashboard = await dashboardResponse.json() as DashboardPayload;
        if (!resolutionResponse.ok) throw new Error(resolution.error ?? `Resolution request failed: ${resolutionResponse.status}`);
        if (!dashboardResponse.ok) throw new Error(`Vacancy request failed: ${dashboardResponse.status}`);
        setEvents(Array.isArray(resolution.events) ? resolution.events : []);
        setJobs((Array.isArray(dashboard.jobs) ? dashboard.jobs : [])
          .filter((job) => ACTIVE_STATUSES.has(job.status))
          .sort((left, right) => String(right.postedAt ?? right.discoveredAt ?? "").localeCompare(String(left.postedAt ?? left.discoveredAt ?? "")))
          .slice(0, 200));
        setError(null);
      } catch (reason) {
        if (!controller.signal.aborted) setError(reason instanceof Error ? reason.message : String(reason));
      } finally {
        loading = false;
      }
    };

    queueMicrotask(() => { void load(); });
    const timer = window.setInterval(() => { void load(); }, REFRESH_MS);
    return () => {
      window.clearInterval(timer);
      controller.abort();
    };
  }, [enabled]);

  const choices = useMemo(() => new Map(jobs.map((job) => [job.id, job])), [jobs]);

  const link = async (eventId: string) => {
    const jobId = selection[eventId];
    if (!jobId) return;
    setLinking(eventId);
    setError(null);
    try {
      const response = await fetch("/api/email-events/unresolved", {
        method: "PATCH",
        headers: { "content-type": "application/json", accept: "application/json" },
        body: JSON.stringify({ eventId, jobId }),
      });
      const payload = await response.json() as { error?: string };
      if (!response.ok) throw new Error(payload.error ?? `Link request failed: ${response.status}`);
      setEvents((current) => current.filter((event) => event.id !== eventId));
      window.setTimeout(() => window.location.reload(), 100);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : String(reason));
    } finally {
      setLinking(null);
    }
  };

  if (!enabled || !target || (events.length === 0 && !error)) return null;

  return createPortal(
    <section className="email-resolution" aria-label="Emails that need vacancy linking">
      <div className="email-resolution-head">
        <div>
          <strong>Needs linking</strong>
          <span>{events.length} job email{events.length === 1 ? "" : "s"} could not be matched safely.</span>
        </div>
      </div>
      {error && <p className="email-resolution-error">{error}</p>}
      {events.map((event) => {
        const suggested = Array.isArray(event.evidence?.candidates) ? event.evidence.candidates : [];
        const optionIds = [...new Set([...suggested.map((candidate) => candidate.jobId), ...jobs.map((job) => job.id)])];
        return <article className="email-resolution-item" key={event.id}>
          <div className="email-resolution-copy">
            <div className="email-resolution-meta">
              <span className="email-resolution-type">{titleCase(event.classification)}</span>
              <time dateTime={event.receivedAt}>{formatDate(event.receivedAt)}</time>
            </div>
            <strong>{event.jobTitle || event.subject}</strong>
            <span>{event.company || "Company not recognized"}{event.summary ? ` · ${event.summary}` : ""}</span>
            {suggested.length > 0 && <small>Suggested: {suggested.map((candidate) => `${candidate.title} — ${candidate.company} (${candidate.score}%)`).join("; ")}</small>}
          </div>
          <div className="email-resolution-actions">
            <select
              aria-label={`Vacancy for ${event.subject}`}
              value={selection[event.id] ?? ""}
              onChange={(change) => setSelection((current) => ({ ...current, [event.id]: change.target.value }))}
            >
              <option value="">Choose vacancy…</option>
              {optionIds.map((jobId) => {
                const suggestedJob = suggested.find((candidate) => candidate.jobId === jobId);
                const job = choices.get(jobId);
                if (!suggestedJob && !job) return null;
                const label = suggestedJob
                  ? `${suggestedJob.title} — ${suggestedJob.company} · ${titleCase(suggestedJob.status)}${suggestedJob.score ? ` · ${suggestedJob.score}%` : ""}`
                  : jobLabel(job!);
                return <option value={jobId} key={jobId}>{label}</option>;
              })}
            </select>
            <button type="button" disabled={!selection[event.id] || linking === event.id} onClick={() => void link(event.id)}>
              {linking === event.id ? "Linking…" : "Link"}
            </button>
          </div>
        </article>;
      })}
    </section>,
    target,
  );
}
