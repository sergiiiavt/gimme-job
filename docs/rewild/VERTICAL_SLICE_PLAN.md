# Rewild overhead hex visual modernization plan

This plan changes Rewild's renderer, map presentation, and visual assets while
preserving its existing real-time tower-defense game.

The visual target is
[top-down-hex-allies-enemies-concept-v2-small-hexes.png](./references/top-down-hex-allies-enemies-concept-v2-small-hexes.png).
It is authoritative for visual direction only. Its turn-based UI and unit-control
ideas are explicitly out of scope.

The work proceeds through reviewable phases. Each phase produces a deterministic
screenshot and separately reviewable visual files. No phase may replace or
silently reinterpret gameplay to make the screenshot easier to reproduce.

## Non-negotiable gameplay contract

The existing mechanics remain authoritative throughout every phase:

- the player spends sunlight to place defenders;
- placed defenders are stationary and attack automatically;
- enemies spawn in waves, move automatically, and attack automatically;
- the house remains the protected objective and retains integrity;
- corruption, score, sunlight, wave progression, and win/loss behavior remain;
- the game runs continuously in real time.

The visual rebuild must not add selectable or movable allies, action points,
turns, player/enemy phases, move/attack/restore commands, or an End Turn control.

## Non-negotiable visual contract

- 1200 x 675 logical game scene.
- Strict overhead orthographic projection.
- Visible pointy-top hex mesh.
- Approximately 37 columns by 15 rows at radius 21-22.
- Uniform nearest-neighbor scaling with no horizontal stretch.
- Automatic enemy routes and visual border networks respect six-neighbor hex
  topology.
- Connected forests, lakes, corruption, and industrial territories.
- Compact stationary defenders and automatically moving enemies with clear
  overhead silhouettes.
- Static scenery; animation is driven by real gameplay events or state changes.
- No legacy three-quarter sprite in an accepted benchmark screenshot.
- No portfolio navigation inside the benchmark frame.

## Phase 0 - contract and baseline

Purpose: remove specification ambiguity before renderer work.

Deliverables:

- revised art bible that marks the target visual-only;
- revised phase plan that freezes existing tower-defense mechanics;
- visual target recorded with visual-only status in the asset manifest;
- complete legacy asset inventory marked reference-only or candidate;
- deterministic benchmark requirements based on a real tower-defense moment;
- baseline screenshots and behavior notes for the current implementation.

Exit criteria:

- the small-hex overhead image is the only authoritative visual reference;
- the existing real-time tower-defense rules are explicitly authoritative;
- no tactical turn, ally movement, AP, action-command, or End Turn requirement
  remains in the plan or manifest;
- three-quarter and invisible-grid visual rules are explicitly superseded;
- required Phase 1 atlas families are recorded without treating missing assets
  as production-ready.

## Phase 1 - renderer and benchmark foundation

Purpose: prove camera, field density, framing, map composition, and integration
with the existing runtime before producing the complete art set.

This phase is a visual-rendering migration. It must not create a replacement game
loop, new command system, or alternate unit simulation.

### Phase 1A - game shell and visual geometry

- Render one fixed 1200 x 675 logical scene.
- Present it through a full-screen game shell.
- Preserve 16:9 with uniform scale and letterboxing.
- Use one shared pointy-top hex geometry configuration for rendering, placement,
  environmental adjacency, and automatic enemy routing.
- Show approximately 37 x 15 cells at radius 21-22.
- Snap grid, camera, pivots, placement previews, and feedback overlays to logical
  pixels.
- Preserve the current timing, resources, waves, attacks, damage, and objective.

Acceptance:

- circles remain circular and hexes retain their intended aspect ratio;
- no horizontal or vertical distortion is visible;
- placement hit testing and automatic routes agree with rendered geometry;
- a saved screenshot reproduces the same framing on every run;
- the tower-defense loop behaves exactly as it did before the visual migration.

### Phase 1B - authored tower-defense benchmark state

Create one fixed review map and one deterministic gameplay snapshot:

- connected meadow and forest territory on the left;
- connected industrial territory on the right;
- one merged forest component;
- one merged lake;
- a road or root network crossing explicit shared edges;
- a cable or drain network connected to industrial modules;
- the protected house with representative integrity;
- several stationary defenders in legal placed positions;
- several enemies at different points of the automatic wave route;
- representative sunlight, wave number, score, corruption, and attack feedback;
- deliberately quiet buildable cells among denser environmental edges.

