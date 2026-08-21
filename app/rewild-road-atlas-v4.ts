export const REWILD_ROAD_V4_IDS = [
  "road-dirt-straight",
  "road-dirt-curve-left",
  "road-dirt-curve-right",
  "road-dirt-t-junction",
  "road-dirt-crossroads",
  "road-dirt-narrow-trail",
  "road-dirt-worn-edge-a",
  "road-dirt-worn-edge-b",
  "fence-wood-straight-a",
  "fence-wood-straight-b",
  "fence-wood-corner",
  "fence-wood-gate",
  "fence-wood-broken",
  "barrier-stone-low",
] as const;

export type RewildRoadV4Id = (typeof REWILD_ROAD_V4_IDS)[number];

interface RewildRoadV4Frame {
  x: number;
  y: number;
  width: number;
  height: number;
  pivotX: number;
  pivotY: number;
}

export interface RewildRoadDrawOptions {
  scale?: number;
  alpha?: number;
  rotationSteps?: number;
}

export interface RewildRoadSelection {
  id: RewildRoadV4Id;
  rotationSteps: number;
}

const ROAD_ATLAS_URL = "/rewild/v4/roads-fences-atlas-v4.png";
const SLOT = 64;

export const REWILD_ROAD_V4_FRAMES: Record<RewildRoadV4Id, RewildRoadV4Frame> = Object.fromEntries(
  REWILD_ROAD_V4_IDS.map((id, index) => [id, {
    x: (index % 4) * SLOT,
    y: Math.floor(index / 4) * SLOT,
    width: SLOT,
    height: SLOT,
    pivotX: 0.5,
    pivotY: 0.5,
  }]),
) as Record<RewildRoadV4Id, RewildRoadV4Frame>;

function bitCount(value: number) {
  let count = 0;
  let remaining = value & 0x3f;
  while (remaining) {
    count += remaining & 1;
    remaining >>>= 1;
  }
  return count;
}

export function rotateConnectorMask(mask: number, steps: number) {
  const normalized = ((steps % 6) + 6) % 6;
  let result = 0;
  for (let direction = 0; direction < 6; direction += 1) {
    if (mask & (1 << direction)) result |= 1 << ((direction + normalized) % 6);
  }
  return result;
}

function rotationForMask(canonicalMask: number, targetMask: number) {
  for (let steps = 0; steps < 6; steps += 1) {
    if (rotateConnectorMask(canonicalMask, steps) === (targetMask & 0x3f)) return steps;
  }
  return 0;
}

const STRAIGHT_MASK = (1 << 0) | (1 << 3);
const CURVE_LEFT_MASK = (1 << 0) | (1 << 1);
const CURVE_RIGHT_MASK = (1 << 0) | (1 << 5);
const T_MASK = (1 << 0) | (1 << 3) | (1 << 5);
const CROSS_MASK = (1 << 0) | (1 << 1) | (1 << 3) | (1 << 4);

function areOpposite(mask: number) {
  for (let direction = 0; direction < 3; direction += 1) {
    if ((mask & (1 << direction)) && (mask & (1 << (direction + 3)))) return true;
  }
  return false;
}

