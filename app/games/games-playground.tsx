"use client";

import { useEffect, useRef, useState } from "react";
import { SiteSidebar } from "../site-navigation";
import {
  GAME_HEIGHT as HEIGHT,
  GAME_WIDTH as WIDTH,
  SPACE_WORLD_HEIGHT,
  SPACE_WORLD_WIDTH,
  cameraForZoomAnchor,
  clampCamera,
  directionInsideCone,
  findSolidPlanetIndex,
  gravityAtPoint,
  normalizedDirection,
  rectsOverlap,
  screenToWorld,
  type PlanetPhysics,
  type Rect,
} from "./game-engine";
import styles from "./games.module.css";

type GameId = "platformer" | "gravity";
type WeaponId = "blaster" | "rocket" | "bomb";
type AimPoint = { x: number; y: number; inside: boolean };
type ClientPoint = { clientX: number; clientY: number };
type Projectile = {
  x: number;
  y: number;
  vx: number;
  vy: number;
  kind: WeaponId;
  bornAt: number;
};
type Explosion = { x: number; y: number; radius: number; bornAt: number; duration: number };

type PlatformEnemy = Rect & {
  alive: boolean;
  minX: number;
  maxX: number;
  vx: number;
  fireEvery: number;
  nextFireAt: number;
  spawnIndex: number;
};
type EnemySpawn = Omit<PlatformEnemy, "alive" | "fireEvery" | "nextFireAt" | "spawnIndex">;
type SpaceEnemy = { x: number; y: number; radius: number; alive: boolean };
type VisualPlanet = PlanetPhysics & { fill: string; edge: string };

const PLATFORM_WORLD_WIDTH = 1920;
const PLATFORM_WORLD_HEIGHT = 960;
const PLATFORM_SCALE = WIDTH / PLATFORM_WORLD_WIDTH;
const GRAVITY_BASE_ZOOM = 0.4;
const GRAVITY_MIN_ZOOM = 0.24;
const GRAVITY_MAX_ZOOM = 2.4;
const FIRE_HALF_ANGLE = Math.PI * 32 / 180;

const WEAPON_LABELS: Record<WeaponId, string> = {
  blaster: "Blaster",
  rocket: "Rocket",
  bomb: "Bomb",
};

function canvasPoint(canvas: HTMLCanvasElement, event: ClientPoint): { x: number; y: number } {
  const rect = canvas.getBoundingClientRect();
  return {
    x: (event.clientX - rect.left) * canvas.width / rect.width,
    y: (event.clientY - rect.top) * canvas.height / rect.height,
  };
}

function pointInsideRect(x: number, y: number, rect: Rect): boolean {
  return x >= rect.x && x <= rect.x + rect.w && y >= rect.y && y <= rect.y + rect.h;
}

function selectWeapon(code: string, current: WeaponId): WeaponId {
  if (code === "Digit1") return "blaster";
  if (code === "Digit2") return "rocket";
  if (code === "Digit3") return "bomb";
  return current;
}

function projectileStyle(projectile: Projectile): { fill: string; radius: number } {
  if (projectile.kind === "rocket") return { fill: "#ffb25b", radius: 7 };
  if (projectile.kind === "bomb") return { fill: "#e9825e", radius: 9 };
  return { fill: "#ffd166", radius: 4 };
}

function drawProjectile(ctx: CanvasRenderingContext2D, projectile: Projectile, scale = 1) {
  const style = projectileStyle(projectile);
  ctx.beginPath();
  ctx.fillStyle = style.fill;
  ctx.arc(projectile.x, projectile.y, style.radius / scale, 0, Math.PI * 2);
  ctx.fill();

  if (projectile.kind === "rocket") {
    ctx.beginPath();
    ctx.strokeStyle = "rgba(255, 205, 126, .72)";
    ctx.lineWidth = 3 / scale;
    ctx.moveTo(projectile.x, projectile.y);
    const speed = Math.max(1, Math.hypot(projectile.vx, projectile.vy));
    ctx.lineTo(
      projectile.x - projectile.vx / speed * 16 / scale,
      projectile.y - projectile.vy / speed * 16 / scale,
    );
    ctx.stroke();
  }
}

function drawCrosshair(ctx: CanvasRenderingContext2D, aim: AimPoint, valid = true, scale = 1) {
  if (!aim.inside) return;
  const radius = 11 / scale;
  const inner = 6 / scale;
  const outer = 17 / scale;
  ctx.save();
  ctx.strokeStyle = valid ? "rgba(255, 255, 255, .72)" : "rgba(255, 125, 112, .9)";
  ctx.lineWidth = 1.5 / scale;
  ctx.beginPath();
  ctx.arc(aim.x, aim.y, radius, 0, Math.PI * 2);
  ctx.moveTo(aim.x - outer, aim.y);
  ctx.lineTo(aim.x - inner, aim.y);
  ctx.moveTo(aim.x + inner, aim.y);
  ctx.lineTo(aim.x + outer, aim.y);
  ctx.moveTo(aim.x, aim.y - outer);
  ctx.lineTo(aim.x, aim.y - inner);
  ctx.moveTo(aim.x, aim.y + inner);
  ctx.lineTo(aim.x, aim.y + outer);
  ctx.stroke();
  ctx.restore();
}

