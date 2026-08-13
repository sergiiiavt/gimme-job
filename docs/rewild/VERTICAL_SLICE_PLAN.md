# Rewild overhead hex rebuild plan

This plan replaces the earlier three-quarter, hidden-grid vertical-slice plan.
The authoritative target is
[top-down-hex-allies-enemies-concept-v2-small-hexes.png](./references/top-down-hex-allies-enemies-concept-v2-small-hexes.png).

The rebuild proceeds through reviewable phases. Each phase must produce a
deterministic screenshot and a separately reviewable asset pack. Procedural map
generation and content expansion cannot hide unresolved camera, scale, or
projection problems.

## Non-negotiable contract

- 1200 x 675 logical game scene.
- Strict overhead orthographic projection.
- Visible pointy-top tactical mesh.
- Approximately 37 columns by 15 rows at radius 21-22.
- Uniform nearest-neighbor scaling with no horizontal stretch.
- Six-neighbor movement, attacks, restoration, and border networks.
- Connected forests, lakes, corruption, and industrial territories.
- Small one-cell allies and enemies with clear overhead silhouettes.
- Static scenery and action-only animation.
- No legacy three-quarter sprite in an accepted benchmark screenshot.
- No portfolio navigation inside the benchmark frame.

## Phase 0 - contract and baseline

Purpose: remove specification ambiguity before renderer work.

Deliverables:

- revised art bible;
- revised phase plan;
- authoritative target recorded in the asset manifest;
- complete legacy asset inventory marked reference-only or candidate;
- deterministic benchmark requirements;
- baseline screenshot of the current implementation.

Exit criteria:

- the small-hex overhead target is the only authoritative visual reference;
- three-quarter and invisible-grid rules are explicitly superseded;
- required Phase 1 atlas families are recorded without pretending that missing
  assets are production-ready.

## Phase 1 - deterministic benchmark foundation

Purpose: prove the new camera, field density, framing, and tactical composition
before migrating complete gameplay.

### Phase 1A - game shell and geometry

- Render one fixed 1200 x 675 logical scene.
- Present it through a full-screen game shell.
- Preserve 16:9 with uniform scale and letterboxing.
- Use one shared pointy-top hex geometry configuration.
- Show approximately 37 x 15 cells at radius 21-22.
- Snap grid, camera, pivots, and selection overlays to logical pixels.
- Confirm pointer-to-cell mapping at all six borders and at scaled sizes.

Acceptance:

- circles remain circular and hexes retain their intended aspect ratio;
- no horizontal or vertical distortion is visible;
- all six neighbor selections agree with pathfinding geometry;
- a saved screenshot exactly reproduces the same framing on every run.

### Phase 1B - authored benchmark state

Create one fixed review map, not a random map:

- connected meadow and forest territory on the left;
- connected industrial territory on the right;
- one merged forest component;
- one merged lake;
- a road or root network crossing explicit shared edges;
- a cable or drain network connected to industrial modules;
- one selected ally, at least two additional allies, and several enemies;
- legal movement cells and one attack or restore relationship;
- dense edge areas and deliberately quiet traversable cells.

The benchmark state is data, not a painted full-scene image. It must be possible
to hide units, overlays, or a territory layer independently.

### Phase 1C - temporary overhead renderer

- Replace smooth gradients with palette-stepped pixel materials.
- Render connected territory masks before the mesh.
- Remove internal shorelines from merged water.
- Remove repeated internal silhouettes from merged forest.
- Render roads, roots, cables, and drains from six-edge metadata.
- Use compact overhead placeholders only where final Phase 1 atlases are absent.
- Exclude perspective trees, ponds, house, facilities, defenders, and enemies.
- Render tactical overlays after the world and before the HUD.

Acceptance:

- the world reads as connected even when units are hidden;
- the mesh remains visible without dominating every cell;
- the nature/industry split matches the target composition;
- no pasted perspective object or broad oval shadow remains;
- no passive animation is running.

### Phase 1D - asset review pack

Required new atlas families:

1. terrain cells and connected-region edge masks;
2. mesh, selection, movement, range, and target overlays;
3. overhead forest and nature-object components;
4. overhead water interiors, shores, and edge attachments;
5. industrial ground and datacenter modules;
6. six-edge road, cable, root, drain, and wall networks;
7. overhead allies with six-direction action states;
8. overhead enemies with six-direction action states;
9. corruption, rubble, damage, and reclamation states.

Each family ships:

- transparent PNG atlas;
- machine-readable frame metadata;
- frame name, dimensions, pivot, cell footprint, allowed facing, and state;
- native-scale contact sheet;
- gameplay-scale contact sheet;
- benchmark integration screenshot;
- keep, revise, or reject decision.

Phase 1 exit criteria:

