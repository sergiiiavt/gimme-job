"use client";

import { useEffect } from "react";

type VacancyScrollSnapshot = {
  board: number;
  details: Record<string, number>;
};

const STORAGE_PREFIX = "gimmejob:vacancy-scroll-state:v1";

function storageKey() {
  const mode = window.location.pathname.startsWith("/workspace") ? "personal" : "public";
  return `${STORAGE_PREFIX}:${mode}`;
}

function readSnapshot(key: string): VacancyScrollSnapshot {
  try {
    const raw = window.sessionStorage.getItem(key);
    if (!raw) return { board: 0, details: {} };
    const parsed = JSON.parse(raw) as Partial<VacancyScrollSnapshot>;
    const board = Number.isFinite(parsed.board) ? Math.max(0, Number(parsed.board)) : 0;
    const details = parsed.details && typeof parsed.details === "object"
      ? Object.fromEntries(Object.entries(parsed.details).filter(([, value]) => Number.isFinite(value)).map(([id, value]) => [id, Math.max(0, Number(value))]))
      : {};
    return { board, details };
  } catch {
    return { board: 0, details: {} };
  }
}

function detailId(panel: HTMLElement) {
  const labelledBy = panel.getAttribute("aria-labelledby") ?? "";
  return labelledBy.startsWith("vacancy-tab-") ? labelledBy.slice("vacancy-tab-".length) : null;
}

export default function VacancyScrollState() {
  useEffect(() => {
    const key = storageKey();
    const snapshot = readSnapshot(key);
    let writeFrame = 0;
    let restoreFrame = 0;
    let lastPane: HTMLElement | null = null;
    let lastPaneKey = "";

    const persist = () => {
      if (writeFrame) window.cancelAnimationFrame(writeFrame);
      writeFrame = 0;
      window.sessionStorage.setItem(key, JSON.stringify(snapshot));
    };

    const schedulePersist = () => {
      if (writeFrame) return;
      writeFrame = window.requestAnimationFrame(persist);
    };

    const restoreActivePane = () => {
      restoreFrame = 0;
      const board = document.querySelector<HTMLElement>(".vacancy-workspace #vacancy-board-panel.vacancy-list-view");
      if (board) {
        if (lastPane !== board || lastPaneKey !== "board") board.scrollTop = snapshot.board;
        lastPane = board;
        lastPaneKey = "board";
        return;
      }

      const detail = document.querySelector<HTMLElement>(".vacancy-workspace #selected-vacancy-detail.vacancy-detail-tab");
      if (!detail) {
        lastPane = null;
        lastPaneKey = "";
        return;
      }

      const id = detailId(detail);
      if (!id) return;
      const paneKey = `detail:${id}`;
      if (lastPane !== detail || lastPaneKey !== paneKey) detail.scrollTop = snapshot.details[id] ?? 0;
      lastPane = detail;
      lastPaneKey = paneKey;
    };

    const scheduleRestore = () => {
      if (restoreFrame) return;
      restoreFrame = window.requestAnimationFrame(restoreActivePane);
    };

    const onScroll = (event: Event) => {
      const target = event.target;
      if (!(target instanceof HTMLElement)) return;
      if (target.matches(".vacancy-workspace #vacancy-board-panel.vacancy-list-view")) {
        snapshot.board = target.scrollTop;
        schedulePersist();
        return;
      }
      if (!target.matches(".vacancy-workspace #selected-vacancy-detail.vacancy-detail-tab")) return;
      const id = detailId(target);
      if (!id) return;
      snapshot.details[id] = target.scrollTop;
      schedulePersist();
    };

    const onClick = (event: MouseEvent) => {
      const target = event.target;
      if (!(target instanceof Element)) return;
      const button = target.closest<HTMLButtonElement>("button.sync-button");
      if (!button || !button.textContent?.includes("Sync jobs")) return;
      snapshot.board = 0;
      snapshot.details = {};
      persist();
      lastPane = null;
      lastPaneKey = "";
    };

    const observer = new MutationObserver(scheduleRestore);
    observer.observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ["aria-labelledby"] });
    document.addEventListener("scroll", onScroll, true);
    document.addEventListener("click", onClick, true);
    window.addEventListener("pagehide", persist);
    scheduleRestore();

    return () => {
      observer.disconnect();
      document.removeEventListener("scroll", onScroll, true);
      document.removeEventListener("click", onClick, true);
      window.removeEventListener("pagehide", persist);
      if (restoreFrame) window.cancelAnimationFrame(restoreFrame);
      persist();
    };
  }, []);

  return null;
}
