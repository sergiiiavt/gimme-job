"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { SiteSidebar, type SubnavItem } from "../../site-navigation";
import styles from "./websocket-playground.module.css";

type ConnectionState = "disconnected" | "connecting" | "connected";
type Direction = "system" | "sent" | "received";
type Frame = { id: string; direction: Direction; at: string; payload: string };
type ScenarioId = "broadcast" | "echo" | "delay" | "heartbeat" | "identity" | "close";
type ServerEvent = { connectionId?: unknown; roomConnections?: unknown; room?: unknown; type?: unknown };

const SCENARIOS: Array<SubnavItem & { id: ScenarioId }> = [
  { id: "broadcast", label: "Broadcast · all tabs" },
  { id: "echo", label: "Echo · this tab only" },
  { id: "delay", label: "Delay" },
  { id: "heartbeat", label: "Heartbeat" },
  { id: "identity", label: "Identity" },
  { id: "close", label: "Close" },
];

const EXAMPLES: Record<ScenarioId, string> = {
  broadcast: JSON.stringify({ action: "broadcast", message: "Hello everyone in this room" }, null, 2),
  echo: JSON.stringify({ action: "echo", message: "Hello WebSocket" }, null, 2),
  delay: JSON.stringify({ action: "delay", milliseconds: 1500, message: "This arrives later" }, null, 2),
  heartbeat: JSON.stringify({ action: "heartbeat" }, null, 2),
  identity: JSON.stringify({ action: "whoami" }, null, 2),
  close: JSON.stringify({ action: "close", code: 1000, reason: "Playground demo complete" }, null, 2),
};

const SCENARIO_HINTS: Record<ScenarioId, string> = {
  broadcast: "Broadcast sends the frame to every connected client in this room, including this tab. Open a second tab, connect it to the same room, and wait until Clients shows 2 before sending.",
  echo: "Echo sends the response only back to this WebSocket connection. Another tab should not receive it.",
  delay: "The response appears only in this tab after the requested delay while the connection stays open.",
  heartbeat: "Heartbeat checks this connection and returns an alive response only to this tab.",
  identity: "Identity returns this connection ID, room, and current number of connected clients.",
  close: "Close asks the server to close only this active WebSocket connection.",
};

function normalizeRoom(value: string): string {
  return value.replace(/[^a-zA-Z0-9_-]/g, "").slice(0, 40) || "playground";
}

