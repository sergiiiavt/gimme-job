"use client";

import NextImage from "next/image";
import Link from "next/link";
import { ChangeEvent, FormEvent, useEffect, useRef, useState } from "react";
import { SiteSidebar } from "../../site-navigation";
import styles from "./websocket-playground.module.css";

type ConnectionState = "connecting" | "connected" | "disconnected";
type GuideTab = "test" | "hints";
type ServerEvent = {
  data?: unknown;
  fromConnectionId?: unknown;
  connectionId?: unknown;
  roomConnections?: unknown;
  timestamp?: unknown;
  type?: unknown;
};
type ChatImage = {
  kind: "image";
  dataUrl: string;
  name: string;
  width: number;
  height: number;
  caption?: string;
};
type ChatMessage = {
  id: string;
  mine: boolean;
  text: string;
  image?: ChatImage;
  time: string;
};

const CHAT_ROOM = "playground";
const MAX_IMAGE_SOURCE_BYTES = 8 * 1024 * 1024;
const MAX_IMAGE_DATA_URL_CHARS = 520_000;
const MAX_IMAGE_DIMENSION = 1280;
const IMAGE_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);
const IMAGE_DATA_URL = /^data:image\/(?:jpeg|png|webp);base64,/i;

function socketUrl(): string {
  const configured = process.env.NEXT_PUBLIC_WEBSOCKET_PLAYGROUND_URL?.trim();
  let base = configured;

  if (!base) {
    if (typeof window !== "undefined" && window.location.hostname === "localhost") {
      base = "ws://127.0.0.1:8000/v1/playground/ws";
    } else if (typeof window !== "undefined") {
      const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
      base = `${protocol}//${window.location.host}/playgrounds/websocket/ws`;
    } else {
      base = "wss://gimme-job.com/playgrounds/websocket/ws";
    }
  }

  const separator = base.includes("?") ? "&" : "?";
  return `${base}${separator}room=${CHAT_ROOM}`;
}

function parseEvent(value: string): ServerEvent | null {
  try {
    const parsed: unknown = JSON.parse(value);
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed as ServerEvent : null;
  } catch {
    return null;
  }
}

function displayTime(timestamp: unknown): string {
  const date = typeof timestamp === "string" ? new Date(timestamp) : new Date();
  const validDate = Number.isNaN(date.getTime()) ? new Date() : date;
  return validDate.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

function imagePayload(value: unknown): ChatImage | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const item = value as Record<string, unknown>;
  if (item.kind !== "image" || typeof item.dataUrl !== "string" || !IMAGE_DATA_URL.test(item.dataUrl)) return null;
  if (typeof item.width !== "number" || typeof item.height !== "number" || item.width <= 0 || item.height <= 0) return null;
  return {
    kind: "image",
    dataUrl: item.dataUrl,
    name: typeof item.name === "string" ? item.name : "image",
    width: item.width,
    height: item.height,
    caption: typeof item.caption === "string" ? item.caption : undefined,
  };
}

function chatData(value: unknown): Pick<ChatMessage, "text" | "image"> | null {
  if (typeof value === "string") return value ? { text: value } : null;
  const image = imagePayload(value);
  if (image) return { text: image.caption?.trim() ?? "", image };
  return null;
}

function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new window.Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("The image could not be read."));
    image.src = url;
  });
}

async function prepareImage(file: File): Promise<ChatImage> {
  if (!IMAGE_TYPES.has(file.type)) throw new Error("Use a JPEG, PNG or WebP image.");
  if (file.size > MAX_IMAGE_SOURCE_BYTES) throw new Error("Image must be 8 MB or smaller.");

  const objectUrl = URL.createObjectURL(file);
  try {
    const source = await loadImage(objectUrl);
    const longestSide = Math.max(source.naturalWidth, source.naturalHeight);
    let scale = Math.min(1, MAX_IMAGE_DIMENSION / Math.max(1, longestSide));

    for (let resizeAttempt = 0; resizeAttempt < 6; resizeAttempt += 1) {
      const width = Math.max(1, Math.round(source.naturalWidth * scale));
      const height = Math.max(1, Math.round(source.naturalHeight * scale));
      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;
      const context = canvas.getContext("2d");
      if (!context) throw new Error("Image processing is unavailable in this browser.");
      context.drawImage(source, 0, 0, width, height);

      for (const quality of [0.86, 0.76, 0.66, 0.56, 0.46]) {
        const dataUrl = canvas.toDataURL("image/webp", quality);
        if (dataUrl.length <= MAX_IMAGE_DATA_URL_CHARS) {
          return { kind: "image", dataUrl, name: file.name.slice(0, 180), width, height };
        }
      }
      scale *= 0.78;
    }
  } finally {
    URL.revokeObjectURL(objectUrl);
  }

  throw new Error("Image is still too large after compression. Choose a smaller image.");
}

