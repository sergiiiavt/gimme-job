import type { Metadata } from "next";
import InterviewNavigationState from "./interview-navigation-state";
import PrimaryNavScrollState from "./primary-nav-scroll-state";
import { DEFAULT_DESCRIPTION, SITE_NAME, SITE_ORIGIN } from "./seo";
import ToTopButton from "./to-top-button";
import VacancyPopoverLayer from "./vacancy-popover-layer";
import VacancyScrollState from "./vacancy-scroll-state";
import "./globals.css";
import "./interview-auth-layout.css";
import "./about-site-layout.css";
import "./about-interview-polish.css";
import "./vacancies-workspace.css";
import "./vacancy-detail-layout.css";
import "./vacancy-filter-enhancer.css";
import "./vacancy-description.css";
import "./vacancy-interaction-state.css";
import "./general-ui-fixes.css";
import "./quick-reference-availability.css";
import "./brand-logo.css";
import "./mobile-navigation-logo.css";
import "./navigation-current-selection.css";
import "./navigation-scroll.css";
import "./to-top-button.css";
import "./ai-assistant-controls.css";
import "./vacancy-responsive-stats.css";
import "./http-status-accordion.css";
import "./site-code-blocks.css";\nimport "./new-design.css";

const DESIGN_STORAGE_KEY = "gimmejob-design";

const designModeBootstrap = String.raw\`
(() => {
  try {
    const stored = window.localStorage.getItem("${DESIGN_STORAGE_KEY}");
    document.documentElement.dataset.design = stored === "old" ? "old" : "new";
  } catch {
    document.documentElement.dataset.design = "new";
  }
})();
\`;

const designModeControls = String.raw\`
(() => {
  const root = document.documentElement;
  const controls = Array.from(document.querySelectorAll("[data-design-option]"));

  const sync = () => {
    const activeMode = root.dataset.design === "old" ? "old" : "new";
    for (const control of controls) {
      const active = control.getAttribute("data-design-option") === activeMode;
      control.setAttribute("aria-pressed", String(active));
      control.classList.toggle("active", active);
    }
  };

  for (const control of controls) {
    control.addEventListener("click", () => {
      const mode = control.getAttribute("data-design-option") === "old" ? "old" : "new";
      root.dataset.design = mode;
      try {
        window.localStorage.setItem("${DESIGN_STORAGE_KEY}", mode);
      } catch {
        // The visual switch still works when storage is unavailable.
      }
      sync();
    });
  }

  sync();
})();
\`;

const homeTitle = "GimmeJob | QA Interview Questions, Learning & Career Tools";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_ORIGIN),
  title: homeTitle,
  description: DEFAULT_DESCRIPTION,
  applicationName: SITE_NAME,
  keywords: [
    "QA interview questions",
    "software testing",
    "test automation",
    "QA learning",
    "API testing",
    "Python automation",
    "LLM testing",
    "QA jobs",
  ],
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-image-preview": "large",
      "max-snippet": -1,
      "max-video-preview": -1,
    },
  },
  openGraph: {
    type: "website",
    title: homeTitle,
    description: DEFAULT_DESCRIPTION,
    siteName: SITE_NAME,
  },
  twitter: {
    card: "summary",
    title: homeTitle,
    description: DEFAULT_DESCRIPTION,
  },
  other: {
    "codex-preview": "development",
  },
  icons: {
    icon: "/favicon.png",
    shortcut: "/favicon.png",
  },
};

const websiteJsonLd = {
  "@context": "https://schema.org",
  "@type": "WebSite",
  name: SITE_NAME,
  url: SITE_ORIGIN,
  description: DEFAULT_DESCRIPTION,
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(websiteJsonLd).replace(/</g, "\\u003c") }}
        />
        <div className="design-mode-switcher" role="group" aria-label="Site design">\n          <span>Design</span>\n          <button aria-pressed="false" data-design-option="old" type="button">Old</button>\n          <button aria-pressed="true" className="active" data-design-option="new" type="button">New</button>\n        </div>\n        <script dangerouslySetInnerHTML={{ __html: designModeControls }}/>\n        <InterviewNavigationState/>
        <PrimaryNavScrollState/>
        <VacancyScrollState/>
        <VacancyPopoverLayer/>
        <ToTopButton/>
        {children}
      </body>
    </html>
  );
}
