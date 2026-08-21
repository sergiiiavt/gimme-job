# Rewild Visual Bible v1.1 — audited reference set

This directory keeps the seven original generated reference sheets for provenance, but **not every image is production-authoritative**. Before using any image for generation, extraction, integration, or review, read [`REFERENCE_STATUS.json`](REFERENCE_STATUS.json).

## Source-of-truth hierarchy

1. **Gameplay/runtime code is authoritative for what exists, how it behaves, runtime state, footprints, and the actual hex geometry.**
   - `app/rewild-world.ts`
   - `app/rewild-balance.ts`
   - `app/rewild-simulation.ts`
   - `app/rewild-hex-grid.ts`
2. **`REFERENCE_STATUS.json` is authoritative for how each of the seven images may be used.**
3. A generated image is authoritative only for the visual qualities explicitly approved for that file. Text labels, implied mechanics, roster panels, state names, footprints, and hex guides inside generated images are never automatically authoritative.
4. Generated art must never introduce gameplay entities, factions, abilities, movement systems, structures, states, or mechanics that do not exist in code.
5. [`HEX_GEOMETRY_CONTRACT.md`](HEX_GEOMETRY_CONTRACT.md) records the implemented regular flat-top geometry and supersedes generated or stale geometry wording.

## Reference status

| File | Status | Allowed use | Explicit exceptions |
| --- | --- | --- | --- |
| `01-environment-detail.webp` | **approved with exceptions** | small nature/industrial props, fences/barriers, environment density and placement language | **road artwork is not a production target**; do not crop final road sprites from this sheet; not a geometry source |
| `02-style-scale-footprint.webp` | **REJECTED** | provenance only | roster panel is not code-faithful; purple crystal corruption; must not be used for prompts, scale, footprints, roster, or production extraction |
| `03-mainframe-interactions.webp` | **approved** | drainage, pollution, forest damage, expansion corridors, physical environment interaction | not a roster, footprint, or geometry source |
| `04-terrain-transitions.webp` | **REJECTED** | provenance only | irregular/elongated cells and purple crystal corruption; must not be used for prompts or transition production |
| `05-industrial-modular-kit.webp` | **inspiration only** | hardware motifs, pipes, cables, cooling/drainage, foundations, rubble | generated module names are not gameplay entities; exact footprint/projection is non-authoritative |
| `06-damage-states.webp` | **inspiration only** | degradation/readability/recovery mood | generated state labels are not runtime states; purple crystal corruption is invalid |
| `07-gameplay-target.webp` | **composition only** | overall density, composition, readability, nature/industry balance | roster/state/geometry are non-authoritative; purple crystal corruption is invalid |

Rejected images remain in this directory only so the provenance is explicit. **Rejected files must not be supplied to future sprite-generation prompts and must not be used as production extraction sources.**

## Canonical gameplay roster

The roster below comes from code, not from any image.

### Plants — exact six
- `sunbloom` — Sunbloom
- `thornbramble` — Thornbramble
- `sporecap` — Sporecap
- `vinewhip` — Vinewhip
- `rootreclaimer` — Rootreclaimer
- `elderoak` — Elder Oak

`elderoak` may use young/mature visuals, but it remains one gameplay unit type.

### Enemies — exact four
- `clickbait` — AI Slop Swarm
- `deepfake` — Deepfake Sludge
- `popup` — Popup Parasite
- `fragment` — AI Slop Fragment

### Stateful gameplay/world concepts
- House
- regular `DataNode` / Datacenter
- boss `DataNode` / Mainframe
- `FacilityRuin` after collapse

Datacenter and Mainframe are structures, not unit roster entries.

## Canonical state vocabulary

Generated state labels do not create runtime state. Current code-backed environment visual states are:
- `healthy`
- `stressed`
- `corrupted`
- `dead`
- `recovering`

Current world-effect vocabulary is:
- `construction`
- `impact`
- `shutdown`
- `collapse`
- `reclaim`
- `dilution`

House/DataNode damage can be visualized from runtime HP/build progress and existing renderer cues, but labels such as **Critical**, **Destroyed**, **Failing**, **Overloaded**, or **Heavily Damaged** must not be promoted to gameplay state merely because they appear on a concept sheet.

## Corruption rule

Production corruption is wasted/contaminated technological and ecological damage: polluted or dead soil, electrical/thermal stress, damaged infrastructure, cables/conductive traces, dead vegetation, drainage/waste effects.

**Purple crystals, magical veins, fantasy corruption nodes, or glowing crystal fields are rejected visual language.** If an otherwise useful reference contains them, ignore that portion.

## Road rule after audit

The road family is **not currently visually approved for production**. Existing road drawings in the Environment Detail Sheet are illustrative only. Future road work must start from a newly defined production road target, while connector topology and regular hex placement come from code.

See [`PRODUCTION_RULES.md`](PRODUCTION_RULES.md), [`SPRITE_MANIFEST.md`](SPRITE_MANIFEST.md), [`PREFLIGHT.md`](PREFLIGHT.md), [`REFERENCE_STATUS.json`](REFERENCE_STATUS.json), and [`HEX_GEOMETRY_CONTRACT.md`](HEX_GEOMETRY_CONTRACT.md) before generating or integrating any new sprite batch.