export default function WebSocketPlayground() {
  const [mobileNav, setMobileNav] = useState(false);
  const [connectionState, setConnectionState] = useState<ConnectionState>("connecting");
  const [connectionAttempt, setConnectionAttempt] = useState(0);
  const [online, setOnline] = useState(0);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [draft, setDraft] = useState("");
  const [error, setError] = useState("");
  const [guideTab, setGuideTab] = useState<GuideTab>("test");
  const [pendingImage, setPendingImage] = useState<ChatImage | null>(null);
  const [imagePreparing, setImagePreparing] = useState(false);
  const [imageError, setImageError] = useState("");
  const socketRef = useRef<WebSocket | null>(null);
  const connectionIdRef = useRef("");
  const messagesEndRef = useRef<HTMLDivElement | null>(null);
  const imageInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    let active = true;
    const socket = new WebSocket(socketUrl());
    socketRef.current = socket;
    connectionIdRef.current = "";

    socket.onopen = () => {
      if (!active) return;
      setConnectionState("connected");
      setError("");
    };

    socket.onmessage = (event) => {
      if (!active) return;
      const payload = parseEvent(String(event.data));
      if (!payload) return;

      if (payload.type === "connected") {
        if (typeof payload.connectionId === "string") connectionIdRef.current = payload.connectionId;
        if (typeof payload.roomConnections === "number") setOnline(payload.roomConnections);
        return;
      }

      if (payload.type === "presence") {
        if (typeof payload.roomConnections === "number") setOnline(payload.roomConnections);
        return;
      }

      if (payload.type !== "broadcast") return;
      const content = chatData(payload.data);
      if (!content) return;

      setMessages((current) => [
        ...current.slice(-199),
        {
          id: crypto.randomUUID(),
          mine: payload.fromConnectionId === connectionIdRef.current,
          text: content.text,
          image: content.image,
          time: displayTime(payload.timestamp),
        },
      ]);
    };

    socket.onerror = () => {
      if (!active) return;
      setError("Connection error");
    };

    socket.onclose = () => {
      if (!active) return;
      socketRef.current = null;
      connectionIdRef.current = "";
      setOnline(0);
      setConnectionState("disconnected");
    };

    return () => {
      active = false;
      if (socketRef.current === socket) socketRef.current = null;
      if (socket.readyState === WebSocket.OPEN || socket.readyState === WebSocket.CONNECTING) {
        socket.close(1000, "Leaving chat");
      }
    };
  }, [connectionAttempt]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages]);

  function sendMessage(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const text = draft.trim();
    const socket = socketRef.current;
    if ((!text && !pendingImage) || !socket || socket.readyState !== WebSocket.OPEN) return;

    const message: string | ChatImage = pendingImage
      ? { ...pendingImage, caption: text || undefined }
      : text;

    socket.send(JSON.stringify({ action: "broadcast", message }));
    setDraft("");
    setPendingImage(null);
    setImageError("");
  }

  async function selectImage(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;

    setImagePreparing(true);
    setImageError("");
    try {
      setPendingImage(await prepareImage(file));
    } catch (reason) {
      setPendingImage(null);
      setImageError(reason instanceof Error ? reason.message : "Could not prepare this image.");
    } finally {
      setImagePreparing(false);
    }
  }

  function reconnect() {
    if (connectionState !== "disconnected") return;
    setConnectionState("connecting");
    setError("");
    setConnectionAttempt((value) => value + 1);
  }

  return (
    <main className="kb-shell">
      <SiteSidebar
        activeExternalId="websocket-playground"
        activeSection={null}
        activeSubsection=""
        hideSecondary
        mobileOpen={mobileNav}
        mode="public"
        onSelectSubsection={() => undefined}
        personalHref="/playgrounds/websocket"
        secondaryItems={[]}
        secondaryTitle="WebSocket Playground"
      />

      <section className="kb-main">
        <button aria-expanded={mobileNav} aria-label="Toggle navigation" className="kb-floating-menu" onClick={() => setMobileNav((value) => !value)} type="button">☰</button>
        <div className={`kb-content ${styles.page}`}>
          <div className={styles.workspace}>
            <section className={styles.chat}>
              <header className={styles.chatHeader}>
                <div>
                  <h1>WebSocket Chat</h1>
                  <p>{connectionState === "connected" ? `${online || 1} online` : connectionState}</p>
                </div>
                <span aria-label={connectionState} className={`${styles.statusDot} ${styles[connectionState]}`}/>
              </header>

              <div aria-live="polite" className={styles.messages}>
                {!messages.length && connectionState === "connected" && (
                  <p className={styles.empty}>No messages yet. Open this page in another window and start chatting.</p>
                )}
                {messages.map((message) => (
                  <article className={`${styles.message} ${message.mine ? styles.mine : styles.theirs}`} key={message.id}>
                    <div className={styles.messageBubble}>
                      {message.image && (
                        <NextImage
                          alt={message.image.name || "Shared image"}
                          className={styles.chatImage}
                          height={message.image.height}
                          src={message.image.dataUrl}
                          unoptimized
                          width={message.image.width}
                        />
                      )}
                      {message.text && <p>{message.text}</p>}
                    </div>
                    <time>{message.time}</time>
                  </article>
                ))}
                <div ref={messagesEndRef}/>
              </div>

              {connectionState === "disconnected" ? (
                <div className={styles.disconnectedBar}>
                  <span>{error || "Disconnected"}</span>
                  <button onClick={reconnect} type="button">Reconnect</button>
                </div>
              ) : (
                <form className={styles.composer} onSubmit={sendMessage}>
                  {pendingImage && (
                    <div className={styles.attachmentPreview}>
                      <NextImage alt={pendingImage.name} height={pendingImage.height} src={pendingImage.dataUrl} unoptimized width={pendingImage.width}/>
                      <span>{pendingImage.name || "image"}</span>
                      <button aria-label="Remove image" onClick={() => setPendingImage(null)} type="button">×</button>
                    </div>
                  )}
                  <div className={styles.composerRow}>
                    <input
                      accept="image/jpeg,image/png,image/webp"
                      aria-label="Choose image"
                      className={styles.imageInput}
                      onChange={selectImage}
                      ref={imageInputRef}
                      type="file"
                    />
                    <button
                      aria-label="Add image"
                      className={styles.imageButton}
                      disabled={connectionState !== "connected" || imagePreparing}
                      onClick={() => imageInputRef.current?.click()}
                      type="button"
                    >
                      {imagePreparing ? "…" : "Image"}
                    </button>
                    <input
                      aria-label="Message"
                      autoComplete="off"
                      disabled={connectionState !== "connected"}
                      maxLength={4000}
                      onChange={(event) => setDraft(event.target.value)}
                      placeholder={connectionState === "connected" ? (pendingImage ? "Add a caption…" : "Message") : "Connecting…"}
                      value={draft}
                    />
                    <button className={styles.sendButton} disabled={connectionState !== "connected" || (!draft.trim() && !pendingImage)} type="submit">Send</button>
                  </div>
                  {imageError && <p className={styles.imageError} role="alert">{imageError}</p>}
                </form>
              )}
            </section>

            <aside aria-labelledby="websocket-lab-guide" className={styles.guide}>
              <div aria-label="WebSocket guide sections" className={styles.guideTabs} role="tablist">
                <button
                  aria-controls="websocket-guide-test"
                  aria-selected={guideTab === "test"}
                  className={guideTab === "test" ? styles.activeTab : ""}
                  id="websocket-guide-test-tab"
                  onClick={() => setGuideTab("test")}
                  role="tab"
                  type="button"
                >Test & inspect</button>
                <button
                  aria-controls="websocket-guide-hints"
                  aria-selected={guideTab === "hints"}
                  className={guideTab === "hints" ? styles.activeTab : ""}
                  id="websocket-guide-hints-tab"
                  onClick={() => setGuideTab("hints")}
                  role="tab"
                  type="button"
                >Hints & links</button>
              </div>

              <div className={styles.guideBody}>
                {guideTab === "test" ? (
                  <div aria-labelledby="websocket-guide-test-tab" id="websocket-guide-test" role="tabpanel">
                    <span className={styles.eyebrow}>WebSocket testing lab</span>
                    <h2 id="websocket-lab-guide">Use the chat as a real test target</h2>
                    <p className={styles.lead}>Open the page in two browser windows, keep DevTools open in one, and verify the connection and message flow instead of testing only the visible UI.</p>

                    <section className={styles.guideSection}>
                      <h3>What to test</h3>
                      <ol className={styles.checkList}>
                        <li><strong>Handshake.</strong> Confirm the WebSocket upgrade succeeds and the connection remains open.</li>
                        <li><strong>Message flow.</strong> Send text and an image from window A and verify the same payload reaches window B and the sender.</li>
                        <li><strong>Presence.</strong> Open and close extra windows and check that the online count follows active connections.</li>
                        <li><strong>Reconnect.</strong> Interrupt the socket or network, observe the close, then use Reconnect and verify a clean new connection.</li>
                        <li><strong>Boundaries.</strong> Try empty input, long messages, Unicode, image size/type limits, rapid sends and several clients at once.</li>
                      </ol>
                    </section>

                    <section className={styles.guideSection}>
                      <h3>Where to look</h3>
                      <div className={styles.inspectList}>
                        <div><strong>DevTools → Network → WS</strong><span>Connection URL, request/response headers and the opening handshake.</span></div>
                        <div><strong>Messages / Frames</strong><span>Outgoing and incoming payloads, order, timing, image payload size and unexpected duplicates.</span></div>
                        <div><strong>Console</strong><span>Client-side connection errors, parsing failures and reconnect issues.</span></div>
                        <div><strong>Server logs</strong><span>Connection IDs, room membership, broadcasts, disconnects and correlation between clients.</span></div>
                      </div>
                    </section>
                  </div>
                ) : (
                  <div aria-labelledby="websocket-guide-hints-tab" id="websocket-guide-hints" role="tabpanel">
                    <span className={styles.eyebrow}>Troubleshooting & reference</span>
                    <h2>Hints, bottlenecks and deeper material</h2>
                    <p className={styles.lead}>Use these checks after the basic connection and message flow are working.</p>

                    <section className={styles.guideSection}>
                      <h3>Hints & bottlenecks</h3>
                      <ul className={styles.bulletList}>
                        <li>A successful <code>101 Switching Protocols</code> proves only that the transport handshake worked; it does not prove subscription, authorization or message delivery.</li>
                        <li>Watch for slow consumers, fan-out cost, per-connection memory, proxy idle timeouts and reconnect storms.</li>
                        <li>For reliability testing, define what should happen to in-flight or missed messages after a disconnect.</li>
                        <li>Images in this playground are compressed and sent inside the WebSocket payload. In production, large media is usually uploaded to object storage and only a URL or media ID is sent through the socket.</li>
                      </ul>
                    </section>

                    <div className={styles.queueNote}>
                      <strong>Queue reference</strong>
                      <p>WebSocket is a transport, not a durable queue. Acknowledgement, retry, replay, deduplication and guaranteed delivery must be provided by the application or a messaging system when the product requires them.</p>
                    </div>

                    <nav aria-label="WebSocket learning links" className={styles.resources}>
                      <Link href="/learn/api?topic=websocket"><span>Full WebSocket learning topic</span><b>→</b></Link>
                      <Link href="/learn/networking?topic=protocols-and-transports"><span>Networking: protocols & transports</span><b>→</b></Link>
                      <Link href="/interview/web-api?question=websocket-how-would-you-test"><span>Interview: test WebSocket end to end</span><b>→</b></Link>
                      <Link href="/interview/web-api?question=websocket-security-auth-origin-scale"><span>Interview: auth, Origin & scale</span><b>→</b></Link>
                    </nav>
                  </div>
                )}
              </div>
            </aside>
          </div>
        </div>
      </section>
      {mobileNav && <button aria-label="Close navigation" className="kb-backdrop" onClick={() => setMobileNav(false)} type="button"/>}
    </main>
  );
}
