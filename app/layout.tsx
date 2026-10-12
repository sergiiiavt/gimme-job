import type { Metadata } from "next";
import InterviewNavigationState from "./interview-navigation-state";
import PrimaryNavScrollState from "./primary-nav-scroll-state";
import JsonLd from "./json-ld";
import { DEFAULT_DESCRIPTION, DEFAULT_OG_IMAGE, HOME_TITLE, SITE_NAME, SITE_ORIGIN } from "./seo";
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
import "./site-code-blocks.css";
import "./new-design.css";

const DESIGN_STORAGE_KEY = "gimmejob-design";

const designModeBootstrap = String.raw`
(() => {
  try {
    const stored = window.localStorage.getItem("${DESIGN_STORAGE_KEY}");
    document.documentElement.dataset.design = stored === "old" ? "old" : "new";
  } catch {
    document.documentElement.dataset.design = "new";
  }
})();
`;

// Every page renders per request; vinext 1.x would otherwise cache pages that read search params.
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_ORIGIN),
  title: HOME_TITLE,
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
    title: HOME_TITLE,
    description: DEFAULT_DESCRIPTION,
    siteName: SITE_NAME,
    locale: "en_US",
    images: [DEFAULT_OG_IMAGE],
  },
  twitter: {
    card: "summary_large_image",
    title: HOME_TITLE,
    description: DEFAULT_DESCRIPTION,
    images: [DEFAULT_OG_IMAGE.url],
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
  inLanguage: ["en", "uk"],
  publisher: {
    "@type": "Organization",
    name: SITE_NAME,
    url: SITE_ORIGIN,
    logo: `${SITE_ORIGIN}/gimmejob-logo.png`,
  },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html data-design="new" lang="en" suppressHydrationWarning>
      <body>
        <script dangerouslySetInnerHTML={{ __html: designModeBootstrap }}/>
        <JsonLd data={websiteJsonLd}/>

        <InterviewNavigationState/>
        <PrimaryNavScrollState/>
        <VacancyScrollState/>
        <VacancyPopoverLayer/>
        <ToTopButton/>
        {children}
      </body>
    </html>
  );
}
