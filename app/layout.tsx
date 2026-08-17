import type { Metadata } from "next";
import PrimaryNavScrollState from "./primary-nav-scroll-state";
import "./globals.css";
import "./interview-auth-layout.css";
import "./about-site-layout.css";
import "./vacancies-workspace.css";
import "./vacancy-filter-enhancer.css";
import "./vacancy-description.css";
import "./quick-reference-availability.css";
import "./brand-logo.css";
import "./mobile-navigation-logo.css";
import "./navigation-current-selection.css";

export const metadata: Metadata = {
  title: "GimmeJob | Serhii Yavtushkevych's QA engineering portfolio",
  description: "A live QA engineering portfolio with a researched interview catalog, career tools, learning paths, and a Cloudflare delivery pipeline.",
  applicationName: "GimmeJob",
  keywords: ["QA engineering portfolio", "QA jobs", "career", "interview questions", "test automation", "AI agents", "LLM testing", "DevOps", "security"],
  robots: {
    index: true,
    follow: true,
  },
  openGraph: {
    type: "website",
    title: "GimmeJob | QA engineering portfolio",
    description: "A live QA engineering portfolio with career tools, 672 researched interview questions, and an auditable cloud delivery pipeline.",
    siteName: "GimmeJob",
  },
  other: {
    "codex-preview": "development",
  },
  icons: {
    icon: "/favicon.svg",
    shortcut: "/favicon.svg",
  },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>
        <PrimaryNavScrollState/>
        {children}
      </body>
    </html>
  );
}
