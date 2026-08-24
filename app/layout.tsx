import type { Metadata } from "next";
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
        <PrimaryNavScrollState/>
        <VacancyScrollState/>
        <VacancyPopoverLayer/>
        <ToTopButton/>
        {children}
      </body>
    </html>
  );
}
