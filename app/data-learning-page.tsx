"use client";

import { useSearchParams } from "next/navigation";
import sqlCurriculum from "@/content/data-learning/catalog";
import LearningDocumentPage from "./learning-document-page";

const sqlModuleIds = sqlCurriculum.taxonomy.map((module) => module.id);

const trackOptions = [
  { id: "sql", label: "SQL", available: true, moduleIds: sqlModuleIds },
  { id: "database-integrity", label: "Database integrity", available: false, emptyState: "Database integrity learning path is under construction." },
  { id: "etl-and-elt", label: "ETL & ELT", available: false, emptyState: "ETL & ELT learning path is under construction." },
  { id: "data-quality", label: "Data quality", available: false, emptyState: "Data quality learning path is under construction." },
  { id: "bi-semantics-and-lineage", label: "BI semantics & lineage", available: false, emptyState: "BI semantics and lineage learning path is under construction." },
];

const dataTrackLayout = `
.kb-subnav-switch {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 6px;
}

.kb-subnav-switch button {
  flex: none;
  min-width: 0;
  min-height: 40px;
  padding: 6px 7px;
  line-height: 1.15;
  white-space: normal;
  overflow-wrap: break-word;
}
`;

export default function DataLearningPage({ mode }: { mode: "public" | "personal" }) {
  const searchParams = useSearchParams();
  const requestedTopic = searchParams.get("topic") ?? undefined;

  return (
    <>
      <style>{dataTrackLayout}</style>
      <LearningDocumentPage
        curriculum={sqlCurriculum}
        defaultTrackId="sql"
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
        trackOptions={trackOptions}
      />
    </>
  );
}
