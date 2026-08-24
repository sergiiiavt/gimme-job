"use client";

import { useEffect, useRef, useState } from "react";
import {
  isLearningVideoRateSupported,
  LEARNING_VIDEO_PLAYBACK_RATES,
  sameLearningVideoRate,
} from "./learning-video-policy";
import styles from "./learning-video.module.css";

type YouTubePlayer = {
  destroy: () => void;
  getAvailablePlaybackRates: () => number[];
  getIframe: () => HTMLIFrameElement;
  getPlaybackRate: () => number;
  setPlaybackRate: (rate: number) => void;
};

type YouTubePlayerEvent = { target: YouTubePlayer; data?: number };

type YouTubeNamespace = {
  Player: new (element: HTMLElement, options: {
    videoId: string;
    playerVars?: Record<string, number | string>;
    events?: {
      onError?: (event: YouTubePlayerEvent) => void;
      onPlaybackRateChange?: (event: YouTubePlayerEvent) => void;
      onReady?: (event: YouTubePlayerEvent) => void;
    };
  }) => YouTubePlayer;
};

type YouTubeWindow = Window & typeof globalThis & {
  YT?: YouTubeNamespace;
  onYouTubeIframeAPIReady?: () => void;
};

type PlaybackAttempt = {
  requested: number;
  actual: number;
};

let youtubeApiPromise: Promise<YouTubeNamespace> | null = null;

function loadYouTubeApi() {
  if (typeof window === "undefined") return Promise.reject(new Error("YouTube player requires a browser."));
  const target = window as YouTubeWindow;
  if (target.YT?.Player) return Promise.resolve(target.YT);
  if (youtubeApiPromise) return youtubeApiPromise;

  youtubeApiPromise = new Promise<YouTubeNamespace>((resolve, reject) => {
    const finish = () => {
      if (target.YT?.Player) resolve(target.YT);
    };
    const previousReady = target.onYouTubeIframeAPIReady;
    target.onYouTubeIframeAPIReady = () => {
      previousReady?.();
      if (target.YT?.Player) resolve(target.YT);
      else reject(new Error("YouTube IFrame API loaded without a Player constructor."));
    };

    const existing = document.querySelector<HTMLScriptElement>('script[src="https://www.youtube.com/iframe_api"]');
    if (existing) {
      existing.addEventListener("load", finish, { once: true });
      existing.addEventListener("error", () => reject(new Error("Could not load the YouTube IFrame API.")), { once: true });
      window.setTimeout(finish, 0);
      return;
    }

    const script = document.createElement("script");
    script.src = "https://www.youtube.com/iframe_api";
    script.async = true;
    script.addEventListener("load", finish, { once: true });
    script.addEventListener("error", () => reject(new Error("Could not load the YouTube IFrame API.")), { once: true });
    document.head.appendChild(script);
  });

  return youtubeApiPromise;
}

export default function LearningVideo({ channel, channelUrl, title, videoId }: {
  channel: string;
  channelUrl: string;
  title: string;
  videoId: string;
}) {
  const mountRef = useRef<HTMLDivElement | null>(null);
  const playerRef = useRef<YouTubePlayer | null>(null);
  const [availableRates, setAvailableRates] = useState<number[]>([]);
  const [currentRate, setCurrentRate] = useState(1);
  const [lastAttempt, setLastAttempt] = useState<PlaybackAttempt | null>(null);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    const mount = mountRef.current;
    if (!mount) return undefined;
    const host = document.createElement("div");
    mount.replaceChildren(host);

    loadYouTubeApi()
      .then((YT) => {
        if (cancelled) return;
        const player = new YT.Player(host, {
          videoId,
          playerVars: {
            controls: 1,
            enablejsapi: 1,
            playsinline: 1,
            rel: 0,
          },
          events: {
            onReady: (event) => {
              if (cancelled) return;
              playerRef.current = event.target;
              event.target.getIframe().setAttribute("title", title);
              setAvailableRates(event.target.getAvailablePlaybackRates());
              setCurrentRate(event.target.getPlaybackRate());
              setReady(true);
              setError(null);
            },
            onPlaybackRateChange: (event) => {
              if (!cancelled) setCurrentRate(event.target.getPlaybackRate());
            },
            onError: () => {
              if (!cancelled) setError("YouTube could not load this video in the embedded player.");
            },
          },
        });
        playerRef.current = player;
      })
      .catch((reason: unknown) => {
        if (!cancelled) setError(reason instanceof Error ? reason.message : "Could not load YouTube player.");
      });

    return () => {
      cancelled = true;
      playerRef.current?.destroy();
      playerRef.current = null;
      mount.replaceChildren();
    };
  }, [title, videoId]);

  const setRate = (rate: number) => {
    const player = playerRef.current;
    if (!player || !ready) return;

    setLastAttempt(null);
    player.setPlaybackRate(rate);

    window.setTimeout(() => {
      if (playerRef.current !== player) return;
      const actual = player.getPlaybackRate();
      setCurrentRate(actual);
      setAvailableRates(player.getAvailablePlaybackRates());
      setLastAttempt({ requested: rate, actual });
    }, 180);
  };

  return (
    <section className={styles.card} aria-label={`${title} video`}>
      <div className={styles.frame}>
        <div ref={mountRef}/>
        {error && <div className={styles.error}>{error}</div>}
      </div>
      <div className={styles.meta}>
        <strong>{title}</strong>
        <span>
          Source channel: <a href={channelUrl} rel="noopener noreferrer" target="_blank">{channel}</a> · YouTube
        </span>
      </div>
      <div className={styles.controls} role="group" aria-label="Playback speed">
        <span className={styles.controlsLabel}>Speed</span>
        {LEARNING_VIDEO_PLAYBACK_RATES.map((rate) => {
          const advertised = ready && isLearningVideoRateSupported(availableRates, rate);
          const isActive = sameLearningVideoRate(currentRate, rate);
          return (
            <button
              aria-pressed={isActive}
              className={`${styles.speed}${isActive ? ` ${styles.speedActive}` : ""}`}
              disabled={!ready}
              key={rate}
              onClick={() => setRate(rate)}
              title={advertised ? `Play at ${rate}×` : `Request ${rate}×; YouTube may clamp it to a supported speed`}
              type="button"
            >
              {rate}×
            </button>
          );
        })}
        <span className={styles.note}>Every speed button sends the requested value to YouTube. Unsupported values such as 3× or 4× may be clamped by the embedded player.</span>
        {lastAttempt && (
          <span className={styles.note} aria-live="polite">
            {sameLearningVideoRate(lastAttempt.requested, lastAttempt.actual)
              ? `Applied ${lastAttempt.actual}×.`
              : `Requested ${lastAttempt.requested}×; YouTube applied ${lastAttempt.actual}×.`}
          </span>
        )}
      </div>
    </section>
  );
}
