import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "GimmeJob",
  description: "Jobs, interview questions, QA notes, AI agents, security, DevOps, and software standards.",
  applicationName: "GimmeJob",
  keywords: ["jobs", "QA jobs", "career", "interview questions", "AI agents", "LLM testing", "DevOps", "security"],
  robots: {
    index: true,
    follow: true,
  },
  openGraph: {
    type: "website",
    title: "GimmeJob",
    description: "Jobs, interview questions, engineering notes, and software standards.",
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
