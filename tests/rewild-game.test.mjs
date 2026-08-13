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
  assert.match(publicSource, /<RewildGame onViewChange=\{onTopicChange\} view=\{activeTopic\}\/>/);
  assert.match(publicSource, /const hideSecondary = section === "about" \|\| section === "resume" \|\| section === "rewild"/);
  assert.match(publicSource, /section === "rewild" && subsection === "all" \? " kb-main-game"/);
  assert.match(stylesSource, /\.rw-play-page \.rw-game-shell/);
  assert.match(stylesSource, /\.rw-play-page \.rw-stage \{[^}]*height: 100%;[^}]*max-height: 100%;[^}]*max-width: none;[^}]*width: 100%;/);
  assert.match(stylesSource, /\.rw-stage canvas \{[^}]*object-fit: cover;/);
  assert.match(stylesSource, /\.kb-main-game \{[^}]*height: 100dvh;[^}]*overflow: hidden;/);
  assert.match(stylesSource, /\.rw-play-page \{[^}]*height: 100dvh;[^}]*overflow: hidden;/);

  assert.match(gameSource, /const COLS = 30;/);
  assert.match(gameSource, /const ROWS = 14;/);
  assert.match(gameSource, /const TILE = 40;/);
  assert.match(gameSource, /const FIELD_TOP = 58;/);
  assert.match(gameSource, /const CANVAS_HEIGHT = 675;/);
  assert.match(gameSource, /width=\{CANVAS_WIDTH\} height=\{CANVAS_HEIGHT\}/);
  assert.match(gameSource, /ctx\.imageSmoothingEnabled = false/);
  assert.match(stylesSource, /image-rendering: pixelated/);
  assert.match(gameSource, /"terrain-world": "\/rewild\/terrain-world\.png"/);
  assert.match(gameSource, /function drawCorruptionDetails/);
  assert.match(gameSource, /function drawAmbientWorld/);
  assert.match(gameSource, /function drawWorldMesh/);
  assert.match(gameSource, /function drawEntityRelations/);
  assert.match(gameSource, /function drawCombatEffects/);
  assert.match(gameSource, /drawSprite\(ctx, "obj-house", x, groundY, 1, false\)/);
  assert.doesNotMatch(gameSource, /ctx\.strokeRect\(x, y, TILE, TILE\)/);

  for (const plant of ["Sunbloom", "Thornbramble", "Sporecap", "Vinewhip", "Rootreclaimer", "Elder Oak"]) {
    assert.match(gameSource, new RegExp(plant.replace(" ", "\\s")));
  }
  for (const enemy of ["AI Slop Swarm", "Deepfake Sludge", "Popup Parasite", "AI Slop Mainframe"]) {
    assert.match(gameSource, new RegExp(enemy));
  }

  assert.doesNotMatch(gameSource, /endless/i);
  assert.doesNotMatch(gameSource, /GameMode/);
  assert.match(gameSource, />Field guide<\/button>/);
  assert.match(gameSource, /state\.wave === 5 && !state\.bossSpawned/);
  assert.match(gameSource, /function findPath/);
  assert.match(gameSource, /function spreadCorruption/);
  assert.match(gameSource, /function reclaimNear/);
  assert.match(gameSource, /state\.selected === "rootreclaimer" \? tile === "corrupt" : tile === "grass"/);
  assert.match(gameSource, /window\.requestAnimationFrame/);
  assert.match(gameSource, /onKeyDown=\{onCanvasKeyDown\} tabIndex=\{0\}/);
  assert.match(gameSource, /const renderedWidth = boxRatio > sceneRatio/);
  assert.match(gameSource, /if \(x < 0 \|\| y < 0 \|\| x >= renderedWidth \|\| y >= renderedHeight\) return/);
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
  assert.match(gameOutput, /terrain-world\.png/);
  const initialOutput = (await Promise.all(scripts.filter((file) => !gameScripts.includes(file)).map((file) => readFile(new URL(file, assetDirectory), "utf8")))).join("\n");
  assert.doesNotMatch(initialOutput, /AI Slop Swarm/);
});
