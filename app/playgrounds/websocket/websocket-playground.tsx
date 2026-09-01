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
  { id: "broadcast", label: "Broadcast room" },
  { id: "delay", label: "Delayed response" },
  { id: "heartbeat", label: "Heartbeat" },
  { id: "identity", label: "Connection identity" },
  { id: "close", label: "Close connection" },
];

const EXAMPLES: Record<ScenarioId, string> = {
  echo: JSON.stringify({ action: "echo", message: "Hello WebSocket" }, null, 2),
  broadcast: JSON.stringify({ action: "broadcast", message: "Hello everyone in this room" }, null, 2),
  delay: JSON.stringify({ action: "delay", milliseconds: 1500, message: "This arrives later" }, null, 2),
  heartbeat: JSON.stringify({ action: "heartbeat" }, null, 2),
  identity: JSON.stringify({ action: "whoami" }, null, 2),
  close: JSON.stringify({ action: "close", code: 1000, reason: "Playground demo complete" }, null, 2),
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

  function send() {
    const socket = socketRef.current;
    if (!socket || socket.readyState !== WebSocket.OPEN) {
      setError("Connect first, then send a frame.");
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
          <header className={styles.hero}>
            <span>Playground</span>
            <h1>WebSocket Playground</h1>
            <p>Open a real WebSocket connection to the Python backend, send frames, broadcast between browser tabs, and inspect every event in DevTools.</p>
          </header>

          <section className={styles.connectionPanel}>
            <div>
              <label htmlFor="ws-room">Room</label>
              <input id="ws-room" maxLength={40} onChange={(event) => setRoom(event.target.value.replace(/[^a-zA-Z0-9_-]/g, "").slice(0, 40) || "playground")} value={room}/>
            </div>
            <div className={styles.endpoint}>
              <span>Endpoint</span>
              <code>{socketUrl}</code>
            </div>
            <div className={styles.connectionActions}>
              <span className={`${styles.status} ${styles[state]}`}>{state}</span>
              <button disabled={state !== "disconnected"} onClick={connect} type="button">Connect</button>
              <button disabled={state === "disconnected"} onClick={disconnect} type="button">Disconnect</button>
            </div>
          </section>

          <div className={styles.grid}>
            <section className={styles.composer}>
              <div className={styles.sectionHeader}>
                <div><span>Scenario</span><strong>{SCENARIOS.find((item) => item.id === scenario)?.label}</strong></div>
                <button onClick={() => setDraft(EXAMPLES[scenario])} type="button">Reset example</button>
              </div>
              <label htmlFor="ws-message">Message</label>
              <textarea id="ws-message" maxLength={16384} onChange={(event) => setDraft(event.target.value)} rows={12} value={draft}/>
              <div className={styles.sendRow}>
                <small>{new Blob([draft]).size.toLocaleString()} / 16,384 bytes</small>
                <button disabled={state !== "connected" || !draft.trim()} onClick={send} type="button">Send frame</button>
              </div>
              {error && <p className={styles.error} role="alert">{error}</p>}
            </section>

            <section className={styles.frames}>
              <div className={styles.sectionHeader}>
                <div><span>Frames</span><strong>{frames.length} events</strong></div>
                <button disabled={!frames.length} onClick={() => setFrames([])} type="button">Clear</button>
              </div>
              <div aria-live="polite" className={styles.frameList}>
                {!frames.length && <p className={styles.empty}>Connect to start capturing WebSocket events.</p>}
                {frames.map((frame) => (
                  <article className={styles.frame} data-direction={frame.direction} key={frame.id}>
                    <div><time>{frame.at}</time><strong>{frame.direction === "sent" ? "→ SENT" : frame.direction === "received" ? "← RECEIVED" : "• SYSTEM"}</strong></div>
                    <pre>{frame.payload}</pre>
                  </article>
                ))}
              </div>
            </section>
          </div>

          <section className={styles.help}>
            <h2>Try it as QA</h2>
            <ol>
              <li>Click <strong>Connect</strong>.</li>
              <li>Send the current scenario and compare the sent and received frames.</li>
              <li>Open DevTools → Network → WS and inspect the same frames there.</li>
              <li>For broadcast, open this page in a second tab with the same room name and connect both tabs.</li>
            </ol>
          </section>
        </div>
      </section>
      {mobileNav && <button aria-label="Close navigation" className="kb-backdrop" onClick={() => setMobileNav(false)} type="button"/>}
    </main>
  );
}
