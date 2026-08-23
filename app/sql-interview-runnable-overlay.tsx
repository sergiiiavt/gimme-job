"use client";

import ExecutableSqlBlock from "./executable-sql-block";
import InterviewRunnableOverlay, { type RunnableInterviewCodeExample } from "./interview-runnable-overlay";
import { isRunnableSqlInterviewExample } from "./interview-sql-execution";

interface RunnableInterviewQuestion {
  id: string;
  codeExamples?: RunnableInterviewCodeExample[];
}

function isRunnable(example: RunnableInterviewCodeExample) {
  return isRunnableSqlInterviewExample(example.language, example.code, example.sqlRuntime);
}

function renderRunner(example: RunnableInterviewCodeExample) {
  return <ExecutableSqlBlock code={example.code} />;
}

export default function SqlInterviewRunnableOverlay({ questions }: { questions: RunnableInterviewQuestion[] }) {
  return (
    <InterviewRunnableOverlay
      copyAriaLabel="Copy SQL example"
      hostClassName="iq-sql-runner-host"
      isRunnable={isRunnable}
      questions={questions}
      renderRunner={renderRunner}
    />
  );
}
