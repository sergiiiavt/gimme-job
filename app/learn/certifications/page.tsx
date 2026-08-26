import type { Metadata } from "next";
import IstqbAiTestingPage from "../../istqb-ai-testing-page";
import { learningSectionMetadata } from "../../seo";

export const metadata: Metadata = learningSectionMetadata("certifications");

export default function Page() {
  return <IstqbAiTestingPage/>;
}
