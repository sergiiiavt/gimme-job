"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";

const TO_TOP_THRESHOLD = 360;

function supportsToTop(pathname: string) {
  return pathname === "/vacancies"
    || pathname === "/workspace"
    || pathname.startsWith("/interview")
    || pathname === "/learn"
    || pathname.startsWith("/learn/")
    || pathname === "/workspace/learn"
    || pathname.startsWith("/workspace/learn/");
}

export default function ToTopButton() {
  const pathname = usePathname();
  const enabled = supportsToTop(pathname);
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    if (!enabled) return;

    const updateVisibility = () => setScrolled(window.scrollY > TO_TOP_THRESHOLD);
    const frame = window.requestAnimationFrame(updateVisibility);
    window.addEventListener("scroll", updateVisibility, { passive: true });
    return () => {
      window.cancelAnimationFrame(frame);
      window.removeEventListener("scroll", updateVisibility);
    };
  }, [enabled, pathname]);

  if (!enabled) return null;
  const visible = scrolled;

  return (
    <button
      aria-label="Scroll to top"
      className={`to-top-button${visible ? " visible" : ""}`}
      onClick={() => {
        const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
        window.scrollTo({ top: 0, behavior: reducedMotion ? "auto" : "smooth" });
      }}
      tabIndex={visible ? 0 : -1}
      type="button"
    >
      <span aria-hidden="true">↑</span>
      <strong>To top</strong>
    </button>
  );
}
