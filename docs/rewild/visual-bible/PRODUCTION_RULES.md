# Rewild Production Art Rules

These rules are mandatory for every new sprite batch and every visual-integration PR.

## 1. Gameplay roster is code-locked

Before generating art, re-read `app/rewild-world.ts` on the target branch.

Current gameplay unit roster:

### Plants
- `sunbloom`
- `thornbramble`
- `sporecap`
- `vinewhip`
- `rootreclaimer`
- `elderoak`

`elderoak` may have young/mature visual states, but it remains one gameplay unit type.

### Enemies
- `clickbait` — AI Slop Swarm
- `deepfake` — Deepfake Sludge
- `popup` — Popup Parasite
- `fragment` — AI Slop Fragment

### Gameplay structures/stateful world entities
- House
- regular Data Node / Datacenter
- boss Data Node / Mainframe
- Facility ruin after collapse

Do not invent Scout, Harvester, Ranger, Builder, factions, mobile allies, new enemy classes, magical towers, or any other gameplay entity unless code is intentionally changed in a separate gameplay task.

## 2. Art style is locked to Visual Bible v1

Required characteristics:
- cozy, readable pixel art;
- moderate detail, not maximal micro-detail;
- natural asymmetry;
- no repeated template silhouette across unrelated assets;
- no generic fantasy-RPG styling;
- industrial objects should look physically plausible: racks, boxes, fans, pipes, cables, wheels, tracks, gears, cooling/drainage hardware;
- wasted/corrupted land should read as technological/ecological damage, pollution, dead soil, heat/electrical stress and infrastructure impact — not magical crystal terrain as the dominant language.

## 3. Hex geometry is code-authoritative

Runtime layout is pointy-top and regular. Never infer production geometry from a distorted generated reference.

Current values from `app/rewild-world.ts`:
- `HEX_SIZE = 21`
- regular pointy-top hex height = `2 * size = 42`
- regular pointy-top hex width = `sqrt(3) * size ≈ 36.373`
- width/height ratio ≈ `0.8660254`
- all six sides equal;
- all interior angles = 120°;
- six neighbor directions only.

Hard rule: no horizontal or vertical stretching of hex cells, footprints, sprites, or biome masks. Render scale must be uniform in X and Y.

## 4. Footprints and scale

Every production asset must declare:
- stable asset id;
- visual category;
- gameplay owner, if any;
- footprint in hexes;
- native pixel box;
- anchor/pivot;
- state;
- facing/orientation requirement;
- whether drawing may visually overlap neighboring hexes.

Large landmarks such as House, Datacenter, Mainframe, Elder Oak and connected biome clusters may occupy or visually span multiple cells. Do not squeeze a large object into one cell simply to fit a sprite-sheet slot.

## 5. Connected-biome rules

Forest, water, road, industry and wasted/corrupted territory must read as connected regions, not repeated isolated hex stamps.

Where connections matter, support six-direction edge masks and create explicit vocabulary for:
- interior;
- exterior edge;
- corner/curve;
- junction;
- terminator;
- broken/damaged transition when required.

Biome interactions should be physical and readable: drainage pipes into ponds, cooling-water connections, forest clearing/death near Mainframe growth, industrial foundations pushing into nature, polluted or drained water edges.

## 6. Production-file rules

- Sprite assets use transparent backgrounds unless they are terrain tiles/sheets.
- Preserve native aspect ratio.
- Nearest-neighbor rendering only in runtime.
- No smooth resampling in the game.
- No text labels baked into production sprites.
- No decorative generated hex outline baked into a sprite unless it is itself a gameplay/UI asset.
- Keep individual source sprites before packing into an atlas.
- Atlas packing must not resize individual sprites non-uniformly.

## 7. Variation / anti-template rule

For object families, variation should come from authored silhouette and detail changes, not random scale distortion.

Check each batch for:
- repeated identical crown/tree shapes;
- repeated identical industrial boxes;
- mirrored copies that are too obvious;
- equal spacing that looks procedural;
- same visual motif applied to unrelated enemies.

Use asymmetry, distinct silhouettes, size classes and state-specific details while preserving a common palette and pixel language.

## 8. Mandatory self-check before accepting a batch

### Code check
- Re-read entity/types on target branch.
- Verify every gameplay sprite id maps to an existing code concept.
- Flag decorative props separately from gameplay entities.

### Geometry check
- Any visible hex guide is regular pointy-top.
- Uniform X/Y scale.
- Footprint coordinates fit six-neighbor hex logic.

### Visual check
- Matches Visual Bible v1.
- Readable at actual gameplay scale.
- No style drift toward high-detail fantasy, glossy sci-fi, or magical corruption.
- No stretched silhouettes.
- No obvious template repetition.

### Technical check
- Expected dimensions and alpha are valid.
- Transparent margins are reasonable.
- No accidental clipping.
- Atlas frame does not contain another frame's pixels.
- Runtime does not silently fall back to an older generation.

### Integration check
- Simulation/gameplay code unchanged unless task explicitly requires gameplay change.
- Deterministic benchmark reviewed at 1200×675.
- Benchmark hash is updated only after visual review confirms the intentional change.

## 9. Batch workflow

For each family:
1. Read code and this document.
2. Select only approved IDs from `SPRITE_MANIFEST.md`.
3. Generate a small contact sheet for that family.
4. Reject hallucinated or distorted items before integration.
5. Extract/prepare clean production sprites.
6. Validate geometry/dimensions/alpha.
7. Pack into v4 atlas without resizing distortion.
8. Integrate behind existing renderer seams.
9. Run repository tests + visual benchmark.
10. Review gameplay-scale screenshot against Visual Bible.

One family at a time. Do not redraw already approved families merely because another family is being changed.
