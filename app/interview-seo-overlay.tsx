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
  const [breadcrumbHost, setBreadcrumbHost] = useState<HTMLElement | null>(null);
  const [relatedHost, setRelatedHost] = useState<HTMLElement | null>(null);
  const enabled = Boolean(label && relatedLinks?.length);

  useEffect(() => {
    if (!enabled) return;

    let disposed = false;
    let observer: MutationObserver | null = null;
    let breadcrumbMount: HTMLElement | null = null;
    let relatedMount: HTMLElement | null = null;

    const attach = () => {
      const titleColumn = document.querySelector<HTMLElement>(".iq-head > div:first-child");
      const heading = titleColumn?.querySelector<HTMLElement>("h1");
      if (!titleColumn || !heading) return false;

      breadcrumbMount = document.createElement("div");
      breadcrumbMount.dataset.interviewSeoBreadcrumb = "true";
      heading.insertAdjacentElement("beforebegin", breadcrumbMount);

      relatedMount = document.createElement("div");
      relatedMount.dataset.interviewSeoRelated = "true";
      heading.insertAdjacentElement("afterend", relatedMount);

      if (!disposed) {
        setBreadcrumbHost(breadcrumbMount);
        setRelatedHost(relatedMount);
      }
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
      breadcrumbMount?.remove();
      relatedMount?.remove();
      setBreadcrumbHost(null);
      setRelatedHost(null);
    };
  }, [enabled]);

  if (!enabled || !label || !relatedLinks) return null;

  return (
    <>
      {breadcrumbHost && createPortal(
        <>
          <nav className="iq-seo-breadcrumb" aria-label="Breadcrumb">
            <Link href="/interview">Interview questions</Link>
            <span aria-hidden="true">/</span>
            <span aria-current="page">{label}</span>
          </nav>
          <style>{`
            .iq-seo-breadcrumb {
              align-items: center;
              color: #6a756f;
              display: flex;
              flex-wrap: wrap;
              font-size: 11px;
              gap: 6px;
              margin: 0 0 7px;
            }
            .iq-seo-breadcrumb a {
              color: #4f6258;
              text-decoration: none;
            }
            .iq-seo-breadcrumb a:hover { text-decoration: underline; }
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
        breadcrumbHost,
      )}
      {relatedHost && createPortal(
        <div className="iq-seo-actions">
          <nav className="iq-seo-related" aria-label={`Related ${label} learning`}>
            <span>Related learning</span>
            {relatedLinks.map((link) => <Link href={link.href} key={link.href}>{link.label}</Link>)}
          </nav>
        </div>,
        relatedHost,
      )}
    </>
  );
}
