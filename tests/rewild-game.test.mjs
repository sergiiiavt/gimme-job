import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
import test from "node:test";

const projectFile = (path) => new URL(`../${path}`, import.meta.url);

test("ships Fight AI slop as a lazy, local-only public game", async () => {
  const [gameSource, worldSource, publicSource, navigationSource, stylesSource] = await Promise.all([
    readFile(projectFile("app/rewild-game.tsx"), "utf8"),
    readFile(projectFile("app/rewild-hex-world.ts"), "utf8"),
    readFile(projectFile("app/public-site.tsx"), "utf8"),
    readFile(projectFile("app/site-navigation.tsx"), "utf8"),
    readFile(projectFile("app/globals.css"), "utf8"),
  ]);

  assert.match(navigationSource, /\{ id: "rewild", label: "Fight AI slop" \}/);
  assert.match(publicSource, /lazy\(\(\) => import\("\.\/rewild-game"\)\)/);
  assert.match(publicSource, /<RewildGame onViewChange=\{onTopicChange\} view=\{activeTopic\}\/>/);
  assert.match(stylesSource, /\.rw-play-page \.rw-game-shell/);
  assert.match(stylesSource, /\.rw-stage canvas \{[^}]*object-fit: contain;/);
  assert.match(stylesSource, /\.kb-main-game \{[^}]*height: 100dvh;[^}]*overflow: hidden;/);
  assert.match(stylesSource, /image-rendering: pixelated/);

  assert.match(worldSource, /export const HEX_COLS = 30;/);
  assert.match(worldSource, /export const HEX_ROWS = 14;/);
  assert.match(worldSource, /const CUBE_DIRECTIONS: CubeCoord\[\] = \[/);
  assert.match(worldSource, /export function hexNeighbors/);
  assert.match(worldSource, /export function hexDistance/);
  assert.match(worldSource, /export function pixelToHex/);
  assert.match(worldSource, /export function hexDisk/);
  assert.match(worldSource, /export function hexLine/);
  assert.match(worldSource, /function createRoadNetwork/);
  assert.match(worldSource, /export function createHexWorld\(seed = MAP_SEED\)/);
  assert.match(worldSource, /interface HexCell/);
  assert.match(worldSource, /interface WorldObject/);
  assert.match(worldSource, /surface: roadKeys\.has\(hexKey\(hex\)\) \? "road" : "meadow"/);
  assert.match(worldSource, /object\.kind === "pond"/);
  assert.match(worldSource, /export function createFacilityFootprint/);
  assert.match(worldSource, /return hexDisk\(anchor, boss \? 2 : 1\)/);
  assert.match(worldSource, /export function findPath/);
  assert.match(worldSource, /for \(const neighbor of hexNeighbors\(current\)\)/);
  assert.match(worldSource, /hexDistance\(plant, targetHex\(target\)\) <= radius/);
  assert.match(worldSource, /function spreadCorruption/);
  assert.match(worldSource, /hexNeighbors\(source\.hex\)/);
  assert.match(worldSource, /left\.surface === "road" \? 6 : 0/);
  assert.match(worldSource, /cell\.surface !== "water"/);
  assert.match(worldSource, /cell\.surface = "rubble"/);
  assert.match(worldSource, /function reclaimNear/);
  assert.match(worldSource, /export function facilityOperational/);
  assert.match(worldSource, /state\.ruins\.push/);
  assert.match(worldSource, /export function createReviewGameState/);
  assert.match(worldSource, /plant\.reclaimTarget = target\.hex/);
  assert.match(worldSource, /if \(target\.surface === "rubble"\) (?:\{ )?target\.surface = "meadow"/);
  assert.match(worldSource, /export function objectCorruption/);
  assert.match(worldSource, /export function inspectHex/);
  assert.match(worldSource, /function updateEcosystem/);
  assert.match(worldSource, /stepCost = cell\?\.surface === "road" \? \.18 : 1/);
  assert.doesNotMatch(worldSource, /const directions = \[\[1, 0\], \[-1, 0\], \[0, 1\], \[0, -1\]\]/);

  assert.match(gameSource, /from "\.\/rewild-hex-world"/);
  assert.match(gameSource, /ctx\.imageSmoothingEnabled = false/);
  assert.match(gameSource, /function drawRoad/);
  assert.match(gameSource, /function drawCorruption/);
  assert.match(gameSource, /function drawGrounding/);
  assert.match(gameSource, /function drawFacilityGround/);
  assert.match(gameSource, /function drawAtlasFrame/);
  assert.match(gameSource, /facilityModules\(node\)/);
  assert.match(gameSource, /damagedFacilityModules\(node\)/);
  assert.match(gameSource, /drawNodeConnections\(ctx, node, state\)/);
  assert.match(gameSource, /drawRuinConnections\(ctx, ruin, state\)/);
  assert.match(gameSource, /"cable-broken"/);
  assert.match(gameSource, /"drain-clean"/);
  assert.match(gameSource, /requestedReviewState/);
  assert.match(gameSource, /"shoreline-polluted-outlet"/);
  assert.match(gameSource, /"roots-reclaiming"/);
  assert.doesNotMatch(gameSource, /const wallHeight = stage/);
  assert.match(gameSource, /function drawRubble/);
  assert.match(gameSource, /drawSprite\(ctx, object\.sprite/);
  assert.match(gameSource, /object\.kind !== "house"/);
  assert.match(gameSource, /const polygon = hexPolygon\(state\.cursor/);
  assert.doesNotMatch(gameSource, /strokeRect\(state\.cursor/);
  assert.match(gameSource, /const hex = pixelToHex\(worldX, worldY\)/);
  assert.match(gameSource, /Arrows plus Q\/E move through six neighbors/);
  assert.match(gameSource, /onKeyDown=\{onCanvasKeyDown\} tabIndex=\{0\}/);
  assert.match(gameSource, /window\.requestAnimationFrame/);
  assert.match(gameSource, /className=\{`rw-inspector/);
  assert.doesNotMatch(gameSource, /\/api\//);

  for (const plant of ["Sunbloom", "Thornbramble", "Sporecap", "Vinewhip", "Rootreclaimer", "Elder Oak"]) assert.match(worldSource, new RegExp(plant.replace(" ", "\\s")));
  for (const enemy of ["AI Slop Swarm", "Deepfake Sludge", "Popup Parasite"]) assert.match(worldSource, new RegExp(enemy));

  const assetDirectory = projectFile("dist/client/assets/");
  const scripts = (await readdir(assetDirectory)).filter((file) => file.endsWith(".js"));
  const gameScripts = scripts.filter((file) => file.startsWith("rewild-game-"));
  assert.ok(gameScripts.length >= 1, "The production build must contain a separate Rewild game chunk.");
  const gameOutput = (await Promise.all(gameScripts.map((file) => readFile(new URL(file, assetDirectory), "utf8")))).join("\n");
  assert.match(gameOutput, /AI Slop Swarm/);
  assert.match(gameOutput, /invisible hex topology/i);
  assert.match(gameOutput, /obj-tree-deciduous\.png/);
  const initialOutput = (await Promise.all(scripts.filter((file) => !gameScripts.includes(file)).map((file) => readFile(new URL(file, assetDirectory), "utf8")))).join("\n");
  assert.doesNotMatch(initialOutput, /AI Slop Swarm/);
});
