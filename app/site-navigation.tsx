"use client";

import Link from "next/link";
import AuthStatusControl from "./auth-status-control";

export type SiteSection = "about" | "jobs" | "resume" | "interview" | "python-interview" | "certifications" | "strategy" | "programming" | "automation" | "api" | "data" | "mobile" | "embedded" | "performance" | "security" | "devops" | "observability" | "networking" | "linux" | "llm" | "agentic" | "standards" | "trends" | "news" | "rewild";
export type ExternalNavigationId = "qa-fundamentals";

interface SectionNavigationItem {
  id: SiteSection;
  label: string;
  external?: false;
  publicHref?: string;
  personalHref?: string;
}

interface ExternalNavigationItem {
  id: ExternalNavigationId;
  label: string;
  external: true;
  publicHref: string;
  personalHref: string;
}

type NavigationItem = SectionNavigationItem | ExternalNavigationItem;

export const navigationIntroItem: SectionNavigationItem = {
  id: "about",
  label: "About this site",
  publicHref: "/",
  personalHref: "/",
};

/** Valid deep-link sections that are reachable in-page (e.g. via a catalog toggle) rather than through their own nav button. */
export const hiddenDeepLinkSections: SiteSection[] = ["python-interview"];

export const navigationGroups: Array<{ id: "career" | "learning" | "misc"; label: string; items: NavigationItem[] }> = [
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
      {
        id: "qa-fundamentals",
        label: "QA fundamentals",
        external: true,
        publicHref: "/learn/qa-fundamentals",
        personalHref: "/workspace/learn/qa-fundamentals",
      },
      { id: "certifications", label: "Certs & Trainings" },
      { id: "llm", label: "Generative AI & LLM" },
      { id: "agentic", label: "AI agents & MCP" },
      { id: "programming", label: "Programming", publicHref: "/learn/programming", personalHref: "/workspace/learn/programming" },
      { id: "automation", label: "Test automation", publicHref: "/learn/automation", personalHref: "/workspace/learn/automation" },
      { id: "api", label: "API & integration" },
      { id: "data", label: "Databases, SQL & BI" },
      { id: "mobile", label: "Mobile & accessibility" },
      { id: "embedded", label: "Embedded & IoT QA" },
      { id: "performance", label: "Performance & reliability" },
      { id: "security", label: "Security testing" },
      { id: "devops", label: "Cloud & DevOps", publicHref: "/learn/cloud-devops", personalHref: "/workspace/learn/cloud-devops" },
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

function isSectionNavigationItem(item: NavigationItem): item is SectionNavigationItem {
  return item.external !== true;
}

export const navigationItems: SectionNavigationItem[] = [
  navigationIntroItem,
  ...navigationGroups.flatMap((group) => group.items.filter(isSectionNavigationItem)),
];

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
  activeSection: SiteSection | null;
  activeExternalId?: ExternalNavigationId;
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

const brandLinkStyle = {
  alignItems: "center",
  display: "flex",
  gap: "8px",
  lineHeight: 1,
  minHeight: "42px",
  padding: "0 8px 18px",
} as const;

const brandMarkStyle = {
  display: "block",
  flex: "0 0 auto",
  height: "38px",
  width: "38px",
} as const;

const brandWordmarkStyle = {
  color: "#0b1d3a",
  display: "block",
  fontFamily: '"Arial Rounded MT Bold", "Avenir Next", "Segoe UI", system-ui, sans-serif',
  fontSize: "20px",
  fontWeight: 800,
  letterSpacing: "-0.045em",
  whiteSpace: "nowrap",
} as const;

const brandJobStyle = {
  color: "#1769ff",
} as const;

const responsiveAccountStyle = `
@media (max-width: 820px) {
  .kb-account-corner { right: 62px !important; top: 8px !important; }
}
`;

function GimmeJobMark() {
  return (
    <svg aria-hidden="true" style={brandMarkStyle} viewBox="0 0 64 64">
      <circle cx="27.5" cy="29" fill="none" r="20.5" stroke="#1769ff" strokeLinecap="round" strokeWidth="6"/>
      <path d="M42.5 43.5 54 55" fill="none" stroke="#1769ff" strokeLinecap="round" strokeWidth="6"/>
      <path d="m18.5 30.5 7.7 7.8L42.5 21" fill="none" stroke="#12c7a5" strokeLinecap="round" strokeLinejoin="round" strokeWidth="6"/>
      <path d="M44.5 7.5v5M53.7 11.8l-3.5 3.5M57 21h-5" fill="none" stroke="#12c7a5" strokeLinecap="round" strokeWidth="4.5"/>
    </svg>
  );
}

export function SiteSidebar({ activeExternalId, activeSection, activeSubsection, hideSecondary = false, mobileOpen, mode, onSelect, onSelectSubsection, personalHref = "/workspace", secondaryEmptyState, secondaryItems, secondarySwitcher, secondaryTitle }: SidebarProps) {
  const renderItem = (item: NavigationItem, intro = false) => {
    if (item.external) {
      return (
        <Link
          className={`${intro ? "kb-nav-intro " : ""}kb-nav-link${activeExternalId === item.id ? " active" : ""}`}
          href={mode === "public" ? item.publicHref : item.personalHref}
          key={item.id}
        >
          {item.label}
        </Link>
      );
    }

    if (item.publicHref && item.personalHref) {
      return (
        <Link
          className={`${intro ? "kb-nav-intro " : ""}kb-nav-link${activeSection === item.id ? " active" : ""}`}
          href={mode === "public" ? item.publicHref : item.personalHref}
          key={item.id}
        >
          {item.label}
        </Link>
      );
    }

    return onSelect ? (
      <button className={`${intro ? "kb-nav-intro " : ""}kb-nav-link${activeSection === item.id ? " active" : ""}`} key={item.id} onClick={() => onSelect(item.id)}>
        {item.label}
      </button>
    ) : (
      <Link className={`${intro ? "kb-nav-intro " : ""}kb-nav-link${activeSection === item.id ? " active" : ""}`} href={item.id === "jobs" ? "/workspace" : `/workspace/learn?section=${item.id}`} key={item.id}>
        {item.label}
      </Link>
    );
  };

  return <>
    <div className={`kb-navigation${hideSecondary ? " compact" : ""}${mobileOpen ? " open" : ""}`}>
      <aside className="kb-sidebar">
        <Link aria-label="GimmeJob — About this site" className="kb-brand" href={mode === "public" ? navigationIntroItem.publicHref ?? "/" : navigationIntroItem.personalHref ?? "/"} style={brandLinkStyle}>
          <GimmeJobMark/>
          <strong style={brandWordmarkStyle}>Gimme<span style={brandJobStyle}>Job</span></strong>
        </Link>

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
