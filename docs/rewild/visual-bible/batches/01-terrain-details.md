# V4 Batch 01 — Terrain, Road and Small Detail Primitives

Base: Visual Bible v1.

This batch is visual-only. It must not add gameplay entities or touch simulation code.

## Production source layout

Generate clean pixel-art source sprites on transparent background. No labels, no baked hex outlines, no shadows that imply a different projection. Preserve native aspect ratio.

### 01A — Road / fence / boundary family — REVIEW APPROVED
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

Approval note: the Batch 01A review sheet was explicitly approved in chat on 2026-08-20. It locks the road/fence/barrier style direction for clean production export. The review poster itself is not the final runtime atlas.

### 01B — Small nature details — SOURCE LOCKED / RUNTIME INTEGRATION
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

The 16 exact assets are stored losslessly-for-pipeline as base64 PNG source bundles under `assets/rewild/v4/source-b64/`. They are deterministically decoded and packed during local development, validation, and production build. No generated contact-sheet labels or background pixels enter the runtime atlas.

### 01C — Small industrial details — SOURCE LOCKED / RUNTIME INTEGRATION
31. `industrial-cable-segment-a`
32. `industrial-junction-box-a`
33. `industrial-relay-box-a`
34. `industrial-pipe-outlet-a`
35. `industrial-vent-small-a`
36. `industrial-debris-small-a`

These six assets use the same deterministic source-bundle and atlas pipeline as 01B. They are decorative physical hardware only and do not create gameplay entities.

## Geometry constraints

- Runtime geometry comes from `app/rewild-hex-grid.ts` and `HEX_GEOMETRY_CONTRACT.md`.
- If a temporary review guide is shown, use regular flat-top hexes: six equal sides, 120° interior angles, width/height ≈ 1.1547005.
- Production sprites themselves contain no hex outline.
- Never resize non-uniformly.
- Road/fence/pipe/cable connector directions must correspond to the six runtime neighbor directions, not arbitrary screen-space angles.

## Style constraints

- Match Visual Bible `01-environment-detail.webp`, `04-terrain-transitions.webp`, and `07-gameplay-target.webp`.
- Cozy, moderately detailed pixel art.
- Natural asymmetry.
- No repeated template silhouette.
- Small props remain readable without competing with units or major structures.
- Industrial pieces are physical hardware, not magical/electrical fantasy motifs.

## Generation strategy

1. 01A road/fence/boundary — 14 exact assets. **Review approved; connector-aware production export is next.**
2. 01B nature details — 16 exact assets. **Source locked and wired to v4 authored overlay.**
3. 01C industrial details — 6 exact assets. **Source locked and wired to v4 authored overlay.**

No further concept-sheet generation is required for 01B/01C. New generation is allowed only for a specific rejected/missing production asset or a later explicitly defined family.

## Acceptance gate

Before integration:
- inspect generated sheet for invented gameplay entities: expected count = 0;
- verify every intended slot and reject missing/duplicated/hallucinated items;
- confirm no stretched hex guides;
- confirm no text baked into sprite cells;
- crop/export each accepted source separately;
- validate alpha bounds and transparent padding;
- pack without non-uniform resizing;
- review at actual 1200×675 gameplay scale.
