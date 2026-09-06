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
type Bullet = { x: number; y: number; vx: number; vy: number };
type AimPoint = { x: number; y: number; inside: boolean };

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

type ClientPoint = { clientX: number; clientY: number };

const GRAVITY_MIN_ZOOM = 0.4;
const GRAVITY_MAX_ZOOM = 2.25;
const FIRE_HALF_ANGLE = Math.PI * 32 / 180;

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

function drawBullet(ctx: CanvasRenderingContext2D, bullet: Bullet, fill = "#ffd166", radius = 5) {
  ctx.beginPath();
  ctx.fillStyle = fill;
  ctx.arc(bullet.x, bullet.y, radius, 0, Math.PI * 2);
  ctx.fill();
}

function drawCrosshair(ctx: CanvasRenderingContext2D, aim: AimPoint, valid = true) {
  if (!aim.inside) return;
  ctx.save();
  ctx.strokeStyle = valid ? "rgba(255, 255, 255, .72)" : "rgba(255, 125, 112, .9)";
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.arc(aim.x, aim.y, 11, 0, Math.PI * 2);
  ctx.moveTo(aim.x - 17, aim.y);
  ctx.lineTo(aim.x - 6, aim.y);
  ctx.moveTo(aim.x + 6, aim.y);
  ctx.lineTo(aim.x + 17, aim.y);
  ctx.moveTo(aim.x, aim.y - 17);
  ctx.lineTo(aim.x, aim.y - 6);
  ctx.moveTo(aim.x, aim.y + 6);
  ctx.lineTo(aim.x, aim.y + 17);
  ctx.stroke();
  ctx.restore();
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
      { x: 0, y: 680, w: WIDTH, h: 40 },
      { x: 130, y: 570, w: 235, h: 20 },
      { x: 430, y: 495, w: 205, h: 20 },
      { x: 760, y: 585, w: 220, h: 20 },
      { x: 1050, y: 485, w: 225, h: 20 },
      { x: 1160, y: 350, w: 185, h: 20 },
      { x: 830, y: 315, w: 210, h: 20 },
      { x: 505, y: 245, w: 190, h: 20 },
      { x: 205, y: 325, w: 190, h: 20 },
    ];
    const spawnTemplates: EnemySpawn[] = [
      { x: 205, y: 528, w: 34, h: 42, minX: 145, maxX: 340, vx: 55 },
      { x: 820, y: 543, w: 34, h: 42, minX: 775, maxX: 950, vx: -62 },
      { x: 1110, y: 443, w: 34, h: 42, minX: 1065, maxX: 1245, vx: 58 },
      { x: 900, y: 273, w: 34, h: 42, minX: 845, maxX: 1015, vx: -50 },
      { x: 555, y: 203, w: 34, h: 42, minX: 520, maxX: 665, vx: 48 },
      { x: 255, y: 283, w: 34, h: 42, minX: 220, maxX: 375, vx: -54 },
      { x: 495, y: 453, w: 34, h: 42, minX: 445, maxX: 610, vx: 60 },
      { x: 1200, y: 308, w: 34, h: 42, minX: 1170, maxX: 1325, vx: -52 },
    ];
    const enemies: PlatformEnemy[] = [];
    const bullets: Bullet[] = [];
    const enemyBullets: Bullet[] = [];
    const player = {
      x: 55,
      y: 625,
      w: 34,
      h: 50,
      vx: 0,
      vy: 0,
      onGround: false,
      facing: 1,
      jumpsRemaining: 2,
    };
    const aim: AimPoint = { x: 240, y: 620, inside: false };
    let score = 0;
    let spawnSerial = 0;
    let nextSpawnAt = performance.now() + 3200;
    let lastShot = -Infinity;
    let lastTime = performance.now();
    let jumpQueued = false;
    let frame = 0;

    function createEnemy(spawnIndex: number, now: number): PlatformEnemy {
      const template = spawnTemplates[spawnIndex];
      return {
        ...template,
        alive: true,
        fireEvery: 1250 + spawnIndex % 3 * 260,
        nextFireAt: now + 650 + spawnIndex * 115,
        spawnIndex,
      };
    }

    for (let index = 0; index < 5; index += 1) enemies.push(createEnemy(index, lastTime));
    spawnSerial = enemies.length;

    function respawn() {
      player.x = 55;
      player.y = 625;
      player.vx = 0;
      player.vy = 0;
      player.onGround = false;
      player.jumpsRemaining = 2;
      enemyBullets.length = 0;
    }

    function shootAtAim(now: number) {
      if (now - lastShot < 145) return;
      const originX = player.x + player.w / 2;
      const originY = player.y + player.h * 0.45;
      const direction = normalizedDirection(originX, originY, aim.x, aim.y);
      bullets.push({
        x: originX + direction.x * 24,
        y: originY + direction.y * 24,
        vx: direction.x * 760,
        vy: direction.y * 760,
      });
      lastShot = now;
    }

    function spawnEnemy(now: number) {
      if (enemies.filter((enemy) => enemy.alive).length >= 8) return;
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
      shootAtAim(performance.now());
    }

    function onPointerLeave() {
      aim.inside = false;
    }

    function onKeyDown(event: KeyboardEvent) {
      if (["ArrowLeft", "ArrowRight", "ArrowUp", "Space"].includes(event.code)) event.preventDefault();
      keys.add(event.code);
      if (["ArrowUp", "KeyW", "Space"].includes(event.code) && !event.repeat) jumpQueued = true;
      if (event.code === "KeyR") respawn();
    }

    function onKeyUp(event: KeyboardEvent) {
      keys.delete(event.code);
    }

    canvas.addEventListener("pointermove", onPointerMove);
    canvas.addEventListener("pointerdown", onPointerDown);
    canvas.addEventListener("pointerleave", onPointerLeave);
    window.addEventListener("keydown", onKeyDown, { passive: false });
    window.addEventListener("keyup", onKeyUp);

    function update(dt: number, now: number) {
      const left = keys.has("ArrowLeft") || keys.has("KeyA");
      const right = keys.has("ArrowRight") || keys.has("KeyD");
      const shoot = keys.has("KeyF") || keys.has("KeyJ");

      player.vx = left === right ? 0 : left ? -300 : 300;
      if (player.vx) player.facing = Math.sign(player.vx);

      if (jumpQueued) {
        if (player.jumpsRemaining > 0) {
          player.vy = -555;
          player.onGround = false;
          player.jumpsRemaining -= 1;
        }
        jumpQueued = false;
      }
      if (shoot) shootAtAim(now);

      const previousBottom = player.y + player.h;
      player.vy += 1320 * dt;
      player.x += player.vx * dt;
      player.y += player.vy * dt;
      player.x = Math.max(0, Math.min(WIDTH - player.w, player.x));
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

      if (player.y > HEIGHT + 90) respawn();

      if (now >= nextSpawnAt) {
        spawnEnemy(now);
        nextSpawnAt = now + 3000;
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
          enemyBullets.push({
            x: originX + direction.x * 22,
            y: originY + direction.y * 22,
            vx: direction.x * 395,
            vy: direction.y * 395,
          });
          enemy.nextFireAt = now + enemy.fireEvery;
        }
      }

      for (let index = bullets.length - 1; index >= 0; index -= 1) {
        const bullet = bullets[index];
        bullet.x += bullet.vx * dt;
        bullet.y += bullet.vy * dt;
        let remove = bullet.x < -30 || bullet.x > WIDTH + 30 || bullet.y < -30 || bullet.y > HEIGHT + 30;
        for (const enemy of enemies) {
          if (!enemy.alive) continue;
          if (pointInsideRect(bullet.x, bullet.y, enemy)) {
            enemy.alive = false;
            score += 1;
            remove = true;
            break;
          }
        }
        if (remove) bullets.splice(index, 1);
      }

      for (let index = enemyBullets.length - 1; index >= 0; index -= 1) {
        const bullet = enemyBullets[index];
        bullet.x += bullet.vx * dt;
        bullet.y += bullet.vy * dt;
        let remove = bullet.x < -30 || bullet.x > WIDTH + 30 || bullet.y < -30 || bullet.y > HEIGHT + 30;

        if (!remove && rectsOverlap(player, { x: bullet.x - 4, y: bullet.y - 4, w: 8, h: 8 })) {
          remove = true;
          respawn();
        }
        if (!remove && platforms.some((platform) => pointInsideRect(bullet.x, bullet.y, platform))) remove = true;
        if (remove) enemyBullets.splice(index, 1);
      }

      for (let index = enemies.length - 1; index >= 0; index -= 1) {
        if (!enemies[index].alive) enemies.splice(index, 1);
      }
    }

    function render() {
      ctx.clearRect(0, 0, WIDTH, HEIGHT);
      ctx.fillStyle = "#101722";
      ctx.fillRect(0, 0, WIDTH, HEIGHT);

      ctx.fillStyle = "rgba(255,255,255,.035)";
      for (let x = 0; x < WIDTH; x += 60) ctx.fillRect(x, 0, 1, HEIGHT);
      for (let y = 0; y < HEIGHT; y += 60) ctx.fillRect(0, y, WIDTH, 1);

      ctx.fillStyle = "#314338";
      for (const platform of platforms) ctx.fillRect(platform.x, platform.y, platform.w, platform.h);

      ctx.fillStyle = "#d75a4a";
      for (const enemy of enemies) {
        ctx.fillRect(enemy.x, enemy.y, enemy.w, enemy.h);
        ctx.fillStyle = "rgba(255, 207, 191, .85)";
        ctx.fillRect(enemy.x + 7, enemy.y + 10, 6, 6);
        ctx.fillStyle = "#d75a4a";
      }

      bullets.forEach((bullet) => drawBullet(ctx, bullet));
      enemyBullets.forEach((bullet) => drawBullet(ctx, bullet, "#ff765f", 4.5));

      ctx.fillStyle = "#edf5ff";
      ctx.fillRect(player.x, player.y, player.w, player.h);
      ctx.strokeStyle = "#6f8197";
      ctx.lineWidth = 2;
      ctx.strokeRect(player.x, player.y, player.w, player.h);

      ctx.fillStyle = "#dfe8e2";
      ctx.font = "14px system-ui, sans-serif";
      ctx.fillText(`Score ${score} · Enemies ${enemies.length} · Jumps ${player.jumpsRemaining}`, 20, 30);
      drawCrosshair(ctx, aim);
    }

    function loop(now: number) {
      const dt = Math.min((now - lastTime) / 1000, 0.033);
      lastTime = now;
      update(dt, now);
      render();
      frame = requestAnimationFrame(loop);
    }

    frame = requestAnimationFrame(loop);
    return () => {
      cancelAnimationFrame(frame);
      canvas.removeEventListener("pointermove", onPointerMove);
      canvas.removeEventListener("pointerdown", onPointerDown);
      canvas.removeEventListener("pointerleave", onPointerLeave);
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
    const bullets: Bullet[] = [];
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
    let zoom = 1;
    const camera = clampCamera(ship.x, ship.y, WIDTH / zoom, HEIGHT / zoom);
    let lastShot = -Infinity;
    let lastTime = performance.now();
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

    function shootAtAim(now: number) {
      if (now - lastShot < 155) return;
      const direction = currentFireDirection();
      if (!direction) return;
      bullets.push({
        x: ship.x + direction.x * 24,
        y: ship.y + direction.y * 24,
        vx: ship.vx + direction.x * 760,
        vy: ship.vy + direction.y * 760,
      });
      lastShot = now;
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
      shootAtAim(performance.now());
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
      if (event.code === "KeyR") respawn();
    }

    function onKeyUp(event: KeyboardEvent) {
      keys.delete(event.code);
    }

    canvas.addEventListener("pointermove", onPointerMove);
    canvas.addEventListener("pointerdown", onPointerDown);
    canvas.addEventListener("pointerleave", onPointerLeave);
    canvas.addEventListener("wheel", onWheel, { passive: false });
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
      const shoot = keys.has("KeyF") || keys.has("Space");

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

      if (shoot) shootAtAim(now);

      if (shipCollidesWithPlanet()) respawn();
      if (ship.x < 0 || ship.x > SPACE_WORLD_WIDTH || ship.y < 0 || ship.y > SPACE_WORLD_HEIGHT) respawn();

      for (let index = bullets.length - 1; index >= 0; index -= 1) {
        const bullet = bullets[index];
        const bulletGravity = gravityAtPoint(bullet.x, bullet.y, planets);
        bullet.vx += bulletGravity.x * dt;
        bullet.vy += bulletGravity.y * dt;
        bullet.x += bullet.vx * dt;
        bullet.y += bullet.vy * dt;
        let remove = bullet.x < -50 || bullet.x > SPACE_WORLD_WIDTH + 50 || bullet.y < -50 || bullet.y > SPACE_WORLD_HEIGHT + 50;

        for (const enemy of enemies) {
          if (!enemy.alive) continue;
          const distanceSquared = (bullet.x - enemy.x) ** 2 + (bullet.y - enemy.y) ** 2;
          if (distanceSquared <= (enemy.radius + 5) ** 2) {
            enemy.alive = false;
            remove = true;
            break;
          }
        }

        if (!remove) {
          const planetIndex = findSolidPlanetIndex(planets, bullet.x, bullet.y);
          if (planetIndex >= 0) {
            const hitPlanet = planets[planetIndex];
            hitPlanet.craters.push({ x: bullet.x, y: bullet.y, radius: 48 });
            if (hitPlanet.craters.length > 160) hitPlanet.craters.shift();
            remove = true;
          }
        }

        if (remove) bullets.splice(index, 1);
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
      ctx.strokeStyle = "rgba(210, 229, 244, .42)";
      ctx.lineWidth = 1.3 / zoom;
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

    function render() {
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

      bullets.forEach((bullet) => drawBullet(ctx, bullet, "#ffd166", 5 / zoom));
      drawFireCone();
      drawShip();
      ctx.restore();

      const remaining = enemies.filter((enemy) => enemy.alive).length;
      const aimDirection = currentFireDirection();
      ctx.fillStyle = "#dfe8e2";
      ctx.font = "14px system-ui, sans-serif";
      ctx.fillText(`Targets ${enemies.length - remaining}/${enemies.length} · Zoom ${Math.round(zoom * 100)}%`, 20, 30);
      ctx.fillStyle = "#9eaaa3";
      ctx.fillText(`World ${Math.round(ship.x)}, ${Math.round(ship.y)} · wheel to zoom · fire only inside the forward arc`, 20, 52);
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
      render();
      frame = requestAnimationFrame(loop);
    }

    frame = requestAnimationFrame(loop);
    return () => {
      cancelAnimationFrame(frame);
      canvas.removeEventListener("pointermove", onPointerMove);
      canvas.removeEventListener("pointerdown", onPointerDown);
      canvas.removeEventListener("pointerleave", onPointerLeave);
      canvas.removeEventListener("wheel", onWheel);
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
    };
  }, [resetToken]);

  return <canvas aria-label="Gravity game" className={styles.canvas} height={HEIGHT} ref={canvasRef} width={WIDTH}/>;
}

const GAME_INFO: Record<GameId, { description: string; controls: string }> = {
  platformer: {
    description: "Double-jump through an arena where enemies keep arriving and fire back.",
    controls: "A/D or ←/→ move · W/↑/Space double jump · mouse aim · click or F/J shoot · R respawn",
  },
  gravity: {
    description: "Explore a zoomable space world with planetary gravity and a forward-only firing arc.",
    controls: "A/D or ←/→ rotate · W/↑ thrust · mouse aim · wheel zoom · click or F/Space shoot · R respawn",
  },
};

export default function GamesClient() {
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
