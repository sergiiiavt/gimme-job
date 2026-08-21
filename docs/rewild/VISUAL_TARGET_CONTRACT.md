# Rewild target visual contract — audited

Status: current scene-level acceptance contract for the Rewild visual rebuild.

This document does not redefine gameplay. The authority chain is defined in [`ART_BIBLE.md`](ART_BIBLE.md) and [`visual-bible/README.md`](visual-bible/README.md). Before using any of the seven generated reference sheets, read [`visual-bible/REFERENCE_STATUS.json`](visual-bible/REFERENCE_STATUS.json).

## 1. Gameplay is frozen

Rewild remains continuous real-time tower defense.

- The player spends sunlight to place defenders.
- Placed defenders are stationary and act automatically.
- Enemies spawn in waves, move automatically, and attack automatically.
- House integrity, corruption, score, sunlight, wave progression, and win/loss rules remain authoritative.
- No selectable/movable allies, AP, player/enemy phases, Move/Attack/Restore commands, or End Turn control may be introduced by visual work.
- The renderer consumes a detached rendering snapshot and must not mutate simulation state.

## 2. Scene and geometry contract

- Logical scene: 1200 × 675.
- Projection: strict 90-degree overhead orthographic.
- Runtime hex field: regular **flat-top** geometry from `app/rewild-hex-grid.ts`.
- Current `HEX_SIZE`: 21 logical pixels.
- Hex width: 42 logical pixels.
- Hex height: `sqrt(3) * 21 ≈ 36.373` logical pixels.
- X step: 31.5 logical pixels.
- Six equal sides and six 120° interior angles.
- Six runtime neighbor directions.
- Scaling: uniform nearest-neighbor only; never stretch one axis independently.
- Camera/pivots should land on stable logical pixels where practical.

Generated reference hexes are not geometry sources. `04-terrain-transitions.webp` is explicitly rejected because it contains irregular/elongated cells.

## 3. Audited visual reference roles

### Approved interaction reference
`visual-bible/03-mainframe-interactions.webp`
- drainage/pollution into water;
- forest clearing/wasting;
- industrial expansion corridors;
- physical pipe/cable relationships.

### Approved with exceptions
`visual-bible/01-environment-detail.webp`
- use small nature/industrial prop style, fences/barriers, density and placement language;
- **do not use its road artwork as the production road target**;
- do not extract production pixels from the sheet.

### Composition only
`visual-bible/07-gameplay-target.webp`
- use overall density, readability, nature/industry balance and macro composition;
- ignore purple crystal corruption;
- never infer roster/state/geometry from it.

### Inspiration only
`visual-bible/05-industrial-modular-kit.webp`
- use physical hardware motifs only;
- generated module labels are not gameplay entities.

`visual-bible/06-damage-states.webp`
- use degradation/recovery readability only;
- generated state labels are not runtime states;
- ignore crystal corruption.

### Rejected
- `visual-bible/02-style-scale-footprint.webp`
- `visual-bible/04-terrain-transitions.webp`

Rejected files must not be supplied to generation prompts or used for production extraction.

## 4. Composition contract

The battlefield should read as connected macro zones before individual micro-props are noticed.

### Natural territory
Required:
- connected forest canopy masses;
- suppressed interior seams and readable exterior edges;
- integrated connected water rather than isolated blue cells;
- meso-scale shrubs, rocks, logs, stumps, roots, clearings and shoreline vegetation;
- local clusters rather than uniform one-prop-per-cell decoration;
- enough quiet cells to preserve placement and route readability.

Rejected:
- repeated identical tree circles;
- uniform stamp patterns;
- micro-detail used to hide missing macro structure;
- water that reads as separate independent hex tiles.

### House / central battlefield
Required:
- house grounded into yard/soil/vegetation context;
- readable tower-defense space around important routes and placements;
- natural transitions between meadow, yard and nearby paths.

Rejected:
- house visually dropped onto empty grass;
- repetitive chunky road pieces dominating the center.

### Industrial territory
Required:
- connected industrial material ownership;
- Datacenter/Mainframe footprints integrated into foundations/platforms;
- physical power/cooling/drainage/access relationships;
- cable/pipe/conduit/junction networks;
- machinery, vents, relays, rubble, debris and drains used as visual-only hardware where appropriate;
- visible transition from healthy territory to industrially stressed/wasted territory.

Rejected:
- isolated structures on flat dark circles;
- random boxes without physical network relationships;
- generated module labels treated as gameplay classes.

## 5. Corruption / waste contract

Production visual progression should read materially:

healthy vegetation → stressed vegetation → exposed/polluted soil → cracked/dead/wasted ground → technological/electrical residue.

Recovery should visibly reverse material ownership when gameplay clears corruption.

Approved motifs:
- dead/stressed vegetation;
- polluted water/soil;
- dark stains and residues;
- scorched/electrically stressed ground;
- broken cables/conductive traces;
- damaged industrial hardware;
- rubble and drainage waste.

Rejected motifs:
- purple crystal fields;
- magical crystal nodes;
- fantasy glowing veins as the primary read.

## 6. Runtime state contract

Generated image labels do not define state.

Code-backed environment visual states:
- `healthy`
- `stressed`
- `corrupted`
- `dead`
- `recovering`

World-effect vocabulary:
- `construction`
- `impact`
- `shutdown`
- `collapse`
- `reclaim`
- `dilution`

House/DataNode visuals may use explicit mappings from HP/build progress and existing renderer behavior. Do not create runtime states such as `critical`, `destroyed`, `failing`, `overloaded`, or `heavily-damaged` solely from the concept sheets.

## 7. Connected-material rules

### Forest
- Interior borders disappear under shared canopy.
- Interior cells favor canopy mass over repeated independent trees.
- Exterior cells carry irregular crown/understory detail.

### Water
- Shore treatment appears on exterior edges only.
- Interior water edges remain visually continuous.
- Reeds, lilies, rocks and pollution attach to selected exterior zones.

### Industry
- Industrial territory replaces meadow material rather than simply tinting it.
- Structures share foundations and physical networks.
- Empty industrial cells still read as part of the compound.

### Roads
Road topology must use six-neighbor runtime adjacency, but **current road art is not approved**. The previous Batch 01A visual approval is withdrawn. A new production road target must be reviewed before atlas integration resumes.

## 8. Pixel and file contract

- One coherent apparent pixel density.
- Nearest-neighbor runtime scaling.
- Transparent backgrounds for object sprites.
- No text labels inside production sprites.
- No generated hex outlines baked into object sprites.
- No non-uniform resizing.
- Keep individual production sources before atlas packing.
- Final atlases must strictly decode and contain visible pixels in every required frame.
- v4 must not silently fall back when a required production frame fails.

## 9. Gameplay-scale acceptance

A deterministic screenshot hash proves determinism, not artistic quality. Before accepting a new 1200×675 benchmark:

- inspect actual scale and pixel density;
- verify regular flat-top geometry and no stretch;
- verify macro/meso/micro density hierarchy;
- verify roads/shorelines/connectors read continuously;
- verify units and House remain readable;
- verify no hallucinated gameplay entities or unsupported state labels entered runtime;
- verify no purple crystal corruption survived;
- compare only against the approved scopes listed in `REFERENCE_STATUS.json`.

A visual family is not complete merely because CI is green.
