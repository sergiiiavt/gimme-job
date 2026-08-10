"use client";

import type { ReactNode } from "react";
import Link from "next/link";

export type SiteSection = "jobs" | "interview" | "certifications" | "trends" | "agentic" | "llm" | "security" | "devops" | "standards" | "news";

export const navigationGroups: Array<{ label: string; items: Array<{ id: SiteSection; label: string; marker: string }> }> = [
  {
    label: "Career",
    items: [
      { id: "jobs", label: "Jobs", marker: "J" },
      { id: "interview", label: "Interview questions", marker: "Q" },
      { id: "certifications", label: "Certifications", marker: "C" },
      { id: "trends", label: "Market trends", marker: "T" },
    ],
  },
  {
    label: "Engineering labs",
    items: [
      { id: "agentic", label: "Agentic lab", marker: "A" },
      { id: "llm", label: "LLM lab", marker: "L" },
      { id: "security", label: "Security lab", marker: "S" },
      { id: "devops", label: "DevOps lab", marker: "D" },
    ],
  },
  {
    label: "Reference",
    items: [
      { id: "standards", label: "Standards", marker: "I" },
      { id: "news", label: "News", marker: "N" },
    ],
  },
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
      <div className="kb-brand"><span>GJ</span><div><strong>GimmeJob</strong><small>Career workspace</small></div></div>
      <nav aria-label="GimmeJob sections">
        {navigationGroups.map((group) => (
          <div className="kb-nav-group" key={group.label}>
            <h2>{group.label}</h2>
            {group.items.map((item) => mode === "public" ? (
              <button className={activeSection === item.id ? "kb-nav-link active" : "kb-nav-link"} key={item.id} onClick={() => onSelect?.(item.id)}>
                <i>{item.marker}</i><span>{item.label}</span>
              </button>
            ) : (
              <Link className={activeSection === item.id ? "kb-nav-link active" : "kb-nav-link"} href={item.id === "jobs" ? "/workspace" : `/#${item.id}`} key={item.id}>
                <i>{item.marker}</i><span>{item.label}</span>
              </Link>
            ))}
          </div>
        ))}
      </nav>

      {mode === "public" ? (
        <div className="kb-private">
          <span>PRIVATE WORKSPACE</span>
          <p>Application statuses, feedback, resume versions, drafts, and agent actions.</p>
          <Link href="/workspace"><i>↳</i> Manage jobs</Link>
        </div>
      ) : (
        <div className="kb-private kb-private-current">
          <span>PRIVATE WORKSPACE</span>
          <div className="kb-storage-state"><i className={online ? "online" : ""}/><strong>{online ? "Database connected" : online === null ? "Connecting" : "Demo mode"}</strong></div>
          <p>{online ? "Statuses and feedback are saved privately." : "Changes are not being stored."}</p>
          <Link href="/"><i>←</i> Public view</Link>
        </div>
      )}
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
      <div><span>{mode === "public" ? "Knowledge base" : "Private workspace"}</span><strong>{title}</strong></div>
      <div className={`kb-view-state ${mode}`}><i/>{mode === "public" ? "Public view" : "Private view"}</div>
      <div className="kb-top-actions">{children}</div>
    </header>
  );
}
