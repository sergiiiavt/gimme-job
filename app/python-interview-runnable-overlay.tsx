"use client";

import ExecutablePythonBlock from "./executable-python-block";
import InterviewRunnableOverlay, { type RunnableInterviewCodeExample } from "./interview-runnable-overlay";
import {
  isRunnablePythonInterviewExample,
  type PythonInterviewExecution,
} from "./interview-python-execution";

interface RunnableInterviewQuestion {
  id: string;
  codeExamples?: Array<RunnableInterviewCodeExample & { execution?: PythonInterviewExecution }>;
}

function isRunnable(example: RunnableInterviewCodeExample) {
  return isRunnablePythonInterviewExample(
    example.language,
    example.code,
    example.execution as PythonInterviewExecution | undefined,
  );
}

function renderRunner(example: RunnableInterviewCodeExample) {
  return <ExecutablePythonBlock code={example.code} />;
}

export default function PythonInterviewRunnableOverlay({ questions }: { questions: RunnableInterviewQuestion[] }) {
  return (
    <InterviewRunnableOverlay
      copyAriaLabel="Copy Python example"
      hostClassName="iq-python-runner-host"
      isRunnable={isRunnable}
      questions={questions}
      renderRunner={renderRunner}
    />
  );
}
