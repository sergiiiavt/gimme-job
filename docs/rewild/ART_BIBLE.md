# Rewild visual production bible

This document converts the approved visual direction into production constraints. The reference is [`vertical-slice-target-v1.png`](./references/vertical-slice-target-v1.png). It is an art and composition target, not a bitmap to place behind gameplay.

## Product objective

The battlefield must read as one stateful physical place. Terrain, structures, units, and props cannot look like isolated pictures placed on a flat green field. Every major object must alter, overlap, connect to, or react to its surroundings.

The invisible hex topology remains authoritative for gameplay. It must not define the visible terrain silhouette.

## Camera and pixel language

- View: three-quarter top-down strategy-game view.
- Internal reference canvas: `1200 × 675`, presented at integer or pixelated scaling.
- Logical hex diameter: about `50 px`; this is a simulation scale, not a visible tile size.
- Authoring density: assets may be authored at four times the final pixel density, but final exports must use nearest-neighbor downsampling and share one apparent pixel size.
- Light: stable upper-left daylight.
- Highlights: upper and left-facing surfaces.
- Contact darkening: immediately below rooted objects, walls, rocks, and machines.
- Cast shadows: short, quiet, and directional. The house must not have a large oval shadow.
- Outlines: colored dark edges, not uniform black borders.
- No blur, vector-smooth curves, painterly texture, antialiased scaling, or mixed-resolution pixels.

## Visual hierarchy

1. Active defenders, enemies, and combat feedback.
2. House and active datacenter compound.
3. Healthy-to-corrupted terrain structure.
4. Roads, ponds, forests, and large prop clusters.
5. Grounding details and transitions.
6. Micro-detail.

At least 20% of traversable ground remains visually quiet. Density must form clusters and gradients rather than cover every location equally.

## Palette roles

These are role anchors rather than a hard indexed palette. New assets should remain close to them and introduce a new hue only for gameplay meaning.

| Role | Anchor colors |
| --- | --- |
| Meadow light | `#8dae48`, `#71973b` |
| Meadow dark | `#416f31`, `#294c2b` |
| Living foliage | `#567f28`, `#2f682d`, `#173d2b` |
| Warm soil | `#a27a45`, `#755136`, `#4c372b` |
| Natural water | `#276d82`, `#194c68`, `#112f4b` |
| Natural stone | `#8b8b76`, `#62685f`, `#3d4643` |
| Concrete/steel | `#8a9294`, `#5c666c`, `#30373d`, `#1c2227` |
| Warning/utility | `#d69a2e`, `#8f6020` |
| Corruption soil | `#584b3f`, `#393438`, `#202228` |
| Severe contamination | `#674b76`, `#3e304c`, `#7f9f36` |

Combat projectiles may be brighter than the environment, but only while an attack is active.

## Layer contract

The renderer composes the world in this order:

1. macro meadow color fields;
2. continuous road, water, dirt, and corruption masks;
3. transition decals crossing simulation boundaries;
4. excavation, foundations, rubble, worn ground, roots, and cable trenches;
5. freestanding environment objects;
6. compound modules and connected infrastructure;
7. defenders and enemies, depth-sorted by ground pivot;
8. restrained event effects;
9. foreground overlap and placement overlay.

No object may carry a large baked patch of generic meadow. Transparent assets contain only the object and deliberately authored grounding fragments.

## Scale sheet

Sizes are final on the `1200 × 675` battlefield. Transparent padding is excluded.

| Family | Visible width | Ground footprint | Notes |
| --- | ---: | ---: | --- |
| Micro decal | `3–14 px` | none | tuft, leaf, pebble, small flower |
| Small defender | `28–48 px` | `18–30 px` | clear silhouette and shared root pivot |
| Heavy defender | `56–88 px` | `34–52 px` | mature Elder Oak only |
| Small enemy | `24–44 px` | `18–30 px` | one readable dark mass plus accent |
| Tree | `90–150 px` | `30–55 px` | canopy can overlap neighbors |
| Rock/shrub cluster | `55–130 px` | `40–100 px` | asymmetric perimeter |
| House | `118–155 px` | `90–125 px` | worn entrance, fence/garden assembled separately |
| Pond | `170–310 px` | logical water region | shoreline and water are separate layers in the final system |
| Datacenter module | `50–150 px` | multi-hex | modules share concrete, lighting, and connection rules |
| Full datacenter compound | `300–520 px` | `7–19 hexes` | never a single sprite or rectangular box |

