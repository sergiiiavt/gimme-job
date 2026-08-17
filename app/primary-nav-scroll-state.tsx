"use client";

import { useEffect } from "react";

const PRIMARY_NAV_SELECTOR = ".kb-navigation .kb-nav-list";
const PRIMARY_NAV_SCROLL_KEY = "gimmejob.primary-nav.scrollTop";

function readSavedScrollTop() {
  try {
    const value = window.sessionStorage.getItem(PRIMARY_NAV_SCROLL_KEY);
    const parsed = value === null ? 0 : Number(value);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : 0;
  } catch {
    return 0;
  }
}

function saveScrollTop(value: number) {
  try {
    window.sessionStorage.setItem(PRIMARY_NAV_SCROLL_KEY, String(value));
  } catch {
    // Navigation scroll preservation is a progressive enhancement.
  }
}

export default function PrimaryNavScrollState() {
  useEffect(() => {
    let nav: HTMLElement | null = null;
    let restoreFrame: number | null = null;

    const saveCurrentPosition = () => {
      if (nav) saveScrollTop(nav.scrollTop);
    };

    const attachToCurrentNav = () => {
      const nextNav = document.querySelector<HTMLElement>(PRIMARY_NAV_SELECTOR);
      if (!nextNav || nextNav === nav) return;

      nav?.removeEventListener("scroll", saveCurrentPosition);
      nav = nextNav;
      nav.addEventListener("scroll", saveCurrentPosition, { passive: true });

      if (restoreFrame !== null) window.cancelAnimationFrame(restoreFrame);
      const savedScrollTop = readSavedScrollTop();
      restoreFrame = window.requestAnimationFrame(() => {
        if (nav === nextNav) nextNav.scrollTop = savedScrollTop;
        restoreFrame = null;
      });
    };

    attachToCurrentNav();

    const observer = new MutationObserver(attachToCurrentNav);
    observer.observe(document.body, { childList: true, subtree: true });

    return () => {
      if (restoreFrame !== null) window.cancelAnimationFrame(restoreFrame);
      nav?.removeEventListener("scroll", saveCurrentPosition);
      observer.disconnect();
    };
  }, []);

  return null;
}
