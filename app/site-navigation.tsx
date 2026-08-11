"use client";

import type { ReactNode } from "react";
import Link from "next/link";

export type SiteSection = "jobs" | "interview" | "certifications" | "trends" | "agentic" | "llm" | "security" | "devops" | "standards" | "news";

export const navigationItems: Array<{ id: SiteSection; label: string }> = [
  { id: "jobs", label: "Jobs" },
  { id: "interview", label: "Interview questions" },
  { id: "certifications", label: "Certifications" },
  { id: "trends", label: "Trends" },
  { id: "agentic", label: "Agentic" },
  { id: "llm", label: "LLM" },
  { id: "security", label: "Security" },
  { id: "devops", label: "DevOps" },
  { id: "standards", label: "Standards" },
  { id: "news", label: "News" },
];

export interface SubnavItem {
  id: string;
  label: string;
  count?: number;
}

interface SidebarProps {
  activeSection: SiteSection;
  mobileOpen: boolean;
  mode: "public" | "private";
  onSelect?: (section: SiteSection) => void;
  online?: boolean | null;
  secondaryTitle: string;
  secondaryItems: SubnavItem[];
  activeSubsection: string;
  onSelectSubsection: (subsection: string) => void;
}

export function SiteSidebar({ activeSection, activeSubsection, mobileOpen, mode, onSelect, onSelectSubsection, online, secondaryItems, secondaryTitle }: SidebarProps) {
  return (
    <div className={mobileOpen ? "kb-navigation open" : "kb-navigation"}>
      <aside className="kb-sidebar">
        <Link className="kb-brand" href={mode === "public" ? "/" : "/workspace"}>GimmeJob</Link>

        <nav className="kb-nav-list" aria-label="GimmeJob sections">
          {navigationItems.map((item) => mode === "public" ? (
            <button className={activeSection === item.id ? "kb-nav-link active" : "kb-nav-link"} key={item.id} onClick={() => onSelect?.(item.id)}>
              {item.label}
            </button>
          ) : (
            <Link className={activeSection === item.id ? "kb-nav-link active" : "kb-nav-link"} href={item.id === "jobs" ? "/workspace" : `/#${item.id}`} key={item.id}>
              {item.label}
            </Link>
          ))}
        </nav>

        <div className="kb-sidebar-footer">
          {mode === "public" ? (
            <Link href="/workspace">Private workspace</Link>
          ) : (
            <>
              <span className="kb-storage-state"><i className={online ? "online" : ""}/>{online ? "DB connected" : online === null ? "Connecting" : "DB unavailable"}</span>
              <Link href="/">Public site</Link>
              <Link href="/workspace/logout">Sign out</Link>
            </>
          )}
        </div>
      </aside>

      <aside className="kb-subnav">
        <nav aria-label={`${secondaryTitle} subsections`}>
          {secondaryItems.map((item) => (
            <button className={activeSubsection === item.id ? "active" : ""} key={item.id} onClick={() => onSelectSubsection(item.id)}>
              <span>{item.label}</span>{typeof item.count === "number" && <small>{item.count}</small>}
            </button>
          ))}
        </nav>
      </aside>
    </div>
  );
}

interface TopbarProps {
  children: ReactNode;
  mode: "public" | "private";
  onMenu: () => void;
}

export function SiteTopbar({ children, mode, onMenu }: TopbarProps) {
  return (
    <header className="kb-topbar">
      <button className="kb-menu" onClick={onMenu} aria-label="Toggle navigation">☰</button>
      <div className={`kb-view-state ${mode}`}><i/>{mode === "public" ? "Public" : "Private"}</div>
      <div className="kb-top-actions">{children}</div>
    </header>
  );
}
