"use client";

import { useEffect, useRef, useState } from "react";
import { SiteSidebar } from "../site-navigation";
import {
  TERRAIN_CELL,
  TERRAIN_COLUMNS,
  TERRAIN_ROWS,
  WORLD_HEIGHT as HEIGHT,
  WORLD_WIDTH as WIDTH,
  carveTerrain,
  createTerrain,
  isTerrainSolid,
  rectsOverlap,
  terrainIndex,
  terrainSurfaceRow,
  type Rect,
} from "./game-engine";
import styles from "./games.module.css";

type GameId = "platformer" | "gravity";
type Bullet = { x: number; y: number; vx: number; vy: number };

type PlatformEnemy = Rect & {
  alive: boolean;
  minX: number;
  maxX: number;
  vx: number;
};

type SpaceEnemy = { x: number; y: number; radius: number; alive: boolean };

function drawPlatformerPlayer(ctx: CanvasRenderingContext2D, player: Rect) {
  ctx.fillStyle = "#edf5ff";
  ctx.fillRect(player.x, player.y, player.w, player.h);
  ctx.strokeStyle = "#182339";
  ctx.lineWidth = 2;
  ctx.strokeRect(player.x, player.y, player.w, player.h);
}

function drawPlatform(ctx: CanvasRenderingContext2D, platform: Rect) {
  ctx.fillStyle = "#314338";
  ctx.fillRect(platform.x, platform.y, platform.w, platform.h);
}

function drawPlatformEnemy(ctx: CanvasRenderingContext2D, enemy: PlatformEnemy) {
  ctx.fillStyle = "#d75a4a";
  ctx.fillRect(enemy.x, enemy.y, enemy.w, enemy.h);
}

