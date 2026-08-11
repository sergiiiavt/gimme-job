import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
import test from "node:test";

const projectFile = (path) => new URL(`../${path}`, import.meta.url);

test("ships Fight AI slop as a lazy, local-only public game", async () => {
  const [gameSource, publicSource, navigationSource, stylesSource] = await Promise.all([
    readFile(projectFile("app/rewild-game.tsx"), "utf8"),
    readFile(projectFile("app/public-site.tsx"), "utf8"),
    readFile(projectFile("app/site-navigation.tsx"), "utf8"),
    readFile(projectFile("app/globals.css"), "utf8"),
  ]);

  assert.match(navigationSource, /\{ id: "rewild", label: "Fight AI slop" \}/);
  assert.match(publicSource, /lazy\(\(\) => import\("\.\/rewild-game"\)\)/);
  assert.match(publicSource, /\{ id: "all", label: "Fight AI slop" \}/);
  assert.match(publicSource, /\{ id: "guide", label: "Field guide" \}/);
  assert.match(publicSource, /<RewildGame view=\{activeTopic\}\/>/);
  assert.match(publicSource, /"kb-main kb-main-game"/);
  assert.match(stylesSource, /\.rw-play-page \.rw-game-shell/);
  assert.match(stylesSource, /\.rw-play-page \.rw-stage \{ max-width: none; \}/);

  assert.match(gameSource, /const COLS = 16;/);
  assert.match(gameSource, /const ROWS = 12;/);
  assert.match(gameSource, /const TILE = 40;/);
  assert.match(gameSource, /width=\{CANVAS_WIDTH\} height=\{CANVAS_HEIGHT\}/);
  assert.match(gameSource, /ctx\.imageSmoothingEnabled = false/);
  assert.match(stylesSource, /image-rendering: pixelated/);

  for (const plant of ["Sunbloom", "Thornbramble", "Sporecap", "Vinewhip", "Rootreclaimer", "Elder Oak"]) {
    assert.match(gameSource, new RegExp(plant.replace(" ", "\\s")));
  }
  for (const enemy of ["AI Slop Swarm", "Deepfake Sludge", "Popup Parasite", "AI Slop Mainframe"]) {
    assert.match(gameSource, new RegExp(enemy));
  }

  assert.match(gameSource, /type GameMode = "siege" \| "endless"/);
  assert.match(gameSource, /function findPath/);
  assert.match(gameSource, /function spreadCorruption/);
  assert.match(gameSource, /function reclaimNear/);
  assert.match(gameSource, /state\.selected === "rootreclaimer" \? tile === "corrupt" : tile === "grass"/);
  assert.match(gameSource, /window\.requestAnimationFrame/);
  assert.match(gameSource, /onKeyDown=\{onCanvasKeyDown\} tabIndex=\{0\}/);
  assert.match(gameSource, /event\.key === "Enter"/);
  assert.match(gameSource, /window\.localStorage\.setItem\(STORAGE_KEY/);
  assert.doesNotMatch(gameSource, /\/api\//);

  const assetDirectory = projectFile("dist/client/assets/");
  const scripts = (await readdir(assetDirectory)).filter((file) => file.endsWith(".js"));
  const gameScripts = scripts.filter((file) => file.startsWith("rewild-game-"));
  assert.ok(gameScripts.length >= 1, "The production build must contain a separate Rewild game chunk.");
  const gameOutput = (await Promise.all(gameScripts.map((file) => readFile(new URL(file, assetDirectory), "utf8")))).join("\n");
  assert.match(gameOutput, /AI Slop Swarm/);
  assert.match(gameOutput, /AI slop erased/);
  const initialOutput = (await Promise.all(scripts.filter((file) => !gameScripts.includes(file)).map((file) => readFile(new URL(file, assetDirectory), "utf8")))).join("\n");
  assert.doesNotMatch(initialOutput, /AI Slop Swarm/);
});
