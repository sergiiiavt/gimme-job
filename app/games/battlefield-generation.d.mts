export type GeneratedRect = { x: number; y: number; w: number; h: number };
export type GeneratedEnemySpawn = GeneratedRect & { minX: number; maxX: number; vx: number };
export type PlatformBattlefield = {
  seed: number;
  platforms: GeneratedRect[];
  spawnTemplates: GeneratedEnemySpawn[];
  playerSpawn: { x: number; y: number };
};

export type GravityPlanetSpec = {
  x: number;
  y: number;
  radius: number;
  surfaceGravity: number;
  fill: string;
  edge: string;
};
export type GravityEnemySpec = { x: number; y: number; radius: number; fireEvery: number };
export type GravityStationSpec = {
  x: number;
  y: number;
  radius: number;
  health: number;
  maxHealth: number;
  fireEvery: number;
};
export type GravityBattlefield = {
  seed: number;
  shipSpawn: { x: number; y: number; angle: number };
  planets: GravityPlanetSpec[];
  baseAngles: number[];
  enemies: GravityEnemySpec[];
  stations: GravityStationSpec[];
};

export function randomBattlefieldSeed(salt?: number): number;
export function generatePlatformBattlefield(seed: number, worldWidth?: number, worldHeight?: number): PlatformBattlefield;
export function generateGravityBattlefield(seed: number, worldWidth?: number, worldHeight?: number): GravityBattlefield;
