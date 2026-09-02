"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { SiteSidebar, type SubnavItem } from "../../site-navigation";
import styles from "./websocket-playground.module.css";

type ConnectionState = "disconnected" | "connecting" | "connected";
type Direction = "system" | "sent" | "received";
type Frame = { id: string; direction: Direction; at: string; payload: string };

type ScenarioId = "echo" | "broadcast" | "delay" | "heartbeat" | "identity" | "close";

const SCENARIOS: Array<SubnavItem & { id: ScenarioId }> = [
  { id: "echo", label: "Echo" },
  { id: "broadcast", label: "Broadcast" },
  { id: "delay", label: "Delay" },
  { id: "heartbeat", label: "Heartbeat" },
  { id: "identity", label: "Identity" },
  { id: "close", label: "Close" },
];

const EXAMPLES: Record<ScenarioId, string> = {
  echo: JSON.stringify({ action: "echo", message: "Hello WebSocket" }, null, 2),
  broadcast: JSON.stringify({ action: "broadcast", message: "Hello everyone in this room" }, null, 2),
  delay: JSON.stringify({ action: "delay", milliseconds: 1500, message: "This arrives later" }, null, 2),
  heartbeat: JSON.stringify({ action: "heartbeat" }, null, 2),
  identity: JSON.stringify({ action: "whoami" }, null, 2),
  close: JSON.stringify({ action: "close", code: 1000, reason: "Playground demo complete" }, null, 2),
};

const SCENARIO_HINTS: Partial<Record<ScenarioId, string>> = {
  broadcast: "Open this page in another tab with the same room to verify broadcast delivery.",
  delay: "The response should appear after the requested delay while the connection stays open.",
  close: "This message asks the server to close the active WebSocket connection.",
};

function productionSocketUrl(room: string): string {
  const base = process.env.NEXT_PUBLIC_WEBSOCKET_PLAYGROUND_URL?.trim() || "wss://ai.gimme-job.com/v1/playground/ws";
  const separator = base.includes("?") ? "&" : "?";
  return `${base}${separator}room=${encodeURIComponent(room)}`;
}

function localSocketUrl(room: string): string {
  return `ws://127.0.0.1:8000/v1/playground/ws?room=${encodeURIComponent(room)}`;
}

function frameTime(): string {
  return new Date().toLocaleTimeString([], { hour12: false, hour: "2-digit", minute: "2-digit", second: "2-digit" });
}

function makeFrame(direction: Direction, payload: string): Frame {
  return { id: crypto.randomUUID(), direction, at: frameTime(), payload };
}

function frameLabel(direction: Direction): string {
  if (direction === "sent") return "→";
  if (direction === "received") return "←";
  return "•";
}

function framePreview(payload: string): string {
  const compact = payload.replace(/\s+/g, " ").trim();
  return compact.length > 120 ? `${compact.slice(0, 117)}…` : compact;
}

