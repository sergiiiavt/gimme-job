"use client";

import { useEffect, useRef, useState } from "react";
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

let youtubeApiPromise: Promise<YouTubeNamespace> | null = null;

function loadYouTubeApi() {
  if (typeof window === "undefined") return Promise.reject(new Error("YouTube player requires a browser."));
  const target = window as YouTubeWindow;
  if (target.YT?.Player) return Promise.resolve(target.YT);
  if (youtubeApiPromise) return youtubeApiPromise;

  youtubeApiPromise = new Promise<YouTubeNamespace>((resolve, reject) => {
    const previousReady = target.onYouTubeIframeAPIReady;
    target.onYouTubeIframeAPIReady = () => {
      previousReady?.();
      if (target.YT?.Player) resolve(target.YT);
      else reject(new Error("YouTube IFrame API loaded without a Player constructor."));
    };

    const existing = document.querySelector<HTMLScriptElement>('script[src="https://www.youtube.com/iframe_api"]');
    if (existing) {
      existing.addEventListener("error", () => reject(new Error("Could not load the YouTube IFrame API.")), { once: true });
      return;
    }

    const script = document.createElement("script");
    script.src = "https://www.youtube.com/iframe_api";
    script.async = true;
    script.addEventListener("error", () => reject(new Error("Could not load the YouTube IFrame API.")), { once: true });
    document.head.appendChild(script);
  });

  return youtubeApiPromise;
}

const requestedRates = [1, 1.25, 1.5, 1.75, 2, 3, 4];
const sameRate = (left: number, right: number) => Math.abs(left - right) < 0.01;

export default function LearningVideo({ channel, title, videoId }: {
  channel: string;
  title: string;
  videoId: string;
}) {
  const mountRef = useRef<HTMLDivElement | null>(null);
  const playerRef = useRef<YouTubePlayer | null>(null);
  const [availableRates, setAvailableRates] = useState<number[]>([]);
  const [currentRate, setCurrentRate] = useState(1);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    loadYouTubeApi()
      .then((YT) => {
        if (cancelled || !mountRef.current) return;
        const player = new YT.Player(mountRef.current, {
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
    };
  }, [title, videoId]);

  const setRate = (rate: number) => {
    const player = playerRef.current;
    if (!player || !availableRates.some((candidate) => sameRate(candidate, rate))) return;
    player.setPlaybackRate(rate);
    window.setTimeout(() => {
      if (playerRef.current === player) setCurrentRate(player.getPlaybackRate());
    }, 80);
  };

  return (
    <section className={styles.card} aria-label={`${title} video`}>
      <div className={styles.frame}>
        {error ? <div className={styles.error}>{error}</div> : <div ref={mountRef}/>} 
      </div>
      <div className={styles.meta}>
        <strong>{title}</strong>
        <span>{channel} · YouTube</span>
      </div>
      <div className={styles.controls} role="group" aria-label="Playback speed">
        <span className={styles.controlsLabel}>Speed</span>
        {requestedRates.map((rate) => {
          const supported = ready && availableRates.some((candidate) => sameRate(candidate, rate));
          const isActive = sameRate(currentRate, rate);
          const unavailableMessage = `${rate}× is not exposed by the YouTube embedded player for this video.`;
          return (
            <button
              aria-pressed={isActive}
              className={`${styles.speed}${isActive ? ` ${styles.speedActive}` : ""}`}
              disabled={!supported}
              key={rate}
              onClick={() => setRate(rate)}
              title={supported ? `Play at ${rate}×` : unavailableMessage}
              type="button"
            >
              {rate}×
            </button>
          );
        })}
        <span className={styles.note}>3× and 4× stay visible but are enabled only when YouTube reports those rates for this embed.</span>
      </div>
    </section>
  );
}
