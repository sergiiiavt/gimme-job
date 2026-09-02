"use client";

import { FormEvent, useEffect, useRef, useState } from "react";
import { SiteSidebar } from "../../site-navigation";
import styles from "./websocket-playground.module.css";

type ConnectionState = "connecting" | "connected" | "disconnected";
type ServerEvent = {
  data?: unknown;
  fromConnectionId?: unknown;
  connectionId?: unknown;
  roomConnections?: unknown;
  timestamp?: unknown;
  type?: unknown;
};
type ChatMessage = {
  id: string;
  mine: boolean;
  text: string;
  time: string;
};

const CHAT_ROOM = "playground";

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

export default function WebSocketPlayground() {
  const [mobileNav, setMobileNav] = useState(false);
  const [connectionState, setConnectionState] = useState<ConnectionState>("connecting");
  const [connectionAttempt, setConnectionAttempt] = useState(0);
  const [online, setOnline] = useState(0);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [draft, setDraft] = useState("");
  const [error, setError] = useState("");
  const socketRef = useRef<WebSocket | null>(null);
  const connectionIdRef = useRef("");
  const messagesEndRef = useRef<HTMLDivElement | null>(null);

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
      const text = typeof payload.data === "string" ? payload.data : String(payload.data ?? "");
      if (!text) return;

      setMessages((current) => [
        ...current.slice(-199),
        {
          id: crypto.randomUUID(),
          mine: payload.fromConnectionId === connectionIdRef.current,
          text,
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
    if (!text || !socket || socket.readyState !== WebSocket.OPEN) return;

    socket.send(JSON.stringify({ action: "broadcast", message: text }));
    setDraft("");
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
                  <div>{message.text}</div>
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
                <input
                  aria-label="Message"
                  autoComplete="off"
                  disabled={connectionState !== "connected"}
                  maxLength={4000}
                  onChange={(event) => setDraft(event.target.value)}
                  placeholder={connectionState === "connected" ? "Message" : "Connecting…"}
                  value={draft}
                />
                <button disabled={connectionState !== "connected" || !draft.trim()} type="submit">Send</button>
              </form>
            )}
          </section>
        </div>
      </section>
      {mobileNav && <button aria-label="Close navigation" className="kb-backdrop" onClick={() => setMobileNav(false)} type="button"/>}
    </main>
  );
}
