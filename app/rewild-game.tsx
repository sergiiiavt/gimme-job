"use client";

import { useEffect, useRef, useState } from "react";
import {
  CANVAS_HEIGHT,
  CANVAS_WIDTH,
  DIFFICULTIES,
  DIFFICULTY_ORDER,
  ENEMIES,
  HEX_COLS,
  HEX_ROWS,
  PLANTS,
  PLANT_ORDER,
  createGameState,
  createReviewGameState,
  moveCursor,
  pixelToHex,
  placePlant,
  toUi,
  updateGame,
  type Difficulty,
  type EnemyKind,
  type GameState,
  type PlantKind,
  type RewildReviewState,
  type UiSnapshot,
} from "./rewild-hex-world";
import { renderOverheadGame, type RewildCamera } from "./rewild-overhead-renderer";

const STORAGE_KEY = "gimmejob.rewild.best.v1";
const MIN_ZOOM = 1;
const MAX_ZOOM = 2.4;
const REVIEW_STATES = new Set<RewildReviewState>(["damage", "collapse", "reclamation", "ecosystem", "response"]);

function requestedReviewState() {
  if (typeof window === "undefined") return null;
  const requested = new URLSearchParams(window.location.search).get("rewildReview") as RewildReviewState | null;
  return requested && REVIEW_STATES.has(requested) ? requested : null;
}

function createCamera(): RewildCamera {
  return { x: 0, y: 0, zoom: 1 };
}

function clampCamera(camera: RewildCamera) {
  const viewWidth = CANVAS_WIDTH / camera.zoom;
  const viewHeight = CANVAS_HEIGHT / camera.zoom;
  const slackX = Math.max(0, CANVAS_WIDTH - viewWidth);
  const slackY = Math.max(0, CANVAS_HEIGHT - viewHeight);
  camera.x = slackX > 0 ? Math.min(Math.max(camera.x, 0), slackX) : (CANVAS_WIDTH - viewWidth) / 2;
  camera.y = slackY > 0 ? Math.min(Math.max(camera.y, 0), slackY) : (CANVAS_HEIGHT - viewHeight) / 2;
}

function toCanvasPixel(canvas: HTMLCanvasElement, clientX: number, clientY: number) {
  const bounds = canvas.getBoundingClientRect();
  const scale = Math.min(bounds.width / CANVAS_WIDTH, bounds.height / CANVAS_HEIGHT);
  const renderedWidth = CANVAS_WIDTH * scale;
  const renderedHeight = CANVAS_HEIGHT * scale;
  const offsetX = (bounds.width - renderedWidth) / 2;
  const offsetY = (bounds.height - renderedHeight) / 2;
  return { x: clientX - bounds.left - offsetX, y: clientY - bounds.top - offsetY, renderedWidth, renderedHeight };
}

function formatTime(seconds: number) {
  return `${Math.floor(seconds / 60)}:${String(Math.floor(seconds % 60)).padStart(2, "0")}`;
}

function DefenderMark({ kind }: { kind: PlantKind }) {
  const config = PLANTS[kind];
  return <span className="rw-guide-token" aria-hidden="true" style={{ background: config.color }}>{config.shortName.slice(0, 1)}</span>;
}

function EnemyMark({ kind }: { kind: EnemyKind }) {
  const config = ENEMIES[kind];
  return <span className="rw-guide-token rw-guide-token-enemy" aria-hidden="true" style={{ background: config.color }}>×</span>;
}

