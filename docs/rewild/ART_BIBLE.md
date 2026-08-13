# Rewild overhead hex visual production bible

This document is the authoritative visual contract for the Rewild rebuild.

The sole composition and style target is
[top-down-hex-allies-enemies-concept-v2-small-hexes.png](./references/top-down-hex-allies-enemies-concept-v2-small-hexes.png).
It is a benchmark image to reproduce with a stateful renderer, not a background
bitmap to ship behind gameplay.

Earlier references remain useful only as historical evidence and asset-identity
guides. Where an older document, sprite, screenshot, or implementation conflicts
with this bible, this bible wins.

## Product objective

Rewild is a strict-overhead, turn-based tactical game on a visible pointy-top
hex field. Nature and industry must read as connected territories made from
cells and shared borders. Objects occupy the world instead of appearing as
perspective illustrations pasted above it.

Every visible relationship must be backed by world state:

- adjacent forest cells join into one forest mass;
- adjacent water cells join into one lake with a single exterior shoreline;
- roads, cables, roots, drains, walls, and attacks cross one of six shared edges;
- construction replaces vegetation with excavation, foundation, and modules;
- corruption changes ground, nearby objects, and connected systems;
- destruction leaves cell-aligned rubble;
- reclamation reverses those material states over time.

## Authoritative scene contract

- Logical scene: 1200 x 675 pixels, 16:9.
- Camera: orthographic and strict overhead; no visible side walls or horizon.
- Hex orientation: pointy top.
- Review density: approximately 37 columns by 15 rows.
- Baseline hex radius: 21-22 logical pixels. A final value must be chosen once
  and shared by geometry, renderer, input, pathfinding, and asset metadata.
- Navigation: six neighbors only.
- Default framing: game-only scene. Portfolio or site navigation is not part of
  the benchmark frame.
- Scaling: preserve aspect ratio and use uniform nearest-neighbor scaling.
  Letterbox when necessary; never stretch one axis independently.
- Camera translation and sprite pivots must land on whole logical pixels.

The visible mesh communicates the tactical board. It is always present but
subordinate to units, structures, and action overlays. It must not become a set
of individually shaded honeycomb buttons.

## Pixel language

- All gameplay art uses one apparent pixel density.
- Final rendering is nearest-neighbor with no antialiased scaling.
- Terrain edges are pixel-stepped and authored from discrete masks.
- Do not use canvas blur, smooth radial gradients, wide antialiased Bezier
  strokes, soft photographic shadows, or mixed-resolution source art.
- Outlines use palette-derived dark colors rather than uniform black.
- A one-cell unit must remain readable at 100% benchmark scale.
- Large connected territories may use broader value fields, but their detail
  remains aligned to the same pixel grid.

Strict overhead means the viewer primarily sees roofs, canopies, crowns,
footprints, and ground marks. Legacy three-quarter sprites may communicate
identity, palette, or material, but cannot be rendered as final gameplay art.

## Lighting and depth

- Light direction is stable from the upper-left.
- Depth comes from value separation, overlap, contact darkening, and compact
  one-to-three-pixel accents.
- Large oval drop shadows are prohibited.
- Structures use footprint contact darkening rather than floating shadows.
- Units may use a compact one-pixel grounding mark when required for contrast.
- The house, if present in a scenario, has no broad cast shadow.

## Visual hierarchy

1. Selected cell, legal route, active ally, target, and current action.
2. Enemy silhouettes and active industrial modules.
3. Connected nature and industry territories.
4. Roads, roots, cables, drains, lake shores, and structure footprints.
5. Rocks, trees, ruins, and other occupied-cell objects.
6. Low grass, flowers, pebbles, wear, residue, and quiet variation.

At least 25% of traversable cells remain visually quiet. Ground micro-detail may
vary a cell, but must never compete with cell ownership or tactical readability.

## Palette roles

These are role anchors, not a mandatory indexed palette.

| Role | Anchor colors |
| --- | --- |
| Meadow light | #8dae48, #71973b |
| Meadow dark | #416f31, #294c2b |
| Living foliage | #567f28, #2f682d, #173d2b |
| Warm soil | #a27a45, #755136, #4c372b |
| Natural water | #276d82, #194c68, #112f4b |
| Natural stone | #8b8b76, #62685f, #3d4643 |
| Concrete and steel | #8a9294, #5c666c, #30373d, #1c2227 |
| Warning and utility | #d69a2e, #8f6020 |
| Corruption soil | #584b3f, #393438, #202228 |
| Severe contamination | #674b76, #3e304c, #7f9f36 |
| Selection | #f2e889, #d6c855 |
| Enemy action | #df594f, #8f252c |

Nature owns the lighter, warmer half of the value range. Industrial territory
owns a darker charcoal range. Bright accents are reserved for selection and an
action currently being resolved.

## Authoritative world layers

The renderer composes the scene in this order:

1. quiet grass base and low per-cell variation;
2. connected territory masks;
3. external region edges and transition bands;
4. lakes, soil, industrial slabs, and corruption materials;
5. border networks: roads, roots, cables, drains, and walls;
6. low decals and footprint responses;
7. occupied-cell objects and multi-cell structures;
8. allies and enemies;
9. selected cell, routes, ranges, targets, and event-only effects;
10. tactical HUD.

The visible mesh is rendered after terrain materials and before primary objects,
with action overlays allowed to replace it locally. Internal seams inside a
merged lake, forest, or compound must not look like shoreline or object edges.

## Connected territory rules

### Forest

