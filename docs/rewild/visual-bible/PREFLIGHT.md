# Rewild Sprite Batch Preflight

Run this checklist before generating, accepting, packing, or integrating every v4 batch.

- [ ] Read current `PlantKind`, `EnemyKind`, world object types and node/ruin structures from the target branch.
- [ ] Every gameplay-owned sprite maps to an existing code concept.
- [ ] Decorative props are explicitly marked visual-only.
- [ ] No invented unit classes, factions, movement systems or abilities.
- [ ] Visual direction matches all relevant Visual Bible v1 sheets.
- [ ] Pointy-top hex guides are regular: six equal sides, 120° interior angles, width/height ≈ 0.8660254.
- [ ] X/Y sprite scaling is uniform; no horizontal or vertical stretching.
- [ ] Large assets use declared multi-hex footprints instead of being squeezed into one cell.
- [ ] Connected terrain uses six-neighbor edge logic rather than isolated repeated stamps.
- [ ] Enemies have distinct silhouettes and plausible mechanical locomotion where visible.
- [ ] Corruption/waste reads as pollution/technological ecological damage, not generic magic.
- [ ] Batch has enough authored variation to avoid obvious template repetition.
- [ ] Production sprites contain no labels or generated UI text.
- [ ] Alpha, dimensions, pivots and clipping are validated before atlas packing.
- [ ] Runtime uses nearest-neighbor drawing and no non-uniform scaling.
- [ ] Gameplay/simulation code remains unchanged unless the task explicitly changes gameplay.
- [ ] Review a deterministic 1200×675 gameplay screenshot before updating the benchmark hash.
