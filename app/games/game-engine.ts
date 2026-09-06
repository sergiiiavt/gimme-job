export const GAME_WIDTH = 1440;
export const GAME_HEIGHT = 720;
export const SPACE_WORLD_WIDTH = 5200;
export const SPACE_WORLD_HEIGHT = 3400;

export type Rect = { x: number; y: number; w: number; h: number };
export type Vector = { x: number; y: number };
export type Camera = { x: number; y: number };
export type Crater = { x: number; y: number; radius: number };

export type PlanetPhysics = {
  x: number;
  y: number;
  radius: number;
  surfaceGravity: number;
  craters: Crater[];
};

export function rectsOverlap(a: Rect, b: Rect): boolean {
  return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
}

export function normalizedDirection(fromX: number, fromY: number, toX: number, toY: number): Vector {
  const dx = toX - fromX;
  const dy = toY - fromY;
  const length = Math.hypot(dx, dy);
  if (length === 0) return { x: 1, y: 0 };
  return { x: dx / length, y: dy / length };
}

export function directionInsideCone(shipAngle: number, direction: Vector, halfAngle: number): boolean {
  const forwardX = Math.cos(shipAngle);
  const forwardY = Math.sin(shipAngle);
  const dot = forwardX * direction.x + forwardY * direction.y;
  return dot >= Math.cos(halfAngle);
}

export function wrapCoordinate(value: number, size: number): number {
  if (size <= 0) return 0;
  return ((value % size) + size) % size;
}

export function gravityAtPoint(x: number, y: number, planets: readonly PlanetPhysics[]): Vector {
  let ax = 0;
  let ay = 0;

  for (const planet of planets) {
    const dx = planet.x - x;
    const dy = planet.y - y;
    const distance = Math.hypot(dx, dy);
    if (distance === 0) continue;

    const effectiveDistance = Math.max(distance, planet.radius * 0.35);
    const magnitude = Math.min(
      900,
      planet.surfaceGravity * (planet.radius * planet.radius) / (effectiveDistance * effectiveDistance),
    );
    ax += dx / distance * magnitude;
    ay += dy / distance * magnitude;
  }

  return { x: ax, y: ay };
}

export function pointInsideCrater(x: number, y: number, craters: readonly Crater[]): boolean {
  return craters.some((crater) => (x - crater.x) ** 2 + (y - crater.y) ** 2 <= crater.radius ** 2);
}

export function isPlanetSolidAtPoint(planet: PlanetPhysics, x: number, y: number): boolean {
  const insidePlanet = (x - planet.x) ** 2 + (y - planet.y) ** 2 <= planet.radius ** 2;
  return insidePlanet && !pointInsideCrater(x, y, planet.craters);
}

export function findSolidPlanetIndex(planets: readonly PlanetPhysics[], x: number, y: number): number {
  return planets.findIndex((planet) => isPlanetSolidAtPoint(planet, x, y));
}

export function screenToWorld(screenX: number, screenY: number, camera: Camera, zoom = 1): Vector {
  return { x: screenX / zoom + camera.x, y: screenY / zoom + camera.y };
}

export function clampCameraPosition(x: number, y: number, viewportWidth: number, viewportHeight: number): Camera {
  const maxX = Math.max(0, SPACE_WORLD_WIDTH - viewportWidth);
  const maxY = Math.max(0, SPACE_WORLD_HEIGHT - viewportHeight);
  return {
    x: Math.max(0, Math.min(maxX, x)),
    y: Math.max(0, Math.min(maxY, y)),
  };
}

export function clampCamera(targetX: number, targetY: number, viewportWidth: number, viewportHeight: number): Camera {
  return clampCameraPosition(targetX - viewportWidth / 2, targetY - viewportHeight / 2, viewportWidth, viewportHeight);
}

export function cameraForZoomAnchor(
  camera: Camera,
  screenX: number,
  screenY: number,
  currentZoom: number,
  nextZoom: number,
  canvasWidth: number,
  canvasHeight: number,
): Camera {
  const worldPoint = screenToWorld(screenX, screenY, camera, currentZoom);
  const viewportWidth = canvasWidth / nextZoom;
  const viewportHeight = canvasHeight / nextZoom;
  return clampCameraPosition(
    worldPoint.x - screenX / nextZoom,
    worldPoint.y - screenY / nextZoom,
    viewportWidth,
    viewportHeight,
  );
}
