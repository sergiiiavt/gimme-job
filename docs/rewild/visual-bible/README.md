# Rewild Visual Bible v1

This directory is the authoritative visual reference set for the Rewild production-art rebuild.

## Source-of-truth hierarchy

1. **Gameplay code is authoritative for what exists and how it behaves.**
   - `app/rewild-world.ts`
   - `app/rewild-balance.ts`
   - `app/rewild-simulation.ts`
2. **These seven images are authoritative for visual direction only.** They define style, density, scale relationships, biome transitions, damage language, environment details, and final composition targets.
3. Generated art must never introduce gameplay entities, factions, abilities, movement systems, or structures that do not exist in code.

## Approved reference set

1. `01-environment-detail.webp` — roads, fences, rocks, flora, small industrial props, placement density.
2. `02-style-scale-footprint.webp` — approved Style B, scale relationships, multi-hex footprints, actual unit roster presentation.
3. `03-mainframe-interactions.webp` — mainframe interaction with lake, wetland, forest, wasted ground and expansion corridors.
4. `04-terrain-transitions.webp` — meadow/forest/road/water/industry/wasted-ground transition vocabulary.
5. `05-industrial-modular-kit.webp` — industrial modules, cooling, drainage, cables, pipes, foundations, rubble and assembly examples.
6. `06-damage-states.webp` — state progression for house, datacenter, mainframe, Elder Oak, forest, pond and ground.
7. `07-gameplay-target.webp` — near-final gameplay composition target and gameplay-scale readability reference.

## Critical interpretation rule

The images are **not** a gameplay-design specification. If a reference image contains a decorative object, label, or generated visual concept that is not represented in code, it is only a visual motif and must not become a new gameplay entity.

See `PRODUCTION_RULES.md` before generating or integrating any new sprite batch.
