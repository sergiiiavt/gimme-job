export const LEARNING_PATH_TRACE_EVENT = "gimmejob:learning-path-trace";

export type LiveTraceEvent = {
  type: string;
  sequence: number;
  elapsedMs: number;
  [key: string]: unknown;
};

export function dispatchLearningPathTraceEvent(event: LiveTraceEvent): void {
  window.dispatchEvent(new CustomEvent<LiveTraceEvent>(LEARNING_PATH_TRACE_EVENT, { detail: event }));
}
