from pathlib import Path

source_path = Path("app/games/games-playground.tsx")
tests_path = Path("tests/games-playground.test.mjs")
source = source_path.read_text()
tests = tests_path.read_text()


def replace_once(text: str, old: str, new: str, label: str) -> str:
    if old not in text:
        raise SystemExit(f"Missing source pattern: {label}")
    return text.replace(old, new, 1)


source = replace_once(
    source,
    'type DifficultyId = "easy" | "normal" | "hard";',
    'type DifficultyId = "easy" | "normal" | "hard" | "impossible";',
    "difficulty type",
)
source = replace_once(
    source,
    'const RESPAWN_DELAY_MS = 900;',
    'const RESPAWN_DELAY_MS = 900;\nconst INVINCIBILITY_AFTER_RESPAWN_MS = 2000;',
    "invincibility constant",
)
source = replace_once(
    source,
    '''const DIFFICULTIES: Record<DifficultyId, { label: string; spawnEvery: number }> = {
  easy: { label: "Easy", spawnEvery: 4700 },
  normal: { label: "Normal", spawnEvery: 2800 },
  hard: { label: "Hard", spawnEvery: 1550 },
};''',
    '''const DIFFICULTIES: Record<DifficultyId, { label: string; spawnEvery: number }> = {
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
};''',
    "difficulty configuration",
)
source = replace_once(
    source,
    '''function platformEnemyShotMode(enemy: PlatformEnemy): EnemyProjectileMode {
  return enemy.spawnIndex % 3 === 2 ? "phase" : "standard";
}''',
    '''function platformEnemyShotMode(enemy: PlatformEnemy, difficulty: DifficultyId): EnemyProjectileMode {
  return PHASE_SHOOTER_INDEXES[difficulty].includes(enemy.spawnIndex) ? "phase" : "standard";
}''',
    "phase shooter selection",
)
source = replace_once(
    source,
    'Easy 4.7s · Normal 2.8s · Hard 1.55s between reinforcements',
    'Easy 4.7s / 1 phase · Normal 2.8s / 3 phase · Hard 1.55s / 6 phase · Impossible 1.05s / all phase',
    "difficulty helper text",
)
if source.count('let deadUntil = 0;') != 2:
    raise SystemExit("Expected exactly two deadUntil declarations")
source = source.replace('let deadUntil = 0;', 'let deadUntil = 0;\n    let invincibleUntil = 0;')
source = replace_once(
    source,
    '''    function respawn() {
      player.x = 45;
      player.y = 865;
      player.vx = 0;
      player.vy = 0;
      player.onGround = false;
      player.jumpsRemaining = 2;
      deadUntil = 0;
      jumpQueued = false;
      pointerHeld = false;
    }''',
    '''    function respawn(now = performance.now(), grantInvincibility = false) {
      player.x = 45;
      player.y = 865;
      player.vx = 0;
      player.vy = 0;
      player.onGround = false;
      player.jumpsRemaining = 2;
      deadUntil = 0;
      invincibleUntil = grantInvincibility ? now + INVINCIBILITY_AFTER_RESPAWN_MS : 0;
      jumpQueued = false;
      pointerHeld = false;
    }''',
    "platformer respawn",
)
source = replace_once(
    source,
    '''    function respawn() {
      ship.x = 700;
      ship.y = 650;
      ship.vx = 0;
      ship.vy = 0;
      ship.angle = -Math.PI / 2;
      deadUntil = 0;
      pointerHeld = false;
      enemyProjectiles.length = 0;
      const resetCamera = clampCamera(ship.x, ship.y, WIDTH / zoom, HEIGHT / zoom);
      camera.x = resetCamera.x;
      camera.y = resetCamera.y;
    }''',
    '''    function respawn(now = performance.now(), grantInvincibility = false) {
      ship.x = 700;
      ship.y = 650;
      ship.vx = 0;
      ship.vy = 0;
      ship.angle = -Math.PI / 2;
      deadUntil = 0;
      invincibleUntil = grantInvincibility ? now + INVINCIBILITY_AFTER_RESPAWN_MS : 0;
      pointerHeld = false;
      enemyProjectiles.length = 0;
      const resetCamera = clampCamera(ship.x, ship.y, WIDTH / zoom, HEIGHT / zoom);
      camera.x = resetCamera.x;
      camera.y = resetCamera.y;
    }''',
    "gravity respawn",
)
if source.count('if (deadUntil !== 0 || won) return;') != 2:
    raise SystemExit("Expected exactly two die guards")
source = source.replace('if (deadUntil !== 0 || won) return;', 'if (deadUntil !== 0 || now < invincibleUntil || won) return;')
if source.count('if (event.code === "KeyR" && deadUntil === 0) respawn();') != 2:
    raise SystemExit("Expected exactly two manual respawns")
source = source.replace('if (event.code === "KeyR" && deadUntil === 0) respawn();', 'if (event.code === "KeyR" && deadUntil === 0) respawn(performance.now());')
if source.count('if (deadUntil !== 0 && now >= deadUntil) respawn();') != 2:
    raise SystemExit("Expected exactly two automatic respawns")
source = source.replace('if (deadUntil !== 0 && now >= deadUntil) respawn();', 'if (deadUntil !== 0 && now >= deadUntil) respawn(now, true);')
if source.count('platformEnemyShotMode(enemy)') != 2:
    raise SystemExit("Expected exactly two platform phase mode calls")
