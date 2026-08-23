"use client";

import { useEffect } from "react";
import { createRoot, type Root } from "react-dom/client";
import sqlPracticalTasks from "@/content/data-learning/sql-practical-tasks.json";
import ExecutableSqlBlock from "./executable-sql-block";
import { isRunnableSqlSource } from "./interview-sql-execution";

type SqlTaskRow = { term: string; detail: string };
type SqlTaskCard = {
  id: string;
  title: string;
  entries: SqlTaskRow[];
  more: SqlTaskRow[];
};

const runnableTasks = (sqlPracticalTasks.cards as SqlTaskCard[])
  .map((card) => ({
    card,
    row: [...card.entries, ...card.more].find((row) => isRunnableSqlSource("sql", row.detail)),
  }))
  .filter((item): item is { card: SqlTaskCard; row: SqlTaskRow } => Boolean(item.row));

function normalize(value: string) {
  return value.replace(/\s+/g, " ").trim();
}

export default function SqlReferenceRunnableOverlay() {
  useEffect(() => {
    const roots = new Map<HTMLElement, Root>();
    let frame = 0;

    const syncRunners = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        for (const [host, root] of roots) {
          if (host.isConnected) continue;
          root.unmount();
          roots.delete(host);
        }

        for (const { card, row } of runnableTasks) {
          const heading = Array.from(document.querySelectorAll<HTMLHeadingElement>("article h2"))
            .find((candidate) => normalize(candidate.textContent ?? "") === normalize(card.title));
          const article = heading?.closest<HTMLElement>("article");
          if (!article || article.querySelector(`.sql-reference-runner-host[data-task-id="${card.id}"]`)) continue;

          const label = Array.from(article.querySelectorAll<HTMLElement>("code"))
            .find((candidate) => normalize(candidate.textContent ?? "") === normalize(row.term));
          const rowElement = label?.parentElement;
          if (!rowElement) continue;

          const source = Array.from(rowElement.querySelectorAll<HTMLElement>("span"))
            .find((candidate) => normalize(candidate.textContent ?? "") === normalize(row.detail));
          if (!source) continue;

          source.style.display = "none";
          source.dataset.sqlRunnerHidden = "true";

          const host = document.createElement("div");
          host.className = "sql-reference-runner-host";
          host.dataset.taskId = card.id;
          rowElement.after(host);

          const root = createRoot(host);
          roots.set(host, root);
          root.render(<ExecutableSqlBlock code={row.detail} />);
        }
      });
    };

    syncRunners();
    const observer = new MutationObserver(syncRunners);
    const root = document.querySelector("main") ?? document.body;
    observer.observe(root, { childList: true, subtree: true });

    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
      for (const root of roots.values()) root.unmount();
      roots.clear();
      for (const source of document.querySelectorAll<HTMLElement>('[data-sql-runner-hidden="true"]')) {
        source.style.removeProperty("display");
        delete source.dataset.sqlRunnerHidden;
      }
    };
  }, []);

  return null;
}
