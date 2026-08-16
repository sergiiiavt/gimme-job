"use client";

import Link from "next/link";
import AuthStatusControl from "./auth-status-control";

export type SiteSection = "about" | "jobs" | "resume" | "interview" | "python-interview" | "certifications" | "strategy" | "programming" | "automation" | "api" | "data" | "mobile" | "embedded" | "performance" | "security" | "devops" | "observability" | "networking" | "linux" | "llm" | "agentic" | "standards" | "trends" | "news" | "rewild";

export const navigationIntroItem: { id: SiteSection; label: string } = { id: "about", label: "About this site" };

/** Valid deep-link sections that are reachable in-page (e.g. via a catalog toggle) rather than through their own nav button. */
export const hiddenDeepLinkSections: SiteSection[] = ["python-interview"];

export const navigationGroups: Array<{ id: "career" | "learning" | "misc"; label: string; items: Array<{ id: SiteSection; label: string }> }> = [
  {
    id: "career",
    label: "Career",
    items: [
      { id: "jobs", label: "Vacancies" },
      { id: "resume", label: "My Resume" },
      { id: "interview", label: "Interview questions" },
      { id: "trends", label: "Trends" },
    ],
  },
  {
    id: "learning",
    label: "Learning path",
    items: [
      { id: "certifications", label: "Certs & Trainings" },
      { id: "llm", label: "Generative AI & LLM" },
      { id: "agentic", label: "AI agents & MCP" },
      { id: "programming", label: "Programming" },
      { id: "automation", label: "Test automation" },
      { id: "api", label: "API & integration" },
      { id: "data", label: "Databases, SQL & BI" },
      { id: "mobile", label: "Mobile & accessibility" },
      { id: "embedded", label: "Embedded & IoT QA" },
      { id: "performance", label: "Performance & reliability" },
      { id: "security", label: "Security testing" },
      { id: "devops", label: "Cloud & DevOps" },
      { id: "observability", label: "Observability & SRE" },
      { id: "networking", label: "Networking" },
      { id: "linux", label: "Linux & shell" },
      { id: "standards", label: "Standards & compliance" },
      { id: "strategy", label: "Strategy & leadership" },
    ],
  },
  {
    id: "misc",
    label: "Misc",
    items: [
      { id: "news", label: "News" },
      { id: "rewild", label: "Fight AI slop" },
    ],
  },
];

export const navigationItems = [navigationIntroItem, ...navigationGroups.flatMap((group) => group.items)];

export interface SubnavItem {
  id: string;
  label: string;
  count?: number;
  status?: "under-construction";
}

export interface SecondarySwitcher {
  activeId: string;
  onSelect: (id: string) => void;
  options: Array<{ id: string; label: string }>;
}

interface SidebarProps {
  activeSection: SiteSection;
  mobileOpen: boolean;
  mode: "public" | "personal";
  onSelect?: (section: SiteSection) => void;
  personalHref?: string;
  /** Retained temporarily for caller compatibility; public/personal is no longer a user-selectable view. */
  publicHref?: string;
  secondaryTitle: string;
  secondaryEmptyState?: string;
  secondaryItems: SubnavItem[];
  secondarySwitcher?: SecondarySwitcher;
  activeSubsection: string;
  hideSecondary?: boolean;
  onSelectSubsection: (subsection: string) => void;
}

const accountCornerStyle = {
  position: "fixed",
  right: "18px",
  top: "14px",
  zIndex: 90,
} as const;

const responsiveAccountStyle = `
@media (max-width: 820px) {
  .kb-account-corner { right: 62px !important; top: 8px !important; }
}
`;

export function SiteSidebar({ activeSection, activeSubsection, hideSecondary = false, mobileOpen, mode, onSelect, onSelectSubsection, personalHref = "/workspace", secondaryEmptyState, secondaryItems, secondarySwitcher, secondaryTitle }: SidebarProps) {
  const renderItem = (item: { id: SiteSection; label: string }, intro = false) => onSelect ? (
    <button className={`${intro ? "kb-nav-intro " : ""}kb-nav-link${activeSection === item.id ? " active" : ""}`} key={item.id} onClick={() => onSelect(item.id)}>
      {item.label}
    </button>
  ) : (
    <Link className={`${intro ? "kb-nav-intro " : ""}kb-nav-link${activeSection === item.id ? " active" : ""}`} href={item.id === "jobs" ? "/workspace" : `/workspace/learn?section=${item.id}`} key={item.id}>
      {item.label}
    </Link>
  );

  return <>
    <div className={`kb-navigation${hideSecondary ? " compact" : ""}${mobileOpen ? " open" : ""}`}>
      <aside className="kb-sidebar">
        <Link className="kb-brand" href={mode === "public" ? "/" : "/workspace"}>GimmeJob</Link>

        <nav className="kb-nav-list" aria-label="GimmeJob sections">
          {renderItem(navigationIntroItem, true)}
          {navigationGroups.map((group) => (
            <section className={`kb-area-group kb-area-group-${group.id}`} aria-labelledby={`kb-area-${group.id}`} key={group.id}>
              <h2 id={`kb-area-${group.id}`}>{group.label}</h2>
              <div>
                {group.items.map((item) => renderItem(item))}
              </div>
            </section>
          ))}
        </nav>
      </aside>

      {!hideSecondary && <aside className="kb-subnav">
        {secondarySwitcher && (
          <div className="kb-subnav-switch" role="group" aria-label={`${secondaryTitle} catalog`}>
            {secondarySwitcher.options.map((option) => (
              <button className={secondarySwitcher.activeId === option.id ? "active" : ""} key={option.id} onClick={() => secondarySwitcher.onSelect(option.id)} type="button">
                {option.label}
              </button>
            ))}
          </div>
        )}
        {secondaryEmptyState ? (
        <div className="kb-subnav-empty" aria-live="polite">
          <span className="kb-construction-badge">Under construction</span>
          <strong>{secondaryEmptyState}</strong>
        </div>
      ) : (
        <nav aria-label={`${secondaryTitle} subsections`}>
          {secondaryItems.map((item) => (
            <button className={activeSubsection === item.id ? "active" : ""} key={item.id} onClick={() => onSelectSubsection(item.id)}>
              <span>{item.label}</span>
              {item.status === "under-construction" ? <em className="kb-construction-badge">Under construction</em> : typeof item.count === "number" && <small>{item.count}</small>}
            </button>
          ))}
        </nav>
      )}
      </aside>}
    </div>

    <style>{responsiveAccountStyle}</style>
    <div className="kb-account-corner" style={accountCornerStyle}>
      <AuthStatusControl mode={mode} personalHref={personalHref}/>
    </div>
  </>;
}
