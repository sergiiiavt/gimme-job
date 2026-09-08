"use client";

import { useEffect, useRef, useState } from "react";
import { SiteSidebar } from "../site-navigation";
import {
  generateGravityBattlefield,
  generatePlatformBattlefield,
  randomBattlefieldSeed,
} from "./battlefield-generation.mjs";
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
  wrapCoordinate,
  type PlanetPhysics,
  type Rect,
} from "./game-engine";
import styles from "./games.module.css";

type GameId = "platformer" | "gravity";
type DifficultyId = "easy" | "normal" | "hard" | "impossible";
type WeaponId = "blaster" | "rocket" | "bomb";
type ProjectileTeam = "player" | "enemy";
type EnemyProjectileMode = "standard" | "phase";
type AimPoint = { x: number; y: number; inside: boolean };
type ClientPoint = { clientX: number; clientY: number };
type Projectile = {
  x: number;
  y: number;
  vx: number;
  vy: number;
  kind: WeaponId;
  bornAt: number;
  team: ProjectileTeam;
  enemyMode?: EnemyProjectileMode;
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
type SpaceEnemy = {
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
  alive: boolean;
  fireEvery: number;
  nextFireAt: number;
};
type SpaceStation = {
  x: number;
  y: number;
  radius: number;
  alive: boolean;
  health: number;
  maxHealth: number;
  fireEvery: number;
  nextFireAt: number;
};
type EnemyBase = {
  x: number;
  y: number;
  radius: number;
  alive: boolean;
  health: number;
  maxHealth: number;
  planetIndex: number;
};
type VisualPlanet = PlanetPhysics & { fill: string; edge: string };

const PLATFORM_WORLD_WIDTH = 1920;
const PLATFORM_WORLD_HEIGHT = 960;
const PLATFORM_SCALE = WIDTH / PLATFORM_WORLD_WIDTH;
const GRAVITY_BASE_ZOOM = 0.4;
const GRAVITY_MIN_ZOOM = 0.24;
const GRAVITY_MAX_ZOOM = 2.4;
const GRAVITY_TURN_SPEED = 3.45;
const GRAVITY_THRUST = 440;
const GRAVITY_PASSIVE_DRAG = 0.996;
const GRAVITY_BRAKE_DRAG = 0.94;
const GRAVITY_MAX_SPEED = 520;
const FIRE_HALF_ANGLE = Math.PI * 32 / 180;
const RESPAWN_DELAY_MS = 900;
const INVINCIBILITY_AFTER_RESPAWN_MS = 2000;

const DIFFICULTIES: Record<DifficultyId, { label: string; spawnEvery: number }> = {
  easy: { label: "Easy", spawnEvery: 4700 },
  normal: { label: "Normal", spawnEvery: 2800 },
  hard: { label: "Hard", spawnEvery: 1550 },
  impossible: { label: "Impossible", spawnEvery: 1050 },
};

const PHASE_SHOOTER_INDEXES: Record<DifficultyId, readonly number[]> = {
  easy: [2],
  normal: [1, 3, 5],
  hard: [0, 2, 4, 6, 8, 10],
  impossible: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11],
};

const WEAPON_OPTIONS: readonly { id: WeaponId; icon: string; key: string; label: string }[] = [
  { id: "blaster", icon: "●", key: "1", label: "Blaster" },
  { id: "rocket", icon: "🚀", key: "2", label: "Rocket" },
  { id: "bomb", icon: "💣", key: "3", label: "Bomb" },
];

function battlefieldId(seed: number): string {
  return seed.toString(16).padStart(8, "0").slice(-8);
}

function WeaponSelector({ weapon, onSelect }: { weapon: WeaponId; onSelect: (weapon: WeaponId) => void }) {
  return (
    <div aria-label="Weapon selector" className={styles.weaponSelector} role="group">
      {WEAPON_OPTIONS.map((option) => (
        <button
          aria-label={`${option.label} weapon`}
          aria-pressed={weapon === option.id}
          className={weapon === option.id ? styles.weaponActive : ""}
          key={option.id}
          onClick={() => onSelect(option.id)}
          title={`${option.key} · ${option.label}`}
          type="button"
        >
          <span aria-hidden="true" className={styles.weaponIcon}>{option.icon}</span>
          <small>{option.key}</small>
        </button>
      ))}
    </div>
  );
}

function DifficultyPicker({ onSelect }: { onSelect: (difficulty: DifficultyId) => void }) {
  return (
    <div
      className={styles.gameSurface}
      style={{ alignItems: "center", background: "#101722", display: "flex", justifyContent: "center" }}
    >
      <div style={{ color: "#dfe8e2", lineHeight: 1.5, maxWidth: 520, padding: 24, textAlign: "center" }}>
        <h2 style={{ fontSize: 22, margin: "0 0 6px" }}>Choose difficulty</h2>
        <p style={{ color: "#9eaaa3", fontSize: 13, margin: "0 0 18px" }}>
          Every game generates a new reachable battlefield. Reinforcements keep arriving until you clear every enemy.
        </p>
        <div aria-label="Select platformer difficulty" className={styles.selector} role="group">
          {(Object.keys(DIFFICULTIES) as DifficultyId[]).map((difficulty) => (
            <button key={difficulty} onClick={() => onSelect(difficulty)} type="button">
              {DIFFICULTIES[difficulty].label}
            </button>
          ))}
        </div>
        <p style={{ color: "#718078", fontSize: 11, margin: "14px 0 0" }}>
          Easy 4.7s / 1 phase · Normal 2.8s / 3 phase · Hard 1.55s / 6 phase · Impossible 1.05s / all phase
        </p>
      </div>
    </div>
  );
}

