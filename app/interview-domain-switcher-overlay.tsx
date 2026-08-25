"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { usePathname, useSearchParams } from "next/navigation";
import { setInterviewCatalogDomain } from "@/content/interview/catalog";
import { INTERVIEW_DOMAIN_ROUTES, interviewDomainRouteFromPathname } from "@/content/interview/domain-routes";
import { rememberInterviewPath } from "./interview-navigation-memory";

const routeById = new Map(INTERVIEW_DOMAIN_ROUTES.map((route) => [route.id, route]));
const interviewDomains = [
  { id: "generic-qa", label: routeById.get("generic-qa")?.switcherLabel ?? "Generic QA", href: routeById.get("generic-qa")?.path ?? "/interview/generic-qa" },
  { id: "python", label: "Python", href: "/interview/python" },
  { id: "automation-qa", label: routeById.get("automation-qa")?.switcherLabel ?? "Automation", href: routeById.get("automation-qa")?.path ?? "/interview/automation" },
  { id: "sql-databases", label: routeById.get("sql-databases")?.switcherLabel ?? "SQL / DB", href: routeById.get("sql-databases")?.path ?? "/interview/sql" },
  { id: "web-api", label: routeById.get("web-api")?.switcherLabel ?? "Web / API", href: routeById.get("web-api")?.path ?? "/interview/web-api" },
  { id: "mobile", label: routeById.get("mobile")?.switcherLabel ?? "Mobile", href: routeById.get("mobile")?.path ?? "/interview/mobile" },
  { id: "embedded-iot", label: routeById.get("embedded-iot")?.switcherLabel ?? "Embedded", href: routeById.get("embedded-iot")?.path ?? "/interview/embedded-iot" },
  { id: "ai-llm", label: routeById.get("ai-llm")?.switcherLabel ?? "AI / LLM", href: routeById.get("ai-llm")?.path ?? "/interview/ai-llm" },
] as const;

type InterviewDomain = (typeof interviewDomains)[number];

function resetInterviewViewState() {
  document.querySelector<HTMLButtonElement>(".iq-filter-grid .iq-clear:not(:disabled)")?.click();
  document.querySelector<HTMLButtonElement>(".kb-subnav > nav:not(.iq-domain-switcher) > button:first-child")?.click();
}

export default function InterviewDomainSwitcherOverlay() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [host, setHost] = useState<HTMLElement | null>(null);

  const normalizedPath = pathname.replace(/\/+$/, "") || "/";
  const pathDomain = interviewDomainRouteFromPathname(normalizedPath);
  const activeDomain = normalizedPath === "/interview/python"
    ? "python"
    : pathDomain?.id ?? searchParams.get("domain") ?? "generic-qa";

  const activateDomain = (domain: InterviewDomain) => {
    rememberInterviewPath(domain.href);
    if (activeDomain === domain.id) return;

    resetInterviewViewState();
    if (domain.id !== "python") setInterviewCatalogDomain(domain.id);
  };

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
          <Link
            aria-current={activeDomain === domain.id ? "page" : undefined}
            className={activeDomain === domain.id ? "active" : ""}
            href={domain.href}
            key={domain.id}
            onClick={() => activateDomain(domain)}
            scroll={false}
          >
            {domain.label}
          </Link>
        ))}
      </nav>
      <style>{`
        .kb-subnav nav.iq-domain-switcher {
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 6px;
          margin: 0 0 10px;
          width: 100%;
        }
        .kb-subnav nav.iq-domain-switcher a {
          align-items: center;
          background: #fff;
          border: 1px solid #d8ddd7;
          border-radius: 6px;
          color: #435049;
          display: inline-flex;
          font-size: 10px;
          font-weight: 600;
          height: 36px;
          justify-content: center;
          line-height: 1.15;
          min-width: 0;
          padding: 5px 7px;
          text-align: center;
          text-decoration: none;
          white-space: normal;
          width: 100%;
        }
        .kb-subnav nav.iq-domain-switcher a:hover {
          background: #f3f5f2;
          color: #26322c;
        }
        .kb-subnav nav.iq-domain-switcher a.active {
          background: #e7f0df;
          border-color: #b7c9a8;
          color: #345523;
        }
      `}</style>
    </>,
    host,
  );
}
