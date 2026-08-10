import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "JobPilot — Private Cloud Job Search Agent",
  description: "A private cloud, approval-first dashboard for job discovery, market analysis, resume tailoring, and applications.",
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