function drawBullet(ctx: CanvasRenderingContext2D, bullet: Bullet) {
  ctx.beginPath();
  ctx.fillStyle = "#ffd166";
  ctx.arc(bullet.x, bullet.y, 4, 0, Math.PI * 2);
  ctx.fill();
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
      { x: 0, y: 500, w: WIDTH, h: 40 },
      { x: 105, y: 415, w: 185, h: 18 },
      { x: 355, y: 350, w: 165, h: 18 },
      { x: 600, y: 420, w: 160, h: 18 },
      { x: 765, y: 310, w: 150, h: 18 },
      { x: 475, y: 245, w: 150, h: 18 },
      { x: 225, y: 235, w: 130, h: 18 },
    ];
    const enemies: PlatformEnemy[] = [
      { x: 185, y: 381, w: 28, h: 34, alive: true, minX: 120, maxX: 250, vx: 45 },
      { x: 650, y: 386, w: 28, h: 34, alive: true, minX: 615, maxX: 720, vx: -52 },
      { x: 815, y: 276, w: 28, h: 34, alive: true, minX: 780, maxX: 875, vx: 48 },
      { x: 520, y: 211, w: 28, h: 34, alive: true, minX: 490, maxX: 590, vx: -42 },
    ];
    const bullets: Bullet[] = [];
    const player = { x: 35, y: 440, w: 30, h: 42, vx: 0, vy: 0, onGround: false, facing: 1 };
    let score = 0;
    let lastShot = -Infinity;
    let lastTime = performance.now();
    let frame = 0;

    function respawn() {
      player.x = 35;
      player.y = 440;
      player.vx = 0;
      player.vy = 0;
      player.onGround = false;
    }

    function onKeyDown(event: KeyboardEvent) {
      if (["ArrowLeft", "ArrowRight", "ArrowUp", "Space"].includes(event.code)) event.preventDefault();
      keys.add(event.code);
      if (event.code === "KeyR") respawn();
    }

    function onKeyUp(event: KeyboardEvent) {
      keys.delete(event.code);
    }

    window.addEventListener("keydown", onKeyDown, { passive: false });
    window.addEventListener("keyup", onKeyUp);

    function update(dt: number, now: number) {
      const left = keys.has("ArrowLeft") || keys.has("KeyA");
      const right = keys.has("ArrowRight") || keys.has("KeyD");
      const jump = keys.has("ArrowUp") || keys.has("KeyW") || keys.has("Space");
      const shoot = keys.has("KeyF") || keys.has("KeyJ");

      player.vx = left === right ? 0 : left ? -235 : 235;
      if (player.vx) player.facing = Math.sign(player.vx);
      if (jump && player.onGround) {
        player.vy = -480;
        player.onGround = false;
      }
      if (shoot && now - lastShot > 180) {
        bullets.push({
          x: player.x + player.w / 2 + player.facing * 20,
          y: player.y + player.h * 0.45,
          vx: player.facing * 570,
          vy: 0,
        });
        lastShot = now;
      }

      const previousBottom = player.y + player.h;
      player.vy += 1180 * dt;
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
            break;
          }
        }
      }

      if (player.y > HEIGHT + 80) respawn();

      for (const enemy of enemies) {
        if (!enemy.alive) continue;
        enemy.x += enemy.vx * dt;
        if (enemy.x <= enemy.minX || enemy.x + enemy.w >= enemy.maxX) {
          enemy.x = Math.max(enemy.minX, Math.min(enemy.maxX - enemy.w, enemy.x));
          enemy.vx *= -1;
        }
        if (rectsOverlap(player, enemy)) respawn();
      }

      for (let index = bullets.length - 1; index >= 0; index -= 1) {
        const bullet = bullets[index];
        bullet.x += bullet.vx * dt;
        bullet.y += bullet.vy * dt;
        let remove = bullet.x < -20 || bullet.x > WIDTH + 20;
        for (const enemy of enemies) {
          if (!enemy.alive) continue;
          if (bullet.x >= enemy.x && bullet.x <= enemy.x + enemy.w && bullet.y >= enemy.y && bullet.y <= enemy.y + enemy.h) {
            enemy.alive = false;
            score += 1;
            remove = true;
            break;
          }
        }
        if (remove) bullets.splice(index, 1);
      }
    }

    function render() {
      ctx.clearRect(0, 0, WIDTH, HEIGHT);
      ctx.fillStyle = "#101722";
      ctx.fillRect(0, 0, WIDTH, HEIGHT);

      ctx.fillStyle = "rgba(255,255,255,.035)";
      for (let x = 0; x < WIDTH; x += 48) ctx.fillRect(x, 0, 1, HEIGHT);
      for (let y = 0; y < HEIGHT; y += 48) ctx.fillRect(0, y, WIDTH, 1);

      platforms.forEach((platform) => drawPlatform(ctx, platform));
      enemies.filter((enemy) => enemy.alive).forEach((enemy) => drawPlatformEnemy(ctx, enemy));
      bullets.forEach((bullet) => drawBullet(ctx, bullet));
      drawPlatformerPlayer(ctx, player);

      ctx.fillStyle = "#dfe8e2";
      ctx.font = "13px system-ui, sans-serif";
      ctx.fillText(`Targets ${score}/${enemies.length}`, 18, 26);
      if (score === enemies.length) {
        ctx.font = "600 20px system-ui, sans-serif";
        ctx.fillText("Area clear", WIDTH / 2 - 48, 54);
      }
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
    const terrain = createTerrain();
    const bullets: Bullet[] = [];
    const enemies: SpaceEnemy[] = [];
    const ship = { x: 225, y: 145, vx: 0, vy: 0, angle: -Math.PI / 2 };
    let lastShot = -Infinity;
    let lastTime = performance.now();
    let frame = 0;

    for (const column of [46, 66, 84]) {
      enemies.push({
        x: column * TERRAIN_CELL + TERRAIN_CELL / 2,
        y: terrainSurfaceRow(column) * TERRAIN_CELL - 12,
        radius: 11,
        alive: true,
      });
    }

    function respawn() {
      ship.x = 225;
      ship.y = 145;
      ship.vx = 0;
      ship.vy = 0;
      ship.angle = -Math.PI / 2;
    }

    function onKeyDown(event: KeyboardEvent) {
      if (["ArrowLeft", "ArrowRight", "ArrowUp", "Space"].includes(event.code)) event.preventDefault();
      keys.add(event.code);
      if (event.code === "KeyR") respawn();
    }

    function onKeyUp(event: KeyboardEvent) {
      keys.delete(event.code);
    }

    window.addEventListener("keydown", onKeyDown, { passive: false });
    window.addEventListener("keyup", onKeyUp);

    function update(dt: number, now: number) {
      const left = keys.has("ArrowLeft") || keys.has("KeyA");
      const right = keys.has("ArrowRight") || keys.has("KeyD");
      const thrust = keys.has("ArrowUp") || keys.has("KeyW");
      const shoot = keys.has("KeyF") || keys.has("Space");

      if (left !== right) ship.angle += (left ? -1 : 1) * 2.55 * dt;
      if (thrust) {
        ship.vx += Math.cos(ship.angle) * 330 * dt;
        ship.vy += Math.sin(ship.angle) * 330 * dt;
      }
      ship.vy += 118 * dt;
      ship.vx *= Math.pow(0.995, dt * 60);
      ship.vy *= Math.pow(0.998, dt * 60);
      ship.x += ship.vx * dt;
      ship.y += ship.vy * dt;

      if (shoot && now - lastShot > 190) {
        bullets.push({
          x: ship.x + Math.cos(ship.angle) * 18,
          y: ship.y + Math.sin(ship.angle) * 18,
          vx: ship.vx + Math.cos(ship.angle) * 590,
          vy: ship.vy + Math.sin(ship.angle) * 590,
        });
        lastShot = now;
      }

      const noseX = ship.x + Math.cos(ship.angle) * 15;
      const noseY = ship.y + Math.sin(ship.angle) * 15;
      const sideAngle = ship.angle + Math.PI / 2;
      const leftX = ship.x + Math.cos(sideAngle) * 9;
      const leftY = ship.y + Math.sin(sideAngle) * 9;
      const rightX = ship.x - Math.cos(sideAngle) * 9;
      const rightY = ship.y - Math.sin(sideAngle) * 9;
      if (
        isTerrainSolid(terrain, ship.x, ship.y)
        || isTerrainSolid(terrain, noseX, noseY)
        || isTerrainSolid(terrain, leftX, leftY)
        || isTerrainSolid(terrain, rightX, rightY)
      ) {
        respawn();
      }
      if (ship.x < -30 || ship.x > WIDTH + 30 || ship.y < -100 || ship.y > HEIGHT + 40) respawn();

      for (let index = bullets.length - 1; index >= 0; index -= 1) {
        const bullet = bullets[index];
        bullet.vy += 25 * dt;
        bullet.x += bullet.vx * dt;
        bullet.y += bullet.vy * dt;
        let remove = bullet.x < -20 || bullet.x > WIDTH + 20 || bullet.y < -40 || bullet.y > HEIGHT + 20;

        for (const enemy of enemies) {
          if (!enemy.alive) continue;
          const distanceSquared = (bullet.x - enemy.x) ** 2 + (bullet.y - enemy.y) ** 2;
          if (distanceSquared <= (enemy.radius + 4) ** 2) {
            enemy.alive = false;
            remove = true;
            break;
          }
        }

        if (!remove && isTerrainSolid(terrain, bullet.x, bullet.y)) {
          carveTerrain(terrain, bullet.x, bullet.y, 31);
          remove = true;
        }
        if (remove) bullets.splice(index, 1);
      }
    }

    function drawShip() {
      ctx.save();
      ctx.translate(ship.x, ship.y);
      ctx.rotate(ship.angle);
      ctx.beginPath();
      ctx.moveTo(18, 0);
      ctx.lineTo(-12, -10);
      ctx.lineTo(-7, 0);
      ctx.lineTo(-12, 10);
      ctx.closePath();
      ctx.fillStyle = "#d9ecff";
      ctx.fill();
      ctx.strokeStyle = "#5f819c";
      ctx.lineWidth = 2;
      ctx.stroke();
      if (keys.has("ArrowUp") || keys.has("KeyW")) {
        ctx.beginPath();
        ctx.moveTo(-8, -5);
        ctx.lineTo(-28, 0);
        ctx.lineTo(-8, 5);
        ctx.strokeStyle = "#f2b45b";
        ctx.stroke();
      }
      ctx.restore();
    }

    function render() {
      ctx.clearRect(0, 0, WIDTH, HEIGHT);
      ctx.fillStyle = "#070b14";
      ctx.fillRect(0, 0, WIDTH, HEIGHT);

      ctx.fillStyle = "rgba(255,255,255,.38)";
      for (let index = 0; index < 55; index += 1) {
        const x = (index * 173) % WIDTH;
        const y = (index * 79) % 300;
        ctx.fillRect(x, y, index % 5 === 0 ? 2 : 1, index % 5 === 0 ? 2 : 1);
      }

      ctx.fillStyle = "#26382f";
      for (let row = 0; row < TERRAIN_ROWS; row += 1) {
        for (let column = 0; column < TERRAIN_COLUMNS; column += 1) {
          if (terrain[terrainIndex(column, row)]) {
            ctx.fillRect(column * TERRAIN_CELL, row * TERRAIN_CELL, TERRAIN_CELL + 0.5, TERRAIN_CELL + 0.5);
          }
        }
      }

      for (const enemy of enemies) {
        if (!enemy.alive) continue;
        ctx.beginPath();
        ctx.fillStyle = "#d75a4a";
        ctx.arc(enemy.x, enemy.y, enemy.radius, 0, Math.PI * 2);
        ctx.fill();
      }
      bullets.forEach((bullet) => drawBullet(ctx, bullet));
      drawShip();

      const remaining = enemies.filter((enemy) => enemy.alive).length;
      ctx.fillStyle = "#dfe8e2";
      ctx.font = "13px system-ui, sans-serif";
      ctx.fillText(`Targets ${enemies.length - remaining}/${enemies.length}`, 18, 26);
      ctx.fillStyle = "#9eaaa3";
      ctx.fillText("Terrain is destructible", 18, 46);
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
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
    };
  }, [resetToken]);

  return <canvas aria-label="Gravity game" className={styles.canvas} height={HEIGHT} ref={canvasRef} width={WIDTH}/>;
}

const GAME_INFO: Record<GameId, { description: string; controls: string }> = {
  platformer: {
    description: "Jump between platforms and clear the moving targets.",
    controls: "A/D or ←/→ move · W/↑/Space jump · F/J shoot · R respawn",
  },
  gravity: {
    description: "Fly with thrust and gravity. Shots remove terrain and open new paths.",
    controls: "A/D or ←/→ rotate · W/↑ thrust · F/Space shoot · R respawn",
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