function RewildGuide({ onPlay }: { onPlay: () => void }) {
  return (
    <div className="kb-content rw-page">
      <header className="rw-guide-head">
        <span>ANTI-SLOP FIELD MANUAL / 02</span>
        <h1>How to fight AI slop</h1>
        <p>Rewild is a continuous real-time tower-defense game on a six-neighbor hex field. Spend sunlight to place stationary defenders; they target and attack automatically while AI slop advances on the house.</p>
        <button className="rw-guide-play" onClick={onPlay}>Open the battlefield</button>
      </header>
      <section className="rw-guide-grid">
        <article><span>01</span><h2>Grow</h2><p>Choose a defender and place it on a legal healthy cell. Placement spends sunlight immediately.</p></article>
        <article><span>02</span><h2>Hold</h2><p>Defenders never move after planting. Their targeting, attacks, slows, and area damage resolve automatically.</p></article>
        <article><span>03</span><h2>Break</h2><p>Destroy datacenters before their corruption reaches the house and before their spawned slop overwhelms your blockers.</p></article>
        <article><span>04</span><h2>Reclaim</h2><p>Rootreclaimers automatically clear corrupted cells while the rest of the defense keeps the real-time wave under control.</p></article>
      </section>
      <section className="rw-field-guide">
        <div><span>DEFENDERS</span><h2>Weapons that grow</h2></div>
        <div className="rw-guide-list">
          {PLANT_ORDER.map((kind) => <article key={kind}><DefenderMark kind={kind}/><div><strong>{PLANTS[kind].name}</strong><span>{PLANTS[kind].role} · {PLANTS[kind].cost} sun · wave {PLANTS[kind].unlockWave}</span><p>{PLANTS[kind].detail}</p></div></article>)}
        </div>
      </section>
      <section className="rw-field-guide rw-enemy-guide">
        <div><span>AI SLOP</span><h2>Automatic attackers</h2></div>
        <div className="rw-guide-list">
          {(["clickbait", "deepfake", "popup"] as EnemyKind[]).map((kind) => <article key={kind}><EnemyMark kind={kind}/><div><strong>{ENEMIES[kind].name}</strong><span>{ENEMIES[kind].hp} HP · speed {ENEMIES[kind].speed}</span><p>{kind === "clickbait" ? "Fast attention waste rushing the house." : kind === "deepfake" ? "Heavy synthetic sludge that splits when destroyed." : "Hostile clutter that temporarily disables nearby defenders."}</p></div></article>)}
        </div>
      </section>
    </div>
  );
}

