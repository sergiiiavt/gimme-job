import assert from "node:assert/strict";
import { access, readFile, readdir } from "node:fs/promises";
import test from "node:test";

const projectFile = (path) => new URL(`../${path}`, import.meta.url);

test("ships Fight AI slop as a lazy, local-only public game", async () => {
  const [
    gameSource,
    rendererFacadeSource,
    rendererSource,
    authoredOverlaySource,
    atlasFacadeSource,
    atlasSource,
    facadeSource,
    worldSource,
    legacySource,
    simulationSource,
    publicSource,
    navigationSource,
    stylesSource,
  ] = await Promise.all([
    readFile(projectFile("app/rewild-game.tsx"), "utf8"),
    readFile(projectFile("app/rewild-overhead-renderer.ts"), "utf8"),
    readFile(projectFile("app/rewild-production-renderer.ts"), "utf8"),
    readFile(projectFile("app/rewild-authored-overlay.ts"), "utf8"),
    readFile(projectFile("app/rewild-pixel-atlas.ts"), "utf8"),
    readFile(projectFile("app/rewild-pixel-atlas-v3.ts"), "utf8"),
    readFile(projectFile("app/rewild-hex-world.ts"), "utf8"),
    readFile(projectFile("app/rewild-world.ts"), "utf8"),
    readFile(projectFile("app/rewild-world-legacy.ts"), "utf8"),
    readFile(projectFile("app/rewild-simulation.ts"), "utf8"),
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
  assert.match(publicSource, /const isFullScreenGame = section === "rewild" && subsection === "all"/);
  assert.match(publicSource, /!isFullScreenGame && \(/);
  assert.match(publicSource, /Exit game and return to the site/);

  assert.match(facadeSource, /export \* from "\.\/rewild-world\.ts"/);
  assert.match(facadeSource, /from "\.\/rewild-simulation\.ts"/);
  assert.match(legacySource, /export \* from "\.\/rewild-world\.ts"/);
  assert.match(worldSource, /export const HEX_COLS = 37;/);
  assert.match(worldSource, /export const HEX_ROWS = 15;/);
  assert.match(worldSource, /export const HEX_SIZE = 21;/);
  assert.match(worldSource, /from "\.\/rewild-hex-grid\.ts"/);
  assert.match(worldSource, /export function hexNeighbors/);
  assert.match(worldSource, /export function hexDistance/);
  assert.match(worldSource, /export function pixelToHex/);
  assert.match(worldSource, /export function hexDisk/);
  assert.match(worldSource, /export function hexLine/);
  assert.match(worldSource, /function createRoadNetwork/);
  assert.match(worldSource, /export function createHexWorld\(seed = MAP_SEED\)/);
  assert.match(worldSource, /interface HexCell/);
  assert.match(worldSource, /interface WorldObject/);
  assert.match(worldSource, /interface BiomeRegion/);
  assert.match(worldSource, /surface: roadKeys\.has\(hexKey\(hex\)\) \? "road" : "meadow"/);
  assert.match(worldSource, /export function createFacilityFootprint/);
  assert.match(worldSource, /export function createReviewGameState/);
  assert.match(worldSource, /export function inspectHex/);
  assert.match(worldSource, /INITIAL_NODE_ANCHORS/);
  assert.match(worldSource, /forest-west/);
  assert.match(worldSource, /lake-west/);

  assert.match(simulationSource, /export function createGameState/);
  assert.match(simulationSource, /export function findPath/);
  assert.match(simulationSource, /for \(const neighbor of hexNeighbors\(current\)\)/);
  assert.match(simulationSource, /export function corruptionPercent/);
  assert.match(simulationSource, /export function updateGame/);
  assert.match(simulationSource, /export function placePlant/);
  assert.match(simulationSource, /REWILD_BASELINE\.sunlightPerSecond/);
  assert.match(simulationSource, /REWILD_BASELINE\.rootReclaimSeconds/);
  assert.match(simulationSource, /popupDisableSeconds/);
  assert.doesNotMatch(simulationSource, /roadBoost|stepCost|updateEcosystem\(|facilityOperational\(|hexDirection\(plant/);

  assert.match(gameSource, /from "\.\/rewild-hex-world"/);
  assert.match(gameSource, /from "\.\/rewild-overhead-renderer"/);
  assert.match(gameSource, /renderOverheadGame\(context, state, cameraRef\.current\)/);
  assert.match(gameSource, /export default function RewildGame/);
  assert.doesNotMatch(gameSource, /RewildTacticalGame|End turn|PLAYER PHASE/);
  assert.match(gameSource, /const scale = Math\.min\(bounds\.width \/ CANVAS_WIDTH, bounds\.height \/ CANVAS_HEIGHT\)/);
  assert.ok((gameSource.match(/\}, \[view\]\);/g) ?? []).length >= 3, "Canvas and keyboard effects must rebind when returning from the field guide.");
  assert.match(gameSource, /if \(view !== "all"\) return;/);
  assert.match(gameSource, /Defenders stay planted and attack automatically/);
  assert.match(gameSource, /const hex = pixelToHex\(worldX, worldY\)/);
  assert.match(gameSource, /Arrows plus Q\/E move the placement cursor across six neighboring cells/);
  assert.match(gameSource, /window\.requestAnimationFrame/);
  assert.match(gameSource, /STRICT OVERHEAD · REAL-TIME DEFENSE/);
  assert.doesNotMatch(gameSource, /REWILD_ATLASES|obj-house-v2|terrain-pond|tree-response-states-v1|pond-response-states-v1/);
  assert.doesNotMatch(gameSource, /\/api\//);

  assert.match(rendererFacadeSource, /export \* from "\.\/rewild-production-renderer"/);
  assert.match(rendererFacadeSource, /renderProductionGame\(context, snapshot, camera\)/);
  assert.match(rendererFacadeSource, /renderAuthoredArtOverlay\(context, snapshot, camera\)/);
  assert.match(rendererSource, /from "\.\/rewild-pixel-atlas"/);
  assert.match(rendererSource, /type \{ RenderEdge, RenderSnapshot \}/);
  assert.match(rendererSource, /export function renderOverheadGame/);
  assert.match(rendererSource, /ctx\.imageSmoothingEnabled = false/);
  assert.match(rendererSource, /function fillHexes/);
  assert.match(rendererSource, /export function regionBoundarySegments/);
  assert.match(rendererSource, /snapshot\.regionNeighborMasks/);
  assert.match(rendererSource, /function drawConnectedBiomeGround/);
  assert.match(rendererSource, /function drawCompositionWash/);
  assert.match(rendererSource, /HOUSE_CENTER/);
  assert.match(rendererSource, /function drawGround/);
  assert.match(rendererSource, /function drawWater/);
  assert.match(rendererSource, /waterDeep/);
  assert.match(rendererSource, /waterShallow/);
  assert.match(rendererSource, /function drawForest/);
  assert.match(rendererSource, /forestDeep/);
  assert.match(rendererSource, /function drawRoad/);
  assert.match(rendererSource, /roadDirt/);
  assert.match(rendererSource, /snapshot\.roadEdges/);
  assert.match(rendererSource, /function drawIndustrialGround/);
  assert.match(rendererSource, /industrialRust/);
  assert.match(rendererSource, /function drawCorruptionGround/);
  assert.match(rendererSource, /function drawCorruptionTransition/);
  assert.match(rendererSource, /function drawMesh/);
  assert.match(rendererSource, /hexDistance\(cell\.hex, state\.cursor\) <= 2/);
  assert.match(rendererSource, /meshIndustrial: "rgba\(145,155,151,\.035\)"/);
  assert.match(rendererSource, /function drawCableNetwork/);
  assert.match(rendererSource, /snapshot\.cableEdges/);
  assert.match(rendererSource, /function drawDatacenter/);
  assert.match(rendererSource, /function drawHouse/);
  assert.match(rendererSource, /function drawPlant/);
  assert.match(rendererSource, /function drawEnemy/);
  assert.match(rendererSource, /function drawRouteFeedback/);
  assert.match(rendererSource, /snapshot\.enemyRouteEdges/);
  assert.doesNotMatch(rendererSource, /Math\.sin\(\(state\.elapsed/);
  assert.match(rendererSource, /drawRewildSprite\(ctx, node\.boss \? "mainframe" : "datacenter"/);
  assert.match(rendererSource, /spriteForPlant\(plant\.kind, mature\)/);
  assert.match(rendererSource, /spriteForEnemy\(enemy\.kind\)/);
  assert.doesNotMatch(rendererSource, /createRadialGradient|quadraticCurveTo|REWILD_ATLASES|SPRITE_FILES|obj-house-v2/);

  assert.match(authoredOverlaySource, /export function renderAuthoredArtOverlay/);
  assert.match(authoredOverlaySource, /function drawForestDensity/);
  assert.match(authoredOverlaySource, /function drawWaterEdges/);
  assert.match(authoredOverlaySource, /function drawIndustrialComplex/);
  assert.match(authoredOverlaySource, /"industrial-vent-small-a"/);
  assert.match(authoredOverlaySource, /"detail-reeds-a"/);
  assert.doesNotMatch(authoredOverlaySource, /"industrial-fan"|"reed-clump"|"corruption-spike"/);
  assert.match(authoredOverlaySource, /snapshot\.occupiedHexes/);
  assert.doesNotMatch(authoredOverlaySource, /updateGame|placePlant|createGameState|Math\.random/);

  assert.match(atlasFacadeSource, /export \* from "\.\/rewild-pixel-atlas-v3"/);
  assert.match(atlasSource, /REWILD_PIXEL_ATLAS_FRAME_SIZE = 64/);
  assert.match(atlasSource, /REWILD_PIXEL_SPRITE_IDS/);
  assert.match(atlasSource, /"house-damaged"/);
  assert.match(atlasSource, /"mainframe"/);
  assert.match(atlasSource, /"plant-rootreclaimer"/);
  assert.match(atlasSource, /"enemy-deepfake"/);
  assert.match(atlasSource, /"industrial-fan"/);
  assert.match(atlasSource, /"reed-clump"/);
  assert.match(atlasSource, /"corruption-spike"/);
  assert.match(atlasSource, /entities-atlas-v3\.png/);
  assert.match(atlasSource, /terrain-atlas-v3\.png/);
  assert.match(atlasSource, /export function preloadRewildArt/);
  assert.match(atlasSource, /export function drawRewildSprite/);
  assert.match(atlasSource, /export function drawRewildTerrainStamp/);
  assert.match(atlasSource, /ctx\.drawImage/);
  assert.match(atlasSource, /ctx\.imageSmoothingEnabled = false/);
  assert.match(atlasSource, /export function spriteForPlant/);
  assert.match(atlasSource, /export function spriteForEnemy/);
  assert.doesNotMatch(atlasSource, /const PAINTERS|paintTree|createRewildPixelAtlas|createRadialGradient|quadraticCurveTo/);

  await access(projectFile("public/rewild/overhead/entities-atlas-v3.png"));
  await access(projectFile("public/rewild/overhead/terrain-atlas-v3.png"));

  for (const plant of ["Sunbloom", "Thornbramble", "Sporecap", "Vinewhip", "Rootreclaimer", "Elder Oak"]) assert.match(worldSource, new RegExp(plant.replace(" ", "\\s")));
  for (const enemy of ["AI Slop Swarm", "Deepfake Sludge", "Popup Parasite"]) assert.match(worldSource, new RegExp(enemy));

  const assetDirectory = projectFile("dist/client/assets/");
  const scripts = (await readdir(assetDirectory)).filter((file) => file.endsWith(".js"));
  const gameScripts = scripts.filter((file) => file.startsWith("rewild-game-"));
  assert.ok(gameScripts.length >= 1, "The production build must contain a separate Rewild game chunk.");
  const gameOutput = (await Promise.all(gameScripts.map((file) => readFile(new URL(file, assetDirectory), "utf8")))).join("\n");
  assert.match(gameOutput, /AI Slop Swarm/);
  assert.match(gameOutput, /STRICT OVERHEAD/);
  assert.match(gameOutput, /plant-rootreclaimer/);
  assert.match(gameOutput, /enemy-deepfake/);
  assert.match(gameOutput, /entities-atlas-v3\.png/);
  assert.match(gameOutput, /terrain-atlas-v3\.png/);
  assert.doesNotMatch(gameOutput, /obj-house-v2\.png|terrain-pond-[12]\.png|tree-response-states-v1\.png|pond-response-states-v1\.png/);
  const initialOutput = (await Promise.all(scripts.filter((file) => !gameScripts.includes(file)).map((file) => readFile(new URL(file, assetDirectory), "utf8")))).join("\n");
  assert.doesNotMatch(initialOutput, /AI Slop Swarm/);
});