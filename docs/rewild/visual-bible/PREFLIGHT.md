# Rewild Sprite Batch Preflight

Run this checklist before generating, accepting, packing, or integrating every v4 batch.

## Reference authority
- [ ] Read `REFERENCE_STATUS.json` before selecting any image reference.
- [ ] Every supplied reference is allowed for this exact task/scope.
- [ ] `02-style-scale-footprint.webp` and `04-terrain-transitions.webp` are **not** supplied to generation and are not used for production extraction.
- [ ] Any `composition-only` or `inspiration-only` reference has its forbidden uses written down before generation.
- [ ] Generated labels, roster panels, state names and footprint diagrams are treated as non-authoritative unless code/manifest explicitly agrees.

## Gameplay and state
- [ ] Read current `PlantKind`, `EnemyKind`, world object types and node/ruin structures from the target branch.
- [ ] Exact plant roster remains: `sunbloom`, `thornbramble`, `sporecap`, `vinewhip`, `rootreclaimer`, `elderoak`.
- [ ] Exact enemy roster remains: `clickbait`, `deepfake`, `popup`, `fragment`.
- [ ] Every gameplay-owned sprite maps to an existing code concept.
- [ ] Decorative props are explicitly marked visual-only.
- [ ] No invented unit classes, factions, movement systems or abilities.
- [ ] Runtime state names are checked against code; concept-sheet labels do not create states.

## Geometry
- [ ] Hex guides match `app/rewild-hex-grid.ts`: regular flat-top, six equal sides, 120° interior angles, width/height ≈ 1.1547005.
- [ ] X/Y sprite scaling is uniform; no horizontal or vertical stretching.
- [ ] Large assets use declared multi-hex footprints instead of being squeezed into one cell.
- [ ] Connected terrain uses six-neighbor edge logic rather than isolated repeated stamps.

## Visual language
- [ ] Visual direction matches only the permitted scopes in `REFERENCE_STATUS.json`.
- [ ] Enemies have distinct silhouettes and plausible mechanical locomotion where visible.
- [ ] Corruption/waste reads as pollution, technological/ecological damage, dead soil, electrical/thermal stress or damaged infrastructure.
- [ ] No purple crystal fields, magical crystal nodes or fantasy glowing veins are used as the primary corruption language.
- [ ] Batch has enough authored variation to avoid obvious template repetition.
- [ ] Production sprites contain no labels or generated UI text.

## Road-specific gate
- [ ] If the batch contains roads, a newly reviewed production road target exists; `01-environment-detail.webp` road drawings are not treated as final production sprites.
- [ ] Road topology/orientation is derived from the real six-neighbor runtime graph, not from a concept-sheet hex drawing.

## Technical and integration
- [ ] Alpha, dimensions, pivots and clipping are validated before atlas packing.
- [ ] Runtime uses nearest-neighbor drawing and no non-uniform scaling.
- [ ] Production pixels are not extracted from any reference with `productionExtractionAllowed: false`.
- [ ] Gameplay/simulation code remains unchanged unless the task explicitly changes gameplay.
- [ ] Review a deterministic 1200×675 gameplay screenshot before updating the benchmark hash.