function productionSocketUrl(room: string): string {
  const configured = process.env.NEXT_PUBLIC_WEBSOCKET_PLAYGROUND_URL?.trim();
  let base = configured;

  if (!base) {
    if (typeof window !== "undefined") {
      const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
      base = `${protocol}//${window.location.host}/playgrounds/websocket/ws`;
    } else {
      base = "wss://gimme-job.com/playgrounds/websocket/ws";
    }
  }

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

function parseServerEvent(payload: string): ServerEvent | null {
  try {
    const parsed: unknown = JSON.parse(payload);
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed as ServerEvent : null;
  } catch {
    return null;
  }
}

export default function WebSocketPlayground() {
  const [mobileNav, setMobileNav] = useState(false);
  const [scenario, setScenario] = useState<ScenarioId>("broadcast");
  const [room, setRoom] = useState("playground");
  const [draft, setDraft] = useState(EXAMPLES.broadcast);
  const [state, setState] = useState<ConnectionState>("disconnected");
  const [frames, setFrames] = useState<Frame[]>([]);
  const [error, setError] = useState("");
  const [connectionId, setConnectionId] = useState("");
  const [roomConnections, setRoomConnections] = useState(0);
  const socketRef = useRef<WebSocket | null>(null);

  const socketUrl = useMemo(() => {
    if (typeof window !== "undefined" && window.location.hostname === "localhost") return localSocketUrl(room);
    return productionSocketUrl(room);
  }, [room]);

  useEffect(() => {
    const sharedRoom = new URLSearchParams(window.location.search).get("room");
    const roomTimer = sharedRoom
      ? window.setTimeout(() => setRoom(normalizeRoom(sharedRoom)), 0)
      : null;

    return () => {
      if (roomTimer !== null) window.clearTimeout(roomTimer);
      socketRef.current?.close(1000, "Leaving playground");
    };
  }, []);

  function pushFrame(direction: Direction, payload: string) {
    setFrames((current) => [...current.slice(-99), makeFrame(direction, payload)]);
  }

  function updateConnectionInfo(payload: string) {
    const event = parseServerEvent(payload);
    if (!event) return;
    if (typeof event.connectionId === "string") setConnectionId(event.connectionId);
    if (typeof event.roomConnections === "number") setRoomConnections(event.roomConnections);
  }

  function connect() {
    if (state !== "disconnected") return;
    setError("");
    setConnectionId("");
    setRoomConnections(0);
    setState("connecting");
    pushFrame("system", `CONNECT ${socketUrl}`);

    const socket = new WebSocket(socketUrl);
    socketRef.current = socket;
    socket.onopen = () => {
      setError("");
      setState("connected");
      pushFrame("system", "OPEN");
    };
    socket.onmessage = (event) => {
      const payload = String(event.data);
      updateConnectionInfo(payload);
      pushFrame("received", payload);
    };
    socket.onerror = () => setError("WebSocket transport error. Waiting for close details…");
    socket.onclose = (event) => {
      pushFrame("system", `CLOSED code=${event.code} clean=${event.wasClean ? "yes" : "no"} reason=${event.reason || "—"}`);
      socketRef.current = null;
      setState("disconnected");
      setConnectionId("");
      setRoomConnections(0);

      if (event.code === 1000) {
        setError("");
      } else if (event.code === 1006) {
        setError("Abnormal close (1006): the browser did not receive a WebSocket close frame. Check DevTools → Network → WS. Try an Incognito window; if it works there, disable extensions. Also check VPN/proxy or antivirus HTTPS inspection.");
      } else {
        setError(`WebSocket closed with code ${event.code}${event.reason ? `: ${event.reason}` : "."}`);
      }
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

  function openSecondTab() {
    const url = new URL(window.location.href);
    url.searchParams.set("room", room);
    window.open(url.toString(), "_blank", "noopener,noreferrer");
  }

  const scenarioLabel = SCENARIOS.find((item) => item.id === scenario)?.label || "Message";
  const scenarioHint = SCENARIO_HINTS[scenario];
  const broadcastReady = state === "connected" && roomConnections >= 2;

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
              <p>Connect two tabs to the same room, broadcast a message, and inspect the frames.</p>
            </div>
            <span className={`${styles.status} ${styles[state]}`}>{state}</span>
          </header>

          <section className={styles.connectionBar} aria-label="WebSocket connection">
            <label className={styles.roomField} htmlFor="ws-room">
              <span>Room</span>
              <input
                disabled={state !== "disconnected"}
                id="ws-room"
                maxLength={40}
                onChange={(event) => setRoom(normalizeRoom(event.target.value))}
                value={room}
              />
            </label>
            <details className={styles.endpoint}>
              <summary>Endpoint</summary>
              <code>{socketUrl}</code>
            </details>
            <button className={styles.connectionButton} disabled={state === "connecting"} onClick={toggleConnection} type="button">
              {state === "connecting" ? "Connecting…" : state === "connected" ? "Disconnect" : "Connect"}
            </button>
          </section>

          <section className={styles.roomStatus} aria-label="Live room status">
            <div>
              <span>Clients in room</span>
              <strong>{state === "connected" ? roomConnections : "—"}</strong>
            </div>
            <div>
              <span>This connection</span>
              <strong className={styles.connectionId}>{connectionId || "—"}</strong>
            </div>
            <div className={styles.broadcastCheck} data-ready={broadcastReady ? "true" : "false"}>
              <span>Cross-window broadcast</span>
              <strong>{broadcastReady ? "Ready — 2+ clients connected" : state === "connected" ? "Connect a second tab" : "Connect this tab first"}</strong>
            </div>
            <button disabled={state !== "connected"} onClick={openSecondTab} type="button">Open second tab</button>
          </section>

          <div className={styles.workspace}>
            <section className={styles.composer}>
              <div className={styles.panelHeader}>
                <div>
                  <span>Raw WebSocket frame</span>
                  <strong>{scenarioLabel}</strong>
                </div>
                <button onClick={() => setDraft(EXAMPLES[scenario])} type="button">Reset</button>
              </div>
              <textarea aria-label={`${scenarioLabel} frame payload`} id="ws-message" maxLength={16384} onChange={(event) => setDraft(event.target.value)} rows={12} value={draft}/>
              <div className={styles.sendRow}>
                <small>{new Blob([draft]).size.toLocaleString()} B</small>
                <button disabled={state !== "connected" || !draft.trim()} onClick={send} type="button">Send frame</button>
              </div>
              <p className={styles.scenarioHint}>{scenarioHint}</p>
              <p className={styles.rawTextHint}><strong>Important:</strong> plain text is intentionally treated as Echo. For cross-window delivery, keep the JSON payload with <code>{`"action": "broadcast"`}</code>.</p>
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

          <p className={styles.devtoolsHint}>DevTools → Network → WS shows the same traffic at browser level. For a broadcast test, both tabs must show the same room and Clients in room must be at least 2.</p>
        </div>
      </section>
      {mobileNav && <button aria-label="Close navigation" className="kb-backdrop" onClick={() => setMobileNav(false)} type="button"/>}
    </main>
  );
}
