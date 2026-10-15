"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { usePathname } from "next/navigation";
import { interviewDomainRouteBySlug, interviewDomainRouteFromPathname } from "@/content/interview/domain-routes";

const pythonRelatedLinks = [
  { label: "Programming reference", href: "/reference/programming" },
  { label: "Test automation learning", href: "/learn/automation" },
  { label: "QA automation interviews", href: "/interview/automation" },
] as const;

export default function InterviewSeoOverlay({ domainSlug, python = false }: { domainSlug?: string; python?: boolean }) {
  const pathname = usePathname();
  const route = useMemo(
    () => domainSlug
      ? interviewDomainRouteBySlug(domainSlug)
      : interviewDomainRouteFromPathname(pathname) ?? (pathname === "/interview" ? interviewDomainRouteBySlug("generic-qa") : undefined),
    [domainSlug, pathname],
  );
  const label = python ? "Python" : route?.label;
  const relatedLinks = python ? pythonRelatedLinks : route?.relatedLinks;
  const [relatedHost, setRelatedHost] = useState<HTMLElement | null>(null);
  const enabled = Boolean(label && relatedLinks?.length);

  useEffect(() => {
    if (!enabled) return;

    let disposed = false;
    let observer: MutationObserver | null = null;
    let relatedMount: HTMLElement | null = null;

    const attach = () => {
      const titleColumn = document.querySelector<HTMLElement>(".iq-head > .iq-header-copy");
      if (!titleColumn) return false;

      relatedMount = document.createElement("div");
      relatedMount.dataset.interviewSeoRelated = "true";
      titleColumn.appendChild(relatedMount);

      if (!disposed) setRelatedHost(relatedMount);
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
      relatedMount?.remove();
      setRelatedHost(null);
    };
  }, [enabled]);

  if (!enabled || !label || !relatedLinks || !relatedHost) return null;

  return createPortal(
    <>
      <div className="iq-seo-actions">
        <nav className="iq-seo-related" aria-label={`Related ${label} learning`}>
          <span>Related learning</span>
          {relatedLinks.map((link) => <Link href={link.href} key={link.href}>{link.label}</Link>)}
        </nav>
      </div>
      <style>{`
        .iq-seo-actions {
          align-items: center;
          display: flex;
          flex-wrap: wrap;
          gap: 8px 14px;
          margin: 7px 0 0;
        }
        .iq-seo-related {
          align-items: center;
          display: flex;
          flex-wrap: wrap;
          gap: 6px;
        }
        .iq-seo-related > span {
          color: #6a756f;
          font-size: 10px;
          font-weight: 600;
          margin-right: 2px;
          text-transform: uppercase;
        }
        .iq-seo-related a {
          border: 1px solid #d8ddd7;
          border-radius: 999px;
          color: #435049;
          font-size: 10px;
          padding: 4px 8px;
          text-decoration: none;
        }
        .iq-seo-related a:hover {
          background: #f3f5f2;
          color: #26322c;
        }
      `}</style>
    </>,
    relatedHost,
  );
}
