# Rewild Gate B — asset coherence

Gate B produces separate runtime-ready pieces for the datacenter, construction/corruption ground states, and world connections. It does not yet change the live renderer.

## Visual deliverables

- `native-contact-sheet.png`: all source frames at alpha-master resolution.
- `gameplay-contact-sheet.png`: all 52 named frames at the normalized gameplay scale on a transparency checker.
- `assembly-proof.png`: a deliberately simple composition made only from the runtime atlases, proving that modules and terrain states can coexist without a baked background.
- `../../gate-b-sources/*-chroma.png`: untouched built-in image-generation outputs.
- `../../gate-b-sources/*-alpha-master.png`: lossless alpha masters after deterministic chroma removal.
- `../../../../public/rewild/production/*.png`: 50%-scale runtime atlases.
- `../../../../public/rewild/production/*.json`: frame rectangles and normalized ground pivots.

## Frame inventory

| Atlas | Frames | Purpose |
| --- | ---: | --- |
| Datacenter modules | 16 | Compute, cooling, power, access, perimeter, utility, damage |
| Facility ground states | 12 | Survey, excavation, foundation, contamination, rubble, recovery |
| World connections | 24 | Cables, drains, road damage, roots, shoreline relationships |

## Gate B decisions

- Industrial objects use the same upper-left light, gray-steel palette, amber utility accents, and pixel density.
- All pieces have transparent backgrounds and remain independently composable.
- Ground changes use irregular authored material boundaries; they do not expose the simulation hex.
- Corruption is a state chain rather than one tinted overlay.
- Cables, drains, roots, road damage, and shoreline outlets have explicit connectors.
- No module includes a broad cast shadow or baked meadow.

## What Gate C must prove

The renderer must assemble these frames through state and relationships: construction replaces terrain, compute/cooling/power form one compound, cable and drain graphs meet their endpoints, corruption spreads outward from real sources, and reclamation reverses the material chain over time.
