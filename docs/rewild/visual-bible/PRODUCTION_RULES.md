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

### Gameplay structures/stateful world concepts
- House
- regular `DataNode` / Datacenter
- boss `DataNode` / Mainframe
- `FacilityRuin` after collapse

Do not invent Scout, Harvester, Ranger, Builder, factions, mobile allies, new enemy classes, magical towers, generated industrial module classes, or any other gameplay entity unless code is intentionally changed in a separate gameplay task.

## 2. Reference authority is explicit

Read `REFERENCE_STATUS.json` before using any Visual Bible image.

The seven checked-in images are retained for provenance, but they do not have equal authority:
- `03-mainframe-interactions.webp` is an approved interaction/composition reference.
- `01-environment-detail.webp` is approved for small props, fences/barriers and detail density, **not for production road art**.
- `07-gameplay-target.webp` is composition-only and must not define roster, state, geometry, or corruption motifs.
- `05-industrial-modular-kit.webp` and `06-damage-states.webp` are inspiration-only within the scopes listed in `REFERENCE_STATUS.json`.
- `02-style-scale-footprint.webp` and `04-terrain-transitions.webp` are **rejected** and must not be supplied to generation prompts or used for production extraction.

Hard rule: a generated image never overrides code, `REFERENCE_STATUS.json`, `SPRITE_MANIFEST.md`, or `HEX_GEOMETRY_CONTRACT.md`.

Generated labels are non-authoritative. A label such as `Security Core`, `Quantum Relay`, `Critical`, `Failing`, or `Overloaded` does not become a gameplay concept or runtime state merely because it appears on a sheet.

## 3. Art style

Required characteristics:
- cozy, readable pixel art;
- moderate detail, not maximal micro-detail;
- natural asymmetry;
- no repeated template silhouette across unrelated assets;
- no generic fantasy-RPG styling;
- industrial objects should look physically plausible: racks, boxes, fans, pipes, cables, wheels, tracks, gears, cooling/drainage hardware;
- wasted/corrupted land should read as technological/ecological damage, pollution, dead soil, heat/electrical stress and infrastructure impact.

Rejected corruption language:
- purple crystal fields;
- magical crystal nodes;
- fantasy glowing veins as the primary read;
- crystal chunks used as the main corruption marker.

## 4. Runtime state is code-authoritative

Current code-backed environment visual states:
- `healthy`
- `stressed`
- `corrupted`
- `dead`
- `recovering`

Current world-effect vocabulary:
- `construction`
- `impact`
- `shutdown`
- `collapse`
- `reclaim`
- `dilution`

House and DataNode visuals may react to HP/build progress and existing renderer logic. Do not create new gameplay states such as `critical`, `destroyed`, `failing`, `overloaded`, or `heavily-damaged` unless code explicitly introduces them. Visual damage variants may exist, but their mapping to runtime data must be explicit and documented.

## 5. Hex geometry is code-authoritative

Never infer production geometry from a generated reference image or stale prose. `app/rewild-hex-grid.ts` is authoritative.

Current runtime geometry:
- regular **flat-top** hexagons;
- `HEX_SIZE = 21`;
- width = `2 * size = 42` logical pixels;
- height = `sqrt(3) * size ≈ 36.373` logical pixels;
- width/height ratio ≈ `1.1547005`;
- X step = `1.5 * size = 31.5` logical pixels;
- six equal sides;
- every interior angle = 120°;
- exactly six neighbor directions.

`HEX_GEOMETRY_CONTRACT.md` supersedes older Rewild documents or generated sheets that describe the orientation as pointy-top or show stretched/irregular cells.

Hard rule: no horizontal or vertical stretching of hex cells, footprints, sprites, or biome masks. Render scale must be uniform in X and Y.

## 6. Footprints and scale

Every production asset must declare:
- stable asset id;
- visual category;
- gameplay owner, if any;
- footprint in hexes;
- native pixel box;
- anchor/pivot;
- state or runtime cue mapping;
- facing/orientation requirement;
- whether drawing may visually overlap neighboring hexes.

