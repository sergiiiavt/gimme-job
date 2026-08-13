"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { hexNeighborFor, pixelToHexFor, type HexCoord } from "./rewild-hex-grid";
import { renderTacticalWorld } from "./rewild-tactical-renderer";
import {
  TACTICAL_CANVAS_HEIGHT,
  TACTICAL_CANVAS_WIDTH,
  TACTICAL_COLS,
  TACTICAL_LAYOUT,
  TACTICAL_ROWS,
  createTacticalBenchmark,
  endTacticalTurn,
  inspectTacticalCell,
  moveTacticalEntity,
  reduceTacticalWorld,
  setTacticalAction,
  setTacticalPreview,
  tacticalUiSnapshot,
  type TacticalActionMode,
  type TacticalUiSnapshot,
  type TacticalWorldState,
} from "./rewild-tactical-world";

const ACTIONS: Array<{ id: Exclude<TacticalActionMode, null>; key: string; label: string; symbol: string }> = [
  { id: "move", key: "1", label: "Move", symbol: "↗" },
  { id: "attack", key: "2", label: "Attack", symbol: "✣" },
  { id: "restore", key: "3", label: "Restore", symbol: "⌁" },
];

function canvasPoint(canvas: HTMLCanvasElement, clientX: number, clientY: number) {
  const rect = canvas.getBoundingClientRect();
  const scale = Math.min(rect.width / TACTICAL_CANVAS_WIDTH, rect.height / TACTICAL_CANVAS_HEIGHT);
  const renderedWidth = TACTICAL_CANVAS_WIDTH * scale;
  const renderedHeight = TACTICAL_CANVAS_HEIGHT * scale;
  return {
    x: (clientX - rect.left - (rect.width - renderedWidth) / 2) / scale,
    y: (clientY - rect.top - (rect.height - renderedHeight) / 2) / scale,
  };
}

function initialUi() {
  return tacticalUiSnapshot(createTacticalBenchmark());
}

function initialInspection() {
  const state = createTacticalBenchmark();
  return inspectTacticalCell(state, state.preview?.hex ?? { q: 18, r: 7 });
}

