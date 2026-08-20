import { createRenderSnapshot } from "./rewild-render-snapshot";
import {
  renderOverheadGame as renderProductionGame,
  type RewildCamera,
} from "./rewild-production-renderer";
import type { GameState } from "./rewild-hex-world";

export * from "./rewild-production-renderer";

// Compatibility seam: the running simulation never crosses into the production renderer directly.
// Every frame is projected into a detached rendering value first.
export function renderOverheadGame(
  context: CanvasRenderingContext2D,
  state: GameState,
  camera: RewildCamera,
) {
  const snapshot = createRenderSnapshot(state);
  renderProductionGame(context, snapshot.state, camera);
}
