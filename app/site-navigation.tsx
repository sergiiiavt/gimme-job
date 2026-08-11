"use client";

import Link from "next/link";

export type SiteSection = "jobs" | "interview" | "rewild" | "certifications" | "strategy" | "programming" | "automation" | "api" | "data" | "mobile" | "performance" | "security" | "devops" | "observability" | "networking" | "linux" | "llm" | "agentic" | "standards" | "trends" | "news";

export const navigationItems: Array<{ id: SiteSection; label: string }> = [
  { id: "jobs", label: "Jobs" },
  { id: "interview", label: "Interview questions" },
  { id: "rewild", label: "Rewild game" },
  { id: "certifications", label: "Certifications" },
  { id: "strategy", label: "Strategy & leadership" },
  { id: "programming", label: "Programming for QA" },
  { id: "automation", label: "Test automation" },
  { id: "api", label: "API & integration" },
  { id: "data", label: "Databases, SQL & BI" },
  { id: "mobile", label: "Mobile & accessibility" },
  { id: "performance", label: "Performance & reliability" },
  { id: "security", label: "Security testing" },
  { id: "devops", label: "Cloud & DevOps" },
  { id: "observability", label: "Observability & SRE" },
  { id: "networking", label: "Networking" },
  { id: "linux", label: "Linux & shell" },
  { id: "llm", label: "Generative AI & LLM" },
  { id: "agentic", label: "AI agents & MCP" },
  { id: "standards", label: "Standards & compliance" },
  { id: "trends", label: "Trends" },
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
  mode: "public" | "personal";
  onSelect?: (section: SiteSection) => void;
  personalHref?: string;
  publicHref?: string;
  secondaryTitle: string;
  secondaryItems: SubnavItem[];
  activeSubsection: string;
  onSelectSubsection: (subsection: string) => void;
}

export function SiteSidebar({ activeSection, activeSubsection, mobileOpen, mode, onSelect, onSelectSubsection, personalHref = "/workspace", publicHref = "/", secondaryItems, secondaryTitle }: SidebarProps) {
  return (
    <div className={mobileOpen ? "kb-navigation open" : "kb-navigation"}>
      <aside className="kb-sidebar">
        <Link className="kb-brand" href={mode === "public" ? "/" : "/workspace"}>GimmeJob</Link>

        <nav className="kb-nav-list" aria-label="GimmeJob sections">
          {navigationItems.map((item) => onSelect ? (
            <button className={activeSection === item.id ? "kb-nav-link active" : "kb-nav-link"} key={item.id} onClick={() => onSelect?.(item.id)}>
              {item.label}
            </button>
          ) : (
            <Link className={activeSection === item.id ? "kb-nav-link active" : "kb-nav-link"} href={item.id === "jobs" ? "/workspace" : `/workspace/learn?section=${item.id}`} key={item.id}>
              {item.label}
            </Link>
          ))}
        </nav>

        <div className="kb-sidebar-footer">
          <nav className="kb-view-switch" aria-label="Site view">
            <Link className={mode === "public" ? "active" : ""} href={publicHref}>Public</Link>
            <Link className={mode === "personal" ? "active" : ""} href={personalHref}>Personal</Link>
          </nav>
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
