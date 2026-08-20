# Rewild Visual Bible v1

This directory is the authoritative visual reference set for the Rewild production-art rebuild.

## Source-of-truth hierarchy

1. **Gameplay/runtime code is authoritative for what exists, how it behaves, and the actual hex geometry.**
   - `app/rewild-world.ts`
   - `app/rewild-balance.ts`
   - `app/rewild-simulation.ts`
   - `app/rewild-hex-grid.ts`
2. **These seven images are authoritative for visual direction only.** They define style, density, scale relationships, biome transitions, damage language, environment details, and final composition targets.
3. Generated art must never introduce gameplay entities, factions, abilities, movement systems, or structures that do not exist in code.
4. [`HEX_GEOMETRY_CONTRACT.md`](HEX_GEOMETRY_CONTRACT.md) records the implemented regular flat-top geometry and supersedes stale orientation wording in older visual documents.

## Approved reference set

1. `01-environment-detail.webp` — roads, fences, rocks, flora, small industrial props, placement density.
2. `02-style-scale-footprint.webp` — approved Style B, scale relationships, multi-hex footprints, actual unit roster presentation.
3. `03-mainframe-interactions.webp` — mainframe interaction with lake, wetland, forest, wasted ground and expansion corridors.
4. `04-terrain-transitions.webp` — meadow/forest/road/water/industry/wasted-ground transition vocabulary.
5. `05-industrial-modular-kit.webp` — industrial modules, cooling, drainage, cables, pipes, foundations, rubble and assembly examples.
6. `06-damage-states.webp` — state progression for house, datacenter, mainframe, Elder Oak, forest, pond and ground.
7. `07-gameplay-target.webp` — near-final gameplay composition target and gameplay-scale readability reference.

## Critical interpretation rule

The images are **not** a gameplay-design or geometry specification. If a reference image contains a decorative object, label, generated visual concept, or distorted hex guide that conflicts with code, code wins. Decorative motifs that are not represented in gameplay code must not become new gameplay entities.

See `PRODUCTION_RULES.md`, `SPRITE_MANIFEST.md`, `PREFLIGHT.md`, and `HEX_GEOMETRY_CONTRACT.md` before generating or integrating any new sprite batch.