The benchmark state is data, not a painted full-scene image. Terrain, structures,
defenders, enemies, feedback, and HUD layers can be hidden independently. It has
no selected ally, movement command, tactical action bar, phase, AP, or End Turn
state.

### Phase 1C - temporary overhead renderer

- Add a renderer adapter that reads the existing gameplay state without owning
  or replacing it.
- Replace smooth gradients with palette-stepped pixel materials.
- Render connected territory masks before the mesh.
- Remove internal shorelines from merged water.
- Remove repeated internal silhouettes from merged forest.
- Render roads, roots, cables, drains, and walls from six-edge metadata.
- Use compact overhead placeholders only where final atlases are absent.
- Exclude perspective trees, ponds, house, facilities, defenders, and enemies.
- Render placement, route, targeting, attack, damage, and corruption feedback
  after the world and before the existing HUD.

Acceptance:

- the world reads as connected when entities are hidden;
- the mesh remains visible without dominating every cell;
- the nature/industry composition matches the visual target;
- no pasted perspective object or broad oval shadow remains;
- no passive decorative animation is running;
- defenders remain stationary, enemies continue their automatic wave movement,
  and automatic attacks still resolve through the original mechanics.

### Phase 1D - asset review pack

Required new atlas families:

1. terrain cells and connected-region edge masks;
2. mesh, placement, range, route, target, and damage feedback;
3. overhead forest and nature-object components;
4. overhead water interiors, shores, and edge attachments;
5. industrial ground and datacenter modules;
6. six-edge road, cable, root, drain, and wall networks;
7. stationary overhead defenders with automatic attack states;
8. overhead enemies with automatic movement, attack, damage, and death states;
9. corruption, rubble, construction, and environmental-recovery states;
10. protected-house integrity and damage states.

Each family ships:

- transparent PNG atlas;
- machine-readable frame metadata;
- frame name, dimensions, pivot, cell footprint, allowed facing, and state;
- native-scale contact sheet;
- gameplay-scale contact sheet;
- benchmark integration screenshot;
- keep, revise, or reject decision.

Phase 1 exit criteria:

- one running tower-defense scene visually matches the target direction;
- camera, scale, mesh contrast, and composition are approved;
- every visible primary object uses strict-overhead art or an explicitly marked
  temporary overhead placeholder;
- screenshot output is deterministic;
- the full visual pack is supplied for review;
- existing tower-defense behavior has regression coverage and remains unchanged.

## Phase 2 - connected terrain and map representation

Purpose: replace authored visual placement with authoritative cell and edge state
without changing the approved appearance or tower-defense loop.

Cell presentation state includes:

- ground material;
- habitat;
- nature, industry, or contested territory;
- corruption and environmental-recovery amount;
- buildability and automatic-route membership;
- structure and stationary-defender footprints;
- deterministic variation seed.

Shared-edge presentation state includes:

- road;
- cable;
- root;
- drain;
- wall;
- automatic enemy-route connection.

Work:

- connected-component discovery for forest, water, and industrial territory;
- neighbor-mask selection for exterior edges;
- multi-cell footprints and placement validation;
- deterministic seeded terrain variants;
- automatic route visualization derived from existing route state;
- renderer layers driven entirely from map and gameplay state;
- debug toggles for cells, components, edges, footprints, and pivots.

Exit criteria:

- adding or removing a terrain cell updates only relevant external boundaries;
- merged components contain no false internal shores or object seams;
- all visual connectors join at stable edge anchors;
- defender placement and automatic enemy routing still follow existing rules;
- benchmark appearance remains approved after model migration.

## Phase 3 - datacenter construction and environmental response

Purpose: make existing industry and corruption visibly belong to the environment.
This is a presentation/state-model phase, not a new construction command system.

Visual construction sequence:

1. vegetation clearing and survey marks;
2. excavation and removed soil;
3. foundation, trenches, and access preparation;
4. compute, cooling, and power modules;
5. cable, drain, wall, and route connections;
6. active wear and contamination;
7. damage, collapse, and rubble.

Environmental response:

- corruption replaces ground state rather than tinting an overlay;
- roads can visually conduct existing damage/corruption through connected edges;
- drains can show lake pollution at a connected exterior edge;
- forests lose canopy along affected cells;
- rocks and rubble collect local residue;
- destroyed structures leave damaged ground until existing gameplay recovers it.

