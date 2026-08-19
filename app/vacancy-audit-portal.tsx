"use client";

import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";

type AuditEntry = {
  id: string;
  jobId: string;
  actorType: string;
  actorLabel: string;
  action: string;
  field: string | null;
  beforeValue: string | null;
  afterValue: string | null;
  metadata: Record<string, unknown>;
  createdAt: string;
};

type AuditPayload = {
  jobId: string;
  entries: AuditEntry[];
  error?: string;
};

const AUDIT_REFRESH_MS = 5_000;

function activeVacancy(): { jobId: string | null; target: Element | null } {
  const tab = document.querySelector<HTMLButtonElement>(".vacancy-job-tab[aria-selected='true']");
  const target = document.querySelector("#selected-vacancy-detail .job-detail");
  if (!tab?.id.startsWith("vacancy-tab-") || !target) return { jobId: null, target: null };
  return { jobId: tab.id.slice("vacancy-tab-".length), target };
}

function titleCase(value: string): string {
  return value
    .replace(/_/g, " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function formatDate(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("en", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

function changeText(entry: AuditEntry): string | null {
  if (entry.beforeValue !== null && entry.afterValue !== null) {
    return `${entry.beforeValue} → ${entry.afterValue}`;
  }
  if (entry.afterValue !== null) return entry.afterValue;
  if (entry.beforeValue !== null) return entry.beforeValue;
  return null;
}

export default function VacancyAuditPortal({ enabled }: { enabled: boolean }) {
  const [jobId, setJobId] = useState<string | null>(null);
  const [target, setTarget] = useState<Element | null>(null);
  const [entries, setEntries] = useState<AuditEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!enabled) return;
    const update = () => {
      const current = activeVacancy();
      setJobId((value) => value === current.jobId ? value : current.jobId);
      setTarget((value) => value === current.target ? value : current.target);
    };
    update();
    const observer = new MutationObserver(update);
    observer.observe(document.body, {
      attributes: true,
      childList: true,
      subtree: true,
      attributeFilter: ["aria-selected"],
    });
    return () => observer.disconnect();
  }, [enabled]);

  useEffect(() => {
    if (!enabled || !jobId) {
      setEntries([]);
      setError(null);
      return;
    }
    const controller = new AbortController();
    let refreshing = false;

    const load = async (showLoading: boolean) => {
      if (refreshing) return;
      refreshing = true;
      if (showLoading) setLoading(true);
      try {
        const response = await fetch(`/api/jobs/${encodeURIComponent(jobId)}/audit`, {
          cache: "no-store",
          headers: { accept: "application/json" },
          signal: controller.signal,
        });
        const payload = await response.json() as AuditPayload;
        if (!response.ok) throw new Error(payload.error ?? `Audit request failed: ${response.status}`);
        setEntries(Array.isArray(payload.entries) ? payload.entries : []);
        setError(null);
      } catch (reason) {
        if (!controller.signal.aborted) setError(reason instanceof Error ? reason.message : String(reason));
      } finally {
        refreshing = false;
        if (showLoading && !controller.signal.aborted) setLoading(false);
      }
    };

    void load(true);
    const timer = window.setInterval(() => { void load(false); }, AUDIT_REFRESH_MS);
    return () => {
      window.clearInterval(timer);
      controller.abort();
    };
  }, [enabled, jobId]);

  const content = useMemo(() => {
    if (loading) return <p className="vacancy-audit-empty">Loading audit history…</p>;
    if (error) return <p className="vacancy-audit-empty">{error}</p>;
    if (entries.length === 0) return <p className="vacancy-audit-empty">No changes recorded yet.</p>;
    return <ol className="vacancy-audit-list">
      {entries.map((entry) => {
        const change = changeText(entry);
        return <li key={entry.id} className={`vacancy-audit-entry vacancy-audit-entry-${entry.actorType}`}>
          <div className="vacancy-audit-entry-head">
            <strong>{entry.actorLabel}</strong>
            <time dateTime={entry.createdAt}>{formatDate(entry.createdAt)}</time>
          </div>
          <div className="vacancy-audit-action">{titleCase(entry.action)}</div>
          {entry.field && <div className="vacancy-audit-field">{titleCase(entry.field)}</div>}
          {change && <div className="vacancy-audit-change">{change}</div>}
        </li>;
      })}
    </ol>;
  }, [entries, error, loading]);

  if (!enabled || !jobId || !target) return null;
  return createPortal(
    <section className="vacancy-audit" aria-label="Vacancy audit log">
      <div className="vacancy-audit-heading">
        <h3>Audit log</h3>
        <span>Who changed what</span>
      </div>
      {content}
    </section>,
    target,
  );
}
