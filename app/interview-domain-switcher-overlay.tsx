"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { usePathname, useSearchParams } from "next/navigation";

const interviewDomains = [
  { id: "generic-qa", label: "Generic QA", href: "/interview?domain=generic-qa" },
  { id: "python", label: "Python", href: "/interview/python" },
  { id: "automation-qa", label: "Automation", href: "/interview?domain=automation-qa" },
  { id: "sql-databases", label: "SQL / DB", href: "/interview?domain=sql-databases" },
  { id: "web-api", label: "Web / API", href: "/interview?domain=web-api" },
  { id: "mobile", label: "Mobile", href: "/interview?domain=mobile" },
  { id: "embedded-iot", label: "Embedded", href: "/interview?domain=embedded-iot" },
  { id: "ai-llm", label: "AI / LLM", href: "/interview?domain=ai-llm" },
] as const;

export default function InterviewDomainSwitcherOverlay() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [host, setHost] = useState<HTMLElement | null>(null);

  const normalizedPath = pathname.replace(/\/+$/, "") || "/";
  const activeDomain = normalizedPath === "/interview/python"
    ? "python"
    : searchParams.get("domain") ?? "generic-qa";

  useEffect(() => {
    let disposed = false;
    let observer: MutationObserver | null = null;
    let original: HTMLElement | null = null;
    let mount: HTMLElement | null = null;

    const attach = () => {
      original = document.querySelector<HTMLElement>(".kb-subnav-switch");
      if (!original) return false;

      original.hidden = true;
      mount = document.querySelector<HTMLElement>("[data-interview-domain-switcher]");
      if (!mount) {
        mount = document.createElement("div");
        mount.dataset.interviewDomainSwitcher = "true";
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
      <nav className="iq-domain-switcher" aria-label="Interview question domains">
        {interviewDomains.map((domain) => (
          <a
            aria-current={activeDomain === domain.id ? "page" : undefined}
            className={activeDomain === domain.id ? "active" : ""}
            href={domain.href}
            key={domain.id}
          >
            {domain.label}
          </a>
        ))}
      </nav>
      <style>{`
        .iq-domain-switcher {
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 6px;
          margin: 0 0 10px;
        }
        .iq-domain-switcher a {
          align-items: center;
          background: #fff;
          border: 1px solid #d8ddd7;
          border-radius: 6px;
          color: #435049;
          display: flex;
          font-size: 10px;
          font-weight: 600;
          justify-content: center;
          line-height: 1.15;
          min-height: 34px;
          padding: 6px 5px;
          text-align: center;
          text-decoration: none;
        }
        .iq-domain-switcher a:hover {
          background: #f3f5f2;
          color: #26322c;
        }
        .iq-domain-switcher a.active {
          background: #e7f0df;
          border-color: #b7c9a8;
          color: #345523;
        }
      `}</style>
    </>,
    host,
  );
}