function drawExplosions(ctx: CanvasRenderingContext2D, explosions: readonly Explosion[], now: number, scale = 1) {
  for (const explosion of explosions) {
    const progress = Math.min(1, (now - explosion.bornAt) / explosion.duration);
    ctx.beginPath();
    ctx.strokeStyle = `rgba(255, 184, 96, ${0.78 * (1 - progress)})`;
    ctx.lineWidth = 3 / scale;
    ctx.arc(explosion.x, explosion.y, explosion.radius * progress, 0, Math.PI * 2);
    ctx.stroke();
  }
}

function PlatformerGame({ resetToken }: { resetToken: number }) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const keys = new Set<string>();
    const platforms: Rect[] = [
      { x: 0, y: 915, w: PLATFORM_WORLD_WIDTH, h: 45 },
      { x: 115, y: 790, w: 250, h: 16 },
      { x: 420, y: 715, w: 220, h: 16 },
      { x: 720, y: 820, w: 245, h: 16 },
      { x: 1025, y: 735, w: 225, h: 16 },
      { x: 1340, y: 805, w: 270, h: 16 },
      { x: 1650, y: 680, w: 190, h: 16 },
      { x: 1510, y: 535, w: 235, h: 16 },
      { x: 1190, y: 475, w: 250, h: 16 },
      { x: 855, y: 545, w: 210, h: 16 },
      { x: 535, y: 430, w: 245, h: 16 },
      { x: 205, y: 525, w: 220, h: 16 },
      { x: 70, y: 335, w: 220, h: 16 },
      { x: 390, y: 265, w: 205, h: 16 },
      { x: 760, y: 315, w: 225, h: 16 },
      { x: 1090, y: 235, w: 230, h: 16 },
      { x: 1450, y: 300, w: 245, h: 16 },
    ];
    const spawnTemplates: EnemySpawn[] = [
      { x: 170, y: 758, w: 26, h: 32, minX: 125, maxX: 340, vx: 72 },
      { x: 790, y: 788, w: 26, h: 32, minX: 735, maxX: 940, vx: -78 },
      { x: 1080, y: 703, w: 26, h: 32, minX: 1035, maxX: 1230, vx: 70 },
      { x: 1390, y: 773, w: 26, h: 32, minX: 1350, maxX: 1585, vx: -74 },
      { x: 1570, y: 503, w: 26, h: 32, minX: 1520, maxX: 1720, vx: 68 },
      { x: 1240, y: 443, w: 26, h: 32, minX: 1200, maxX: 1410, vx: -66 },
      { x: 900, y: 513, w: 26, h: 32, minX: 865, maxX: 1040, vx: 72 },
      { x: 585, y: 398, w: 26, h: 32, minX: 545, maxX: 755, vx: -70 },
      { x: 250, y: 493, w: 26, h: 32, minX: 215, maxX: 405, vx: 67 },
      { x: 425, y: 233, w: 26, h: 32, minX: 400, maxX: 575, vx: -64 },
      { x: 805, y: 283, w: 26, h: 32, minX: 770, maxX: 955, vx: 70 },
      { x: 1490, y: 268, w: 26, h: 32, minX: 1460, maxX: 1670, vx: -72 },
    ];
    const enemies: PlatformEnemy[] = [];
    const projectiles: Projectile[] = [];
    const enemyProjectiles: Projectile[] = [];
    const explosions: Explosion[] = [];
    const player = {
      x: 45,
      y: 865,
      w: 30,
      h: 42,
      vx: 0,
      vy: 0,
      onGround: false,
      jumpsRemaining: 2,
    };
    const aim: AimPoint = { x: 260, y: 820, inside: false };
    let score = 0;
    let spawnSerial = 0;
    let nextSpawnAt = performance.now() + 2800;
    let lastShot = -Infinity;
    let lastTime = performance.now();
    let jumpQueued = false;
    let pointerHeld = false;
    let weapon: WeaponId = "blaster";
    let frame = 0;

    function createEnemy(spawnIndex: number, now: number): PlatformEnemy {
      const template = spawnTemplates[spawnIndex];
      return {
        ...template,
        alive: true,
        fireEvery: 1180 + spawnIndex % 4 * 210,
        nextFireAt: now + 700 + spawnIndex * 95,
        spawnIndex,
      };
    }

    for (let index = 0; index < 7; index += 1) enemies.push(createEnemy(index, lastTime));
    spawnSerial = enemies.length;

    function respawn() {
      player.x = 45;
      player.y = 865;
      player.vx = 0;
      player.vy = 0;
      player.onGround = false;
      player.jumpsRemaining = 2;
    }

    function weaponCooldown() {
      if (weapon === "rocket") return 650;
      if (weapon === "bomb") return 900;
      return 120;
    }

    function shootAtAim(now: number) {
      if (!aim.inside || now - lastShot < weaponCooldown()) return;
      const originX = player.x + player.w / 2;
      const originY = player.y + player.h * 0.45;
      const direction = normalizedDirection(originX, originY, aim.x, aim.y);
      const speed = weapon === "rocket" ? 660 : weapon === "bomb" ? 470 : 1040;
      projectiles.push({
        x: originX + direction.x * 24,
        y: originY + direction.y * 24,
        vx: direction.x * speed,
        vy: direction.y * speed,
        kind: weapon,
        bornAt: now,
      });
      lastShot = now;
    }

    function spawnEnemy(now: number) {
      if (enemies.filter((enemy) => enemy.alive).length >= 10) return;
      let spawnIndex = spawnSerial % spawnTemplates.length;
      for (let offset = 0; offset < spawnTemplates.length; offset += 1) {
        const candidate = (spawnIndex + offset) % spawnTemplates.length;
        if (!enemies.some((enemy) => enemy.alive && enemy.spawnIndex === candidate)) {
          spawnIndex = candidate;
          break;
        }
      }
      enemies.push(createEnemy(spawnIndex, now));
      spawnSerial += 1;
    }

    function detonate(x: number, y: number, radius: number, now: number) {
      explosions.push({ x, y, radius, bornAt: now, duration: 360 });
      for (const enemy of enemies) {
        if (!enemy.alive) continue;
        const enemyX = enemy.x + enemy.w / 2;
        const enemyY = enemy.y + enemy.h / 2;
        if (Math.hypot(enemyX - x, enemyY - y) <= radius) {
          enemy.alive = false;
          score += 1;
        }
      }
    }

    function updateAim(event: PointerEvent) {
      const point = canvasPoint(canvas, event);
      aim.x = point.x / PLATFORM_SCALE;
      aim.y = point.y / PLATFORM_SCALE;
      aim.inside = true;
    }

    function onPointerMove(event: PointerEvent) {
      updateAim(event);
    }

    function onPointerDown(event: PointerEvent) {
      if (event.button !== 0) return;
      updateAim(event);
      pointerHeld = true;
      shootAtAim(performance.now());
    }

    function onPointerUp() {
      pointerHeld = false;
    }

    function onPointerLeave() {
      aim.inside = false;
    }

    function onKeyDown(event: KeyboardEvent) {
      if (["ArrowLeft", "ArrowRight", "ArrowUp", "Space"].includes(event.code)) event.preventDefault();
      keys.add(event.code);
      weapon = selectWeapon(event.code, weapon);
      if (["ArrowUp", "KeyW", "Space"].includes(event.code) && !event.repeat) jumpQueued = true;
      if (event.code === "KeyR") respawn();
    }

    function onKeyUp(event: KeyboardEvent) {
      keys.delete(event.code);
    }

    canvas.addEventListener("pointermove", onPointerMove);
    canvas.addEventListener("pointerdown", onPointerDown);
    canvas.addEventListener("pointerleave", onPointerLeave);
    window.addEventListener("pointerup", onPointerUp);
    window.addEventListener("pointercancel", onPointerUp);
    window.addEventListener("keydown", onKeyDown, { passive: false });
    window.addEventListener("keyup", onKeyUp);

    function update(dt: number, now: number) {
      const left = keys.has("ArrowLeft") || keys.has("KeyA");
      const right = keys.has("ArrowRight") || keys.has("KeyD");
      const keyboardShoot = keys.has("KeyF") || keys.has("KeyJ");

      player.vx = left === right ? 0 : left ? -360 : 360;

      if (jumpQueued) {
        if (player.jumpsRemaining > 0) {
          player.vy = -650;
          player.onGround = false;
          player.jumpsRemaining -= 1;
        }
        jumpQueued = false;
      }
      if (keyboardShoot || pointerHeld) shootAtAim(now);

      const previousBottom = player.y + player.h;
      player.vy += 1580 * dt;
      player.x += player.vx * dt;
      player.y += player.vy * dt;
      player.x = Math.max(0, Math.min(PLATFORM_WORLD_WIDTH - player.w, player.x));
      player.onGround = false;

      if (player.vy >= 0) {
        for (const platform of platforms) {
          const nextBottom = player.y + player.h;
          const horizontal = player.x + player.w > platform.x && player.x < platform.x + platform.w;
          if (horizontal && previousBottom <= platform.y && nextBottom >= platform.y) {
            player.y = platform.y - player.h;
            player.vy = 0;
            player.onGround = true;
            player.jumpsRemaining = 2;
            break;
          }
        }
      }
      if (player.y > PLATFORM_WORLD_HEIGHT + 100) respawn();

      if (now >= nextSpawnAt) {
        spawnEnemy(now);
        nextSpawnAt = now + 2600;
      }

      for (const enemy of enemies) {
        if (!enemy.alive) continue;
        enemy.x += enemy.vx * dt;
        if (enemy.x <= enemy.minX || enemy.x + enemy.w >= enemy.maxX) {
          enemy.x = Math.max(enemy.minX, Math.min(enemy.maxX - enemy.w, enemy.x));
          enemy.vx *= -1;
        }
        if (rectsOverlap(player, enemy)) respawn();

        if (now >= enemy.nextFireAt) {
          const originX = enemy.x + enemy.w / 2;
          const originY = enemy.y + enemy.h * 0.45;
          const targetX = player.x + player.w / 2;
          const targetY = player.y + player.h * 0.45;
          const direction = normalizedDirection(originX, originY, targetX, targetY);
          enemyProjectiles.push({
            x: originX + direction.x * 18,
            y: originY + direction.y * 18,
            vx: direction.x * 470,
            vy: direction.y * 470,
            kind: "blaster",
            bornAt: now,
          });
          enemy.nextFireAt = now + enemy.fireEvery;
        }
      }

      for (let index = projectiles.length - 1; index >= 0; index -= 1) {
        const projectile = projectiles[index];
        if (projectile.kind === "bomb") projectile.vy += 560 * dt;
        projectile.x += projectile.vx * dt;
        projectile.y += projectile.vy * dt;
        let remove = projectile.x < -60 || projectile.x > PLATFORM_WORLD_WIDTH + 60 || projectile.y < -60 || projectile.y > PLATFORM_WORLD_HEIGHT + 60;

        for (const enemy of enemies) {
          if (!enemy.alive || remove) continue;
          if (pointInsideRect(projectile.x, projectile.y, enemy)) {
            if (projectile.kind === "blaster") {
              enemy.alive = false;
              score += 1;
            } else {
              detonate(projectile.x, projectile.y, projectile.kind === "rocket" ? 115 : 155, now);
            }
            remove = true;
          }
        }

        if (!remove && platforms.some((platform) => pointInsideRect(projectile.x, projectile.y, platform))) {
          if (projectile.kind !== "blaster") detonate(projectile.x, projectile.y, projectile.kind === "rocket" ? 115 : 155, now);
          remove = true;
        }

        if (!remove && projectile.kind === "bomb" && now - projectile.bornAt >= 1250) {
          detonate(projectile.x, projectile.y, 155, now);
          remove = true;
        }

        if (remove) projectiles.splice(index, 1);
      }

      for (let index = enemyProjectiles.length - 1; index >= 0; index -= 1) {
        const projectile = enemyProjectiles[index];
        projectile.x += projectile.vx * dt;
        projectile.y += projectile.vy * dt;
        let remove = projectile.x < -50 || projectile.x > PLATFORM_WORLD_WIDTH + 50 || projectile.y < -50 || projectile.y > PLATFORM_WORLD_HEIGHT + 50;
        if (!remove && rectsOverlap(player, { x: projectile.x - 4, y: projectile.y - 4, w: 8, h: 8 })) {
          remove = true;
          respawn();
        }
        if (!remove && platforms.some((platform) => pointInsideRect(projectile.x, projectile.y, platform))) remove = true;
        if (remove) enemyProjectiles.splice(index, 1);
      }

      for (let index = enemies.length - 1; index >= 0; index -= 1) {
        if (!enemies[index].alive) enemies.splice(index, 1);
      }
      for (let index = explosions.length - 1; index >= 0; index -= 1) {
        if (now - explosions[index].bornAt > explosions[index].duration) explosions.splice(index, 1);
      }
    }

    function render(now: number) {
      ctx.clearRect(0, 0, WIDTH, HEIGHT);
      ctx.fillStyle = "#101722";
      ctx.fillRect(0, 0, WIDTH, HEIGHT);

      ctx.save();
      ctx.scale(PLATFORM_SCALE, PLATFORM_SCALE);
      ctx.fillStyle = "rgba(255,255,255,.035)";
      for (let x = 0; x < PLATFORM_WORLD_WIDTH; x += 80) ctx.fillRect(x, 0, 1, PLATFORM_WORLD_HEIGHT);
      for (let y = 0; y < PLATFORM_WORLD_HEIGHT; y += 80) ctx.fillRect(0, y, PLATFORM_WORLD_WIDTH, 1);

      ctx.fillStyle = "#314338";
      for (const platform of platforms) ctx.fillRect(platform.x, platform.y, platform.w, platform.h);

      for (const enemy of enemies) {
        ctx.fillStyle = "#d75a4a";
        ctx.fillRect(enemy.x, enemy.y, enemy.w, enemy.h);
        ctx.fillStyle = "rgba(255, 207, 191, .85)";
        ctx.fillRect(enemy.x + 5, enemy.y + 8, 5, 5);
      }

      projectiles.forEach((projectile) => drawProjectile(ctx, projectile, 1));
      enemyProjectiles.forEach((projectile) => drawProjectile(ctx, projectile, 1));
      drawExplosions(ctx, explosions, now, 1);

      ctx.fillStyle = "#edf5ff";
      ctx.fillRect(player.x, player.y, player.w, player.h);
      ctx.strokeStyle = "#6f8197";
      ctx.lineWidth = 2;
      ctx.strokeRect(player.x, player.y, player.w, player.h);
      drawCrosshair(ctx, aim, true, 1);
      ctx.restore();

      ctx.fillStyle = "#dfe8e2";
      ctx.font = "14px system-ui, sans-serif";
      ctx.fillText(`Score ${score} · Enemies ${enemies.length} · Jumps ${player.jumpsRemaining} · ${WEAPON_LABELS[weapon]}`, 20, 30);
      ctx.fillStyle = "#9eaaa3";
      ctx.fillText("1 Blaster · 2 Rocket · 3 Bomb · hold left mouse to keep firing", 20, 52);
    }

    function loop(now: number) {
      const dt = Math.min((now - lastTime) / 1000, 0.033);
      lastTime = now;
      update(dt, now);
      render(now);
      frame = requestAnimationFrame(loop);
    }

    frame = requestAnimationFrame(loop);
    return () => {
      cancelAnimationFrame(frame);
      canvas.removeEventListener("pointermove", onPointerMove);
      canvas.removeEventListener("pointerdown", onPointerDown);
      canvas.removeEventListener("pointerleave", onPointerLeave);
      window.removeEventListener("pointerup", onPointerUp);
      window.removeEventListener("pointercancel", onPointerUp);
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
    };
  }, [resetToken]);

  return <canvas aria-label="Platformer game" className={styles.canvas} height={HEIGHT} ref={canvasRef} width={WIDTH}/>;
}

