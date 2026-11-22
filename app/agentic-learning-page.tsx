"use client";

import { Fragment } from "react";
import agenticCatalog from "@/content/agentic-learning/catalog";
import { agenticVideoHeadings, agenticVideos } from "./agentic-videos";
import { waitingForReviewBannerStyle } from "./learning-review-status";
import LearningVideo from "./learning-video";
import TopicLearningPage, { type TopicLearningSupplement } from "./topic-learning-page";
import styles from "./agentic-learning-page.module.css";

/** The videos follow the chapters as a page of their own; they are not a chapter, so retrieval and topic pages skip them. */
const videoSupplement: TopicLearningSupplement = {
  id: "learning-videos",
  label: "Learning videos",
  labelUk: "Навчальні відео",
  headings: agenticVideoHeadings,
  content: () => agenticVideos.map(({ id, title, channel, channelUrl, videoId }) => (
    <Fragment key={id}>
      <h2 className={styles.videoTitle} id={id}>{title}</h2>
      <LearningVideo channel={channel} channelUrl={channelUrl} showTitle={false} title={title} videoId={videoId}/>
    </Fragment>
  )),
};

export default function AgenticLearningPage({ mode }: Readonly<{ mode: "public" | "personal" }>) {
  return (
    <>
      <style>{waitingForReviewBannerStyle}</style>
      <TopicLearningPage
        activeSection="agentic"
        catalog={agenticCatalog}
        defaultTopicId="how-agents-work"
        mode={mode}
        secondaryTitle="AI agents & MCP"
        supplements={[videoSupplement]}
      />
    </>
  );
}
