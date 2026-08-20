# V4 Batch 01 — Terrain, Road and Small Detail Primitives

Base: Visual Bible v1.

This batch is visual-only. It must not add gameplay entities or touch simulation code.

## Production source layout

Generate clean pixel-art source sprites on transparent background. No labels, no baked hex outlines, no shadows that imply a different projection. Preserve native aspect ratio.

### Road family
1. `road-dirt-straight`
2. `road-dirt-curve-left`
3. `road-dirt-curve-right`
4. `road-dirt-t-junction`
5. `road-dirt-crossroads`
6. `road-dirt-narrow-trail`
7. `road-dirt-worn-edge-a`
8. `road-dirt-worn-edge-b`

### Fence / boundary family
9. `fence-wood-straight-a`
10. `fence-wood-straight-b`
11. `fence-wood-corner`
12. `fence-wood-gate`
13. `fence-wood-broken`
14. `barrier-stone-low`

### Small nature detail family
15. `detail-grass-tuft-a`
16. `detail-grass-tuft-b`
17. `detail-grass-tuft-c`
18. `detail-wild-weeds`
19. `detail-flower-yellow`
20. `detail-flower-purple`
21. `detail-mushrooms`
22. `detail-pebbles`
23. `detail-rock-small-a`
24. `detail-rock-small-b`
25. `detail-rock-medium-a`
26. `detail-log-a`
27. `detail-stump-a`
28. `detail-shrub-low-a`
29. `detail-reeds-a`
30. `detail-lily-pads-a`

### Small industrial detail family
31. `industrial-cable-segment-a`
32. `industrial-junction-box-a`
33. `industrial-relay-box-a`
34. `industrial-pipe-outlet-a`
35. `industrial-vent-small-a`
36. `industrial-debris-small-a`

## Geometry constraints

- Any optional hex guide used during review must be regular pointy-top with width/height ≈ 0.8660254.
- Production sprites themselves should not contain a hex outline.
- Never resize non-uniformly.
- Road/fence/pipe/cable connector directions must correspond to the six runtime neighbor directions, not arbitrary screen-space angles.

## Style constraints

- Match Visual Bible `01-environment-detail.webp`, `04-terrain-transitions.webp`, and `07-gameplay-target.webp`.
- Cozy, moderately detailed pixel art.
- Natural asymmetry.
- No repeated template silhouette.
- Small props should remain readable without competing with units or major structures.
- Industrial pieces are physical hardware, not magical/electrical fantasy motifs.

## Acceptance gate

Before integration:
- inspect generated sheet for invented gameplay entities: expected count = 0;
- verify all 36 intended source slots and reject missing/duplicated/hallucinated items;
- confirm no stretched hex guides;
- confirm no text baked into sprite cells;
- crop/export each accepted source separately;
- validate alpha bounds and transparent padding;
- pack without non-uniform resizing;
- review at actual 1200×675 gameplay scale.
