"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";

const TO_TOP_THRESHOLD = 360;

function isVacancyPath(pathname: string) {
  return pathname === "/vacancies" || pathname === "/workspace";
}

function supportsToTop(pathname: string) {
  return isVacancyPath(pathname)
    || pathname.startsWith("/interview")
    || pathname === "/learn"
    || pathname.startsWith("/learn/")
    || pathname === "/workspace/learn"
    || pathname.startsWith("/workspace/learn/");
}

function vacancyScrollElement(pathname: string) {
  if (!isVacancyPath(pathname) || typeof document === "undefined") return null;
  return document.querySelector<HTMLElement>(
    ".vacancy-workspace-personal > .vacancy-list-view, .vacancy-workspace-personal > .vacancy-detail-tab",
  );
}

function currentScrollTop(pathname: string) {
  const scrollElement = vacancyScrollElement(pathname);
  return scrollElement?.scrollTop ?? window.scrollY;
}

export default function ToTopButton() {
  const pathname = usePathname();
  const enabled = supportsToTop(pathname);
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    if (!enabled) return;

    let frame = 0;
    const scheduleVisibilityUpdate = () => {
      window.cancelAnimationFrame(frame);
      frame = window.requestAnimationFrame(() => setScrolled(currentScrollTop(pathname) > TO_TOP_THRESHOLD));
    };

    scheduleVisibilityUpdate();
    window.addEventListener("scroll", scheduleVisibilityUpdate, { passive: true });
    document.addEventListener("scroll", scheduleVisibilityUpdate, true);

    const observer = new MutationObserver(scheduleVisibilityUpdate);
    observer.observe(document.body, { childList: true, subtree: true });

    return () => {
      window.cancelAnimationFrame(frame);
      observer.disconnect();
      window.removeEventListener("scroll", scheduleVisibilityUpdate);
      document.removeEventListener("scroll", scheduleVisibilityUpdate, true);
    };
  }, [enabled, pathname]);

  if (!enabled) return null;
  const visible = scrolled;
  const routeClass = isVacancyPath(pathname)
    ? " to-top-button-vacancies"
    : pathname.startsWith("/interview")
      ? " to-top-button-interview"
      : "";

  return (
    <button
      aria-label="Scroll to top"
      className={`to-top-button${routeClass}${visible ? " visible" : ""}`}
      onClick={() => {
        const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
        const behavior = reducedMotion ? "auto" : "smooth";
        const scrollElement = vacancyScrollElement(pathname);
        if (scrollElement) scrollElement.scrollTo({ top: 0, behavior });
        else window.scrollTo({ top: 0, behavior });
      }}
      tabIndex={visible ? 0 : -1}
      type="button"
    >
      <span aria-hidden="true">↑</span>
      <strong>To top</strong>
    </button>
  );
}