function VictoryOverlay({
  title,
  message,
  primaryLabel,
  onPrimary,
  secondaryLabel,
  onSecondary,
}: {
  title: string;
  message: string;
  primaryLabel: string;
  onPrimary: () => void;
  secondaryLabel?: string;
  onSecondary?: () => void;
}) {
  return (
    <div
      aria-label={`${title} dialog`}
      role="dialog"
      style={{
        alignItems: "center",
        background: "rgba(7, 11, 20, .84)",
        border: "1px solid rgba(215, 246, 90, .34)",
        borderRadius: 14,
        boxShadow: "0 18px 50px rgba(0, 0, 0, .34)",
        color: "#dfe8e2",
        display: "flex",
        flexDirection: "column",
        left: "50%",
        lineHeight: 1.35,
        minWidth: 360,
        padding: "24px 28px 22px",
        position: "absolute",
        textAlign: "center",
        top: "50%",
        transform: "translate(-50%, -50%)",
        zIndex: 5,
      }}
    >
      <h2 style={{ color: "#d7f65a", fontSize: 27, lineHeight: 1.1, margin: "0 0 10px" }}>{title}</h2>
      <p style={{ color: "#c8d3cc", fontSize: 13, lineHeight: 1.45, margin: "0 0 18px", maxWidth: 430 }}>{message}</p>
      <div className={styles.selector} role="group" aria-label={`${title} actions`}>
        <button onClick={onPrimary} type="button">{primaryLabel}</button>
        {secondaryLabel && onSecondary && (
          <button onClick={onSecondary} type="button">{secondaryLabel}</button>
        )}
      </div>
    </div>
  );
}

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

function platformEnemyShotMode(enemy: PlatformEnemy, difficulty: DifficultyId): EnemyProjectileMode {
  return PHASE_SHOOTER_INDEXES[difficulty].includes(enemy.spawnIndex) ? "phase" : "standard";
}

function selectWeapon(code: string, current: WeaponId): WeaponId {
  if (code === "Digit1") return "blaster";
  if (code === "Digit2") return "rocket";
  if (code === "Digit3") return "bomb";
  return current;
}

function projectileStyle(projectile: Projectile): { fill: string; radius: number } {
  if (projectile.team === "enemy") {
    if (projectile.enemyMode === "phase") return { fill: "#c58cff", radius: 6 };
    return { fill: "#ff665d", radius: 5 };
  }
  if (projectile.kind === "rocket") return { fill: "#ffb25b", radius: 7 };
  if (projectile.kind === "bomb") return { fill: "#d7f65a", radius: 9 };
  return { fill: "#76e8ff", radius: 4 };
}

