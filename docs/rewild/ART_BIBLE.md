# Rewild overhead hex visual production bible

This document is the authoritative **visual contract** for Rewild. It does not
replace, reinterpret, or extend the game's existing tower-defense mechanics.

The visual target is
[top-down-hex-allies-enemies-concept-v2-small-hexes.png](./references/top-down-hex-allies-enemies-concept-v2-small-hexes.png).
It is a visual-only reference for projection, scale, palette, terrain
connectivity, and composition. It is not a gameplay mockup: its turn labels,
selection states, movement routes, action buttons, and other tactical-UI ideas
must not be implemented.

Earlier images remain useful as asset-identity and mood references. Where an
older reference conflicts with this bible on presentation, this bible wins.
Where any visual reference conflicts with the existing game rules, the existing
game rules win.

## Authoritative gameplay contract

Rewild remains the existing real-time tower-defense game:

- the player spends sunlight to place defenders;
- placed defenders are stationary and attack automatically;
- enemies spawn in waves, move automatically, and attack automatically;
- the house remains the defended objective and retains integrity;
- corruption, score, sunlight, wave progression, and the existing win/loss flow
  remain authoritative;
- gameplay continues in real time rather than alternating turns or phases.

The visual rebuild must not introduce selectable or movable allies, action
points, player/enemy phases, move/attack/restore commands, an End Turn control,
or a tactical turn-state machine. A defender may be hovered, inspected, or
targeted by existing interactions, but it is never a player-controlled unit.

## Visual objective

Rewild uses a strict-overhead pixel-art presentation on a visible pointy-top hex
field. Nature and industry read as connected territories made from cells and
shared borders. Objects occupy and visibly affect the world instead of appearing
as perspective illustrations pasted above it.

Every visible environmental relationship must be backed by world state:

- adjacent forest cells join into one forest mass;
- adjacent water cells join into one lake with a single exterior shoreline;
- roads, cables, roots, drains, and walls cross shared hex edges;
- datacenter growth replaces vegetation with excavation, foundations, and
  modules;
- corruption changes ground, nearby objects, and connected systems;
- destruction leaves cell-aligned rubble;
- recovery of the environment reverses those material states through existing
  gameplay events.

These relationships are renderer and map-state requirements. They do not imply
new player commands.

## Authoritative scene contract

- Logical scene: 1200 x 675 pixels, 16:9.
- Camera: orthographic and strict overhead; no visible side walls or horizon.
- Hex orientation: pointy top.
- Review density: approximately 37 columns by 15 rows.
- Baseline hex radius: 21-22 logical pixels. A final value must be shared by
  geometry, renderer, pointer input, placement validation, enemy routing, and
  asset metadata.
- Enemy routes and environmental networks may traverse only neighboring hexes;
  enemies choose and follow those routes automatically.
- Default framing: game-only scene. Portfolio navigation is not part of the
  benchmark frame.
- Scaling: preserve aspect ratio and use uniform nearest-neighbor scaling.
  Letterbox when necessary; never stretch one axis independently.
- Camera translation and sprite pivots land on whole logical pixels.

The visible mesh communicates spatial structure and placement. It is always
present but subordinate to defenders, enemies, structures, and gameplay
feedback. It must not become a field of individually shaded honeycomb buttons.

## Pixel language

- All gameplay art uses one apparent pixel density.
- Final rendering is nearest-neighbor with no antialiased scaling.
- Terrain edges are pixel-stepped and authored from discrete masks.
- Do not use canvas blur, smooth radial gradients, wide antialiased Bezier
  strokes, soft photographic shadows, or mixed-resolution source art.
- Outlines use palette-derived dark colors rather than uniform black.
- A one-cell defender or enemy remains readable at 100% benchmark scale.
- Large connected territories may use broader value fields, but their detail
  stays aligned to the same pixel grid.

Strict overhead means the viewer primarily sees roofs, canopies, crowns,
footprints, and ground marks. Legacy three-quarter sprites may communicate
identity, palette, or material, but cannot be final gameplay art.

## Lighting and depth

- Light direction is stable from the upper-left.
- Depth comes from value separation, overlap, contact darkening, and compact
  one-to-three-pixel accents.
- Large oval drop shadows are prohibited.
- Structures use footprint contact darkening rather than floating shadows.
- Units may use a compact one-pixel grounding mark when required for contrast.
- The house has no broad cast shadow.

## Visual hierarchy

1. Immediate tower-defense feedback: placement preview, incoming enemy, active
   attack, damage, house danger, and current wave outcome.
2. Defender and enemy silhouettes and active industrial modules.
3. Connected nature and industry territories.
4. Roads, roots, cables, drains, lake shores, and structure footprints.
5. Rocks, trees, ruins, and other occupied-cell objects.
6. Low grass, flowers, pebbles, wear, residue, and quiet variation.

At least 25% of buildable or traversable cells remain visually quiet. Ground
micro-detail may vary a cell, but must never compete with placement readability,
enemy routes, targets, or the protected house.

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
| Placement and hover | #f2e889, #d6c855 |
| Enemy action and danger | #df594f, #8f252c |

Nature owns the lighter, warmer half of the value range. Industrial territory
owns a darker charcoal range. Bright accents are reserved for active placement,
attacks, impacts, and warnings produced by the running game.

## Authoritative visual layers

The renderer composes the scene in this order:

1. quiet grass base and low per-cell variation;
2. connected territory masks;
3. external region edges and transition bands;
4. lakes, soil, industrial slabs, and corruption materials;
5. border networks: roads, roots, cables, drains, and walls;
6. low decals and footprint responses;
7. occupied-cell objects, the house, and multi-cell structures;
8. stationary defenders and automatically moving enemies;
9. placement, range, route, target, damage, and event-only effects;
10. the existing tower-defense HUD.