source = source.replace('platformEnemyShotMode(enemy)', 'platformEnemyShotMode(enemy, difficulty)')
source = replace_once(
    source,
    '''      const dead = deadUntil !== 0;
      ctx.save();
      if (dead) ctx.globalAlpha = 0.58 + Math.sin(now / 85) * 0.18;
      ctx.fillStyle = dead ? "#d96c62" : "#edf5ff";
      ctx.fillRect(player.x, player.y, player.w, player.h);
      ctx.strokeStyle = dead ? "#ffd0c8" : "#6f8197";
      ctx.lineWidth = 2;
      ctx.strokeRect(player.x, player.y, player.w, player.h);
      ctx.restore();''',
    '''      const dead = deadUntil !== 0;
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
      ctx.restore();''',
    "platformer invincibility visual",
)
source = replace_once(
    source,
    '''      ctx.fillStyle = dead ? "#e89083" : "#9eaaa3";
      ctx.fillText(
        dead
          ? "Respawning…"
          : won
            ? "Arena cleared · all reinforcements stopped"
            : `Next reinforcement in ${Math.max(0, (nextSpawnAt - now) / 1000).toFixed(1)}s`,
        20,
        52,
      );''',
    '''      ctx.fillStyle = dead ? "#e89083" : invincible ? "#76e8ff" : "#9eaaa3";
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
      );''',
    "platformer invincibility status",
)
source = replace_once(
    source,
    '''    function drawShip(now: number) {
      const dead = deadUntil !== 0;
      ctx.save();
      ctx.translate(ship.x, ship.y);
      ctx.rotate(ship.angle);
      if (dead) ctx.globalAlpha = 0.58 + Math.sin(now / 85) * 0.18;''',
    '''    function drawShip(now: number) {
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
      }''',
    "gravity invincibility visual",
)
source = replace_once(
    source,
    '''      const dead = deadUntil !== 0;
      const aimDirection = dead || won ? null : currentFireDirection();''',
    '''      const dead = deadUntil !== 0;
      const invincible = now < invincibleUntil;
      const aimDirection = dead || won ? null : currentFireDirection();''',
    "gravity invincibility state",
)
source = replace_once(
    source,
    '''      ctx.fillStyle = dead ? "#e89083" : "#9eaaa3";
      ctx.fillText(
        dead
          ? "Respawning…"
          : won
            ? "All planetary bases destroyed"
            : `Enemy ships pursue you · orbital stations fire on approach · World ${Math.round(ship.x)}, ${Math.round(ship.y)}`,
        20,
        52,
      );''',
    '''      ctx.fillStyle = dead ? "#e89083" : invincible ? "#76e8ff" : "#9eaaa3";
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
      );''',
    "gravity invincibility status",
)

tests = replace_once(
    tests,
    'assert.match(source, /type DifficultyId = "easy" \\| "normal" \\| "hard";/);',
    'assert.match(source, /type DifficultyId = "easy" \\| "normal" \\| "hard" \\| "impossible";/);',
    "difficulty type test",
)
tests = replace_once(
    tests,
    '  assert.match(source, /hard: \\{ label: "Hard", spawnEvery: 1550 \\}/);',
    '  assert.match(source, /hard: \\{ label: "Hard", spawnEvery: 1550 \\}/);\n  assert.match(source, /impossible: \\{ label: "Impossible", spawnEvery: 1050 \\}/);',
    "impossible cadence test",
)
tests = replace_once(
    tests,
    '''test("platformer phase shooters fire slower bolts that pass through platforms", () => {
  assert.match(source, /function platformEnemyShotMode/);
  assert.match(source, /enemy\\.spawnIndex % 3 === 2 \\? "phase" : "standard"/);
  assert.match(source, /const speed = enemyMode === "phase" \\? 290 : 470/);
  assert.match(source, /projectile\\.enemyMode !== "phase"/);
  assert.match(source, /purple enemies fire phase bolts through platforms/);
});''',
    '''test("platformer phase shooters scale by difficulty and phase bolts pass through platforms", () => {
  assert.match(source, /function platformEnemyShotMode/);
  assert.match(source, /easy: \\[2\\]/);
  assert.match(source, /normal: \\[1, 3, 5\\]/);
  assert.match(source, /hard: \\[0, 2, 4, 6, 8, 10\\]/);
  assert.match(source, /impossible: \\[0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11\\]/);
  assert.match(source, /platformEnemyShotMode\\(enemy, difficulty\\)/);
  assert.match(source, /const speed = enemyMode === "phase" \\? 290 : 470/);
  assert.match(source, /projectile\\.enemyMode !== "phase"/);
});''',
    "phase difficulty test",
)
tests += '''\n\ntest("both games grant two seconds of invincibility after automatic respawn", () => {
  assert.match(source, /const INVINCIBILITY_AFTER_RESPAWN_MS = 2000;/);
  assert.equal((source.match(/let invincibleUntil = 0;/g) ?? []).length, 2);
  assert.equal((source.match(/respawn\\(now, true\\)/g) ?? []).length, 2);
  assert.equal((source.match(/now < invincibleUntil/g) ?? []).length >= 4, true);
  assert.equal((source.match(/Invincible for/g) ?? []).length, 2);
});\n'''

source_path.write_text(source)
tests_path.write_text(tests)