export default function WebSocketPlayground() {
  const [mobileNav, setMobileNav] = useState(false);
  const [scenario, setScenario] = useState<ScenarioId>("echo");
  const [room, setRoom] = useState("playground");
  const [draft, setDraft] = useState(EXAMPLES.echo);
  const [state, setState] = useState<ConnectionState>("disconnected");
  const [frames, setFrames] = useState<Frame[]>([]);
  const [error, setError] = useState("");
  const socketRef = useRef<WebSocket | null>(null);

  const socketUrl = useMemo(() => {
    if (typeof window !== "undefined" && window.location.hostname === "localhost") return localSocketUrl(room);
    return productionSocketUrl(room);
  }, [room]);

  useEffect(() => () => socketRef.current?.close(1000, "Leaving playground"), []);

  function pushFrame(direction: Direction, payload: string) {
    setFrames((current) => [...current.slice(-99), makeFrame(direction, payload)]);
  }

  function connect() {
    if (state !== "disconnected") return;
    setError("");
    setState("connecting");
    pushFrame("system", `CONNECT ${socketUrl}`);

    const socket = new WebSocket(socketUrl);
    socketRef.current = socket;
    socket.onopen = () => {
      setState("connected");
      pushFrame("system", "OPEN");
    };
    socket.onmessage = (event) => pushFrame("received", String(event.data));
    socket.onerror = () => setError("WebSocket connection failed. Check the endpoint and browser Network → WS panel.");
    socket.onclose = (event) => {
      pushFrame("system", `CLOSED code=${event.code} reason=${event.reason || "—"}`);
      socketRef.current = null;
      setState("disconnected");
    };
  }

  function disconnect() {
    socketRef.current?.close(1000, "Disconnected from UI");
  }

  function toggleConnection() {
    if (state === "disconnected") connect();
    else if (state === "connected") disconnect();
  }

  function send() {
    const socket = socketRef.current;
    if (!socket || socket.readyState !== WebSocket.OPEN) {
      setError("Connect first, then send a message.");
      return;
    }
    const payload = draft.trim();
    if (!payload) return;
    socket.send(payload);
    pushFrame("sent", payload);
    setError("");
  }

  function selectScenario(next: string) {
    const nextScenario = next as ScenarioId;
    if (!SCENARIOS.some((item) => item.id === nextScenario)) return;
    setScenario(nextScenario);
    setDraft(EXAMPLES[nextScenario]);
    setMobileNav(false);
  }

  const scenarioLabel = SCENARIOS.find((item) => item.id === scenario)?.label || "Message";
  const scenarioHint = SCENARIO_HINTS[scenario];

  return (
    <main className="kb-shell">
      <SiteSidebar
        activeExternalId="websocket-playground"
        activeSection={null}
        activeSubsection={scenario}
        mobileOpen={mobileNav}
        mode="public"
        onSelectSubsection={selectScenario}
        personalHref="/playgrounds/websocket"
        secondaryItems={SCENARIOS}
        secondaryTitle="WebSocket Playground"
      />

      <section className="kb-main">
        <button aria-expanded={mobileNav} aria-label="Toggle navigation" className="kb-floating-menu" onClick={() => setMobileNav((value) => !value)} type="button">☰</button>
        <div className={`kb-content ${styles.page}`}>
          <header className={styles.header}>
            <div>
              <h1>WebSocket Playground</h1>
              <p>Connect, send a message, and inspect the frames.</p>
            </div>
            <span className={`${styles.status} ${styles[state]}`}>{state}</span>
          </header>

          <section className={styles.connectionBar} aria-label="WebSocket connection">
            <label className={styles.roomField} htmlFor="ws-room">
              <span>Room</span>
              <input id="ws-room" maxLength={40} onChange={(event) => setRoom(event.target.value.replace(/[^a-zA-Z0-9_-]/g, "").slice(0, 40) || "playground")} value={room}/>
            </label>
            <details className={styles.endpoint}>
              <summary>Endpoint</summary>
              <code>{socketUrl}</code>
            </details>
            <button className={styles.connectionButton} disabled={state === "connecting"} onClick={toggleConnection} type="button">
              {state === "connecting" ? "Connecting…" : state === "connected" ? "Disconnect" : "Connect"}
            </button>
          </section>

          <div className={styles.workspace}>
            <section className={styles.composer}>
              <div className={styles.panelHeader}>
                <div>
                  <span>Message</span>
                  <strong>{scenarioLabel}</strong>
                </div>
                <button onClick={() => setDraft(EXAMPLES[scenario])} type="button">Reset</button>
              </div>
              <textarea aria-label={`${scenarioLabel} message`} id="ws-message" maxLength={16384} onChange={(event) => setDraft(event.target.value)} rows={12} value={draft}/>
              <div className={styles.sendRow}>
                <small>{new Blob([draft]).size.toLocaleString()} B</small>
                <button disabled={state !== "connected" || !draft.trim()} onClick={send} type="button">Send</button>
              </div>
              {scenarioHint && <p className={styles.scenarioHint}>{scenarioHint}</p>}
              {error && <p className={styles.error} role="alert">{error}</p>}
            </section>

            <section className={styles.frames}>
              <div className={styles.panelHeader}>
                <div>
                  <span>Frames</span>
                  <strong>{frames.length ? `${frames.length} captured` : "No traffic yet"}</strong>
                </div>
                <button disabled={!frames.length} onClick={() => setFrames([])} type="button">Clear</button>
              </div>
              <div aria-live="polite" className={styles.frameList}>
                {!frames.length && <p className={styles.empty}>Connect to start capturing traffic.</p>}
                {frames.map((frame) => (
                  <details className={styles.frame} data-direction={frame.direction} key={frame.id}>
                    <summary>
                      <time>{frame.at}</time>
                      <strong>{frameLabel(frame.direction)}</strong>
                      <span>{framePreview(frame.payload)}</span>
                    </summary>
                    <pre>{frame.payload}</pre>
                  </details>
                ))}
              </div>
            </section>
          </div>

          <p className={styles.devtoolsHint}>DevTools → Network → WS shows the same traffic at browser level.</p>
        </div>
      </section>
      {mobileNav && <button aria-label="Close navigation" className="kb-backdrop" onClick={() => setMobileNav(false)} type="button"/>}
    </main>
  );
}
