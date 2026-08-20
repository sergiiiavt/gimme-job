# Rewild target visual contract

Status: implementation gate for the post-#245 visual rebuild.

This document narrows the existing [`ART_BIBLE.md`](./ART_BIBLE.md) into a concrete acceptance contract for the current renderer. It does not redefine gameplay. The authoritative visual-only reference remains [`references/top-down-hex-allies-enemies-concept-v2-small-hexes.png`](./references/top-down-hex-allies-enemies-concept-v2-small-hexes.png).

## 1. Gameplay is frozen

Rewild remains continuous real-time tower defense.

- The player spends sunlight to place defenders.
- Placed defenders are stationary and attack automatically.
- Enemies spawn in waves, move automatically, and attack automatically.
- House integrity, corruption, score, sunlight, wave progression, Siege/Endless flow, and win/loss rules remain authoritative.
- No selectable/movable allies, AP, player/enemy phases, Move/Attack/Restore commands, or End Turn control may be introduced by visual work.

The renderer continues to consume a detached snapshot and must not mutate simulation state.

## 2. Scene contract

- Logical scene: 1200 × 675.
- Projection: strict 90-degree overhead orthographic.
- Hex field: pointy-top, approximately 37 × 15, radius 21–22 logical pixels.
- Scaling: uniform nearest-neighbor only; letterbox rather than distort.
- Pixel density: one coherent runtime language across terrain, environment, structures, defenders, enemies, and VFX.
- Lighting: stable upper-left light with compact contact darkening; no broad oval shadows.
- Normal scenery is static. Motion is event/state driven only.

## 3. Composition contract

The battlefield must read as three connected macro zones before individual props are noticed.

### Natural territory — left

Must read as a dense living ecosystem, not an empty grass field with random decorations.

Required:

- connected forest canopy masses;
- clear forest exterior edges and suppressed interior seams;
- at least one integrated merged lake;
- layered meadow/forest transitions;
- medium-size environmental forms such as shrubs, rocks, logs, stumps, roots, and clearings;
- local clusters rather than one random decoration per cell;
- enough quiet cells to preserve placement readability.

Rejected appearance:

- evenly spaced repeated trees;
- circles of identical tree stamps;
- confetti-like micro-detail as the main density source;
- lakes that read as independent blue hexes.

### Central battlefield and house — center

Must remain readable and somewhat more open than both outer territories.

Required:

- an organic dirt path that belongs to the terrain;
- a grounded house zone with yard/soil/vegetation framing;
- path/house transitions that do not look like repeated identical chunks;
- clear tower-defense readability around routes and placement cells.

Rejected appearance:

- log-like or mechanically repeated zig-zag road segments;
- house sprite visually dropped onto empty grass.

### Industrial/corrupted territory — right

Must read as a constructed hostile system, not a dark fill with scattered devices.

Required:

- connected industrial ground with internal hierarchy;
- datacenter compounds with explicit local footprints;
- foundations/platforms around each datacenter;
- visible power/cooling/compute/access relationships;
- cable/pipe/conduit/junction networks;
- machinery, vents, relays, debris, rubble, drains, panels, and hazard details;
- contaminated transition from healthy terrain into industry;
- corruption that visibly changes ground and nearby material.

Rejected appearance:

- isolated datacenter sprite on a flat dark patch;
- random industrial props without compound structure;
- corruption represented only by a few purple marks.

## 4. Density hierarchy

Environmental density must come from authored masses at several scales.

1. **Macro:** connected forest, lake, industrial compound, corruption territory.
2. **Meso:** canopy lobes, shoreline bands, yard/path zones, platforms, machinery clusters, rubble fields.
3. **Micro:** grass tufts, flowers, pebbles, reeds, stains, cracks, small debris.

Micro-detail is never a substitute for missing macro/meso structure.

At least 25% of buildable/traversable cells remain visually quiet, matching the art bible.

## 5. Connected-material rules

### Forest

- Interior borders disappear under shared canopy.
- Interior cells favor canopy mass rather than independent tree silhouettes.
- Exterior cells carry irregular crown edges, understory, and occasional readable trunks/objects.
- Canopy variation is deterministic from world seed/state.

### Water

- Shore treatment exists only on exterior water edges.
- Interior water edges are uninterrupted.
- Deep/shallow variation is component-aware rather than one independent pond per cell.
- Reeds, lilies, rocks, pollution, and vegetation attach to selected exterior edges/shore clusters.