function GravityGame({ resetToken }: { resetToken: number }) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const keys = new Set<string>();
    const projectiles: Projectile[] = [];
    const explosions: Explosion[] = [];
    const planets: VisualPlanet[] = [
      { x: 1200, y: 1600, radius: 270, surfaceGravity: 250, craters: [], fill: "#36505d", edge: "#79929d" },
      { x: 2450, y: 820, radius: 185, surfaceGravity: 175, craters: [], fill: "#594c62", edge: "#9b879f" },
      { x: 3250, y: 2150, radius: 325, surfaceGravity: 300, craters: [], fill: "#4c5740", edge: "#85956d" },
      { x: 4450, y: 1180, radius: 235, surfaceGravity: 220, craters: [], fill: "#5b463d", edge: "#9c7768" },
      { x: 1900, y: 2820, radius: 255, surfaceGravity: 235, craters: [], fill: "#3d5364", edge: "#718da2" },
    ];
    const enemies: SpaceEnemy[] = [
      { x: 1220, y: 1120, radius: 14, alive: true },
      { x: 1580, y: 1510, radius: 14, alive: true },
      { x: 2520, y: 510, radius: 14, alive: true },
      { x: 3600, y: 2030, radius: 14, alive: true },
      { x: 4270, y: 810, radius: 14, alive: true },
      { x: 2030, y: 2430, radius: 14, alive: true },
    ];
    const ship = { x: 700, y: 650, vx: 0, vy: 0, angle: -Math.PI / 2 };
    const aim: AimPoint = { x: WIDTH * 0.72, y: HEIGHT * 0.5, inside: false };
    let zoom = GRAVITY_BASE_ZOOM;
    const camera = clampCamera(ship.x, ship.y, WIDTH / zoom, HEIGHT / zoom);
    let lastShot = -Infinity;
    let lastTime = performance.now();
    let pointerHeld = false;
    let weapon: WeaponId = "blaster";
    let frame = 0;

    function respawn() {
      ship.x = 700;
      ship.y = 650;
      ship.vx = 0;
      ship.vy = 0;
      ship.angle = -Math.PI / 2;
      const resetCamera = clampCamera(ship.x, ship.y, WIDTH / zoom, HEIGHT / zoom);
      camera.x = resetCamera.x;
      camera.y = resetCamera.y;
    }

    function aimWorldPoint() {
      return screenToWorld(aim.x, aim.y, camera, zoom);
    }

    function currentFireDirection() {
      if (!aim.inside) return { x: Math.cos(ship.angle), y: Math.sin(ship.angle) };
      const target = aimWorldPoint();
      const direction = normalizedDirection(ship.x, ship.y, target.x, target.y);
      return directionInsideCone(ship.angle, direction, FIRE_HALF_ANGLE) ? direction : null;
    }

    function weaponCooldown() {
      if (weapon === "rocket") return 700;
      if (weapon === "bomb") return 980;
      return 145;
    }

    function shootAtAim(now: number) {
      if (now - lastShot < weaponCooldown()) return;
      const direction = currentFireDirection();
      if (!direction) return;
      const speed = weapon === "rocket" ? 560 : weapon === "bomb" ? 310 : 780;
      projectiles.push({
        x: ship.x + direction.x * 26,
        y: ship.y + direction.y * 26,
        vx: ship.vx + direction.x * speed,
        vy: ship.vy + direction.y * speed,
        kind: weapon,
        bornAt: now,
      });
      lastShot = now;
    }

    function detonate(x: number, y: number, radius: number, now: number) {
      explosions.push({ x, y, radius, bornAt: now, duration: 420 });
      for (const enemy of enemies) {
        if (!enemy.alive) continue;
        if (Math.hypot(enemy.x - x, enemy.y - y) <= radius + enemy.radius) enemy.alive = false;
      }
    }

    function updateAim(event: PointerEvent) {
      const point = canvasPoint(canvas, event);
      aim.x = point.x;
      aim.y = point.y;
      aim.inside = true;
    }

    function onPointerMove(event: PointerEvent) {
      updateAim(event);
    }

    function onPointerDown(event: PointerEvent) {
      if (event.button !== 0) return;
      updateAim(event);
      pointerHeld = true;
      shootAtAim(performance.now());
    }

    function onPointerUp() {
      pointerHeld = false;
    }

    function onPointerLeave() {
      aim.inside = false;
    }

    function onWheel(event: WheelEvent) {
      event.preventDefault();
      const point = canvasPoint(canvas, event);
      const factor = Math.exp(-event.deltaY * 0.0012);
      const nextZoom = Math.max(GRAVITY_MIN_ZOOM, Math.min(GRAVITY_MAX_ZOOM, zoom * factor));
      if (Math.abs(nextZoom - zoom) < 0.001) return;
      const nextCamera = cameraForZoomAnchor(camera, point.x, point.y, zoom, nextZoom, WIDTH, HEIGHT);
      zoom = nextZoom;
      camera.x = nextCamera.x;
      camera.y = nextCamera.y;
    }

    function onKeyDown(event: KeyboardEvent) {
      if (["ArrowLeft", "ArrowRight", "ArrowUp", "Space"].includes(event.code)) event.preventDefault();
      keys.add(event.code);
      weapon = selectWeapon(event.code, weapon);
      if (event.code === "KeyR") respawn();
    }

    function onKeyUp(event: KeyboardEvent) {
      keys.delete(event.code);
    }

    canvas.addEventListener("pointermove", onPointerMove);
    canvas.addEventListener("pointerdown", onPointerDown);
    canvas.addEventListener("pointerleave", onPointerLeave);
    canvas.addEventListener("wheel", onWheel, { passive: false });
    window.addEventListener("pointerup", onPointerUp);
    window.addEventListener("pointercancel", onPointerUp);
    window.addEventListener("keydown", onKeyDown, { passive: false });
    window.addEventListener("keyup", onKeyUp);

    function shipCollidesWithPlanet() {
      const noseX = ship.x + Math.cos(ship.angle) * 18;
      const noseY = ship.y + Math.sin(ship.angle) * 18;
      const sideAngle = ship.angle + Math.PI / 2;
      const sideX = Math.cos(sideAngle) * 10;
      const sideY = Math.sin(sideAngle) * 10;
      return [
        [ship.x, ship.y],
        [noseX, noseY],
        [ship.x + sideX, ship.y + sideY],
        [ship.x - sideX, ship.y - sideY],
      ].some(([x, y]) => findSolidPlanetIndex(planets, x, y) >= 0);
    }

    function update(dt: number, now: number) {
      const left = keys.has("ArrowLeft") || keys.has("KeyA");
      const right = keys.has("ArrowRight") || keys.has("KeyD");
      const thrust = keys.has("ArrowUp") || keys.has("KeyW");
      const keyboardShoot = keys.has("KeyF") || keys.has("Space");

      if (left !== right) ship.angle += (left ? -1 : 1) * 2.55 * dt;
      if (thrust) {
        ship.vx += Math.cos(ship.angle) * 390 * dt;
        ship.vy += Math.sin(ship.angle) * 390 * dt;
      }

      const gravity = gravityAtPoint(ship.x, ship.y, planets);
      ship.vx += gravity.x * dt;
      ship.vy += gravity.y * dt;
      ship.vx *= Math.pow(0.9993, dt * 60);
      ship.vy *= Math.pow(0.9993, dt * 60);
      ship.x += ship.vx * dt;
      ship.y += ship.vy * dt;

      if (keyboardShoot || pointerHeld) shootAtAim(now);
      if (shipCollidesWithPlanet()) respawn();
      if (ship.x < 0 || ship.x > SPACE_WORLD_WIDTH || ship.y < 0 || ship.y > SPACE_WORLD_HEIGHT) respawn();

      for (let index = projectiles.length - 1; index >= 0; index -= 1) {
        const projectile = projectiles[index];
        const projectileGravity = gravityAtPoint(projectile.x, projectile.y, planets);
        projectile.vx += projectileGravity.x * dt;
        projectile.vy += projectileGravity.y * dt;
        projectile.x += projectile.vx * dt;
        projectile.y += projectile.vy * dt;
        let remove = projectile.x < -100 || projectile.x > SPACE_WORLD_WIDTH + 100 || projectile.y < -100 || projectile.y > SPACE_WORLD_HEIGHT + 100;

        for (const enemy of enemies) {
          if (!enemy.alive || remove) continue;
          const hitRadius = enemy.radius + projectileStyle(projectile).radius;
          if ((projectile.x - enemy.x) ** 2 + (projectile.y - enemy.y) ** 2 <= hitRadius ** 2) {
            if (projectile.kind === "blaster") enemy.alive = false;
            else detonate(projectile.x, projectile.y, projectile.kind === "rocket" ? 130 : 185, now);
            remove = true;
          }
        }

        if (!remove) {
          const planetIndex = findSolidPlanetIndex(planets, projectile.x, projectile.y);
          if (planetIndex >= 0) {
            const craterRadius = projectile.kind === "rocket" ? 110 : projectile.kind === "bomb" ? 155 : 46;
            planets[planetIndex].craters.push({ x: projectile.x, y: projectile.y, radius: craterRadius });
            if (planets[planetIndex].craters.length > 180) planets[planetIndex].craters.shift();
            if (projectile.kind !== "blaster") {
              detonate(projectile.x, projectile.y, projectile.kind === "rocket" ? 130 : 185, now);
            }
            remove = true;
          }
        }

        if (!remove && projectile.kind === "bomb" && now - projectile.bornAt >= 1750) {
          detonate(projectile.x, projectile.y, 185, now);
          remove = true;
        }
        if (!remove && projectile.kind === "rocket" && now - projectile.bornAt >= 3200) {
          detonate(projectile.x, projectile.y, 130, now);
          remove = true;
        }

        if (remove) projectiles.splice(index, 1);
      }

      for (let index = explosions.length - 1; index >= 0; index -= 1) {
        if (now - explosions[index].bornAt > explosions[index].duration) explosions.splice(index, 1);
      }

      const viewportWidth = WIDTH / zoom;
      const viewportHeight = HEIGHT / zoom;
      const nextCamera = clampCamera(ship.x, ship.y, viewportWidth, viewportHeight);
      const follow = Math.min(1, dt * 5.5);
      camera.x += (nextCamera.x - camera.x) * follow;
      camera.y += (nextCamera.y - camera.y) * follow;
    }

    function drawShip() {
      ctx.save();
      ctx.translate(ship.x, ship.y);
      ctx.rotate(ship.angle);
      ctx.beginPath();
      ctx.moveTo(20, 0);
      ctx.lineTo(-14, -11);
      ctx.lineTo(-8, 0);
      ctx.lineTo(-14, 11);
      ctx.closePath();
      ctx.fillStyle = "#d9ecff";
      ctx.fill();
      ctx.strokeStyle = "#7290aa";
      ctx.lineWidth = 2 / zoom;
      ctx.stroke();
      if (keys.has("ArrowUp") || keys.has("KeyW")) {
        ctx.beginPath();
        ctx.moveTo(-9, -5);
        ctx.lineTo(-31, 0);
        ctx.lineTo(-9, 5);
        ctx.strokeStyle = "#f2b45b";
        ctx.stroke();
      }
      ctx.restore();
    }

    function drawFireCone() {
      const length = 270 / zoom;
      ctx.save();
      ctx.strokeStyle = "rgba(166, 198, 224, .38)";
      ctx.lineWidth = 1.5 / zoom;
      ctx.setLineDash([8 / zoom, 8 / zoom]);
      for (const offset of [-FIRE_HALF_ANGLE, FIRE_HALF_ANGLE]) {
        const angle = ship.angle + offset;
        ctx.beginPath();
        ctx.moveTo(ship.x + Math.cos(angle) * 25, ship.y + Math.sin(angle) * 25);
        ctx.lineTo(ship.x + Math.cos(angle) * length, ship.y + Math.sin(angle) * length);
        ctx.stroke();
      }
      ctx.restore();
    }

    function drawPlanet(planet: VisualPlanet) {
      ctx.beginPath();
      ctx.strokeStyle = "rgba(154, 187, 205, .12)";
      ctx.lineWidth = 1 / zoom;
      ctx.arc(planet.x, planet.y, planet.radius * 1.7, 0, Math.PI * 2);
      ctx.stroke();

      ctx.beginPath();
      ctx.fillStyle = planet.fill;
      ctx.arc(planet.x, planet.y, planet.radius, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = planet.edge;
      ctx.lineWidth = 4 / zoom;
      ctx.stroke();

      for (const crater of planet.craters) {
        ctx.beginPath();
        ctx.fillStyle = "#070b14";
        ctx.arc(crater.x, crater.y, crater.radius, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    function render(now: number) {
      ctx.clearRect(0, 0, WIDTH, HEIGHT);
      ctx.fillStyle = "#070b14";
      ctx.fillRect(0, 0, WIDTH, HEIGHT);

      ctx.save();
      ctx.scale(zoom, zoom);
      ctx.translate(-camera.x, -camera.y);

      ctx.fillStyle = "rgba(255,255,255,.43)";
      for (let index = 0; index < 240; index += 1) {
        const x = (index * 379 + 97) % SPACE_WORLD_WIDTH;
        const y = (index * 211 + 53) % SPACE_WORLD_HEIGHT;
        const size = index % 11 === 0 ? 2 : 1;
        ctx.fillRect(x, y, size / zoom, size / zoom);
      }

      planets.forEach((planet) => drawPlanet(planet));
      for (const enemy of enemies) {
        if (!enemy.alive) continue;
        ctx.beginPath();
        ctx.fillStyle = "#d75a4a";
        ctx.arc(enemy.x, enemy.y, enemy.radius, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = "#ff9a8d";
        ctx.lineWidth = 2 / zoom;
        ctx.stroke();
      }

      projectiles.forEach((projectile) => drawProjectile(ctx, projectile, zoom));
      drawExplosions(ctx, explosions, now, zoom);
      drawFireCone();
      drawShip();
      ctx.restore();

      const remaining = enemies.filter((enemy) => enemy.alive).length;
      const aimDirection = currentFireDirection();
      const displayZoom = Math.round(zoom / GRAVITY_BASE_ZOOM * 100);
      ctx.fillStyle = "#dfe8e2";
      ctx.font = "14px system-ui, sans-serif";
      ctx.fillText(`Targets ${enemies.length - remaining}/${enemies.length} · Zoom ${displayZoom}% · ${WEAPON_LABELS[weapon]}`, 20, 30);
      ctx.fillStyle = "#9eaaa3";
      ctx.fillText(`World ${Math.round(ship.x)}, ${Math.round(ship.y)} · 1 Blaster · 2 Rocket · 3 Bomb · hold mouse to fire`, 20, 52);
      if (aim.inside && !aimDirection) {
        ctx.fillStyle = "#e89083";
        ctx.fillText("Aim outside firing arc", 20, 74);
      }
      drawCrosshair(ctx, aim, Boolean(aimDirection));
    }

    function loop(now: number) {
      const dt = Math.min((now - lastTime) / 1000, 0.033);
      lastTime = now;
      update(dt, now);
      render(now);
      frame = requestAnimationFrame(loop);
    }

    frame = requestAnimationFrame(loop);
    return () => {
      cancelAnimationFrame(frame);
      canvas.removeEventListener("pointermove", onPointerMove);
      canvas.removeEventListener("pointerdown", onPointerDown);
      canvas.removeEventListener("pointerleave", onPointerLeave);
      canvas.removeEventListener("wheel", onWheel);
      window.removeEventListener("pointerup", onPointerUp);
      window.removeEventListener("pointercancel", onPointerUp);
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
    };
  }, [resetToken]);

  return <canvas aria-label="Gravity game" className={styles.canvas} height={HEIGHT} ref={canvasRef} width={WIDTH}/>;
}

const GAME_INFO: Record<GameId, { description: string; controls: string }> = {
  platformer: {
    description: "A wider arena with smaller actors, double jump, returning enemies and three weapons.",
    controls: "A/D or ←/→ move · W/↑/Space double jump · hold mouse to fire · 1 blaster · 2 rocket · 3 bomb · R respawn",
  },
  gravity: {
    description: "Planetary gravity, destructible worlds, rebased zoom and a forward-only three-weapon arsenal.",
    controls: "A/D or ←/→ rotate · W/↑ thrust · wheel zoom · hold mouse to fire · 1 blaster · 2 rocket · 3 bomb · R respawn",
  },
};

export default function GamesPlayground() {
  const [mobileNav, setMobileNav] = useState(false);
  const [game, setGame] = useState<GameId>("platformer");
  const [resetToken, setResetToken] = useState(0);
  const info = GAME_INFO[game];

  function selectGame(next: GameId) {
    setGame(next);
    setResetToken((value) => value + 1);
  }

  return (
    <main className="kb-shell">
      <SiteSidebar
        activeExternalId="games"
        activeSection={null}
        activeSubsection=""
        hideSecondary
        mobileOpen={mobileNav}
        mode="public"
        onSelectSubsection={() => undefined}
        personalHref="/games"
        secondaryItems={[]}
        secondaryTitle="Games"
      />

      <section className="kb-main">
        <button aria-expanded={mobileNav} aria-label="Toggle navigation" className="kb-floating-menu" onClick={() => setMobileNav((value) => !value)} type="button">☰</button>
        <div className={`kb-content ${styles.page}`}>
          <header className={styles.header}>
            <div>
              <h1>Games</h1>
              <p>{info.description}</p>
            </div>
            <div aria-label="Select game" className={styles.selector} role="group">
              <button className={game === "platformer" ? styles.active : ""} onClick={() => selectGame("platformer")} type="button">Platformer</button>
              <button className={game === "gravity" ? styles.active : ""} onClick={() => selectGame("gravity")} type="button">Gravity</button>
            </div>
          </header>

          <section className={styles.gameCard}>
            <div className={styles.canvasFrame}>
              {game === "platformer" ? <PlatformerGame resetToken={resetToken}/> : <GravityGame resetToken={resetToken}/>}
            </div>
            <footer className={styles.controls}>
              <span>{info.controls}</span>
              <button onClick={() => setResetToken((value) => value + 1)} type="button">Reset</button>
            </footer>
          </section>
        </div>
      </section>
      {mobileNav && <button aria-label="Close navigation" className="kb-backdrop" onClick={() => setMobileNav(false)} type="button"/>}
    </main>
  );
}