- one running scene is recognizably equivalent to the authoritative target;
- camera, scale, mesh contrast, and composition are approved;
- every visible primary object uses strict-overhead art or an explicitly marked
  temporary overhead placeholder;
- screenshot output is deterministic;
- the full visual pack has been supplied for review.

## Phase 2 - connected terrain and map representation

Purpose: replace authored visual placement with authoritative cell and edge state
without changing the approved benchmark appearance.

Cell state includes:

- ground material;
- habitat;
- nature, industry, or contested territory;
- corruption and recovery amount;
- structure footprint;
- occupant;
- deterministic variation seed.

Shared-edge state includes:

- road;
- cable;
- root;
- drain;
- wall;
- temporary action crossing.

Work:

- connected-component discovery for forest, water, and industrial territory;
- neighbor-mask selection for exterior edges;
- multi-cell footprints and occupancy validation;
- deterministic seeded terrain variants;
- renderer layers driven entirely from world state;
- debug toggles for cells, components, edges, footprints, and pivots.

Exit criteria:

- adding or removing a cell updates only relevant external boundaries;
- merged components contain no false internal shores or object seams;
- all connectors join at stable edge anchors;
- benchmark appearance remains approved after model migration.

## Phase 3 - datacenter construction and environmental response

Purpose: make industry visibly built into the environment.

Construction sequence:

1. vegetation clearing and survey marks;
2. excavation and removed soil;
3. foundation, trenches, and access preparation;
4. compute, cooling, and power modules;
5. cable, drain, wall, and route connections;
6. active wear and contamination;
7. damage, collapse, and rubble.

Environmental response:

- corruption replaces ground state rather than tinting an overlay;
- roads conduct damage through connected edges;
- drains can pollute a lake at a connected exterior edge;
- forests lose canopy along affected cells;
- rocks and rubble collect local residue;
- destroyed structures leave damaged ground until restored.

Exit criteria:

- the datacenter is a connected system rather than objects over grass;
- every active compound shows compute, cooling, and power;
- construction, damage, and destruction alter occupied cells and shared edges;
- hiding structures still reveals their physical history in the ground.

## Phase 4 - tactical allies, enemies, and turns

Purpose: replace continuous tower-defense presentation with six-direction
tactical actions.

Turn states:

- player phase;
- enemy phase;
- resolution phase.

Player commands:

- select;
- move to one of six neighbors or a legal connected route;
- attack across a legal border or range pattern;
- restore a legal neighboring or connected target;
- end turn.

Rules:

- logical occupancy changes only between cells;
- optional movement tween travels only between adjacent centers;
- facing resolves to one of six directions;
- attacks and restoration expose their edge or range relationship;
- event animation completes before the next state is committed;
- idle units remain static.

Exit criteria:

- every movement step can be expressed as a sequence of six-neighbor edges;
- illegal diagonal or free-angle moves cannot be issued;
- allies and enemies are distinguishable at 100% logical scale;
- actions remain readable without decorative particles or constant motion.

## Phase 5 - procedural maps, performance, and release review

Purpose: generalize the approved vertical slice without diluting its composition.

Work:

- deterministic seeded map generation;
- macro territory composition before local detail;
- connected-component size and shoreline constraints;
- authored encounter templates;
- accessibility and contrast review;
- desktop and mobile input validation;
- render-layer caching and performance profiling;
- deterministic screenshot regression suite.

Exit criteria:

- generated maps obey the same connected-territory and six-edge rules;
- default framing remains readable on supported aspect ratios;
- performance meets the agreed frame budget;
- the final review pack contains no legacy perspective runtime art.

## Implementation order inside the renderer

1. geometry and camera;
2. cell and edge data;
3. grass and territory materials;
4. connected external edges;
5. mesh;
6. networks and footprint responses;
7. objects and structures;
8. units;
9. tactical overlays;
10. action effects;
11. HUD.

Do not begin with particles, ambient animation, or random decoration. They cannot
validate the new world representation.

## Legacy asset policy

Existing perspective assets remain in the repository and manifest so their
identity, palette, and historical usage are not lost. Their status is
reference-only. They must not be:

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
- target-versus-current comparison;
- all changed visual PNG files;
- native and gameplay-scale contact sheets;
- cell, edge, footprint, and pivot debug screenshot when relevant;
- asset validator result;
- behavioral test result;
- explicit remaining gaps.

## Final vertical-slice acceptance

- strict overhead presentation matches the target;
- approximately 37 x 15 visible hexes retain correct proportions;
- forests, lakes, and industrial territory merge by adjacency;
- datacenter construction physically changes the environment;
- allies and enemies act only through the hex topology;
- roads, roots, cables, drains, and walls connect through shared edges;
- tactical feedback is clearer than the mesh;
- animation happens only because an action or state transition occurs;
- all accepted visual files are available separately for review.