The visible mesh is rendered after terrain materials and before primary objects,
with gameplay feedback allowed to replace it locally. Internal seams inside a
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

When existing gameplay reduces or clears corruption, material ownership reverses
visibly:

residue thins -> rubble or soil appears -> shoots and roots return -> young
meadow -> mature habitat.

The state is stored per cell. Connected sources influence neighbors only through
six-neighbor rules or an explicit border network. This is a visualization of the
existing corruption system, not a new restore action.

## Border-network contract

Each shared edge can independently carry a road, cable, root, drain, or wall.
Network art requires authored edge combinations:

- six single-direction entries;
- straight pairs;
- 120-degree bends;
- 60-degree bends where the system permits them;
- T junctions, branches, and multi-edge junctions;
- terminators, structure entries, broken states, and contested states.

Free-angle rotation is prohibited for raster connectors. Select an authored
orientation from edge metadata. A connection begins and ends at stable
edge-anchor pixels so neighboring cells join without a seam.

## Object and entity contract

- Low objects fit within one cell unless their footprint explicitly spans cells.
- A normal defender or enemy occupies one cell and stays inside a compact
  overhead silhouette.
- The house, large trees, groves, rocks, ruins, and industrial modules declare
  multi-cell footprints rather than visually overflowing arbitrary cells.
- Each asset records its cell footprint, center pivot, allowed facing variants,
  animation states, and palette family.
- A defender is placed on a legal build cell and remains stationary afterward.
- Defender targeting and attacks are automatic and preserve the existing rules.
- Enemies move automatically along the game's route and attack automatically.
- Enemy directional images use authored variants or explicitly approved
  pixel-safe mirrored variants.

## Motion budget

Normal scenery and idle defenders are static. Animation exists only because the
real-time game is currently doing something or a material state is changing.

| Gameplay event | Allowed motion |
| --- | --- |
| Placement preview | restrained stepped outline or footprint preview |
| Defender placement | short arrival or growth cue |
| Defender attack | anticipation, delivery, impact, recovery |
| Enemy movement | restrained automatic route traversal |
| Enemy attack | anticipation, delivery, impact, recovery |
| Damage | local flash, debris, or one short local shake |
| Construction | activity only while an existing construction stage advances |
| Corruption | material replacement near newly affected cells |
| Destruction | local collapse followed by a static rubble state |
| Wave transition | brief HUD and spawn-route feedback |

Idle bobbing, constant jitter, perpetual glow, decorative particles, global
shaking, and simultaneous ambient animation are prohibited.

## Phase 1 asset contract

Current three-quarter environment, house, defender, enemy, and infrastructure
PNGs remain transitional runtime assets until overhead replacements are ready.
They also remain identity and palette references, but they are not approved for
the final overhead release. The manifest must keep this transitional usage
explicit rather than claiming those files are already absent from runtime.
Existing flat 32 x 32 ground decals may be evaluated as temporary candidates.

Phase 1 establishes these overhead atlas families:

1. overhead terrain cells and connected-region edge masks;
2. visible mesh, placement, range, route, target, and damage feedback;
3. overhead forest components and occupied-cell nature objects;
4. overhead water interiors, shores, and exterior-edge attachments;
5. industrial ground, datacenter modules, and damage states;
6. six-edge road, cable, root, drain, and wall networks;
7. stationary defender units with automatic attack states;
8. enemy units with six-direction automatic movement and attack states;
9. corruption, rubble, construction, and recovery material states;
10. the protected house and its integrity/damage states.

Generated whole-scene images are never runtime assets. All production atlases
must be reviewable separately at native and gameplay scale before integration.

## Deterministic benchmark scene

The first implementation target is one authored, deterministic visual scene
using the existing tower-defense state:

- the full 1200 x 675 game frame;
- approximately 37 x 15 visible pointy-top hexes;
- a connected natural territory on the left;
- a connected industrial territory on the right;
- at least one merged forest and one merged lake;
- one road or root system and one cable or drain system following shared edges;
- the protected house with visible integrity;
- several stationary placed defenders;
- several enemies at different points on their automatic wave route;
- sunlight, score, and wave information from the existing HUD;
- no portfolio navigation, three-quarter sprites, passive decorative animation,
  turn controls, selectable allies, or movement/action commands.

The benchmark is frozen for screenshot review. Procedural generation is added
only after the authored scene proves camera, scale, asset language, adjacency,
and tower-defense readability.

## Acceptance criteria

- The benchmark frame is visually equivalent to the visual-only target without
  copying its tactical mechanics.
- The scene is strict overhead at every layer.
- The grid is visible but not the highest-contrast repeated pattern.
- The frame is never horizontally or vertically distorted.
- Forests, lakes, and industry read as connected components.
- Datacenter growth visibly replaces and damages occupied ground.
- Roads, roots, cables, drains, walls, and automatic enemy routes respect the
  six-neighbor hex topology.
- Defenders remain stationary after placement and attack automatically.
- Enemies move and attack automatically during real-time waves.
- Sunlight, house integrity, corruption, score, waves, and win/loss behavior are
  unchanged.
- No selectable/movable ally, AP, turns, phases, action-command bar, or End Turn
  control exists.
- Entities remain identifiable at 100% logical scale.
- No final object uses a legacy perspective sprite.
- No large oval structure shadow is visible.
- Terrain remains convincing when entities and feedback overlays are hidden.
- No decorative motion occurs without a real gameplay event or material change.

## Reference status

- top-down-hex-allies-enemies-concept-v2-small-hexes.png: authoritative visual-only reference.
- vertical-slice-target-v1.png: superseded historical composition reference.
- approved-world-direction.png: superseded historical mood reference.
- baseline-before-vertical-slice.png: historical baseline only.
