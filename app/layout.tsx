import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "GimmeJob — Personal Job Workspace",
  description: "A private job database for collecting, reviewing, and tracking opportunities.",
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
