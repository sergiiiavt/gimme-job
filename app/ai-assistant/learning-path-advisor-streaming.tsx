"use client";

import { useEffect } from "react";
import LearningPathAdvisor from "./learning-path-advisor";
import { createLearningPathStreamingFetch } from "./learning-path-stream-client";
import { dispatchLearningPathTraceEvent } from "./learning-path-stream-events";

export default function StreamingLearningPathAdvisor() {
  useEffect(() => {
    const originalFetch = window.fetch;
    const streamingFetch = createLearningPathStreamingFetch(
      originalFetch.bind(window),
      window.location.href,
      dispatchLearningPathTraceEvent,
    );

    window.fetch = streamingFetch;
    return () => {
      if (window.fetch === streamingFetch) window.fetch = originalFetch;
    };
  }, []);

  return <LearningPathAdvisor/>;
}