### Industry

- Industrial territory replaces meadow material rather than tinting it.
- Datacenter footprints expand into compound modules and shared infrastructure.
- Empty industrial cells still read as prepared/worn/contaminated compound ground.
- Network connectors terminate at meaningful structure entries or authored junctions.

### Corruption

Visible progression:

healthy vegetation → stressed vegetation → exposed soil → cracked dead ground → technological residue.

Recovery must reverse that material ownership visibly when existing gameplay clears corruption.

## 6. Hex visibility

The hex mesh remains a gameplay substrate, not the dominant visual pattern.

- Normal terrain: low-contrast mesh.
- Placement/cursor/range/route feedback may locally strengthen it.
- Connected regions must read before individual cell boundaries.
- Internal biome seams must not masquerade as shores, canopy edges, or structure outlines.

## 7. Asset contract for v4

Do not produce one monolithic source image. Use reviewable category source sheets and packed runtime atlases.

Recommended source sheets:

1. `nature-source-v1.png`
2. `water-shore-source-v1.png`
3. `industry-source-v1.png`
4. `corruption-source-v1.png`
5. `entities-source-v1.png`
6. `vfx-source-v1.png`

Recommended runtime atlases:

- `entities-atlas-v4.png`
- `terrain-atlas-v4.png`
- `environment-atlas-v4.png` when environment vocabulary no longer fits cleanly in the entity atlas;
- `vfx-atlas-v4.png` for event-driven combat/reclaim effects.

Every packed frame requires metadata for:

- sprite id;
- source frame rectangle;
- pivot;
- cell footprint;
- state;
- category;
- variant group where applicable;
- facing/orientation where applicable.

A frame is not considered valid merely because its rectangle exists. Core validation must prove it contains visible pixels at the expected scale. v4 core frames may not silently rely on v2/v3 fallback art.

## 8. Minimum asset vocabulary before “final” review

### Nature

- 6–8 broadleaf variants;
- 3–4 pine variants;
- canopy interior/edge pieces;
- at least 5 shrub/undergrowth variants;
- rocks, logs, stumps, roots, flowers, meadow grass, fences/signs/ruins;
- shore vegetation, reeds, lilies, shoreline rocks.

### House zone

- intact and damaged/critical house states;
- yard/soil/path transitions;
- fence/garden/brush framing props.

### Industry

- datacenter core variants;
- foundations/platform modules;
- cooling, power, compute/access modules;
- fans, vents, relays, terminals, transformers/power boxes;
- crates, conduits, pipes, cable junctions, drains/walls;
- hazard marks, industrial cracks, debris, rubble, destroyed modules.

### Corruption

- stains;
- cracks/veins;
- tendrils;
- spikes;
- corrupted vegetation;
- glowing nodes;
- contaminated industry;
- reclaim/recovery transition pieces.

### Combat/VFX

- projectile/attack cues;
- impacts;
- reclaim pulse;
- disable cue;
- slow cue;
- corruption-spread cue;
- datacenter collapse cue.

All effects remain restrained and event driven.

## 9. Benchmark scenes

The visual gate must eventually capture at least these deterministic 1200 × 675 scenes:

1. **Ecosystem overview** — proves macro composition, natural density, house grounding, and industrial structure.
2. **Mid-combat** — proves unit readability, route/attack feedback, and environment readability under action.
3. **Corruption-heavy** — proves corruption progression, industrial contamination, and visual hierarchy.
4. **Damage/collapse** — optional until damage-state assets exist, then required before final acceptance.

A screenshot hash proves determinism only. It must never be accepted as a new artistic baseline before a human visual comparison against the authoritative target.

## 10. Acceptance gate

A pass is not final if any of the following remain obvious at 100% benchmark scale:

- large empty green areas dominate;
- forest still reads as repeated independent trees;
- water still reads as blue cell patches;
- road is a repetitive chunky strip;
- house is visually isolated;
- datacenters sit on flat dark blobs;
- industrial territory lacks internal infrastructure;
- corruption is only sparse accent marks;
- art scales/pixel densities visibly conflict;
- grid contrast competes with world art.

Final acceptance requires the rendered battlefield to clearly belong to the same visual family as the authoritative target, while preserving the original real-time tower-defense mechanics.