- A single forest cell reads as a compact overhead tree or young grove.
- Two or more adjacent forest cells form one canopy component.
- Interior borders disappear beneath shared canopy.
- Exterior cells receive irregular crown edges, trunks only where readable, and
  sparse understory.
- A merged forest is not a repeated tree sprite stamped once per cell.

### Water

- Water connectivity is computed from six-neighbor adjacency.
- Shore art appears only on edges touching non-water cells.
- Interior shared edges remain uninterrupted water.
- Reeds, rocks, lilies, foam, and pollution attach to selected exterior edges.
- Large lakes receive restrained value variation, not independent pond sprites.

### Industry

- Industrial territory replaces the underlying ground material.
- A datacenter is a connected multi-cell system, never one enormous sprite.
- Modules occupy explicit footprints and share slabs, access routes, cable
  trunks, cooling, power, drainage, and perimeter elements.
- Empty industrial cells still read as prepared, worn, contaminated, or damaged
  ground belonging to the compound.

### Corruption and recovery

The material progression is:

healthy vegetation -> stressed vegetation -> exposed soil -> cracked dead ground
-> technological residue.

Recovery reverses material ownership in visible stages:

residue thins -> rubble or soil appears -> shoots and roots return -> young
meadow -> mature habitat.

The state is stored per cell. Connected sources may influence neighbors only
through six-neighbor rules or an explicit border network.

## Border-network contract

Each shared edge can independently carry a road, cable, root, drain, wall, or
temporary action crossing. Network art requires authored edge combinations:

- six single-direction entries;
- straight pairs;
- 120-degree bends;
- 60-degree bends where the system permits them;
- T junctions, branches, and multi-edge junctions;
- terminators, structure entries, broken states, and contested states.

Free-angle rotation is prohibited for raster connectors. Select an authored
orientation from edge metadata. A connection must begin and end at stable
edge-anchor pixels so neighboring cells join without a seam.

## Object and unit contract

- Low objects fit within one cell unless their footprint explicitly spans cells.
- A normal ally or enemy occupies one cell and stays inside a compact overhead
  silhouette.
- Large trees, groves, rocks, ruins, and industrial modules declare multi-cell
  footprints rather than visually overflowing arbitrary cells.
- Each asset records its cell footprint, center pivot, six-direction facing
  availability, animation states, and palette family.
- Units may face six directions. Directional images are authored variants or
  pixel-safe mirrored variants explicitly allowed by metadata.
- A rendered tween may briefly interpolate between adjacent cell centers, but
  gameplay ownership changes only between neighboring hexes.

## Motion budget

Normal scenery is static. Animation exists only for an action or a material state
transition.

| Event | Allowed motion |
| --- | --- |
| Selection | restrained pulse or stepped outline |
| Move | short adjacent-cell translation and arrival cue |
| Attack | anticipation, delivery, impact, recovery |
| Restore | short roots or material-replacement sequence |
| Construction | activity only while advancing a construction stage |
| Damage | local flash, debris, or one short local shake |
| Corruption | material replacement near the newly affected cells |
| Destruction | local collapse followed by a static rubble state |

Idle bobbing, constant jitter, perpetual glow, decorative particles, global
shaking, and simultaneous ambient animation are prohibited.

## Phase 1 asset contract

Current three-quarter environment, house, unit, enemy, and infrastructure PNGs
are legacy reference-only assets. They remain in the repository to preserve
identity and palette history, but they are not approved for final rendering.
Existing flat 32 x 32 ground decals may be evaluated as temporary candidates.

Phase 1 establishes these new overhead atlas families:

1. overhead terrain cells and connected-region edge masks;
2. visible mesh and selection/action overlays;
3. overhead forest components and occupied-cell nature objects;
4. overhead water interiors, shores, and exterior-edge attachments;
5. industrial ground, datacenter modules, and damage states;
6. six-edge road, cable, root, drain, and wall networks;
7. one-cell ally units with six-direction action states;
8. one-cell enemy units with six-direction action states;
9. corruption, rubble, and reclamation material states.

Generated whole-scene images are never runtime assets. All production atlases
must be reviewable separately at native and gameplay scale before integration.

## Deterministic benchmark scene

The first implementation target is one authored, deterministic scene matching
the authoritative reference:

- the full 1200 x 675 game frame;
- approximately 37 x 15 visible pointy-top hexes;
- a connected natural territory on the left;
- a connected industrial territory on the right;
- at least one merged forest and one merged lake;
- one road or root system and one cable or drain system following shared edges;
- one selected ally, additional allies, and several enemies;
- visible legal movement and attack or restore relationships;
- no portfolio navigation, three-quarter sprites, or passive animation.

This benchmark is frozen for screenshot review. Procedural generation is added
only after the authored scene proves camera, scale, asset language, adjacency,
and tactical readability.

## Acceptance criteria

- The benchmark frame is recognizably equivalent to the authoritative target.
- The scene is strict overhead at every layer.
- The grid is visible but not the highest-contrast repeated pattern.
- The frame is never horizontally or vertically distorted.
- Forests, lakes, and industry read as connected components.
- Datacenter construction visibly replaces and damages occupied ground.
- All routes, networks, movement, and attacks use six shared edges.
- Units remain identifiable when viewed at 100% logical scale.
- No final object uses a legacy perspective sprite.
- No large oval structure shadow is visible.
- Terrain remains convincing when units and tactical overlays are hidden.
- No motion occurs without an action or a material state change.

## Reference status

- top-down-hex-allies-enemies-concept-v2-small-hexes.png: authoritative.
- vertical-slice-target-v1.png: superseded historical composition reference.
- approved-world-direction.png: superseded historical mood reference.
- baseline-before-vertical-slice.png: historical baseline only.