Large landmarks such as House, Datacenter, Mainframe, Elder Oak and connected biome clusters may occupy or visually span multiple cells. Do not squeeze a large object into one cell simply to fit a sprite-sheet slot.

Generated footprint diagrams are suggestions only until checked against code.

## 7. Connected-biome and road rules

Forest, water, road, industry and wasted/corrupted territory must read as connected regions, not repeated isolated hex stamps.

Where connections matter, support six-direction edge masks and create explicit vocabulary for:
- interior;
- exterior edge;
- corner/curve;
- junction;
- terminator;
- broken/damaged transition when required.

Biome interactions should be physical and readable: drainage pipes into ponds, cooling-water connections, forest clearing/death near Mainframe growth, industrial foundations pushing into nature, polluted or drained water edges.

### Road-specific audit rule

The road drawings in `01-environment-detail.webp` are **not approved production road sprites**. They may explain that a dirt-road family exists, but they must not be cropped, traced, or treated as the final road target. A future road batch requires a newly reviewed production road target before atlas integration. Connector topology still comes from the real six-neighbor runtime graph.

## 8. Production-file rules

- Sprite assets use transparent backgrounds unless they are terrain tiles/sheets.
- Preserve native aspect ratio.
- Nearest-neighbor rendering only in runtime.
- No smooth resampling in the game.
- No text labels baked into production sprites.
- No decorative generated hex outline baked into a sprite unless it is itself a gameplay/UI asset.
- Keep individual source sprites before packing into an atlas.
- Atlas packing must not resize individual sprites non-uniformly.
- Never extract production pixels from a reference whose `productionExtractionAllowed` value is `false`.

## 9. Variation / anti-template rule

For object families, variation should come from authored silhouette and detail changes, not random scale distortion.

Check each batch for:
- repeated identical crown/tree shapes;
- repeated identical industrial boxes;
- mirrored copies that are too obvious;
- equal spacing that looks procedural;
- same visual motif applied to unrelated enemies.

Use asymmetry, distinct silhouettes, size classes and state-specific details while preserving a common palette and pixel language.

## 10. Mandatory self-check before accepting a batch

### Reference check
- Read `REFERENCE_STATUS.json`.
- Use only references whose status and approved scope match the task.
- Do not feed rejected references into generation.
- List any exceptions from composition-only/inspiration-only references before generating.

### Code check
- Re-read entity/types on target branch.
- Verify every gameplay sprite id maps to an existing code concept.
- Flag decorative props separately from gameplay entities.
- Verify state names against code rather than generated labels.

### Geometry check
- Any visible hex guide matches `app/rewild-hex-grid.ts`: regular flat-top, six equal sides, 120° interior angles.
- Uniform X/Y scale.
- Footprint coordinates fit six-neighbor hex logic.

### Visual check
- Matches only the approved scopes of the audited Visual Bible.
- Readable at actual gameplay scale.
- No style drift toward high-detail fantasy, glossy sci-fi, or magical corruption.
- No stretched silhouettes or hexes.
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

## 11. Batch workflow

For each family:
1. Read code, `REFERENCE_STATUS.json`, `SPRITE_MANIFEST.md`, and this document.
2. Select only code-backed or explicitly approved visual-only IDs.
3. Define the exact production target for the family. Do not assume a concept sheet is production-ready.
4. Generate/redraw only that family using permitted references.
5. Reject hallucinated, distorted, duplicated, or out-of-scope items before integration.
6. Extract/prepare clean production sprites only from production-approved output.
7. Validate geometry/dimensions/alpha.
8. Pack into v4 atlas without resizing distortion.
9. Integrate behind existing renderer seams.
10. Run repository tests + visual benchmark.
11. Review gameplay-scale screenshot against the permitted reference scopes.

One family at a time. Do not redraw already accepted families merely because another family is being changed.
