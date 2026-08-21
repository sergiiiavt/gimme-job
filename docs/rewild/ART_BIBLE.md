# Rewild Art Bible — canonical authority wrapper

Status: **superseded as a standalone visual specification**.

The previous version of this file referenced an older generated target and described the field as pointy-top. That conflicts with the current runtime and the audited Visual Bible. Do not use historical copies of this document as a production source.

## Current authority chain

1. **Gameplay/runtime code** defines entities, behavior, state, footprints, and geometry.
   - `app/rewild-world.ts`
   - `app/rewild-simulation.ts`
   - `app/rewild-hex-grid.ts`
2. [`visual-bible/REFERENCE_STATUS.json`](visual-bible/REFERENCE_STATUS.json) defines how each of the seven retained Visual Bible images may be used.
3. [`visual-bible/README.md`](visual-bible/README.md) defines the audited visual-reference hierarchy and exact roster/state interpretation rules.
4. [`visual-bible/PRODUCTION_RULES.md`](visual-bible/PRODUCTION_RULES.md) is the production-art workflow.
5. [`visual-bible/SPRITE_MANIFEST.md`](visual-bible/SPRITE_MANIFEST.md) is the canonical production checklist.
6. [`visual-bible/HEX_GEOMETRY_CONTRACT.md`](visual-bible/HEX_GEOMETRY_CONTRACT.md) records the implemented geometry.
7. [`VISUAL_TARGET_CONTRACT.md`](VISUAL_TARGET_CONTRACT.md) defines current scene-level acceptance criteria.

If any generated image, old document, prompt, or review artifact conflicts with this hierarchy, the hierarchy above wins.

## Frozen gameplay contract

Rewild remains continuous real-time tower defense:
- the player spends sunlight to place defenders;
- defenders are stationary after placement and act automatically;
- enemies spawn, move, and attack automatically in waves;
- House integrity, corruption, score, sunlight, waves, and win/loss behavior remain;
- no turns, AP, selectable/movable allies, Move/Attack/Restore commands, or End Turn control may be introduced by visual work.

## Current geometry contract

The runtime uses regular **flat-top** hexagons from `app/rewild-hex-grid.ts`:
- `HEX_SIZE = 21`;
- width = 42 logical px;
- height = `sqrt(3) * 21 ≈ 36.373` logical px;
- six equal sides;
- six 120° interior angles;
- six neighbor directions;
- X step = 31.5 logical px;
- uniform X/Y scaling only.

Generated hex drawings are never geometry authority. In particular, rejected Visual Bible transition cells must not be copied or measured.

## Locked visual language

Use only the scopes permitted by `visual-bible/REFERENCE_STATUS.json`.

Core direction:
- strict overhead presentation;
- coherent pixel density;
- nearest-neighbor runtime rendering;
- connected forests, water, roads, industrial territory and wasted ground;
- natural asymmetry and moderate detail;
- physical industrial hardware and environmental interaction;
- readable gameplay hierarchy at 1200×675;
- no broad fantasy styling;
- no purple crystal corruption as production language.

## Corruption

Corruption must read as technological/ecological damage: stressed or dead vegetation, polluted soil/water, thermal/electrical damage, conductive traces/cables, contaminated infrastructure, rubble, drainage and industrial waste.

Purple crystal fields, magical nodes and fantasy glowing veins are rejected.

## Roads

The previous road visual approval is withdrawn. Road examples in `visual-bible/01-environment-detail.webp` are illustrative only, and `visual-bible/04-terrain-transitions.webp` is rejected. A new production road target must be reviewed before further road atlas integration.

Connector topology still comes from the real six-neighbor runtime grid.

## Generated-image rule

Whole-scene and concept-sheet images are reference material only. Generated text labels, implied mechanics, roster panels, state names, footprints and hex geometry never become production facts unless independently confirmed by code/manifest and explicitly approved.
