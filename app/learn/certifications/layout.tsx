import type { Metadata } from "next";
import { learningSectionMetadata } from "../../seo";

export const metadata: Metadata = learningSectionMetadata("certifications");

export default function CertificationsLearningLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return children;
}
