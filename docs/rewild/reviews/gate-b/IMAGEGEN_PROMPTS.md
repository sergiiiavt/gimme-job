# Gate B image-generation prompts

All three source sheets were generated with the built-in image-generation workflow. `vertical-slice-target-v1.png` was supplied as a style, scale, palette, and perspective reference. The generated source used a flat magenta chroma field, which was removed locally with the imagegen skill's `remove_chroma_key.py` helper. Runtime atlases were then reduced to 50% with nearest-neighbor sampling.

## Datacenter modules

Create a production modular sprite sheet for a 2D tower-defense game: exactly sixteen separate datacenter compound pieces in a strict 4 by 4 layout—server-hall body, server-hall roof, wall straight, wall corner, cooling fan bank, transformer/power unit, loading bay, access door, fence straight, fence corner, security gate, concrete barriers, cable-entry cabinet, drain outlet, utility crates, and damaged wall/rubble. Match the reference's handcrafted pixel art, three-quarter gameplay view, upper-left light, gray steel/concrete, and restrained amber utility accents. Each item must be a self-contained cutout with generous gutters and a consistent ground pivot. Use a perfectly flat `#ff00ff` chroma background. No baked meadow, terrain field, people, vehicles, labels, grid, hexes, broad shadows, UI, or watermark.

## Facility ground states

Create a production terrain-state sprite sheet for a 2D tower-defense game: exactly twelve separate irregular ground patches in a strict 4 by 3 layout—survey stakes and trampled meadow, excavation and removed roots, compacted gravel, concrete footings and trench, cracked concrete apron, active cable trench, healthy-to-stressed grass, stressed grass-to-exposed soil, exposed soil-to-cracked ground, cracked ground-to-technological sludge, damaged slab/rubble, and early reclamation. Match the reference's handcrafted pixel density, upper-left light, organic silhouettes, warm soil, concrete, yellow stress, violet-charcoal corruption, and restrained sickly-green contamination. Use actual material replacement, never translucent overlays or visible tile/hex boundaries. Use a perfectly flat `#ff00ff` chroma background. No buildings, units, UI, text, grid, or watermark.

## World connections

Create a production connection-overlay sprite sheet for a 2D tower-defense game: exactly twenty-four separate pieces in a strict 6 by 4 layout. Include six cable shapes; cable entry, broken cable, clean and polluting drains, road cable crossing and trench; road cracks, broken asphalt, rubble, damaged concrete and rebar; healthy, bending, reclaiming and severed roots; clean shoreline inlet and polluted shoreline outlet. Match the reference's handcrafted pixel art, gameplay scale, upper-left light, and material palette. Give each connector clean endpoints and generous separation so independent objects can meet across invisible simulation cells. Use a perfectly flat `#ff00ff` chroma background. No full terrain patches, buildings, units, broad shadows, labels, grid, hexes, UI, or watermark.