## Required physical relationships

### House

- Worn entrance path connects to the road or local path network.
- Small garden, fence pieces, stones, weeds, and shrubs make a lived-in perimeter.
- Tall vegetation is suppressed behind the silhouette.
- No broad oval shadow. Use contact darkening under walls and small cast shadows from individual details.

### Datacenter

- Stage 0: survey stakes, tracks, removed vegetation, irregular excavation, soil piles.
- Stage 1: compacted substrate, concrete footings, trenches, delivered material.
- Stage 2: connected wall/server/cooling/power modules, perimeter barriers, construction debris.
- Stage 3: complete compound, cable bundles, drainage, loading access, vents, utility activity.
- Destruction: disconnected modules, broken slabs, exposed cabling, equipment debris, reclaimable rubble.

Every compound requires at least three visible systems: compute, cooling, and power/distribution.

### Corruption

The visual gradient is continuous:

`healthy vegetation → stressed/yellow vegetation → exposed soil → cracked dead ground → dark technological sludge`

- Roads conduct contamination and gain cracks/cable crossings.
- Water resists ground spread but can become polluted from a connected drain or shoreline source.
- Trees lose local foliage, discolor, then expose dead branches.
- Rocks collect residue and synthetic fragments at their base.
- Destroyed infrastructure does not instantly restore the land.

### Reclamation

`sludge thins → rubble/soil exposed → shoots and roots → young meadow → mature healthy ground`

The logical recovery may be immediate, but the rendered transition has state and duration.

## Datacenter production kit

The first vertical slice requires the following modular families:

- 4 wall/corner modules;
- 3 server-hall roof/body variants;
- 3 cooling units and fan banks;
- 2 power/transformer modules;
- loading bay and access door;
- fence, barrier, gate, and warning post variants;
- cable trunk, junction, bend, split, ground entry, and damaged variants;
- drain/outlet and polluted-outlet variants;
- crates, barrels, pallets, work lights, bins, vents, and utility cabinets;
- four excavation/foundation ground stages;
- three destruction/rubble states.

These modules are assembled by the renderer. The compound may not be baked as one enormous image.

## Animation budget

Normal scenery is static. Movement is event-driven.

| Event | Budget |
| --- | --- |
| Water | one subtle ripple cluster every `3–7 s` per pond |
| Wind | occasional regional foliage response; never all vegetation together |
| Construction | machinery/worker cue only during a stage transition |
| Datacenter active | sparse fan, status light, exhaust, or drain activity |
| Attack | one anticipation cue, projectile/beam, and short impact |
| Damage | short hit flash, debris, or local shake; never global shaking |
| Corruption | slow pulse only close to an active source or outlet |
| Reclamation | brief root growth and material replacement |

Idle bobbing, constant jitter, perpetual glowing, and simultaneous ambient motion are prohibited.

## Vertical-slice acceptance criteria

- The terrain remains credible when all units are hidden.
- The datacenter reads as a constructed compound with connected systems.
- Healthy and corrupted ground are distinguishable without a hard border.
- The house reads as part of the site and has no artificial oval shadow.
- Ponds, trees, rocks, and flower masses have asymmetric grounding transitions.
- A screenshot contains both dense and quiet regions.
- The placement hex is the only normally visible hex shape.
- Assets share apparent pixel density, viewpoint, palette, and lighting.
- No large region is a flat fill or repeated rectangular texture.
- No animation exists unless it communicates a world event or state.

## Reference use

- `approved-world-direction.png`: concept and interaction direction.
- `baseline-before-vertical-slice.png`: evidence of the current density and integration gap.
- `vertical-slice-target-v1.png`: authoritative first-slice quality and composition target.

The generated references may guide production but must not be shipped as a gameplay background.
