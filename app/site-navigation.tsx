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

interface SidebarProps {
  activeSection: SiteSection;
  mobileOpen: boolean;
  mode: "public" | "private";
  onSelect?: (section: SiteSection) => void;
  online?: boolean | null;
}

export function SiteSidebar({ activeSection, mobileOpen, mode, onSelect, online }: SidebarProps) {
  return (
    <aside className={mobileOpen ? "kb-sidebar open" : "kb-sidebar"}>
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
            <span className="kb-storage-state"><i className={online ? "online" : ""}/>{online ? "Database connected" : online === null ? "Connecting" : "Database unavailable"}</span>
            <Link href="/">Public site</Link>
            <Link href="/workspace/logout">Sign out</Link>
          </>
        )}
      </div>
    </aside>
  );
}

interface TopbarProps {
  children: ReactNode;
  mode: "public" | "private";
  onMenu: () => void;
  title: string;
}

export function SiteTopbar({ children, mode, onMenu, title }: TopbarProps) {
  return (
    <header className="kb-topbar">
      <button className="kb-menu" onClick={onMenu} aria-label="Toggle navigation">☰</button>
      <strong className="kb-topbar-title">{title}</strong>
      <div className={`kb-view-state ${mode}`}><i/>{mode === "public" ? "Public" : "Private"}</div>
      <div className="kb-top-actions">{children}</div>
    </header>
  );
}
