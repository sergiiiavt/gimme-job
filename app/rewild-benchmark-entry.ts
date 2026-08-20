import { createReviewGameState } from "./rewild-hex-world";
import { renderOverheadGame } from "./rewild-overhead-renderer";
import { preloadRewildArt } from "./rewild-pixel-atlas";

const canvas = document.querySelector<HTMLCanvasElement>("#rewild-benchmark");
if (!canvas) throw new Error("Rewild benchmark canvas is missing.");
const context = canvas.getContext("2d");
if (!context) throw new Error("Rewild benchmark requires a 2D canvas context.");

const state = createReviewGameState(0, "ecosystem");
void preloadRewildArt().then(() => {
  renderOverheadGame(context, state, { x: 0, y: 0, zoom: 1 });
  document.documentElement.dataset.rewildBenchmark = "ready";
});
