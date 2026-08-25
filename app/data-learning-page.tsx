"use client";

import { useSearchParams } from "next/navigation";
import sqlCurriculum from "@/content/data-learning/catalog";
import LearningDocumentPage from "./learning-document-page";

export default function DataLearningPage({ mode }: { mode: "public" | "personal" }) {
  const searchParams = useSearchParams();
  const requestedTopic = searchParams.get("topic") ?? undefined;

  return (
    <LearningDocumentPage
      curriculum={sqlCurriculum}
      heroMeta={({ module, sourceCount }) => [
        "Under review",
        `${module.count ?? 0} focused topics`,
        `${sourceCount} references · runnable SQLite examples`,
      ]}
      initialModuleId={requestedTopic}
      languages={["en"]}
      mode={mode}
      personalHref="/learn/data"
      publicHref="/learn/data"
      secondaryTitle="Databases, SQL & BI"
      section="data"
      sourceStatusLabel={({ sourceCount }) => `${sourceCount} chapter references · Under review`}
    />
  );
}