export default function RewildTacticalGame({ onViewChange }: { onViewChange: (view: string) => void }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const stateRef = useRef<TacticalWorldState>(createTacticalBenchmark());
  const cursorRef = useRef<HexCoord>({ q: 18, r: 7 });
  const [ui, setUi] = useState<TacticalUiSnapshot>(initialUi);
  const [inspected, setInspected] = useState(initialInspection);

  const render = () => {
    const context = canvasRef.current?.getContext("2d");
    if (!context) return;
    renderTacticalWorld(context, stateRef.current, TACTICAL_LAYOUT);
  };

  const sync = () => {
    setUi(tacticalUiSnapshot(stateRef.current));
    setInspected(inspectTacticalCell(stateRef.current, cursorRef.current));
    render();
  };

  useEffect(() => { render(); }, []);

  const setAction = (action: Exclude<TacticalActionMode, null>) => {
    stateRef.current = setTacticalAction(stateRef.current, action);
    sync();
  };

  const reset = () => {
    stateRef.current = createTacticalBenchmark();
    cursorRef.current = { q: 18, r: 7 };
    sync();
    canvasRef.current?.focus();
  };

  const endTurn = () => {
    stateRef.current = endTacticalTurn(stateRef.current);
    sync();
  };

  const updateCursor = (hex: HexCoord) => {
    const state = stateRef.current;
    cursorRef.current = hex;
    const cell = state.cells.get(`${hex.q},${hex.r}`);
    const entity = cell?.occupantId ? state.entities.find((entry) => entry.id === cell.occupantId) : null;
    if (entity?.side === "ally") stateRef.current = reduceTacticalWorld(state, { type: "select-entity", entityId: entity.id });
    else if (state.preview?.hex.q === hex.q && state.preview.hex.r === hex.r && state.preview.valid && state.turn.selectedAction === "move") stateRef.current = moveTacticalEntity(state, hex);
    stateRef.current = setTacticalPreview(stateRef.current, hex);
    sync();
  };

  const onCanvasClick = (event: React.MouseEvent<HTMLCanvasElement>) => {
    const point = canvasPoint(event.currentTarget, event.clientX, event.clientY);
    const hex = pixelToHexFor(TACTICAL_LAYOUT, point.x, point.y);
    if (hex) updateCursor(hex);
  };

  const onCanvasMove = (event: React.PointerEvent<HTMLCanvasElement>) => {
    if (event.buttons) return;
    const point = canvasPoint(event.currentTarget, event.clientX, event.clientY);
    const hex = pixelToHexFor(TACTICAL_LAYOUT, point.x, point.y);
    if (!hex) return;
    const state = stateRef.current;
    if (hex.q === cursorRef.current.q && hex.r === cursorRef.current.r) return;
    cursorRef.current = hex;
    stateRef.current = setTacticalPreview(state, hex);
    sync();
  };

  const onCanvasKeyDown = (event: React.KeyboardEvent<HTMLCanvasElement>) => {
    const movement: Record<string, number> = { ArrowRight: 0, e: 1, ArrowDown: 2, ArrowLeft: 3, q: 4, ArrowUp: 5 };
    if (movement[event.key] !== undefined) {
      event.preventDefault();
      const next = hexNeighborFor(TACTICAL_LAYOUT, cursorRef.current, movement[event.key]);
      if (next) updateCursor(next);
      return;
    }
    const action = ACTIONS.find((item) => item.key === event.key)?.id;
    if (action) { event.preventDefault(); setAction(action); }
    if (event.key === "Enter") { event.preventDefault(); updateCursor(cursorRef.current); }
  };

  const selected = ui.selectedEntity;
  const topStats = useMemo(() => [
    { label: "Turn", value: String(ui.turnNumber).padStart(2, "0") },
    { label: "Phase", value: `${ui.phase.toUpperCase()} PHASE` },
    { label: "Light", value: "120" },
    { label: "World", value: `${Math.round(100 - ui.averageCorruption)}%` },
  ], [ui]);

  return (
    <div className="rwt-page">
      <section className="rwt-shell" aria-label="Fight AI slop tactical benchmark">
        <header className="rwt-topbar" aria-live="polite">
          <div className="rwt-top-stats">{topStats.map((stat) => <div key={stat.label}><span>{stat.label}</span><strong>{stat.value}</strong></div>)}</div>
          <div className="rwt-top-actions"><button type="button" onClick={() => onViewChange("guide")} aria-label="Open field guide">?</button><button type="button" onClick={reset} aria-label="Reset tactical benchmark">↻</button></div>
        </header>

        <div className="rwt-stage">
          <canvas
            aria-label={`A strict overhead ${TACTICAL_COLS} by ${TACTICAL_ROWS} tactical hex field. Every move and action crosses one of six shared borders.`}
            height={TACTICAL_CANVAS_HEIGHT}
            onClick={onCanvasClick}
            onKeyDown={onCanvasKeyDown}
            onPointerMove={onCanvasMove}
            ref={canvasRef}
            tabIndex={0}
            width={TACTICAL_CANVAS_WIDTH}
          />
          <aside className="rwt-inspector" aria-live="polite">
            <span>{inspected.cell?.territory ?? "outside"} · {inspected.cell?.ground ?? "field"}</span>
            <strong>{inspected.entity?.name ?? inspected.structure?.kind.replaceAll("-", " ") ?? inspected.components[0]?.kind ?? "Tactical ground"}</strong>
            <small>{ui.preview?.reason ?? `${inspected.edges.filter((edge) => edge.road || edge.cable || edge.root || edge.drain || edge.wall).length} connected borders`}</small>
          </aside>
        </div>

        <footer className="rwt-commandbar">
          <section className="rwt-unit-card" aria-label="Selected unit">
            <i aria-hidden="true"><span/></i>
            <div><strong>{selected?.name ?? "No unit selected"}</strong><span>{selected ? `${selected.hp}/${selected.maxHp} vitality · ${selected.actionPoints} AP` : "Select a nature unit"}</span></div>
          </section>
          <div className="rwt-actions" role="group" aria-label="Tactical actions">
            {ACTIONS.map((action) => <button className={ui.selectedAction === action.id ? "active" : ""} key={action.id} onClick={() => setAction(action.id)} type="button"><i>{action.symbol}</i><span>{action.label}</span><small>{action.key}</small></button>)}
          </div>
          <div className="rwt-inventory" aria-label="World summary"><span><i>♣</i>{ui.natureCells}</span><span><i>▦</i>{ui.industryCells}</span><span><i>☣</i>{Math.round(ui.averageCorruption)}</span></div>
          <button className="rwt-end-turn" onClick={endTurn} type="button">End turn</button>
        </footer>
      </section>
    </div>
  );
}
