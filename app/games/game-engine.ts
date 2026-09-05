export const WORLD_WIDTH = 960;
export const WORLD_HEIGHT = 540;
export const TERRAIN_CELL = 10;
export const TERRAIN_COLUMNS = WORLD_WIDTH / TERRAIN_CELL;
export const TERRAIN_ROWS = WORLD_HEIGHT / TERRAIN_CELL;

export type Rect = { x: number; y: number; w: number; h: number };

export function rectsOverlap(a: Rect, b: Rect): boolean {
  return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
}

export function terrainIndex(column: number, row: number): number {
  return row * TERRAIN_COLUMNS + column;
}

export function terrainSurfaceRow(column: number): number {
  return Math.floor(35 + Math.sin(column * 0.14) * 3 + Math.sin(column * 0.045) * 5);
}

export function createTerrain(): Uint8Array {
  const terrain = new Uint8Array(TERRAIN_COLUMNS * TERRAIN_ROWS);
  for (let column = 0; column < TERRAIN_COLUMNS; column += 1) {
    const surface = terrainSurfaceRow(column);
    for (let row = surface; row < TERRAIN_ROWS; row += 1) {
      terrain[terrainIndex(column, row)] = 1;
    }
  }
  return terrain;
}

export function isTerrainSolid(terrain: Uint8Array, x: number, y: number): boolean {
  if (x < 0 || x >= WORLD_WIDTH || y >= WORLD_HEIGHT) return true;
  if (y < 0) return false;
  const column = Math.floor(x / TERRAIN_CELL);
  const row = Math.floor(y / TERRAIN_CELL);
  return terrain[terrainIndex(column, row)] === 1;
}

export function carveTerrain(terrain: Uint8Array, x: number, y: number, radius: number): void {
  const minColumn = Math.max(0, Math.floor((x - radius) / TERRAIN_CELL));
  const maxColumn = Math.min(TERRAIN_COLUMNS - 1, Math.floor((x + radius) / TERRAIN_CELL));
  const minRow = Math.max(0, Math.floor((y - radius) / TERRAIN_CELL));
  const maxRow = Math.min(TERRAIN_ROWS - 1, Math.floor((y + radius) / TERRAIN_CELL));
  const radiusSquared = radius * radius;

  for (let row = minRow; row <= maxRow; row += 1) {
    for (let column = minColumn; column <= maxColumn; column += 1) {
      const cellX = column * TERRAIN_CELL + TERRAIN_CELL / 2;
      const cellY = row * TERRAIN_CELL + TERRAIN_CELL / 2;
      if ((cellX - x) ** 2 + (cellY - y) ** 2 <= radiusSquared) {
        terrain[terrainIndex(column, row)] = 0;
      }
    }
  }
}
