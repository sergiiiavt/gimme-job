import type { Metadata } from "next";
import QaFundamentalsPage from "../../qa-fundamentals-page";

export const metadata: Metadata = {
  title: "QA Fundamentals — GimmeJob",
  description: "Source-backed learning path for software testing and quality fundamentals: process, test design, defects, risk, reviews and modern delivery.",
};

export default function PublicQaFundamentalsPage() {
  return <QaFundamentalsPage mode="public"/>;
}