export function selectRoadV4(mask: number, seed: number): RewildRoadSelection {
  const cleanMask = mask & 0x3f;
  const degree = bitCount(cleanMask);
  if (degree <= 1) {
    const direction = degree === 1 ? Math.log2(cleanMask) : 0;
    return { id: "road-dirt-narrow-trail", rotationSteps: Number.isFinite(direction) ? (direction + 3) % 6 : 0 };
  }
  if (degree === 2) {
    if (areOpposite(cleanMask)) {
      const worn = Math.abs(seed) % 7 === 0;
      return {
        id: worn ? (Math.abs(seed) % 2 ? "road-dirt-worn-edge-a" : "road-dirt-worn-edge-b") : "road-dirt-straight",
        rotationSteps: rotationForMask(STRAIGHT_MASK, cleanMask),
      };
    }
    const leftRotation = rotationForMask(CURVE_LEFT_MASK, cleanMask);
    if (rotateConnectorMask(CURVE_LEFT_MASK, leftRotation) === cleanMask) return { id: "road-dirt-curve-left", rotationSteps: leftRotation };
    return { id: "road-dirt-curve-right", rotationSteps: rotationForMask(CURVE_RIGHT_MASK, cleanMask) };
  }
  if (degree === 3) return { id: "road-dirt-t-junction", rotationSteps: rotationForMask(T_MASK, cleanMask) };
  return { id: "road-dirt-crossroads", rotationSteps: rotationForMask(CROSS_MASK, cleanMask) };
}

export function selectFenceV4(mask: number, seed: number, gate: boolean, broken: boolean): RewildRoadSelection {
  const cleanMask = mask & 0x3f;
  if (broken) return { id: "fence-wood-broken", rotationSteps: rotationForMask(STRAIGHT_MASK, cleanMask || STRAIGHT_MASK) };
  if (gate) return { id: "fence-wood-gate", rotationSteps: rotationForMask(STRAIGHT_MASK, cleanMask || STRAIGHT_MASK) };
  if (bitCount(cleanMask) === 2 && !areOpposite(cleanMask)) return { id: "fence-wood-corner", rotationSteps: rotationForMask(CURVE_LEFT_MASK, cleanMask) };
  return {
    id: Math.abs(seed) % 2 ? "fence-wood-straight-a" : "fence-wood-straight-b",
    rotationSteps: rotationForMask(STRAIGHT_MASK, cleanMask || STRAIGHT_MASK),
  };
}

let roadImage: HTMLImageElement | null = null;
let roadReady: Promise<HTMLImageElement> | null = null;

function preload() {
  if (typeof Image === "undefined") return Promise.resolve<HTMLImageElement | null>(null);
  if (roadImage?.complete && roadImage.naturalWidth > 0) return Promise.resolve(roadImage);
  roadReady ??= new Promise<HTMLImageElement>((resolve, reject) => {
    const image = roadImage ?? new Image();
    image.onload = () => { roadImage = image; resolve(image); };
    image.onerror = () => reject(new Error(`Failed to load Rewild v4 road atlas: ${ROAD_ATLAS_URL}`));
    if (!roadImage) {
      roadImage = image;
      image.src = ROAD_ATLAS_URL;
    }
  });
  return roadReady;
}

export function preloadRewildRoadV4() {
  return preload().then(() => undefined);
}

export function drawRewildRoadV4(
  ctx: CanvasRenderingContext2D,
  id: RewildRoadV4Id,
  x: number,
  y: number,
  options: RewildRoadDrawOptions = {},
) {
  if (typeof Image !== "undefined" && !roadReady) void preload();
  if (!roadImage?.complete || roadImage.naturalWidth <= 0) return false;
  const frame = REWILD_ROAD_V4_FRAMES[id];
  const scale = options.scale ?? 1;
  const width = Math.max(1, Math.round(frame.width * scale));
  const height = Math.max(1, Math.round(frame.height * scale));
  const steps = ((options.rotationSteps ?? 0) % 6 + 6) % 6;

  ctx.save();
  ctx.globalAlpha *= options.alpha ?? 1;
  ctx.imageSmoothingEnabled = false;
  ctx.translate(Math.round(x), Math.round(y));
  // Source direction indices increase counter-clockwise in screen-space; canvas positive rotation is clockwise.
  if (steps) ctx.rotate(-steps * Math.PI / 3);
  ctx.drawImage(
    roadImage,
    frame.x,
    frame.y,
    frame.width,
    frame.height,
    -Math.round(width * frame.pivotX),
    -Math.round(height * frame.pivotY),
    width,
    height,
  );
  ctx.restore();
  return true;
}