Exit criteria:

- the datacenter reads as a connected system rather than objects over grass;
- every active compound shows compute, cooling, and power;
- existing construction, damage, corruption, and destruction events alter
  occupied cells and shared edges visibly;
- hiding structures still reveals their physical history in the ground;
- no new player action, resource, timing rule, or victory condition is added.

## Phase 4 - integrate the final art with existing tower defense

Purpose: replace temporary visual placeholders while preserving real-time play.

Work:

- render each placed defender as a stationary overhead entity;
- map existing automatic targeting and attacks to restrained event animations;
- render enemies moving automatically along their existing wave routes;
- map enemy attacks, damage, and death to overhead animation states;
- preserve sunlight costs and income, house integrity, wave scheduling, score,
  corruption, target selection, and win/loss behavior;
- keep all feedback readable without decorative particles or constant motion;
- remove every temporary turn/phase/action-control implementation if one exists.

Exit criteria:

- defenders cannot be commanded to move; they attack automatically;
- enemies move and attack automatically during continuous waves;
- placement spends sunlight according to the existing rules;
- house integrity, corruption, score, wave progression, and game-over behavior
  match the pre-redesign game;
- no selectable/movable ally, action point, turn, phase, move/attack/restore
  command, or End Turn control exists;
- all entities remain identifiable at 100% logical scale.

## Phase 5 - procedural maps, performance, and release review

Purpose: generalize the approved visual slice without changing the game design.

Work:

- deterministic seeded visual map generation compatible with existing gameplay;
- macro territory composition before local detail;
- connected-component size and shoreline constraints;
- route validity and defender-placement validation;
- accessibility and contrast review;
- desktop and mobile input validation;
- render-layer caching and performance profiling;
- deterministic screenshot and gameplay-regression suites.

Exit criteria:

- generated maps obey connected-territory and six-edge presentation rules;
- every generated enemy route is valid for the existing automatic movement;
- default framing remains readable on supported aspect ratios;
- performance meets the agreed frame budget;
- the final review pack contains no legacy perspective runtime art;
- all original tower-defense mechanics pass regression testing.

## Implementation order inside the renderer

1. read-only adapter for existing gameplay state;
2. geometry and camera;
3. cell and edge presentation data;
4. grass and territory materials;
5. connected external edges;
6. mesh;
7. networks and footprint responses;
8. house, objects, and structures;
9. stationary defenders and automatically moving enemies;
10. placement, target, route, attack, damage, and corruption feedback;
11. existing HUD.

Do not begin with particles, ambient animation, or random decoration. Do not
build a second gameplay loop inside the renderer.

## Legacy asset policy

Existing perspective assets remain in the repository and manifest so their
identity, palette, and historical usage are not lost. Their status is
**transitional runtime legacy** while the restored game still loads them, and
**reference-only** after an overhead replacement is integrated. They are
prohibited in the accepted final overhead release, but must not be removed or
misclassified before replacement assets exist. They must not be:

- resized or cropped to simulate an overhead view;
- rotated freely to create directional variants;
- mixed with new overhead atlases in an accepted screenshot;
- used as a shortcut for a connected terrain component.

Existing flat ground decals are candidates, not automatically approved assets.
They must pass native-scale review against the new pixel density.

## Review artifacts per phase

Each phase provides:

- exact code and asset manifest;
- fixed 1200 x 675 benchmark screenshot;
- target-versus-current visual comparison;
- all changed visual PNG files;
- native and gameplay-scale contact sheets;
- cell, edge, footprint, and pivot debug screenshot when relevant;
- asset validator result;
- existing-mechanics regression result;
- explicit remaining gaps.

## Final vertical-slice acceptance

- strict overhead presentation matches the visual-only target;
- approximately 37 x 15 visible hexes retain correct proportions;
- forests, lakes, and industrial territory merge by adjacency;
- datacenter growth physically changes the environment;
- defenders are stationary and attack automatically;
- enemies move and attack automatically through real-time waves;
- sunlight, house integrity, corruption, score, waves, and win/loss behavior are
  preserved;
- roads, roots, cables, drains, walls, and automatic routes connect through
  shared edges;
- gameplay feedback is clearer than the mesh;
- animation happens only because an existing gameplay event or state transition
  occurs;
- no tactical turn system or player-controlled unit movement exists;
- all accepted visual files are available separately for review.