function drawProjectile(ctx: CanvasRenderingContext2D, projectile: Projectile, scale = 1) {
  const style = projectileStyle(projectile);

  if (projectile.team === "enemy") {
    ctx.save();
    ctx.translate(projectile.x, projectile.y);
    if (projectile.enemyMode === "phase") {
      ctx.beginPath();
      ctx.fillStyle = "rgba(197, 140, 255, .22)";
      ctx.arc(0, 0, 10 / scale, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.strokeStyle = "#d8a8ff";
      ctx.lineWidth = 2.4 / scale;
      ctx.arc(0, 0, style.radius / scale, 0, Math.PI * 2);
      ctx.stroke();
      ctx.beginPath();
      ctx.fillStyle = style.fill;
      ctx.arc(0, 0, 2.3 / scale, 0, Math.PI * 2);
      ctx.fill();
    } else {
      ctx.rotate(Math.PI / 4);
      ctx.fillStyle = style.fill;
      ctx.fillRect(-style.radius / scale, -style.radius / scale, style.radius * 2 / scale, style.radius * 2 / scale);
      ctx.strokeStyle = "#ffd0ca";
      ctx.lineWidth = 1.2 / scale;
      ctx.strokeRect(-style.radius / scale, -style.radius / scale, style.radius * 2 / scale, style.radius * 2 / scale);
    }
    ctx.restore();
    return;
  }

  ctx.beginPath();
  ctx.fillStyle = style.fill;
  ctx.arc(projectile.x, projectile.y, style.radius / scale, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = "rgba(220, 249, 255, .88)";
  ctx.lineWidth = 1.4 / scale;
  ctx.stroke();

  if (projectile.kind === "rocket") {
    const speed = Math.max(1, Math.hypot(projectile.vx, projectile.vy));
    ctx.beginPath();
    ctx.strokeStyle = "rgba(255, 205, 126, .72)";
    ctx.lineWidth = 3 / scale;
    ctx.moveTo(projectile.x, projectile.y);
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

function PlatformerGame({
  resetToken,
  difficulty,
  onPlayAgain,
  onChangeDifficulty,
}: {
  resetToken: number;
  difficulty: DifficultyId;
  onPlayAgain: () => void;
  onChangeDifficulty: () => void;
}) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const weaponRef = useRef<WeaponId>("blaster");
  const [weapon, setWeapon] = useState<WeaponId>("blaster");
  const [victoryVisible, setVictoryVisible] = useState(false);

  function chooseWeapon(nextWeapon: WeaponId) {
    weaponRef.current = nextWeapon;
    setWeapon(nextWeapon);
  }

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    weaponRef.current = "blaster";
    setWeapon("blaster");
    setVictoryVisible(false);

    const battlefield = generatePlatformBattlefield(
      randomBattlefieldSeed(resetToken),
      PLATFORM_WORLD_WIDTH,
      PLATFORM_WORLD_HEIGHT,
    );
    const mapId = battlefieldId(battlefield.seed);
    const keys = new Set<string>();
    const platforms: Rect[] = battlefield.platforms;
    const spawnTemplates: EnemySpawn[] = battlefield.spawnTemplates;
    const playerSpawn = battlefield.playerSpawn;
    const enemies: PlatformEnemy[] = [];
    const projectiles: Projectile[] = [];
    const enemyProjectiles: Projectile[] = [];
    const explosions: Explosion[] = [];
    const player = {
      x: playerSpawn.x,
      y: playerSpawn.y,
      w: 30,
      h: 42,
      vx: 0,
      vy: 0,
      onGround: false,
      jumpsRemaining: 2,
    };
    const aim: AimPoint = { x: 260, y: 820, inside: false };
    const difficultyConfig = DIFFICULTIES[difficulty];
    let score = 0;
    let deaths = 0;
    let deadUntil = 0;
    let invincibleUntil = 0;
    let spawnSerial = 0;
    let nextSpawnAt = performance.now() + difficultyConfig.spawnEvery;
    let lastShot = -Infinity;
    let lastTime = performance.now();
    let jumpQueued = false;
    let pointerHeld = false;
    let won = false;
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

    function respawn(now = performance.now(), grantInvincibility = false) {
      player.x = playerSpawn.x;
      player.y = playerSpawn.y;
      player.vx = 0;
      player.vy = 0;
      player.onGround = false;
      player.jumpsRemaining = 2;
      deadUntil = 0;
      invincibleUntil = grantInvincibility ? now + INVINCIBILITY_AFTER_RESPAWN_MS : 0;
      jumpQueued = false;
      pointerHeld = false;
    }

    function die(now: number) {
      if (deadUntil !== 0 || now < invincibleUntil || won) return;
      deaths += 1;
      deadUntil = now + RESPAWN_DELAY_MS;
      player.vx = 0;
      player.vy = 0;
      player.onGround = false;
      jumpQueued = false;
      pointerHeld = false;
    }

    function weaponCooldown() {
      if (weaponRef.current === "rocket") return 650;
      if (weaponRef.current === "bomb") return 900;
      return 120;
    }

    function shootAtAim(now: number) {
      if (won || deadUntil !== 0 || !aim.inside || now - lastShot < weaponCooldown()) return;
      const originX = player.x + player.w / 2;
      const originY = player.y + player.h * 0.45;
      const direction = normalizedDirection(originX, originY, aim.x, aim.y);
      const currentWeapon = weaponRef.current;
      const speed = currentWeapon === "rocket" ? 660 : currentWeapon === "bomb" ? 470 : 1040;
      projectiles.push({
        x: originX + direction.x * 24,
        y: originY + direction.y * 24,
        vx: direction.x * speed,
        vy: direction.y * speed,
        kind: currentWeapon,
        bornAt: now,
        team: "player",
      });
      lastShot = now;
    }

    function spawnEnemy(now: number) {
      if (won || enemies.length >= 10) return;
      let spawnIndex = spawnSerial % spawnTemplates.length;
      for (let offset = 0; offset < spawnTemplates.length; offset += 1) {
        const candidate = (spawnIndex + offset) % spawnTemplates.length;
        if (!enemies.some((enemy) => enemy.spawnIndex === candidate)) {
          spawnIndex = candidate;
          break;
        }
      }
      enemies.push(createEnemy(spawnIndex, now));
      spawnSerial += 1;
    }

    function defeatEnemy(enemy: PlatformEnemy) {
      if (!enemy.alive) return;
      enemy.alive = false;
      score += 1;
    }

    function detonate(x: number, y: number, radius: number, now: number) {
      explosions.push({ x, y, radius, bornAt: now, duration: 360 });
      for (const enemy of enemies) {
        if (!enemy.alive) continue;
        const enemyX = enemy.x + enemy.w / 2;
        const enemyY = enemy.y + enemy.h / 2;
        if (Math.hypot(enemyX - x, enemyY - y) <= radius) defeatEnemy(enemy);
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
      if (deadUntil !== 0 || won) return;
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
      const nextWeapon = selectWeapon(event.code, weaponRef.current);
      if (nextWeapon !== weaponRef.current) {
        weaponRef.current = nextWeapon;
        setWeapon(nextWeapon);
      }
      if (["ArrowUp", "KeyW", "Space"].includes(event.code) && !event.repeat) jumpQueued = true;
      if (event.code === "KeyR" && deadUntil === 0) respawn(performance.now());
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
      if (deadUntil !== 0 && now >= deadUntil) respawn(now, true);
      const dead = deadUntil !== 0;
      const left = keys.has("ArrowLeft") || keys.has("KeyA");
      const right = keys.has("ArrowRight") || keys.has("KeyD");
      const keyboardShoot = keys.has("KeyF") || keys.has("KeyJ");

      if (!dead && !won) {
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
      } else {
        player.vx = 0;
        jumpQueued = false;
      }

      if (!dead) {
        const previousBottom = player.y + player.h;
        player.vy += 1580 * dt;
        player.x += player.vx * dt;
        player.y += player.vy * dt;

        const wrappedCenterX = wrapCoordinate(player.x + player.w / 2, PLATFORM_WORLD_WIDTH);
        player.x = wrappedCenterX - player.w / 2;
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

        const centerY = player.y + player.h / 2;
        if (centerY < 0 || centerY >= PLATFORM_WORLD_HEIGHT) {
          player.y = wrapCoordinate(centerY, PLATFORM_WORLD_HEIGHT) - player.h / 2;
          player.onGround = false;
        }
      }

      if (!won && now >= nextSpawnAt) {
        spawnEnemy(now);
        nextSpawnAt = now + difficultyConfig.spawnEvery;
      }

      for (const enemy of enemies) {
        if (!enemy.alive) continue;
        enemy.x += enemy.vx * dt;
        if (enemy.x <= enemy.minX || enemy.x + enemy.w >= enemy.maxX) {
          enemy.x = Math.max(enemy.minX, Math.min(enemy.maxX - enemy.w, enemy.x));
          enemy.vx *= -1;
        }
        if (!dead && !won && rectsOverlap(player, enemy)) die(now);

        if (!dead && !won && now >= enemy.nextFireAt) {
          const originX = enemy.x + enemy.w / 2;
          const originY = enemy.y + enemy.h * 0.45;
          const direction = normalizedDirection(
            originX,
            originY,
            player.x + player.w / 2,
            player.y + player.h * 0.45,
          );
          const enemyMode = platformEnemyShotMode(enemy, difficulty);
          const speed = enemyMode === "phase" ? 290 : 470;
          enemyProjectiles.push({
            x: originX + direction.x * 18,
            y: originY + direction.y * 18,
            vx: direction.x * speed,
            vy: direction.y * speed,
            kind: "blaster",
            bornAt: now,
            team: "enemy",
            enemyMode,
          });
          enemy.nextFireAt = now + enemy.fireEvery;
        }
      }

      for (let index = projectiles.length - 1; index >= 0; index -= 1) {
        const projectile = projectiles[index];
        if (projectile.kind === "bomb") projectile.vy += 560 * dt;
        projectile.x += projectile.vx * dt;
        projectile.y += projectile.vy * dt;
        let remove = projectile.x < -60
          || projectile.x > PLATFORM_WORLD_WIDTH + 60
          || projectile.y < -60
          || projectile.y > PLATFORM_WORLD_HEIGHT + 60;

        for (const enemy of enemies) {
          if (!enemy.alive || remove) continue;
          if (pointInsideRect(projectile.x, projectile.y, enemy)) {
            if (projectile.kind === "blaster") defeatEnemy(enemy);
            else detonate(projectile.x, projectile.y, projectile.kind === "rocket" ? 115 : 155, now);
            remove = true;
          }
        }

        if (!remove && platforms.some((platform) => pointInsideRect(projectile.x, projectile.y, platform))) {
          if (projectile.kind !== "blaster") {
            detonate(projectile.x, projectile.y, projectile.kind === "rocket" ? 115 : 155, now);
          }
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
        let remove = now - projectile.bornAt > 4200
          || projectile.x < -50
          || projectile.x > PLATFORM_WORLD_WIDTH + 50
          || projectile.y < -50
          || projectile.y > PLATFORM_WORLD_HEIGHT + 50;
        const hitRadius = projectileStyle(projectile).radius;
        if (!remove && !dead && !won && rectsOverlap(player, {
          x: projectile.x - hitRadius,
          y: projectile.y - hitRadius,
          w: hitRadius * 2,
          h: hitRadius * 2,
        })) {
          remove = true;
          die(now);
        }
        if (
          !remove
          && projectile.enemyMode !== "phase"
          && platforms.some((platform) => pointInsideRect(projectile.x, projectile.y, platform))
        ) remove = true;
        if (remove) enemyProjectiles.splice(index, 1);
      }

      for (let index = enemies.length - 1; index >= 0; index -= 1) {
        if (!enemies[index].alive) enemies.splice(index, 1);
      }
      for (let index = explosions.length - 1; index >= 0; index -= 1) {
        if (now - explosions[index].bornAt > explosions[index].duration) explosions.splice(index, 1);
      }

      if (!won && enemies.length === 0) {
        won = true;
        pointerHeld = false;
        enemyProjectiles.length = 0;
        setVictoryVisible(true);
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
        const shotMode = platformEnemyShotMode(enemy, difficulty);
        ctx.fillStyle = shotMode === "phase" ? "#7751b8" : "#d75a4a";
        ctx.fillRect(enemy.x, enemy.y, enemy.w, enemy.h);
        ctx.fillStyle = shotMode === "phase" ? "#e0bdff" : "rgba(255, 207, 191, .85)";
        ctx.fillRect(enemy.x + 5, enemy.y + 8, 5, 5);
        if (shotMode === "phase") {
          ctx.strokeStyle = "#c58cff";
          ctx.lineWidth = 2;
          ctx.strokeRect(enemy.x - 2, enemy.y - 2, enemy.w + 4, enemy.h + 4);
        }
      }
      projectiles.forEach((projectile) => drawProjectile(ctx, projectile));
      enemyProjectiles.forEach((projectile) => drawProjectile(ctx, projectile));
      drawExplosions(ctx, explosions, now);

      const dead = deadUntil !== 0;
      const invincible = now < invincibleUntil;
      ctx.save();
      if (dead) ctx.globalAlpha = 0.58 + Math.sin(now / 85) * 0.18;
      else if (invincible) ctx.globalAlpha = 0.68 + Math.sin(now / 90) * 0.24;
      ctx.fillStyle = dead ? "#d96c62" : invincible ? "#d7fbff" : "#edf5ff";
      ctx.fillRect(player.x, player.y, player.w, player.h);
      ctx.strokeStyle = dead ? "#ffd0c8" : invincible ? "#76e8ff" : "#6f8197";
      ctx.lineWidth = invincible ? 4 : 2;
      ctx.strokeRect(player.x, player.y, player.w, player.h);
      if (invincible) {
        ctx.beginPath();
        ctx.strokeStyle = "rgba(118, 232, 255, .72)";
        ctx.lineWidth = 3;
        ctx.arc(player.x + player.w / 2, player.y + player.h / 2, 31, 0, Math.PI * 2);
        ctx.stroke();
      }
      ctx.restore();
      drawCrosshair(ctx, aim, !dead && !won);
      ctx.restore();

      ctx.fillStyle = "#dfe8e2";
      ctx.font = "14px system-ui, sans-serif";
      ctx.fillText(
        `Difficulty ${difficultyConfig.label} · Score ${score} · Deaths ${deaths} · Enemies ${enemies.length} · Map ${mapId}`,
        20,
        30,
      );
      ctx.fillStyle = dead ? "#e89083" : invincible ? "#76e8ff" : "#9eaaa3";
      ctx.fillText(
        dead
          ? "Respawning…"
          : invincible
            ? `Invincible for ${Math.max(0, (invincibleUntil - now) / 1000).toFixed(1)}s`
            : won
              ? "Arena cleared · all reinforcements stopped"
              : `Next reinforcement in ${Math.max(0, (nextSpawnAt - now) / 1000).toFixed(1)}s`,
        20,
        52,
      );
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
  }, [difficulty, resetToken]);

  return (
    <div className={styles.gameSurface}>
      <canvas aria-label="Platformer game" className={styles.canvas} height={HEIGHT} ref={canvasRef} width={WIDTH}/>
      <WeaponSelector onSelect={chooseWeapon} weapon={weapon}/>
      {victoryVisible && (
        <VictoryOverlay
          message="You eliminated everyone before the next reinforcement."
          onPrimary={onPlayAgain}
          onSecondary={onChangeDifficulty}
          primaryLabel="Start new game"
          secondaryLabel="Change difficulty"
          title="Arena cleared"
        />
      )}
    </div>
  );
}

function GravityGame({ resetToken }: { resetToken: number }) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const weaponRef = useRef<WeaponId>("blaster");
  const [weapon, setWeapon] = useState<WeaponId>("blaster");

  function chooseWeapon(nextWeapon: WeaponId) {
    weaponRef.current = nextWeapon;
    setWeapon(nextWeapon);
  }

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    weaponRef.current = "blaster";
    setWeapon("blaster");

    const battlefield = generateGravityBattlefield(
      randomBattlefieldSeed(resetToken),
      SPACE_WORLD_WIDTH,
      SPACE_WORLD_HEIGHT,
    );
    const mapId = battlefieldId(battlefield.seed);
    const starOffsetX = battlefield.seed % 997;
    const starOffsetY = Math.floor(battlefield.seed / 997) % 991;
    const keys = new Set<string>();
    const projectiles: Projectile[] = [];
    const enemyProjectiles: Projectile[] = [];
    const explosions: Explosion[] = [];
    const planets: VisualPlanet[] = battlefield.planets.map((planet) => ({ ...planet, craters: [] }));
    const baseAngles = battlefield.baseAngles;
    const bases: EnemyBase[] = planets.map((planet, planetIndex) => {
      const angle = baseAngles[planetIndex];
      const distance = planet.radius + 30;
      return {
        x: planet.x + Math.cos(angle) * distance,
        y: planet.y + Math.sin(angle) * distance,
        radius: 28,
        alive: true,
        health: 3,
        maxHealth: 3,
        planetIndex,
      };
    });
    const enemies: SpaceEnemy[] = battlefield.enemies.map((enemy) => ({
      ...enemy,
      vx: 0,
      vy: 0,
      alive: true,
      nextFireAt: 0,
    }));
    const stations: SpaceStation[] = battlefield.stations.map((station) => ({
      ...station,
      alive: true,
      nextFireAt: 0,
    }));
    const ship = {
      x: battlefield.shipSpawn.x,
      y: battlefield.shipSpawn.y,
      vx: 0,
      vy: 0,
      angle: battlefield.shipSpawn.angle,
    };
    const aim: AimPoint = { x: WIDTH * 0.72, y: HEIGHT * 0.5, inside: false };
    let zoom = GRAVITY_BASE_ZOOM;
    const camera = clampCamera(ship.x, ship.y, WIDTH / zoom, HEIGHT / zoom);
    let deaths = 0;
    let deadUntil = 0;
    let invincibleUntil = 0;
    let lastShot = -Infinity;
    let lastTime = performance.now();
    let pointerHeld = false;
    let won = false;
    let frame = 0;

    enemies.forEach((enemy, index) => {
      enemy.nextFireAt = lastTime + 900 + index * 170;
    });
    stations.forEach((station, index) => {
      station.nextFireAt = lastTime + 700 + index * 230;
    });

    function respawn(now = performance.now(), grantInvincibility = false) {
      ship.x = battlefield.shipSpawn.x;
      ship.y = battlefield.shipSpawn.y;
      ship.vx = 0;
      ship.vy = 0;
      ship.angle = battlefield.shipSpawn.angle;
      deadUntil = 0;
      invincibleUntil = grantInvincibility ? now + INVINCIBILITY_AFTER_RESPAWN_MS : 0;
      pointerHeld = false;
      enemyProjectiles.length = 0;
      const resetCamera = clampCamera(ship.x, ship.y, WIDTH / zoom, HEIGHT / zoom);
      camera.x = resetCamera.x;
      camera.y = resetCamera.y;
    }

    function die(now: number) {
      if (deadUntil !== 0 || now < invincibleUntil || won) return;
      deaths += 1;
      deadUntil = now + RESPAWN_DELAY_MS;
      ship.vx = 0;
      ship.vy = 0;
      pointerHeld = false;
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
      if (weaponRef.current === "rocket") return 700;
      if (weaponRef.current === "bomb") return 980;
      return 145;
    }

    function shootAtAim(now: number) {
      if (won || deadUntil !== 0 || now - lastShot < weaponCooldown()) return;
      const direction = currentFireDirection();
      if (!direction) return;
      const currentWeapon = weaponRef.current;
      const speed = currentWeapon === "rocket" ? 560 : currentWeapon === "bomb" ? 310 : 780;
      projectiles.push({
        x: ship.x + direction.x * 26,
        y: ship.y + direction.y * 26,
        vx: ship.vx + direction.x * speed,
        vy: ship.vy + direction.y * speed,
        kind: currentWeapon,
        bornAt: now,
        team: "player",
      });
      lastShot = now;
    }

    function applyDamage(target: SpaceStation | EnemyBase, amount: number) {
      if (!target.alive) return;
      target.health -= amount;
      if (target.health <= 0) {
        target.health = 0;
        target.alive = false;
      }
    }

    function detonate(x: number, y: number, radius: number, now: number) {
      explosions.push({ x, y, radius, bornAt: now, duration: 420 });
      for (const enemy of enemies) {
        if (enemy.alive && Math.hypot(enemy.x - x, enemy.y - y) <= radius + enemy.radius) enemy.alive = false;
      }
      for (const station of stations) {
        if (station.alive && Math.hypot(station.x - x, station.y - y) <= radius + station.radius) applyDamage(station, 2);
      }
      for (const base of bases) {
        if (base.alive && Math.hypot(base.x - x, base.y - y) <= radius + base.radius) applyDamage(base, 2);
      }
    }

    function fireEnemyProjectile(originX: number, originY: number, speed: number, now: number) {
      const direction = normalizedDirection(originX, originY, ship.x, ship.y);
      enemyProjectiles.push({
        x: originX + direction.x * 24,
        y: originY + direction.y * 24,
        vx: direction.x * speed,
        vy: direction.y * speed,
        kind: "blaster",
        bornAt: now,
        team: "enemy",
        enemyMode: "standard",
      });
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
      if (deadUntil !== 0 || won) return;
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
      if (["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown", "Space"].includes(event.code)) event.preventDefault();
      keys.add(event.code);
      const nextWeapon = selectWeapon(event.code, weaponRef.current);
      if (nextWeapon !== weaponRef.current) {
        weaponRef.current = nextWeapon;
        setWeapon(nextWeapon);
      }
      if (event.code === "KeyR" && deadUntil === 0) respawn(performance.now());
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

    function updateThreats(dt: number, now: number, dead: boolean) {
      if (dead || won) return;

      for (const enemy of enemies) {
        if (!enemy.alive) continue;
        const direction = normalizedDirection(enemy.x, enemy.y, ship.x, ship.y);
        enemy.vx += direction.x * 92 * dt;
        enemy.vy += direction.y * 92 * dt;
        const speed = Math.hypot(enemy.vx, enemy.vy);
        if (speed > 185) {
          enemy.vx = enemy.vx / speed * 185;
          enemy.vy = enemy.vy / speed * 185;
        }
        enemy.x = wrapCoordinate(enemy.x + enemy.vx * dt, SPACE_WORLD_WIDTH);
        enemy.y = wrapCoordinate(enemy.y + enemy.vy * dt, SPACE_WORLD_HEIGHT);

        if (Math.hypot(enemy.x - ship.x, enemy.y - ship.y) <= enemy.radius + 18) die(now);
        if (now >= enemy.nextFireAt && Math.hypot(enemy.x - ship.x, enemy.y - ship.y) < 1250) {
          fireEnemyProjectile(enemy.x, enemy.y, 390, now);
          enemy.nextFireAt = now + enemy.fireEvery;
        }
      }

      for (const station of stations) {
        if (!station.alive) continue;
        if (now >= station.nextFireAt && Math.hypot(station.x - ship.x, station.y - ship.y) < 1750) {
          fireEnemyProjectile(station.x, station.y, 455, now);
          station.nextFireAt = now + station.fireEvery;
        }
      }
    }

    function update(dt: number, now: number) {
      if (deadUntil !== 0 && now >= deadUntil) respawn(now, true);
      const dead = deadUntil !== 0;
      const left = keys.has("ArrowLeft") || keys.has("KeyA");
      const right = keys.has("ArrowRight") || keys.has("KeyD");
      const thrust = keys.has("ArrowUp") || keys.has("KeyW");
      const brake = keys.has("ArrowDown") || keys.has("KeyS");
      const keyboardShoot = keys.has("KeyF") || keys.has("Space");
      let wrapped = false;

      if (!dead && !won) {
        if (left !== right) ship.angle += (left ? -1 : 1) * GRAVITY_TURN_SPEED * dt;
        if (thrust) {
          ship.vx += Math.cos(ship.angle) * GRAVITY_THRUST * dt;
          ship.vy += Math.sin(ship.angle) * GRAVITY_THRUST * dt;
        }

        const gravity = gravityAtPoint(ship.x, ship.y, planets);
        ship.vx += gravity.x * dt;
        ship.vy += gravity.y * dt;
        const drag = brake ? GRAVITY_BRAKE_DRAG : GRAVITY_PASSIVE_DRAG;
        ship.vx *= Math.pow(drag, dt * 60);
        ship.vy *= Math.pow(drag, dt * 60);
        const shipSpeed = Math.hypot(ship.vx, ship.vy);
        if (shipSpeed > GRAVITY_MAX_SPEED) {
          ship.vx = ship.vx / shipSpeed * GRAVITY_MAX_SPEED;
          ship.vy = ship.vy / shipSpeed * GRAVITY_MAX_SPEED;
        }
        ship.x += ship.vx * dt;
        ship.y += ship.vy * dt;

        const wrappedX = wrapCoordinate(ship.x, SPACE_WORLD_WIDTH);
        const wrappedY = wrapCoordinate(ship.y, SPACE_WORLD_HEIGHT);
        wrapped = wrappedX !== ship.x || wrappedY !== ship.y;
        ship.x = wrappedX;
        ship.y = wrappedY;

        if (wrapped) {
          const wrappedCamera = clampCamera(ship.x, ship.y, WIDTH / zoom, HEIGHT / zoom);
          camera.x = wrappedCamera.x;
          camera.y = wrappedCamera.y;
        }

        if (keyboardShoot || pointerHeld) shootAtAim(now);
        if (shipCollidesWithPlanet()) die(now);
      }

      updateThreats(dt, now, dead);

      for (let index = projectiles.length - 1; index >= 0; index -= 1) {
        const projectile = projectiles[index];
        const projectileGravity = gravityAtPoint(projectile.x, projectile.y, planets);
        projectile.vx += projectileGravity.x * dt;
        projectile.vy += projectileGravity.y * dt;
        projectile.x += projectile.vx * dt;
        projectile.y += projectile.vy * dt;
        let remove = now - projectile.bornAt > 5200
          || projectile.x < -100
          || projectile.x > SPACE_WORLD_WIDTH + 100
          || projectile.y < -100
          || projectile.y > SPACE_WORLD_HEIGHT + 100;

        for (const enemy of enemies) {
          if (!enemy.alive || remove) continue;
          const hitRadius = enemy.radius + projectileStyle(projectile).radius;
          if ((projectile.x - enemy.x) ** 2 + (projectile.y - enemy.y) ** 2 <= hitRadius ** 2) {
            if (projectile.kind === "blaster") enemy.alive = false;
            else detonate(projectile.x, projectile.y, projectile.kind === "rocket" ? 130 : 185, now);
            remove = true;
          }
        }

        for (const station of stations) {
          if (!station.alive || remove) continue;
          const hitRadius = station.radius + projectileStyle(projectile).radius;
          if ((projectile.x - station.x) ** 2 + (projectile.y - station.y) ** 2 <= hitRadius ** 2) {
            if (projectile.kind === "blaster") applyDamage(station, 1);
            else detonate(projectile.x, projectile.y, projectile.kind === "rocket" ? 130 : 185, now);
            remove = true;
          }
        }

        for (const base of bases) {
          if (!base.alive || remove) continue;
          const hitRadius = base.radius + projectileStyle(projectile).radius;
          if ((projectile.x - base.x) ** 2 + (projectile.y - base.y) ** 2 <= hitRadius ** 2) {
            if (projectile.kind === "blaster") applyDamage(base, 1);
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

      for (let index = enemyProjectiles.length - 1; index >= 0; index -= 1) {
        const projectile = enemyProjectiles[index];
        const projectileGravity = gravityAtPoint(projectile.x, projectile.y, planets);
        projectile.vx += projectileGravity.x * dt * 0.45;
        projectile.vy += projectileGravity.y * dt * 0.45;
        projectile.x += projectile.vx * dt;
        projectile.y += projectile.vy * dt;
        let remove = now - projectile.bornAt > 4800
          || projectile.x < -100
          || projectile.x > SPACE_WORLD_WIDTH + 100
          || projectile.y < -100
          || projectile.y > SPACE_WORLD_HEIGHT + 100;
        if (!remove && !dead && !won && Math.hypot(projectile.x - ship.x, projectile.y - ship.y) <= 18) {
          remove = true;
          die(now);
        }
        if (!remove && findSolidPlanetIndex(planets, projectile.x, projectile.y) >= 0) remove = true;
        if (remove) enemyProjectiles.splice(index, 1);
      }

      for (let index = explosions.length - 1; index >= 0; index -= 1) {
        if (now - explosions[index].bornAt > explosions[index].duration) explosions.splice(index, 1);
      }

      if (!won && bases.every((base) => !base.alive)) {
        won = true;
        pointerHeld = false;
        enemyProjectiles.length = 0;
      }

      if (!wrapped) {
        const viewportWidth = WIDTH / zoom;
        const viewportHeight = HEIGHT / zoom;
        const nextCamera = clampCamera(ship.x, ship.y, viewportWidth, viewportHeight);
        const follow = Math.min(1, dt * 5.5);
        camera.x += (nextCamera.x - camera.x) * follow;
        camera.y += (nextCamera.y - camera.y) * follow;
      }
    }

    function drawShip(now: number) {
      const dead = deadUntil !== 0;
      const invincible = now < invincibleUntil;
      ctx.save();
      ctx.translate(ship.x, ship.y);
      ctx.rotate(ship.angle);
      if (dead) ctx.globalAlpha = 0.58 + Math.sin(now / 85) * 0.18;
      else if (invincible) ctx.globalAlpha = 0.7 + Math.sin(now / 90) * 0.22;
      if (invincible) {
        ctx.beginPath();
        ctx.strokeStyle = "rgba(118, 232, 255, .76)";
        ctx.lineWidth = 2.5 / zoom;
        ctx.arc(0, 0, 29, 0, Math.PI * 2);
        ctx.stroke();
      }
      ctx.beginPath();
      ctx.moveTo(20, 0);
      ctx.lineTo(-14, -11);
      ctx.lineTo(-8, 0);
      ctx.lineTo(-14, 11);
      ctx.closePath();
      ctx.fillStyle = dead ? "#d96c62" : "#d9ecff";
      ctx.fill();
      ctx.strokeStyle = dead ? "#ffd0c8" : "#7290aa";
      ctx.lineWidth = 2 / zoom;
      ctx.stroke();
      if (!dead && (keys.has("ArrowUp") || keys.has("KeyW"))) {
        ctx.beginPath();
        ctx.moveTo(-9, -5);
        ctx.lineTo(-31, 0);
        ctx.lineTo(-9, 5);
        ctx.strokeStyle = "#f2b45b";
        ctx.stroke();
      }
      if (!dead && (keys.has("ArrowDown") || keys.has("KeyS"))) {
        ctx.beginPath();
        ctx.strokeStyle = "#76e8ff";
        ctx.lineWidth = 2 / zoom;
        ctx.moveTo(-7, -8);
        ctx.lineTo(-20, -8);
        ctx.moveTo(-7, 8);
        ctx.lineTo(-20, 8);
        ctx.stroke();
      }
      ctx.restore();
    }

    function drawFireCone(now: number) {
      if (deadUntil !== 0 || now < invincibleUntil || won) return;
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

    function drawBase(base: EnemyBase) {
      if (!base.alive) return;
      const planet = planets[base.planetIndex];
      const angle = Math.atan2(base.y - planet.y, base.x - planet.x);
      ctx.save();
      ctx.translate(base.x, base.y);
      ctx.rotate(angle);
      ctx.fillStyle = "#b9443a";
      ctx.fillRect(-22, -16, 44, 32);
      ctx.fillStyle = "#ffb15b";
      ctx.fillRect(4, -5, 18, 10);
      ctx.strokeStyle = "#ff8e80";
      ctx.lineWidth = 3 / zoom;
      ctx.strokeRect(-22, -16, 44, 32);
      ctx.restore();

      const ratio = base.health / base.maxHealth;
      ctx.fillStyle = "rgba(7,11,20,.72)";
      ctx.fillRect(base.x - 28, base.y - 38, 56, 6);
      ctx.fillStyle = "#d7f65a";
      ctx.fillRect(base.x - 28, base.y - 38, 56 * ratio, 6);
    }

    function drawStation(station: SpaceStation) {
      if (!station.alive) return;
      const stationAngle = (station.x + station.y) * 0.0007;
      ctx.save();
      ctx.translate(station.x, station.y);
      ctx.rotate(stationAngle);

      ctx.strokeStyle = "#9eafbf";
      ctx.lineWidth = 3 / zoom;
      ctx.beginPath();
      ctx.moveTo(-72, 0);
      ctx.lineTo(72, 0);
      ctx.stroke();

      ctx.fillStyle = "#315d82";
      ctx.fillRect(-70, -16, 32, 32);
      ctx.fillRect(38, -16, 32, 32);
      ctx.strokeStyle = "#78a4c4";
      ctx.lineWidth = 1.4 / zoom;
      for (const panelX of [-70, 38]) {
        ctx.strokeRect(panelX, -16, 32, 32);
        ctx.beginPath();
        ctx.moveTo(panelX + 16, -16);
        ctx.lineTo(panelX + 16, 16);
        ctx.moveTo(panelX, 0);
        ctx.lineTo(panelX + 32, 0);
        ctx.stroke();
      }

      ctx.fillStyle = "#c8d1d8";
      ctx.fillRect(-23, -12, 46, 24);
      ctx.fillStyle = "#8f9ca8";
      ctx.fillRect(-8, -21, 16, 42);
      ctx.beginPath();
      ctx.fillStyle = "#6f7e89";
      ctx.arc(0, 0, 11, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = "#dce5eb";
      ctx.lineWidth = 2 / zoom;
      ctx.stroke();

      ctx.strokeStyle = "#b7c4ce";
      ctx.beginPath();
      ctx.moveTo(0, -21);
      ctx.lineTo(0, -38);
      ctx.moveTo(0, -38);
      ctx.lineTo(12, -45);
      ctx.stroke();
      ctx.beginPath();
      ctx.fillStyle = "#ff665d";
      ctx.arc(13, -46, 4 / zoom, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();

      const ratio = station.health / station.maxHealth;
      ctx.fillStyle = "rgba(7,11,20,.72)";
      ctx.fillRect(station.x - 34, station.y + 38, 68, 6);
      ctx.fillStyle = "#d7f65a";
      ctx.fillRect(station.x - 34, station.y + 38, 68 * ratio, 6);
    }

    function drawEnemyShip(enemy: SpaceEnemy) {
      if (!enemy.alive) return;
      const angle = Math.atan2(enemy.vy, enemy.vx);
      ctx.save();
      ctx.translate(enemy.x, enemy.y);
      ctx.rotate(Number.isFinite(angle) ? angle : 0);
      ctx.beginPath();
      ctx.moveTo(18, 0);
      ctx.lineTo(-12, -10);
      ctx.lineTo(-7, 0);
      ctx.lineTo(-12, 10);
      ctx.closePath();
      ctx.fillStyle = "#d75a4a";
      ctx.fill();
      ctx.strokeStyle = "#ff9a8d";
      ctx.lineWidth = 2 / zoom;
      ctx.stroke();
      ctx.restore();
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
        const x = (index * 379 + 97 + starOffsetX) % SPACE_WORLD_WIDTH;
        const y = (index * 211 + 53 + starOffsetY) % SPACE_WORLD_HEIGHT;
        const size = index % 11 === 0 ? 2 : 1;
        ctx.fillRect(x, y, size / zoom, size / zoom);
      }

      planets.forEach((planet) => drawPlanet(planet));
      bases.forEach((base) => drawBase(base));
      stations.forEach((station) => drawStation(station));
      enemies.forEach((enemy) => drawEnemyShip(enemy));
      projectiles.forEach((projectile) => drawProjectile(ctx, projectile, zoom));
      enemyProjectiles.forEach((projectile) => drawProjectile(ctx, projectile, zoom));
      drawExplosions(ctx, explosions, now, zoom);
      drawFireCone(now);
      drawShip(now);
      ctx.restore();

      const basesRemaining = bases.filter((base) => base.alive).length;
      const threatsRemaining = enemies.filter((enemy) => enemy.alive).length
        + stations.filter((station) => station.alive).length;
      const dead = deadUntil !== 0;
      const invincible = now < invincibleUntil;
      const aimDirection = dead || won ? null : currentFireDirection();
      const displayZoom = Math.round(zoom / GRAVITY_BASE_ZOOM * 100);
      ctx.fillStyle = "#dfe8e2";
      ctx.font = "14px system-ui, sans-serif";
      ctx.fillText(
        `Bases ${bases.length - basesRemaining}/${bases.length} · Threats ${threatsRemaining} · Deaths ${deaths} · Zoom ${displayZoom}% · Map ${mapId}`,
        20,
        30,
      );
      ctx.fillStyle = dead ? "#e89083" : invincible ? "#76e8ff" : "#9eaaa3";
      ctx.fillText(
        dead
          ? "Respawning…"
          : invincible
            ? `Invincible for ${Math.max(0, (invincibleUntil - now) / 1000).toFixed(1)}s`
            : won
              ? "All planetary bases destroyed"
              : `Enemy ships pursue you · orbital stations fire on approach · World ${Math.round(ship.x)}, ${Math.round(ship.y)}`,
        20,
        52,
      );
      if (!dead && !won && aim.inside && !aimDirection) {
        ctx.fillStyle = "#e89083";
        ctx.fillText("Aim outside firing arc", 20, 74);
      }
      drawCrosshair(ctx, aim, !dead && !won && Boolean(aimDirection));

      if (won) {
        ctx.fillStyle = "rgba(7, 11, 20, .80)";
        ctx.fillRect(WIDTH / 2 - 250, HEIGHT / 2 - 58, 500, 116);
        ctx.fillStyle = "#d7f65a";
        ctx.font = "700 27px system-ui, sans-serif";
        ctx.textAlign = "center";
        ctx.fillText("System secured", WIDTH / 2, HEIGHT / 2 - 7);
        ctx.fillStyle = "#dfe8e2";
        ctx.font = "14px system-ui, sans-serif";
        ctx.fillText("Every enemy base on every planet has been destroyed.", WIDTH / 2, HEIGHT / 2 + 25);
        ctx.textAlign = "start";
      }
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

  return (
    <div className={styles.gameSurface}>
      <canvas aria-label="Gravity game" className={styles.canvas} height={HEIGHT} ref={canvasRef} width={WIDTH}/>
      <WeaponSelector onSelect={chooseWeapon} weapon={weapon}/>
    </div>
  );
}

const GAME_INFO: Record<GameId, { description: string; controls: string }> = {
  platformer: {
    description: "Each game builds a new reachable platform battlefield; clear every enemy before the next reinforcement arrives.",
    controls: "A/D or ←/→ move · W/↑/Space double jump · hold mouse to fire · purple enemies fire phase bolts through platforms · 1/2/3 weapons · clear all enemies to win · R respawn",
  },
  gravity: {
    description: "Each game builds a new planetary battlefield with safe spacing, hostile ships, stations, and one base per planet.",
    controls: "A/D or ←/→ rotate · W/↑ thrust · S/↓ brake · assisted drag and speed cap · wheel zoom · hold mouse to fire · 1/2/3 weapons · destroy all planetary bases to win · R respawn",
  },
};

export default function GamesPlayground() {
  const [mobileNav, setMobileNav] = useState(false);
  const [game, setGame] = useState<GameId>("platformer");
  const [difficulty, setDifficulty] = useState<DifficultyId | null>(null);
  const [resetToken, setResetToken] = useState(0);
  const info = GAME_INFO[game];

  function selectGame(next: GameId) {
    setGame(next);
    if (next === "platformer") setDifficulty(null);
    setResetToken((value) => value + 1);
  }

  function selectDifficulty(next: DifficultyId) {
    setDifficulty(next);
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
        <button
          aria-expanded={mobileNav}
          aria-label="Toggle navigation"
          className="kb-floating-menu"
          onClick={() => setMobileNav((value) => !value)}
          type="button"
        >☰</button>
        <div className={`kb-content ${styles.page}`}>
          <header className={styles.header}>
            <div>
              <h1>Games</h1>
              <p>{info.description}</p>
            </div>
            <div aria-label="Select game" className={styles.selector} role="group">
              <button
                className={game === "platformer" ? styles.active : ""}
                onClick={() => selectGame("platformer")}
                type="button"
              >Platformer</button>
              <button
                className={game === "gravity" ? styles.active : ""}
                onClick={() => selectGame("gravity")}
                type="button"
              >Gravity</button>
            </div>
          </header>

          <section className={styles.gameCard}>
            <div className={styles.canvasFrame}>
              {game === "platformer"
                ? difficulty
                  ? (
                    <PlatformerGame
                      difficulty={difficulty}
                      onChangeDifficulty={() => setDifficulty(null)}
                      onPlayAgain={() => setResetToken((value) => value + 1)}
                      resetToken={resetToken}
                    />
                  )
                  : <DifficultyPicker onSelect={selectDifficulty}/>
                : <GravityGame resetToken={resetToken}/>}
            </div>
            <footer className={styles.controls}>
              <span>{game === "platformer" && !difficulty ? "Select difficulty to start." : info.controls}</span>
              <div style={{ display: "flex", gap: 7 }}>
                {game === "platformer" && difficulty && (
                  <button onClick={() => setDifficulty(null)} type="button">Difficulty</button>
                )}
                {(game === "gravity" || difficulty) && (
                  <button onClick={() => setResetToken((value) => value + 1)} type="button">New battlefield</button>
                )}
              </div>
            </footer>
          </section>
        </div>
      </section>
      {mobileNav && (
        <button
          aria-label="Close navigation"
          className="kb-backdrop"
          onClick={() => setMobileNav(false)}
          type="button"
        />
      )}
    </main>
  );
}
