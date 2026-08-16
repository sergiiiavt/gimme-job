"use client";

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
type LearningClusterTone = "foundation" | "ai" | "build" | "systems" | "infra" | "governance";

interface LearningCluster {
  tone: LearningClusterTone;
  itemIds: Array<NavigationItem["id"]>;
}

export const navigationIntroItem: SectionNavigationItem = {
  id: "about",
  label: "About this site",
  publicHref: "/about",
  personalHref: "/about",
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

const learningClusters: LearningCluster[] = [
  { tone: "foundation", itemIds: ["qa-fundamentals", "certifications"] },
  { tone: "ai", itemIds: ["llm", "agentic"] },
  { tone: "build", itemIds: ["programming", "automation", "testing-tools"] },
  { tone: "systems", itemIds: ["api", "data", "mobile", "embedded"] },
  { tone: "infra", itemIds: ["performance", "security", "devops", "observability", "networking", "linux"] },
  { tone: "governance", itemIds: ["standards", "metrics-estimation", "strategy"] },
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
  quickReferenceActive?: boolean;
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
  minHeight: "38px",
  padding: "0 6px 8px",
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
  height: "34px",
  width: "34px",
} as const;

const brandWordmarkStyle = {
  color: "#0b1d3a",
  display: "block",
  fontFamily: '"Arial Rounded MT Bold", "Avenir Next", "Segoe UI", system-ui, sans-serif',
  fontSize: "19px",
  fontWeight: 800,
  letterSpacing: "-0.045em",
  whiteSpace: "nowrap",
} as const;

const brandJobStyle = {
  color: "#1769ff",
} as const;

const responsiveAccountStyle = `
.kb-mobile-brand { display: none; }

.kb-navigation .kb-sidebar {
  background: #fbfcfa;
  border-right: 1px solid #e7ebe7;
}

.kb-navigation .kb-nav-list {
  gap: 0 !important;
}

.kb-navigation .kb-area-group {
  background: transparent;
  border: 0;
  border-radius: 0;
  margin: 0;
  padding: 4px 2px;
}

.kb-navigation .kb-area-group + .kb-area-group {
  border-top: 0;
  padding-top: 5px;
}

.kb-navigation .kb-area-group > h2 {
  color: #89928d;
  font-size: 9.5px;
  font-weight: 750;
  letter-spacing: .08em;
  margin: 2px 6px 4px;
  text-transform: uppercase;
}

.kb-navigation .kb-nav-link {
  align-items: center;
  background: transparent;
  border: 0;
  border-left: 3px solid transparent;
  border-radius: 5px;
  color: #435049;
  display: grid;
  font-size: 11.3px;
  font-weight: 500 !important;
  gap: 7px;
  grid-template-columns: 16px minmax(0, 1fr);
  line-height: 1.12;
  margin: 0;
  min-height: 25px;
  padding: 4px 6px 4px 3px;
  width: 100%;
}

.kb-navigation .kb-nav-link:hover {
  background: #f3f5f2;
  color: #26322c;
}

.kb-navigation .kb-nav-link.active {
  background: #edf4e8;
  border-left-color: #6f9248;
  box-shadow: none;
  color: #253126;
  font-weight: 500 !important;
}

.kb-navigation .kb-nav-icon {
  color: #69736e;
  display: grid;
  height: 16px;
  place-items: center;
  width: 16px;
}

.kb-navigation .kb-nav-icon svg {
  display: block;
  height: 15px;
  width: 15px;
}

.kb-navigation .kb-nav-link.active .kb-nav-icon {
  color: #527731;
}

.kb-navigation .kb-nav-label {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.kb-learning-catalog {
  display: flex;
  flex-direction: column;
  gap: 3px;
}

.kb-learning-cluster {
  border-radius: 8px;
  padding: 2px 3px;
}

.kb-learning-cluster-foundation { background: rgba(219, 232, 205, .42); }
.kb-learning-cluster-ai { background: rgba(217, 232, 247, .48); }
.kb-learning-cluster-build { background: rgba(248, 236, 204, .50); }
.kb-learning-cluster-systems { background: rgba(238, 228, 247, .46); }
.kb-learning-cluster-infra { background: rgba(221, 239, 230, .46); }
.kb-learning-cluster-governance { background: rgba(236, 237, 233, .72); }

.kb-area-group-learning .kb-learning-cluster .kb-nav-link:hover {
  background: rgba(255, 255, 255, .48);
}

.kb-area-group-learning .kb-learning-cluster .kb-nav-link.active {
  background: rgba(213, 229, 196, .82);
  border-left-color: #6f9248;
}

.kb-quick-reference-link {
  align-items: center;
  background: #f7f8f6;
  border: 1px solid #e2e6e1;
  border-radius: 7px;
  color: #4f5c54;
  display: flex;
  font-size: 10.5px;
  font-weight: 700;
  justify-content: space-between;
  margin: 0 4px 7px;
  min-height: 32px;
  padding: 6px 8px;
  text-decoration: none;
}

.kb-quick-reference-link:hover {
  background: #f0f3ee;
  color: #334238;
}

.kb-quick-reference-link.active {
  background: #e8f0df;
  border-color: #cadbb8;
  color: #3e5d27;
}

.kb-quick-reference-link small {
  color: #929a95;
  font-size: 8.5px;
  font-weight: 750;
  letter-spacing: .05em;
  text-transform: uppercase;
}

@media (max-width: 1100px) {
  .kb-navigation .kb-nav-link {
    font-size: 10.5px;
    gap: 6px;
    grid-template-columns: 15px minmax(0, 1fr);
    min-height: 26px;
    padding-right: 4px;
  }

  .kb-navigation .kb-nav-icon,
  .kb-navigation .kb-nav-icon svg {
    height: 14px;
    width: 14px;
  }

  .kb-learning-catalog { gap: 2px; }
  .kb-learning-cluster { padding: 1px 2px; }
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

function SidebarItemIcon({ id }: { id: NavigationItem["id"] }) {
  const props = {
    "aria-hidden": true,
    fill: "none",
    stroke: "currentColor",
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    strokeWidth: 1.7,
    viewBox: "0 0 24 24",
  };

  switch (id) {
    case "about":
      return <svg {...props}><circle cx="12" cy="12" r="8"/><path d="M12 10v6M12 7.2h.01"/></svg>;
    case "jobs":
      return <svg {...props}><rect x="3" y="7" width="18" height="12" rx="2"/><path d="M8 7V5h8v2M3 11h18M10 11v2h4v-2"/></svg>;
    case "resume":
      return <svg {...props}><path d="M6 3h8l4 4v14H6zM14 3v5h4M9 12h6M9 16h6"/></svg>;
    case "interview":
      return <svg {...props}><path d="M4 5h16v11H9l-5 4z"/></svg>;
    case "trends":
      return <svg {...props}><path d="m4 17 5-5 4 3 7-8M15 7h5v5"/></svg>;
    case "qa-fundamentals":
      return <svg {...props}><path d="M4 5.5A3.5 3.5 0 0 1 7.5 2H12v17H7.5A3.5 3.5 0 0 0 4 22zM20 5.5A3.5 3.5 0 0 0 16.5 2H12v17h4.5A3.5 3.5 0 0 1 20 22z"/></svg>;
    case "certifications":
      return <svg {...props}><circle cx="12" cy="9" r="5"/><path d="m9 14-1 7 4-2 4 2-1-7M10 9l1.3 1.3L14 7.5"/></svg>;
    case "llm":
      return <svg {...props}><path d="m12 3 1.2 3.3L17 7.5l-3.8 1.2L12 12l-1.2-3.3L7 7.5l3.8-1.2zM5 13l.8 2.2L8 16l-2.2.8L5 19l-.8-2.2L2 16l2.2-.8zM18 14l.8 2.2L21 17l-2.2.8L18 20l-.8-2.2L15 17l2.2-.8z"/></svg>;
    case "agentic":
      return <svg {...props}><rect x="5" y="7" width="14" height="11" rx="3"/><path d="M9 11h.01M15 11h.01M9 15h6M12 7V4M10 4h4"/></svg>;
    case "programming":
      return <svg {...props}><path d="m8 6-5 6 5 6M16 6l5 6-5 6M14 4l-4 16"/></svg>;
    case "automation":
      return <svg {...props}><rect x="4" y="4" width="16" height="16" rx="2"/><path d="m8 12 2.5 2.5L16 9"/></svg>;
    case "testing-tools":
      return <svg {...props}><path d="M14.5 5.5a5 5 0 0 0-6.8 6.8L3 17l4 4 4.7-4.7a5 5 0 0 0 6.8-6.8l-3 3-4-4z"/></svg>;
    case "api":
      return <svg {...props}><path d="M10 13a4 4 0 0 0 5.7 0l2.3-2.3a4 4 0 0 0-5.7-5.7L11 6.3M14 11a4 4 0 0 0-5.7 0L6 13.3A4 4 0 0 0 11.7 19l1.3-1.3"/></svg>;
    case "data":
      return <svg {...props}><ellipse cx="12" cy="5" rx="7" ry="3"/><path d="M5 5v6c0 1.7 3.1 3 7 3s7-1.3 7-3V5M5 11v6c0 1.7 3.1 3 7 3s7-1.3 7-3v-6"/></svg>;
    case "mobile":
      return <svg {...props}><rect x="7" y="2" width="10" height="20" rx="2"/><path d="M10 5h4M11 19h2"/></svg>;
    case "embedded":
      return <svg {...props}><rect x="7" y="7" width="10" height="10" rx="1"/><path d="M9 2v5M12 2v5M15 2v5M9 17v5M12 17v5M15 17v5M2 9h5M2 12h5M2 15h5M17 9h5M17 12h5M17 15h5"/></svg>;
    case "performance":
      return <svg {...props}><path d="M4 17a8 8 0 1 1 16 0M12 17l4-6M7 17h10"/></svg>;
    case "security":
      return <svg {...props}><path d="M12 3 19 6v5c0 4.6-2.8 8-7 10-4.2-2-7-5.4-7-10V6z"/></svg>;
    case "devops":
      return <svg {...props}><path d="M7 18h10a4 4 0 0 0 .7-7.9A6 6 0 0 0 6.2 8.4 4.8 4.8 0 0 0 7 18z"/></svg>;
    case "observability":
      return <svg {...props}><path d="M2.5 12s3.5-6 9.5-6 9.5 6 9.5 6-3.5 6-9.5 6-9.5-6-9.5-6z"/><circle cx="12" cy="12" r="2.5"/></svg>;
    case "networking":
      return <svg {...props}><circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3c3 3 4 6 4 9s-1 6-4 9M12 3c-3 3-4 6-4 9s1 6 4 9"/></svg>;
    case "linux":
      return <svg {...props}><path d="m4 7 5 5-5 5M11 17h9"/></svg>;
    case "standards":
      return <svg {...props}><rect x="5" y="4" width="14" height="17" rx="2"/><path d="M9 4V2h6v2M9 9h6M9 13h6M9 17h4"/></svg>;
    case "metrics-estimation":
      return <svg {...props}><path d="M5 20V12h3v8M10.5 20V7h3v13M16 20V4h3v16"/></svg>;
    case "strategy":
      return <svg {...props}><circle cx="9" cy="8" r="3"/><circle cx="17" cy="10" r="2.5"/><path d="M3.5 20c.6-4 2.5-6 5.5-6s5 2 5.5 6M14 15c3.8-.5 6 1.2 6.5 4.5"/></svg>;
    case "news":
      return <svg {...props}><rect x="4" y="3" width="16" height="18" rx="2"/><path d="M8 7h8M8 11h8M8 15h5M8 18h8"/></svg>;
    case "rewild":
      return <svg {...props}><path d="m12 3 1.4 4.2L18 8.5l-3.5 2.7L15 16l-3-2-3 2 .5-4.8L6 8.5l4.6-1.3zM5 17l.6 1.4L7 19l-1.4.6L5 21l-.6-1.4L3 19l1.4-.6z"/></svg>;
    default:
      return <svg {...props}><circle cx="12" cy="12" r="8"/></svg>;
  }
}

export function SiteSidebar({ activeExternalId, activeSection, activeSubsection, hideSecondary = false, mobileOpen, mode, onSelectSubsection, personalHref = "/vacancies", quickReferenceActive = false, secondaryEmptyState, secondaryItems, secondarySwitcher, secondaryTitle }: SidebarProps) {
  const renderItem = (item: NavigationItem, intro = false) => {
    const active = item.external ? activeExternalId === item.id : activeSection === item.id;
    const href = item.external ? item.publicHref : sectionNavigationHref(item.id, mode);

    return (
      <Link
        aria-current={active ? "page" : undefined}
        className={`${intro ? "kb-nav-intro " : ""}kb-nav-link${active ? " active" : ""}`}
        href={href}
        key={item.id}
        title={item.label}
      >
        <span className="kb-nav-icon"><SidebarItemIcon id={item.id}/></span>
        <span className="kb-nav-label">{item.label}</span>
      </Link>
    );
  };

  const renderLearningItems = (items: NavigationItem[]) => (
    <div className="kb-learning-catalog">
      {learningClusters.map((cluster) => (
        <div className={`kb-learning-cluster kb-learning-cluster-${cluster.tone}`} key={cluster.tone}>
          {cluster.itemIds.map((itemId) => {
            const item = items.find((candidate) => candidate.id === itemId);
            return item ? renderItem(item) : null;
          })}
        </div>
      ))}
    </div>
  );

  const brandHref = sectionNavigationHref("about", mode);
  const activeNavigationId = activeExternalId ?? activeSection;
  const learningItems = navigationGroups.find((group) => group.id === "learning")?.items ?? [];
  const quickReferenceHref = activeNavigationId && learningItems.some((item) => item.id === activeNavigationId)
    ? `/reference/${activeNavigationId}`
    : null;

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
        {quickReferenceHref && (
          <Link aria-current={quickReferenceActive ? "page" : undefined} className={`kb-quick-reference-link${quickReferenceActive ? " active" : ""}`} href={quickReferenceHref}>
            <span>Quick reference</span><small>one page</small>
          </Link>
        )}
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
