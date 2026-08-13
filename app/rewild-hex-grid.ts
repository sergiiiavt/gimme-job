export interface HexCoord { q: number; r: number }
export interface PixelPoint { x: number; y: number }

export interface HexLayout {
  cols: number;
  rows: number;
  size: number;
  origin: PixelPoint;
}

interface CubeCoord { x: number; y: number; z: number }

export const HEX_DIRECTIONS: readonly CubeCoord[] = [
  { x: 1, y: -1, z: 0 },
  { x: 1, y: 0, z: -1 },
  { x: 0, y: 1, z: -1 },
  { x: -1, y: 1, z: 0 },
  { x: -1, y: 0, z: 1 },
  { x: 0, y: -1, z: 1 },
];

export function hexWidth(layout: HexLayout) { return layout.size * 2; }
export function hexHeight(layout: HexLayout) { return Math.sqrt(3) * layout.size; }
export function hexXStep(layout: HexLayout) { return layout.size * 1.5; }

export function inHexLayout(layout: HexLayout, hex: HexCoord) {
  return hex.q >= 0 && hex.r >= 0 && hex.q < layout.cols && hex.r < layout.rows;
}

export function offsetToCube(hex: HexCoord): CubeCoord {
  const x = hex.q;
  const z = hex.r - (hex.q - (hex.q & 1)) / 2;
  return { x, z, y: -x - z };
}

export function cubeToOffset(cube: CubeCoord): HexCoord {
  return { q: cube.x, r: cube.z + (cube.x - (cube.x & 1)) / 2 };
}

function cubeRound(cube: CubeCoord): CubeCoord {
  let x = Math.round(cube.x);
  let y = Math.round(cube.y);
  let z = Math.round(cube.z);
  const xDiff = Math.abs(x - cube.x);
  const yDiff = Math.abs(y - cube.y);
  const zDiff = Math.abs(z - cube.z);
  if (xDiff > yDiff && xDiff > zDiff) x = -y - z;
  else if (yDiff > zDiff) y = -x - z;
  else z = -x - y;
  return { x, y, z };
}

export function hexCenterFor(layout: HexLayout, hex: HexCoord): PixelPoint {
  return {
    x: layout.origin.x + layout.size + hex.q * hexXStep(layout),
    y: layout.origin.y + hexHeight(layout) / 2 + (hex.r + (hex.q & 1) * .5) * hexHeight(layout),
  };
}

export function pixelToHexFor(layout: HexLayout, x: number, y: number): HexCoord | null {
  const localX = x - layout.origin.x - layout.size;
  const localY = y - layout.origin.y - hexHeight(layout) / 2;
  const fractionalX = localX / (layout.size * 1.5);
  const fractionalZ = localY / hexHeight(layout) - fractionalX / 2;
  const cube = cubeRound({ x: fractionalX, z: fractionalZ, y: -fractionalX - fractionalZ });
  const hex = cubeToOffset(cube);
  if (!inHexLayout(layout, hex)) return null;
  const center = hexCenterFor(layout, hex);
  return (center.x - x) ** 2 + (center.y - y) ** 2 <= (layout.size * 1.04) ** 2 ? hex : null;
}

export function hexPolygonFor(layout: HexLayout, hex: HexCoord, scale = 1): PixelPoint[] {
  const center = hexCenterFor(layout, hex);
  return Array.from({ length: 6 }, (_, index) => {
    const angle = Math.PI / 3 * index;
    return { x: center.x + Math.cos(angle) * layout.size * scale, y: center.y + Math.sin(angle) * layout.size * scale };
  });
}

export function hexNeighborsFor(layout: HexLayout, hex: HexCoord): HexCoord[] {
  const cube = offsetToCube(hex);
  return HEX_DIRECTIONS
    .map((direction) => cubeToOffset({ x: cube.x + direction.x, y: cube.y + direction.y, z: cube.z + direction.z }))
    .filter((neighbor) => inHexLayout(layout, neighbor));
}

export function hexNeighborFor(layout: HexLayout, hex: HexCoord, direction: number): HexCoord | null {
  const vector = HEX_DIRECTIONS[((direction % HEX_DIRECTIONS.length) + HEX_DIRECTIONS.length) % HEX_DIRECTIONS.length];
  const cube = offsetToCube(hex);
  const neighbor = cubeToOffset({ x: cube.x + vector.x, y: cube.y + vector.y, z: cube.z + vector.z });
  return inHexLayout(layout, neighbor) ? neighbor : null;
}

export function hexDistanceBetween(left: HexCoord, right: HexCoord) {
  const a = offsetToCube(left);
  const b = offsetToCube(right);
  return Math.max(Math.abs(a.x - b.x), Math.abs(a.y - b.y), Math.abs(a.z - b.z));
}

export function hexDirectionBetween(start: HexCoord, end: HexCoord): number | null {
  const from = offsetToCube(start);
  const to = offsetToCube(end);
  const distance = hexDistanceBetween(start, end);
  if (!distance) return null;
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const dz = to.z - from.z;
  const direction = HEX_DIRECTIONS.findIndex((candidate) => candidate.x * distance === dx && candidate.y * distance === dy && candidate.z * distance === dz);
  return direction >= 0 ? direction : null;
}

export function straightHexLineBetween(layout: HexLayout, start: HexCoord, end: HexCoord) {
  const directionIndex = hexDirectionBetween(start, end);
  if (directionIndex === null) return [];
  const startCube = offsetToCube(start);
  const direction = HEX_DIRECTIONS[directionIndex];
  const distance = hexDistanceBetween(start, end);
  return Array.from({ length: distance + 1 }, (_, step) => cubeToOffset({
    x: startCube.x + direction.x * step,
    y: startCube.y + direction.y * step,
    z: startCube.z + direction.z * step,
  })).filter((hex) => inHexLayout(layout, hex));
}

export function hexLineBetween(layout: HexLayout, start: HexCoord, end: HexCoord) {
  const a = offsetToCube(start);
  const b = offsetToCube(end);
  const distance = hexDistanceBetween(start, end);
  if (!distance) return [start];
  const result: HexCoord[] = [];
  for (let step = 0; step <= distance; step += 1) {
    const t = step / distance;
    const cube = cubeRound({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t, z: a.z + (b.z - a.z) * t });
    const hex = cubeToOffset(cube);
    if (inHexLayout(layout, hex) && !result.some((entry) => entry.q === hex.q && entry.r === hex.r)) result.push(hex);
  }
  return result;
}
