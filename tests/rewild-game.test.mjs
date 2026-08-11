import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
import test from "node:test";

const projectFile = (path) => new URL(`../${path}`, import.meta.url);

test("ships Rewild as a lazy, local-only public game", async () => {
  const [gameSource, publicSource, navigationSource, stylesSource] = await Promise.all([
    readFile(projectFile("app/rewild-game.tsx"), "utf8"),
    readFile(projectFile("app/public-site.tsx"), "utf8"),
    readFile(projectFile("app/site-navigation.tsx"), "utf8"),
    readFile(projectFile("app/globals.css"), "utf8"),
  ]);

  assert.match(navigationSource, /\{ id: "rewild", label: "Rewild game" \}/);
  assert.match(publicSource, /lazy\(\(\) => import\("\.\/rewild-game"\)\)/);
  assert.match(publicSource, /\{ id: "all", label: "Play Rewild" \}/);
  assert.match(publicSource, /\{ id: "guide", label: "Field guide" \}/);
  assert.match(publicSource, /<RewildGame view=\{activeTopic\}\/>/);

  assert.match(gameSource, /const COLS = 16;/);
  assert.match(gameSource, /const ROWS = 12;/);
  assert.match(gameSource, /const TILE = 40;/);
  assert.match(gameSource, /width=\{CANVAS_WIDTH\} height=\{CANVAS_HEIGHT\}/);
  assert.match(gameSource, /ctx\.imageSmoothingEnabled = false/);
  assert.match(stylesSource, /image-rendering: pixelated/);

  for (const plant of ["Sunbloom", "Thornbramble", "Sporecap", "Vinewhip", "Rootreclaimer", "Elder Oak"]) {
    assert.match(gameSource, new RegExp(plant.replace(" ", "\\s")));
  }
  for (const enemy of ["Clickbait Swarm", "Deepfake Blob", "Popup Spammer", "Mainframe Core"]) {
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
  assert.match(gameOutput, /Clickbait Swarm/);
  assert.match(gameOutput, /The field is alive again/);
  const initialOutput = (await Promise.all(scripts.filter((file) => !gameScripts.includes(file)).map((file) => readFile(new URL(file, assetDirectory), "utf8")))).join("\n");
  assert.doesNotMatch(initialOutput, /Clickbait Swarm/);
});
