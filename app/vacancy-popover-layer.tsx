"use client";

import { useEffect } from "react";

const FILTER_SELECTOR = 'details[name="vacancy-toolbar-filter"]';
const MENU_SELECTOR = ".vacancy-filter-menu, .vacancy-calendar-menu";
const VIEWPORT_GAP = 12;
const ANCHOR_GAP = 6;

type PopoverMenu = HTMLElement & {
  hidePopover?: () => void;
  showPopover?: () => void;
};

function menuFor(details: HTMLDetailsElement) {
  return details.querySelector<PopoverMenu>(MENU_SELECTOR);
}

function setPopoverState(details: HTMLDetailsElement) {
  const menu = menuFor(details);
  if (!menu) return;

  menu.setAttribute("popover", "manual");
  try {
    if (details.open) menu.showPopover?.();
    else menu.hidePopover?.();
  } catch {
    // The menu may already be in the requested state; positioning still works as a fallback.
  }
}

function positionMenu(details: HTMLDetailsElement) {
  if (!details.open) return;
  const summary = details.querySelector<HTMLElement>("summary");
  const menu = menuFor(details);
  if (!summary || !menu) return;

  setPopoverState(details);

  const anchor = summary.getBoundingClientRect();
  const measured = menu.getBoundingClientRect();
  const maxWidth = Math.max(0, window.innerWidth - VIEWPORT_GAP * 2);
  const width = Math.min(measured.width || anchor.width, maxWidth);
  const preferredLeft = anchor.right - width;
  const left = Math.min(
    Math.max(VIEWPORT_GAP, preferredLeft),
    Math.max(VIEWPORT_GAP, window.innerWidth - VIEWPORT_GAP - width),
  );
  const availableBelow = Math.max(0, window.innerHeight - anchor.bottom - ANCHOR_GAP - VIEWPORT_GAP);
  const availableAbove = Math.max(0, anchor.top - ANCHOR_GAP - VIEWPORT_GAP);
  const openAbove = availableBelow < Math.min(measured.height || 220, 220) && availableAbove > availableBelow;
  const maxHeight = Math.max(96, openAbove ? availableAbove : availableBelow);
  const visibleHeight = Math.min(measured.height || maxHeight, maxHeight);
  const top = openAbove
    ? Math.max(VIEWPORT_GAP, anchor.top - ANCHOR_GAP - visibleHeight)
    : Math.min(window.innerHeight - VIEWPORT_GAP, anchor.bottom + ANCHOR_GAP);

  Object.assign(menu.style, {
    bottom: "auto",
    left: `${Math.round(left)}px`,
    margin: "0",
    maxHeight: `${Math.floor(maxHeight)}px`,
    maxWidth: `${Math.floor(maxWidth)}px`,
    overflowY: "auto",
    position: "fixed",
    right: "auto",
    top: `${Math.round(top)}px`,
    zIndex: "120",
  });
}

function syncOpenMenus() {
  document.querySelectorAll<HTMLDetailsElement>(`${FILTER_SELECTOR}[open]`).forEach(positionMenu);
}

export default function VacancyPopoverLayer() {
  useEffect(() => {
    let frame = 0;

    const scheduleSync = () => {
      if (frame) return;
      frame = window.requestAnimationFrame(() => {
        frame = 0;
        syncOpenMenus();
      });
    };

    const onToggle = (event: Event) => {
      const details = event.target;
      if (!(details instanceof HTMLDetailsElement) || !details.matches(FILTER_SELECTOR)) return;
      setPopoverState(details);
      if (details.open) scheduleSync();
    };

    const observer = new MutationObserver(scheduleSync);
    observer.observe(document.body, { childList: true, subtree: true });
    document.addEventListener("toggle", onToggle, true);
    document.addEventListener("scroll", scheduleSync, true);
    window.addEventListener("resize", scheduleSync);

    return () => {
      observer.disconnect();
      document.removeEventListener("toggle", onToggle, true);
      document.removeEventListener("scroll", scheduleSync, true);
      window.removeEventListener("resize", scheduleSync);
      if (frame) window.cancelAnimationFrame(frame);
      document.querySelectorAll<HTMLDetailsElement>(FILTER_SELECTOR).forEach((details) => {
        const menu = menuFor(details);
        try { menu?.hidePopover?.(); } catch { /* no-op */ }
      });
    };
  }, []);

  return null;
}
