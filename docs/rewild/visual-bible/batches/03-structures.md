# Batch 03: House, Datacenter, Mainframe

Four sprites are stored as individual PNG files under `assets/rewild/v4/structures-source/`:
`house`, `house-damaged`, `datacenter`, `mainframe`. `npm run build:rewild-v4-structures` packs
them at native pixel size into `public/rewild/v4/structures-atlas-v4.png` (+ `.json` metadata).
Generated atlas/source copies are gitignored the same way as the plant/enemy unit batch; the
build recreates them.

Unlike the unit atlas, these four sprites span very different native canvas sizes (house/
house-damaged/datacenter at 80x80, mainframe at 128x128) because their gameplay footprints are
wildly different — a 3-hex house cluster vs. a 19-hex boss mainframe. `structures-atlas-v4` packs
them as a simple horizontal strip at native size rather than into uniform grid slots
(`scripts/build-rewild-v4-structures-atlas.mjs`); `app/rewild-structure-atlas-v4.ts` reads each
frame's real width/height instead of assuming one shared slot size.

## Origin and generation

These were generated fresh this session via `create_1_direction_object`, not selected from
pre-existing PixelLab review candidates (unlike Batch 02's units). An earlier attempt using
`create_map_object` with `view: "high top-down"` reproduced the exact isometric-facade problem
`enemy-popup` had in Batch 02 — visible walls, angled roofs, side faces — for all four structures.
Switching to `create_1_direction_object` with `view: "top-down"` plus explicit "satellite photo,
roof only, no walls visible" prompt language fixed the projection on the retry for all four. This
confirms the fix that worked for `enemy-popup` generalizes: the structured `view` parameter alone
is not sufficient for architecture with real height — the prompt also has to actively rule out the
isometric/3-quarter framing PixelLab defaults toward for buildings.

`plant-thornbramble`-style content-policy blocks did not recur here, but `datacenter`'s 16-frame
batch was visibly mixed quality (several candidates still isometric despite the corrected prompt);
`house`/`house-damaged`/`mainframe` were consistently compliant across nearly all candidates.
Frame selection still required a manual per-candidate check, not blind frame-0 trust.

## Governance note

Same caveat as Batch 02's 2026-08-22 follow-up: descriptions were grounded in code-authoritative
data (`HOUSE_FOOTPRINT`/`HOUSE_CENTER`, `DataNode`, `createFacilityFootprint` in
`app/rewild-world.ts`; in-game flavor text "Last human house" / "AI slop datacenter" / "Mainframe
Core" from `inspectHex`) and the *approved* references — `03-mainframe-interactions.webp`
(composition), `05-industrial-modular-kit.webp` (hardware motifs, inspiration-only), and
`06-damage-states.webp` (degradation mood for `house-damaged`, inspiration-only) — not the
`rejected` `02-style-scale-footprint.webp` roster sheet.

## Scale tuning

The old v2/v3 procedural fallback's `scale` constants in `rewild-production-renderer.ts`
(`drawHouse`, `drawDatacenter`) were tuned for those sprites' own proportions and did not carry
over. Each structure's real on-screen footprint bounding box was computed directly from the
code-authoritative hex geometry (`hexDisk`, `hexPolygon`, `HOUSE_FOOTPRINT` in
`app/rewild-world.ts`) and compared against candidate scales by rendering the sprite next to its
actual footprint outline in the live renderer:

- `house` / `house-damaged`: 3-hex cluster, ~73.5x72.7px bounding box, native 80x80px source ->
  `scale: .95`.
- `datacenter`: `hexDisk(anchor, 1)`, 7 hexes, ~105x109px bounding box, native 80x80px source ->
  `scale: 1.28`.
- `mainframe`: `hexDisk(anchor, 2)`, 19 hexes, ~168x182px bounding box, native 128x128px source ->
  `scale: 1.28` (same fill ratio as datacenter; the radial design reaches toward the outer hex
  ring at this scale, reading as a boss structure that dominates its whole territory).

## Integration seam

`app/rewild-pixel-atlas.ts` now checks a second v4 set (`V4_STRUCTURE_SPRITES`, gated by
`REWILD_STRUCTURE_V4_IDS`) after the existing unit check and before the v3/v2 fallback chain, so
`house`/`house-damaged`/`datacenter`/`mainframe` route to `drawRewildStructureV4Sprite` the same
way the Batch 02 roster routes to `drawRewildEntityV4Sprite`. `rewild-production-renderer.ts` was
only touched to update the two `scale` call sites above; its draw call structure (health bars,
shadow discs, alpha-on-low-hp) is unchanged.

## Known gap (not addressed by this batch)

Only one visual state per structure exists (`house`/`house-damaged` covers HP-based house damage;
`datacenter`/`mainframe` have no damaged/collapsed art yet — `drawDatacenter` still only modulates
alpha at low HP). Per `SPRITE_MANIFEST.md` section A, exact damage/collapse variants for
datacenter and mainframe require an explicit HP/stage mapping before a future art batch should
attempt them.
