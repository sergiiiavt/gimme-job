"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import AuthStatusControl from "./auth-status-control";
import { sectionNavigationHref } from "./navigation-paths";

export type SiteSection = "about" | "jobs" | "resume" | "interview" | "python-interview" | "certifications" | "strategy" | "programming" | "automation" | "api" | "data" | "mobile" | "embedded" | "performance" | "security" | "devops" | "observability" | "networking" | "linux" | "llm" | "agentic" | "standards" | "trends" | "news" | "rewild";
export type ExternalNavigationId = "qa-fundamentals" | "testing-tools" | "metrics-estimation";

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
type LearningCategoryId = "core" | "automation" | "specialized" | "infrastructure" | "ai" | "management";

interface LearningCategory {
  id: LearningCategoryId;
  label: string;
  itemIds: Array<NavigationItem["id"]>;
}

export const navigationIntroItem: SectionNavigationItem = {
  id: "about",
  label: "About this site",
  publicHref: "/learn/about",
  personalHref: "/learn/about",
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
      {
        id: "testing-tools",
        label: "Testing & diagnostic tools",
        external: true,
        publicHref: "/learn/testing-tools",
        personalHref: "/workspace/learn/testing-tools",
      },
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
      {
        id: "metrics-estimation",
        label: "QA metrics & estimation",
        external: true,
        publicHref: "/learn/metrics-estimation",
        personalHref: "/workspace/learn/metrics-estimation",
      },
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

const learningCategories: LearningCategory[] = [
  {
    id: "core",
    label: "QA Core",
    itemIds: ["qa-fundamentals", "testing-tools", "metrics-estimation", "standards", "certifications"],
  },
  {
    id: "automation",
    label: "Automation & Development",
    itemIds: ["programming", "automation", "api", "data"],
  },
  {
    id: "specialized",
    label: "Specialized Testing",
    itemIds: ["mobile", "embedded", "performance", "security"],
  },
  {
    id: "infrastructure",
    label: "Infrastructure",
    itemIds: ["devops", "observability", "networking", "linux"],
  },
  {
    id: "ai",
    label: "AI for QA",
    itemIds: ["llm", "agentic"],
  },
  {
    id: "management",
    label: "QA Management",
    itemIds: ["strategy"],
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

const mobileBrandLinkStyle = {
  alignItems: "center",
  gap: "8px",
  left: "12px",
  lineHeight: 1,
  minHeight: "42px",
  padding: 0,
  position: "absolute",
  top: "8px",
  zIndex: 47,
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
.kb-mobile-brand { display: none; }

.kb-learning-groups { gap: 4px !important; }
.kb-learning-category { border-radius: 7px; overflow: hidden; }
.kb-learning-category-toggle {
  align-items: center;
  background: transparent;
  border: 0;
  border-radius: 7px;
  color: #314137;
  cursor: pointer;
  display: grid;
  font-size: 11.5px;
  font-weight: 780;
  gap: 7px;
  grid-template-columns: 18px minmax(0, 1fr) 14px;
  line-height: 1.22;
  min-height: 38px;
  padding: 7px 7px;
  text-align: left;
  transition: background .14s ease, color .14s ease;
  width: 100%;
}
.kb-learning-category-toggle:hover { background: #e8f0e4; color: #1d3023; }
.kb-learning-category.current > .kb-learning-category-toggle,
.kb-learning-category.open > .kb-learning-category-toggle { background: #e7efe3; }
.kb-learning-category.current > .kb-learning-category-toggle { color: #294d2e; }
.kb-learning-category-icon { color: #5f7e35; display: grid; place-items: center; }
.kb-learning-category-icon svg { display: block; height: 18px; width: 18px; }
.kb-learning-category-chevron { color: #66736b; display: grid; place-items: center; transition: transform .15s ease; }
.kb-learning-category-chevron svg { display: block; height: 13px; width: 13px; }
.kb-learning-category.open .kb-learning-category-chevron { transform: rotate(90deg); }
.kb-learning-category-items { display: flex; flex-direction: column; gap: 1px; padding: 3px 2px 5px 24px; }
.kb-area-group-learning .kb-learning-category-items .kb-nav-link {
  border-radius: 6px;
  font-size: 11.5px;
  line-height: 1.28;
  min-height: 32px;
  padding: 7px 6px 7px 8px;
}
.kb-area-group-learning .kb-learning-category-items .kb-nav-link.active {
  box-shadow: inset 3px 0 0 #5f7e35;
  font-weight: 800;
}

@media (max-width: 1100px) {
  .kb-learning-category-toggle { font-size: 10.5px; gap: 5px; grid-template-columns: minmax(0, 1fr) 12px; padding-left: 6px; padding-right: 5px; }
  .kb-learning-category-icon { display: none; }
  .kb-learning-category-items { padding-left: 8px; }
  .kb-area-group-learning .kb-learning-category-items .kb-nav-link { font-size: 10.5px; padding-left: 6px; padding-right: 4px; }
}

@media (max-width: 900px) {
  .kb-account-corner { right: 62px !important; top: 8px !important; z-index: 50 !important; }
  .kb-floating-menu { z-index: 51 !important; }
  .kb-navigation.open { padding-top: 58px; }
  .kb-navigation.open .kb-mobile-brand { display: flex; }
  .kb-navigation.open > .kb-sidebar > .kb-brand { display: none !important; }
  .kb-navigation.open > .kb-sidebar,
  .kb-navigation.open > .kb-subnav { height: auto; min-height: 0; }
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

function LearningCategoryIcon({ id }: { id: LearningCategoryId }) {
  const commonProps = {
    "aria-hidden": true,
    fill: "none",
    stroke: "currentColor",
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    strokeWidth: 1.8,
    viewBox: "0 0 24 24",
  };

  if (id === "core") {
    return <svg {...commonProps}><path d="M12 3 19 6v5c0 4.5-2.8 8-7 10-4.2-2-7-5.5-7-10V6l7-3Z"/><path d="m8.8 12 2 2 4.5-5"/></svg>;
  }

  if (id === "automation") {
    return <svg {...commonProps}><path d="m8 7-5 5 5 5"/><path d="m16 7 5 5-5 5"/><path d="m14 4-4 16"/></svg>;
  }

  if (id === "specialized") {
    return <svg {...commonProps}><circle cx="12" cy="12" r="7"/><circle cx="12" cy="12" r="2.5"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3"/></svg>;
  }

  if (id === "infrastructure") {
    return <svg {...commonProps}><path d="M7 18h10a4 4 0 0 0 .7-7.9A6 6 0 0 0 6.2 8.4 4.8 4.8 0 0 0 7 18Z"/><path d="M9 21h6M12 18v3"/></svg>;
  }

  if (id === "ai") {
    return <svg {...commonProps}><circle cx="6" cy="12" r="2"/><circle cx="17.5" cy="6" r="2"/><circle cx="17.5" cy="18" r="2"/><path d="M8 12h4M13.5 11l2.5-3M13.5 13l2.5 3M12 8v8"/></svg>;
  }

  return <svg {...commonProps}><circle cx="9" cy="8" r="3"/><circle cx="17" cy="10" r="2.5"/><path d="M3.5 20c.6-4 2.5-6 5.5-6s5 2 5.5 6M14 15c3.8-.5 6 1.2 6.5 4.5"/></svg>;
}

function LearningCategoryChevron() {
  return (
    <svg aria-hidden="true" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" viewBox="0 0 16 16">
      <path d="m6 3 5 5-5 5"/>
    </svg>
  );
}

export function SiteSidebar({ activeExternalId, activeSection, activeSubsection, hideSecondary = false, mobileOpen, mode, onSelectSubsection, personalHref = "/workspace", secondaryEmptyState, secondaryItems, secondarySwitcher, secondaryTitle }: SidebarProps) {
  const activeLearningCategoryId = learningCategories.find((category) =>
    category.itemIds.some((itemId) => itemId === activeExternalId || itemId === activeSection),
  )?.id ?? null;
  const [openLearningCategoryId, setOpenLearningCategoryId] = useState<LearningCategoryId | null>(activeLearningCategoryId);

  useEffect(() => {
    if (activeLearningCategoryId) {
      setOpenLearningCategoryId(activeLearningCategoryId);
    }
  }, [activeLearningCategoryId]);

  const renderItem = (item: NavigationItem, intro = false) => {
    if (item.external) {
      const active = activeExternalId === item.id;
      return (
        <Link
          aria-current={active ? "page" : undefined}
          className={`${intro ? "kb-nav-intro " : ""}kb-nav-link${active ? " active" : ""}`}
          href={mode === "public" ? item.publicHref : item.personalHref}
          key={item.id}
        >
          {item.label}
        </Link>
      );
    }

    const href = item.publicHref && item.personalHref
      ? mode === "public" ? item.publicHref : item.personalHref
      : sectionNavigationHref(item.id, mode);
    const active = activeSection === item.id;

    return (
      <Link aria-current={active ? "page" : undefined} className={`${intro ? "kb-nav-intro " : ""}kb-nav-link${active ? " active" : ""}`} href={href} key={item.id}>
        {item.label}
      </Link>
    );
  };

  const renderLearningItems = (items: NavigationItem[]) => (
    <div className="kb-learning-groups">
      {learningCategories.map((category) => {
        const open = openLearningCategoryId === category.id;
        const current = activeLearningCategoryId === category.id;
        const panelId = `kb-learning-category-${category.id}`;

        return (
          <div className={`kb-learning-category${open ? " open" : ""}${current ? " current" : ""}`} key={category.id}>
            <button
              aria-controls={panelId}
              aria-expanded={open}
              className="kb-learning-category-toggle"
              onClick={() => setOpenLearningCategoryId(open ? null : category.id)}
              type="button"
            >
              <span className="kb-learning-category-icon"><LearningCategoryIcon id={category.id}/></span>
              <span>{category.label}</span>
              <span className="kb-learning-category-chevron"><LearningCategoryChevron/></span>
            </button>
            <div className="kb-learning-category-items" hidden={!open} id={panelId}>
              {category.itemIds.map((itemId) => {
                const item = items.find((candidate) => candidate.id === itemId);
                return item ? renderItem(item) : null;
              })}
            </div>
          </div>
        );
      })}
    </div>
  );

  const brandHref = mode === "public"
    ? navigationIntroItem.publicHref ?? "/learn/about"
    : navigationIntroItem.personalHref ?? "/learn/about";

  return <>
    <div className={`kb-navigation${hideSecondary ? " compact" : ""}${mobileOpen ? " open" : ""}`}>
      <Link aria-label="GimmeJob — About this site" className="kb-mobile-brand" href={brandHref} style={mobileBrandLinkStyle}>
        <GimmeJobMark/>
        <strong style={brandWordmarkStyle}>Gimme<span style={brandJobStyle}>Job</span></strong>
      </Link>

      <aside className="kb-sidebar">
        <Link aria-label="GimmeJob — About this site" className="kb-brand" href={brandHref} style={brandLinkStyle}>
          <GimmeJobMark/>
          <strong style={brandWordmarkStyle}>Gimme<span style={brandJobStyle}>Job</span></strong>
        </Link>

        <nav className="kb-nav-list" aria-label="GimmeJob sections">
          {renderItem(navigationIntroItem, true)}
          {navigationGroups.map((group) => (
            <section className={`kb-area-group kb-area-group-${group.id}`} aria-labelledby={`kb-area-${group.id}`} key={group.id}>
              <h2 id={`kb-area-${group.id}`}>{group.label}</h2>
              {group.id === "learning" ? renderLearningItems(group.items) : (
                <div>
                  {group.items.map((item) => renderItem(item))}
                </div>
              )}
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
