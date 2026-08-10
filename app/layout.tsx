import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "GimmeJob — Jobs, career knowledge, and engineering labs",
  description: "Curated vacancies, interview knowledge, market trends, and practical QA, AI agent, security, and DevOps labs.",
  applicationName: "GimmeJob",
  keywords: ["jobs", "QA jobs", "career", "interview questions", "AI agents", "LLM testing", "DevOps", "security"],
  robots: {
    index: true,
    follow: true,
  },
  openGraph: {
    type: "website",
    title: "GimmeJob — Career engineering hub",
    description: "Curated vacancies, career knowledge, market trends, and practical engineering labs.",
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
      <body>{children}</body>
    </html>
  );
}
