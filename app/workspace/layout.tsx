import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Private workspace — GimmeJob",
  description: "Private vacancy tracking and application workspace.",
  robots: {
    index: false,
    follow: false,
    nocache: true,
  },
};

export default function WorkspaceLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return children;
}
