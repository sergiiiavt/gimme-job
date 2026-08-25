import { createPageMetadata } from "../../seo";

export const metadata = createPageMetadata({
  title: "SQL Learning Path",
  description: "A complete SQL learning path for QA and quality engineers covering querying, joins, aggregation, CTEs, window functions, transactions, schema design, performance, security, and practical data validation.",
  path: "/learn/data",
});

export default function DataLearningLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return children;
}
