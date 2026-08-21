# V4 Batch 01 — Terrain, Road and Small Detail Primitives

Base: audited Visual Bible v1.1 (`REFERENCE_STATUS.json`).

This batch is visual-only. It must not add gameplay entities or touch simulation code.

## Production source rules

Use clean pixel-art source sprites on transparent background. No labels, no baked hex outlines, no shadows that imply a different projection. Preserve native aspect ratio. Never extract production pixels from a Visual Bible image whose `productionExtractionAllowed` value is `false`.

### 01A — Road / fence / boundary family — **REVIEW APPROVAL RETRACTED / REDESIGN REQUIRED**

Planned topology vocabulary remains:
1. `road-dirt-straight`
2. `road-dirt-curve-left`
3. `road-dirt-curve-right`
4. `road-dirt-t-junction`
5. `road-dirt-crossroads`
6. `road-dirt-narrow-trail`
7. `road-dirt-worn-edge-a`
8. `road-dirt-worn-edge-b`
9. `fence-wood-straight-a`
10. `fence-wood-straight-b`
11. `fence-wood-corner`
12. `fence-wood-gate`
13. `fence-wood-broken`
14. `barrier-stone-low`

Audit correction:
- the earlier Batch 01A review approval is withdrawn;
- road drawings in `01-environment-detail.webp` are illustrative and **not** approved production road art;
- `04-terrain-transitions.webp` is rejected and must not be used in road/transition generation;
- existing experimental road source work must not be promoted merely because topology/connector logic is valid;
- define and review a new production road target before atlas integration resumes.

Fence/barrier motifs in `01-environment-detail.webp` may still inform visual language, but clean production sprites require a fresh production review.

### 01B — Small nature details — SOURCE LOCKED / RUNTIME INTEGRATED
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

The exact production PNG sources are committed under `assets/rewild/v4/source/` and are packed deterministically by the v4 detail-atlas build. The Visual Bible sheets are review references, not atlas source material.

### 01C — Small industrial details — SOURCE LOCKED / RUNTIME INTEGRATED
31. `industrial-cable-segment-a`
32. `industrial-junction-box-a`
33. `industrial-relay-box-a`
34. `industrial-pipe-outlet-a`
35. `industrial-vent-small-a`
36. `industrial-debris-small-a`

These six assets use the same committed-PNG and atlas pipeline as 01B. They are decorative physical hardware only and do not create gameplay entities.

## Geometry constraints

- Runtime geometry comes from `app/rewild-hex-grid.ts` and `HEX_GEOMETRY_CONTRACT.md`.
- If a temporary review guide is shown, use regular flat-top hexes: six equal sides, 120° interior angles, width/height ≈ 1.1547005.
- Production sprites themselves contain no hex outline.
- Never resize non-uniformly.
- Road/fence/pipe/cable connector directions must correspond to the six runtime neighbor directions, not arbitrary screen-space angles.
- `04-terrain-transitions.webp` must never be used as a geometry guide.

## Style constraints

Permitted references for this batch:
- `01-environment-detail.webp` — small props, fences/barriers, flora, industrial details and density only; **exclude road artwork as a production target**;
- `03-mainframe-interactions.webp` — physical industrial/nature interaction when relevant;
- `07-gameplay-target.webp` — composition/density only, excluding corruption motifs;
- `05-industrial-modular-kit.webp` — hardware inspiration only, with generated labels ignored.

Rejected references:
- `02-style-scale-footprint.webp`;
- `04-terrain-transitions.webp`.

General style:
- cozy, moderately detailed pixel art;
- natural asymmetry;
- no repeated template silhouette;
- small props remain readable without competing with units or major structures;
- industrial pieces are physical hardware, not magical fantasy motifs;
- corruption/waste is technological/ecological damage, never purple crystal terrain.

## Current strategy

1. **01A road/fence/boundary — redesign required.** Stop experimental road integration until a new production target is reviewed.
2. **01B nature details — integrated.** Do not redraw as part of the road redesign.
3. **01C industrial details — integrated.** Do not redraw as part of the road redesign.

## Acceptance gate

Before any future 01A integration:
- confirm the new road/fence production target is explicitly reviewed;
- inspect every generated asset for invented gameplay entities: expected count = 0;
- verify every intended slot and reject missing/duplicated/hallucinated items;
- confirm no stretched hex guides;
- confirm no text baked into sprite cells;
- validate alpha bounds and transparent padding;
- pack without non-uniform resizing;
- validate connector masks against the real six-neighbor grid;
- review at actual 1200×675 gameplay scale before updating any benchmark hash.
