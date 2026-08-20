export const REWILD_STORAGE_KEY = "gimmejob.rewild.best.v1";

export const REWILD_BASELINE = Object.freeze({
  sunlightStart: 120,
  houseHp: 100,
  firstWaveSeconds: 24,
  sunlightPerSecond: 1,
  sunbloomPerSecond: 2,
  rootReclaimSeconds: 3.7,
  popupDisableSeconds: 3.2,
  popupAbilityCooldown: 5,
  enemyAttackCooldown: 1,
  houseAttackCooldown: .85,
  pathRefreshSeconds: 1.1,
  siegeBossWave: 5,
  winScore: 1000,
  houseHealthScoreMultiplier: 5,
});

export const REWILD_PLANT_BALANCE = Object.freeze({
  sunbloom: { cost: 25, unlockWave: 1, hp: 45 },
  thornbramble: { cost: 40, unlockWave: 1, hp: 100, range: 1, damage: 4, cooldown: 1 },
  sporecap: { cost: 60, unlockWave: 2, hp: 50, range: 2, damage: 15, cooldown: 2 },
  vinewhip: { cost: 50, unlockWave: 1, hp: 55, range: 3, damage: 8, cooldown: .9, slowSeconds: 2 },
  rootreclaimer: { cost: 45, unlockWave: 2, hp: 65, range: 3, cooldown: 3.7 },
  elderoak: { cost: 150, unlockWave: 4, hp: 300, range: 2, damage: 25, cooldown: 1.5, matureSeconds: 15 },
});

export const REWILD_ENEMY_BALANCE = Object.freeze({
  clickbait: { hp: 10, speed: 1.15, damage: 2 },
  deepfake: { hp: 60, speed: .55, damage: 6 },
  popup: { hp: 25, speed: .48, damage: 4 },
  fragment: { hp: 15, speed: .9, damage: 3 },
});

export function waveSeconds(wave: number) {
  return Math.max(15, 25 - wave);
}

export function waveSunlightReward(wave: number) {
  return 35 + wave * 4;
}