export default function RewildGame({ onViewChange = () => {}, view = "all" }: { onViewChange?: (view: string) => void; view?: string }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const stateRef = useRef<GameState | null>(null);
  const animationRef = useRef<number | null>(null);
  const lastFrameRef = useRef(0);
  const lastUiRef = useRef(0);
  const cameraRef = useRef<RewildCamera>(createCamera());
  const dragRef = useRef<{ x: number; y: number; scaleX: number; scaleY: number } | null>(null);
  const [ui, setUi] = useState<UiSnapshot>(() => toUi(createGameState(0, "normal", "menu")));
  const [difficulty, setDifficulty] = useState<Difficulty>("normal");

  useEffect(() => {
    let best = 0;
    try { best = Number(window.localStorage.getItem(STORAGE_KEY) ?? 0) || 0; } catch { /* local persistence is optional */ }
    const reviewState = requestedReviewState();
    stateRef.current = reviewState ? createReviewGameState(best, reviewState) : createGameState(best, "normal", "menu");
    setUi(toUi(stateRef.current));
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    const context = canvas?.getContext("2d");
    if (!canvas || !context) return;
    context.imageSmoothingEnabled = false;
    lastFrameRef.current = 0;
    const frame = (time: number) => {
      const state = stateRef.current;
      if (state) {
        const dt = lastFrameRef.current ? Math.min(.05, (time - lastFrameRef.current) / 1000) : 0;
        lastFrameRef.current = time;
        updateGame(state, dt);
        renderOverheadGame(context, state, cameraRef.current);
        if (time - lastUiRef.current > 150) {
          lastUiRef.current = time;
          setUi(toUi(state));
        }
      }
      animationRef.current = window.requestAnimationFrame(frame);
    };
    animationRef.current = window.requestAnimationFrame(frame);
    return () => {
      if (animationRef.current !== null) window.cancelAnimationFrame(animationRef.current);
      animationRef.current = null;
      lastFrameRef.current = 0;
    };
  }, [view]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const onContextMenu = (event: MouseEvent) => event.preventDefault();
    const onMouseDown = (event: MouseEvent) => {
      if (event.button !== 2) return;
      event.preventDefault();
      const { renderedWidth, renderedHeight } = toCanvasPixel(canvas, event.clientX, event.clientY);
      dragRef.current = { x: event.clientX, y: event.clientY, scaleX: CANVAS_WIDTH / renderedWidth, scaleY: CANVAS_HEIGHT / renderedHeight };
    };
    const onMouseMove = (event: MouseEvent) => {
      const drag = dragRef.current;
      if (!drag) return;
      const camera = cameraRef.current;
      camera.x -= (event.clientX - drag.x) * drag.scaleX / camera.zoom;
      camera.y -= (event.clientY - drag.y) * drag.scaleY / camera.zoom;
      clampCamera(camera);
      dragRef.current = { ...drag, x: event.clientX, y: event.clientY };
    };
    const onMouseUp = () => { dragRef.current = null; };
    const onWheel = (event: WheelEvent) => {
      event.preventDefault();
      const camera = cameraRef.current;
      const { x, y, renderedWidth, renderedHeight } = toCanvasPixel(canvas, event.clientX, event.clientY);
      const canvasX = x / renderedWidth * CANVAS_WIDTH;
      const canvasY = y / renderedHeight * CANVAS_HEIGHT;
      const worldX = canvasX / camera.zoom + camera.x;
      const worldY = canvasY / camera.zoom + camera.y;
      const nextZoom = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, camera.zoom * Math.exp(-event.deltaY * .0015)));
      camera.zoom = nextZoom;
      camera.x = worldX - canvasX / nextZoom;
      camera.y = worldY - canvasY / nextZoom;
      clampCamera(camera);
    };
    canvas.addEventListener("contextmenu", onContextMenu);
    canvas.addEventListener("mousedown", onMouseDown);
    canvas.addEventListener("wheel", onWheel, { passive: false });
    window.addEventListener("mousemove", onMouseMove);
    window.addEventListener("mouseup", onMouseUp);
    return () => {
      canvas.removeEventListener("contextmenu", onContextMenu);
      canvas.removeEventListener("mousedown", onMouseDown);
      canvas.removeEventListener("wheel", onWheel);
      window.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("mouseup", onMouseUp);
    };
  }, [view]);

  useEffect(() => {
    if (view !== "all") return;
    const onKeyDown = (event: KeyboardEvent) => {
      const state = stateRef.current;
      if (!state) return;
      const index = Number(event.key) - 1;
      if (index >= 0 && index < PLANT_ORDER.length) {
        const kind = PLANT_ORDER[index];
        if (state.wave >= PLANTS[kind].unlockWave) {
          state.selected = kind;
          setUi(toUi(state));
        }
      }
      if (event.code === "Space" && (state.status === "playing" || state.status === "paused")) {
        event.preventDefault();
        state.status = state.status === "playing" ? "paused" : "playing";
        setUi(toUi(state));
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [view]);

  if (view === "guide") return <RewildGuide onPlay={() => onViewChange("all")}/>;

  const start = () => {
    const best = stateRef.current?.best ?? 0;
    const reviewState = requestedReviewState();
    stateRef.current = reviewState ? createReviewGameState(best, reviewState) : createGameState(best, difficulty);
    lastFrameRef.current = 0;
    cameraRef.current = createCamera();
    setUi(toUi(stateRef.current));
  };

  const choosePlant = (kind: PlantKind) => {
    const state = stateRef.current;
    if (!state || state.wave < PLANTS[kind].unlockWave) return;
    state.selected = kind;
    setUi(toUi(state));
  };

  const togglePause = () => {
    const state = stateRef.current;
    if (!state || (state.status !== "playing" && state.status !== "paused")) return;
    state.status = state.status === "playing" ? "paused" : "playing";
    setUi(toUi(state));
  };

  const onCanvasClick = (event: React.MouseEvent<HTMLCanvasElement>) => {
    const state = stateRef.current;
    const canvas = canvasRef.current;
    if (!state || !canvas) return;
    const { x, y, renderedWidth, renderedHeight } = toCanvasPixel(canvas, event.clientX, event.clientY);
    if (x < 0 || y < 0 || x >= renderedWidth || y >= renderedHeight) return;
    const camera = cameraRef.current;
    const worldX = x / renderedWidth * CANVAS_WIDTH / camera.zoom + camera.x;
    const worldY = y / renderedHeight * CANVAS_HEIGHT / camera.zoom + camera.y;
    const hex = pixelToHex(worldX, worldY);
    if (!hex) return;
    state.cursor = hex;
    placePlant(state, hex);
    setUi(toUi(state));
  };

  const onCanvasPointerMove = (event: React.PointerEvent<HTMLCanvasElement>) => {
    if (event.buttons !== 0) return;
    const state = stateRef.current;
    const canvas = canvasRef.current;
    if (!state || !canvas || state.status !== "playing") return;
    const { x, y, renderedWidth, renderedHeight } = toCanvasPixel(canvas, event.clientX, event.clientY);
    if (x < 0 || y < 0 || x >= renderedWidth || y >= renderedHeight) return;
    const camera = cameraRef.current;
    const hex = pixelToHex(x / renderedWidth * CANVAS_WIDTH / camera.zoom + camera.x, y / renderedHeight * CANVAS_HEIGHT / camera.zoom + camera.y);
    if (!hex || (hex.q === state.cursor.q && hex.r === state.cursor.r)) return;
    state.cursor = hex;
    setUi(toUi(state));
  };

  const onCanvasKeyDown = (event: React.KeyboardEvent<HTMLCanvasElement>) => {
    const state = stateRef.current;
    if (!state || state.status !== "playing") return;
    const movement: Record<string, number> = { ArrowRight: 0, e: 1, ArrowDown: 2, ArrowLeft: 3, q: 4, ArrowUp: 5 };
    if (movement[event.key] !== undefined) {
      event.preventDefault();
      moveCursor(state, movement[event.key]);
      setUi(toUi(state));
    } else if (event.key === "Enter") {
      event.preventDefault();
      placePlant(state, state.cursor);
      setUi(toUi(state));
    }
  };

  const overlay = ui.status === "menu" || ui.status === "won" || ui.status === "lost";
  return (
    <div className="rw-play-page">
      <section className="rw-game-shell" aria-label="Fight AI slop game">
        <div className="rw-hud" aria-live="polite">
          <div className="rw-hud-brand"><span>STRICT OVERHEAD · REAL-TIME DEFENSE</span><strong>Fight AI slop</strong><small>{ui.best.toLocaleString()} best · {DIFFICULTIES[ui.difficulty].name}</small></div>
          <div><span>Sunlight</span><strong>{ui.sunlight}</strong></div>
          <div><span>House</span><strong>{ui.houseIntegrity}%</strong></div>
          <div><span>Corruption</span><strong>{ui.corruption}%</strong></div>
          <div><span>Wave</span><strong>{ui.wave} · {ui.nextWave}s</strong></div>
          <div><span>Score</span><strong>{ui.score.toLocaleString()}</strong></div>
        </div>
        <div className="rw-stage">
          <canvas
            ref={canvasRef}
            width={CANVAS_WIDTH}
            height={CANVAS_HEIGHT}
            onClick={onCanvasClick}
            onPointerMove={onCanvasPointerMove}
            onKeyDown={onCanvasKeyDown}
            tabIndex={0}
            aria-label={`A ${HEX_COLS} by ${HEX_ROWS} overhead hex field under attack by AI slop. Select a plant, then click a hex or use six-direction keys and Enter to plant. Right-drag to pan and scroll to zoom.`}
          />
          {overlay && <div className={`rw-overlay rw-overlay-${ui.status}`}>
            <span>{ui.status === "menu" ? "AI INFRASTRUCTURE DETECTED" : ui.status === "won" ? "FEED TERMINATED" : "AI SLOP WON"}</span>
            <h2>{ui.status === "menu" ? "Hold the living field." : ui.status === "won" ? "AI slop erased." : "The feed ate everything."}</h2>
            <p>{ui.status === "menu" ? "Place stationary defenders, survive continuous waves, destroy datacenters, and keep corruption away from the house." : ui.message}</p>
            {ui.status !== "menu" && <div className="rw-result"><span>{ui.wave} waves</span><span>{formatTime(ui.elapsed)}</span><span>{ui.score.toLocaleString()} score</span></div>}
            <div className="rw-difficulty-picker" role="group" aria-label="Difficulty">
              {DIFFICULTY_ORDER.map((key) => <button type="button" className={difficulty === key ? "active" : ""} aria-pressed={difficulty === key} key={key} onClick={() => setDifficulty(key)}><strong>{DIFFICULTIES[key].name}</strong><small>{DIFFICULTIES[key].description}</small></button>)}
            </div>
            <div className="rw-overlay-actions"><button onClick={start}>{ui.status === "menu" ? "Enter the field" : "Fight again"}</button></div>
          </div>}
          {ui.status === "paused" && <div className="rw-pause-card"><span>PAUSED</span><strong>The field is holding.</strong><button onClick={togglePause}>Resume</button></div>}
          {!overlay && ui.status !== "paused" && <aside className={`rw-inspector${ui.inspection.valid ? " rw-inspector-valid" : ""}`} aria-live="polite">
            <div><span>{ui.inspection.subtitle}</span>{ui.inspection.score !== null && <b>{ui.inspection.score}</b>}</div>
            <strong>{ui.inspection.title}</strong>
            <ul>{ui.inspection.details.slice(0, 3).map((detail) => <li key={detail}>{detail}</li>)}</ul>
          </aside>}
          <div className={`rw-build-menu${overlay || ui.reviewState ? " rw-build-menu-hidden" : ""}`} aria-label="Build menu" aria-hidden={overlay || Boolean(ui.reviewState)}>
            <div className="rw-build-menu-head"><span>Grow</span></div>
            <div className="rw-plant-bar" aria-label="Plants">
              {PLANT_ORDER.map((kind, index) => {
                const config = PLANTS[kind];
                const locked = ui.wave < config.unlockWave;
                return <button className={ui.selected === kind ? "active" : ""} disabled={locked || ui.status === "menu" || ui.status === "won" || ui.status === "lost"} aria-pressed={ui.selected === kind} key={kind} onClick={() => choosePlant(kind)}><i style={{ background: config.color }}>{locked ? "×" : index + 1}</i><span><strong>{config.shortName}</strong><small>{locked ? `Wave ${config.unlockWave}` : `${config.cost} sun`}</small></span></button>;
              })}
            </div>
          </div>
        </div>
        <div className="rw-status-line"><span>{ui.message}</span><small>{ui.enemies} AI slop · {ui.nodes} datacenters · {ui.plants} defenders</small></div>
        <footer className="rw-controls"><p><strong>Grow:</strong> choose 1-6, then click the landscape. Arrows plus Q/E move the placement cursor across six neighboring cells; Enter plants. Defenders stay planted and attack automatically.</p><div><button onClick={() => onViewChange("guide")}>Field guide</button><button onClick={togglePause} disabled={ui.status === "menu" || ui.status === "won" || ui.status === "lost"}>{ui.status === "paused" ? "Resume" : "Pause"}</button><button onClick={start}>Restart</button></div></footer>
      </section>
    </div>
  );
}
