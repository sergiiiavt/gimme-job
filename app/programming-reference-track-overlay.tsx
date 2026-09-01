"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";

const programmingTracks = [
  { id: "python", label: "Python", href: "/learn/programming?track=python" },
  { id: "csharp", label: "C#", href: "/learn/programming?track=csharp" },
  { id: "typescript", label: "TypeScript", href: "/learn/programming?track=typescript" },
] as const;

export default function ProgrammingReferenceTrackOverlay() {
  const [host, setHost] = useState<HTMLElement | null>(null);

  useEffect(() => {
    let disposed = false;
    let observer: MutationObserver | null = null;
    let original: HTMLElement | null = null;
    let mount: HTMLElement | null = null;

    const attach = () => {
      original = document.querySelector<HTMLElement>(".kb-subnav-switch");
      if (!original) return false;

      original.hidden = true;
      mount = document.querySelector<HTMLElement>("[data-programming-reference-tracks]");
      if (!mount) {
        mount = document.createElement("div");
        mount.dataset.programmingReferenceTracks = "true";
        original.insertAdjacentElement("afterend", mount);
      }
      if (!disposed) setHost(mount);
      return true;
    };

    if (!attach()) {
      observer = new MutationObserver(() => {
        if (attach()) observer?.disconnect();
      });
      observer.observe(document.body, { childList: true, subtree: true });
    }

    return () => {
      disposed = true;
      observer?.disconnect();
      if (original) original.hidden = false;
      if (mount) mount.remove();
      setHost(null);
    };
  }, []);

  if (!host) return null;

  return createPortal(
    <>
      <nav className="programming-reference-tracks" aria-label="Programming language tracks">
        {programmingTracks.map((track) => (
          <button
            className={track.id === "python" ? "active" : ""}
            key={track.id}
            onClick={() => window.location.assign(track.href)}
            type="button"
          >
            {track.label}
          </button>
        ))}
      </nav>
      <style>{`
        .kb-subnav nav.programming-reference-tracks {
          display: grid;
          grid-template-columns: repeat(3, minmax(0, 1fr));
          gap: 6px;
          margin: 0 0 12px;
          width: 100%;
        }
        .kb-subnav nav.programming-reference-tracks button {
          background: #fff;
          border: 1px solid #d8dfd8;
          border-radius: 6px;
          color: #536159;
          cursor: pointer;
          font-size: 11px;
          font-weight: 750;
          min-height: 34px;
          min-width: 0;
          padding: 0 6px;
        }
        .kb-subnav nav.programming-reference-tracks button:hover {
          border-color: #aebbb2;
          color: #26372e;
        }
        .kb-subnav nav.programming-reference-tracks button.active {
          background: #dfead9;
          border-color: #afc3a5;
          color: #284d37;
        }
      `}</style>
    </>,
    host,
  );
}
