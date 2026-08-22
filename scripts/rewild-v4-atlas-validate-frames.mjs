import assert from "node:assert/strict";

// Shared by validate-rewild-v4-entities-atlas.mjs and validate-rewild-v4-structures-atlas.mjs:
// both parse the same "id": { x, y, width, height } shape out of their runtime atlas module and
// check each generated atlas frame the same way, differing only in id count and a label string.
const RUNTIME_FRAME_PATTERN = /^\s*"([^"]+)": \{ x: (\d+), y: (\d+), width: (\d+), height: (\d+) \},$/gmu;

export function parseRuntimeFrameTable(runtimeSource, expectedCount, label) {
  const frames = new Map(
    [...runtimeSource.matchAll(RUNTIME_FRAME_PATTERN)].map((match) => [match[1], {
      x: Number.parseInt(match[2], 10),
      y: Number.parseInt(match[3], 10),
      width: Number.parseInt(match[4], 10),
      height: Number.parseInt(match[5], 10),
    }]),
  );
  assert.equal(frames.size, expectedCount, `runtime v4 ${label} frame table must contain exactly the ${expectedCount} approved IDs`);
  return frames;
}

export function assertFrameGeometry(frame, runtimeFrames, { data, info }, label) {
  const { x, y, width, height } = frame.frame;
  assert.ok(x >= 0 && y >= 0 && width > 0 && height > 0, `${frame.name}: invalid frame rectangle`);
  assert.ok(x + width <= info.width && y + height <= info.height, `${frame.name}: frame exceeds atlas bounds`);
  assert.deepEqual(frame.pivot, { x: 0.5, y: 0.5 }, `${frame.name}: ${label} sprites must stay center-pivoted to match the hex-center draw call`);
  assert.deepEqual(runtimeFrames.get(frame.name), frame.frame, `${frame.name}: runtime frame must exactly match generated atlas metadata`);

  let visible = 0;
  for (let py = y; py < y + height; py += 1) {
    for (let px = x; px < x + width; px += 1) {
      if (data[(py * info.width + px) * info.channels + 3] > 24) visible += 1;
    }
  }
  assert.ok(visible >= 24, `${frame.name}: atlas frame is effectively empty`);
}
