# Rewild Hex Geometry Contract

Status: authoritative geometry note for production art and visual review.

## Source of truth

`app/rewild-hex-grid.ts` is authoritative for runtime hex geometry. Generated reference images and older Rewild prose are not allowed to override it.

The current runtime constructs each polygon with six vertices spaced by `Math.PI / 3` radians and uses:

- `hexWidth = size * 2`
- `hexHeight = sqrt(3) * size`
- `hexXStep = size * 1.5`
- `HEX_SIZE = 21`

Therefore the current field uses regular **flat-top** hexagons:

- width = 42 logical px
- height ≈ 36.373 logical px
- width/height ≈ 1.1547005
- six equal sides
- six 120° interior angles
- six neighbor directions

## Non-distortion rule

Do not stretch a hex, footprint, biome mask, sprite, screenshot, or atlas frame independently on X or Y. Runtime scaling is uniform. If a generated review image contains a visibly tall or wide distorted hex, that geometry is rejected even if the surrounding art is useful.

## Older documentation

Older Rewild documents and configuration currently contain historical `pointy-top` wording. That wording describes an earlier target direction and is stale relative to the implemented grid. For production work, this document and the runtime code supersede that orientation label.

Changing the runtime orientation itself is a gameplay/input/renderer migration and must be treated as a separate explicit task. Visual-asset work must conform to the current implemented geometry instead.
