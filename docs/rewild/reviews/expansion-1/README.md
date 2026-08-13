# Rewild Expansion Pack 1 — environment response

This pack replaces renderer tints on trees and ponds with independent pixel-art material states driven by the ecosystem simulation.

## Runtime assets

- `public/rewild/production/tree-response-states-v1.png`: ten deciduous/pine states — healthy, stressed, corrupted, dead, and recovering.
- `public/rewild/production/pond-response-states-v1.png`: eight wide/compact pond states — clean, contaminated, polluted, and recovering.
- Both atlases include JSON frame rectangles and normalized ground pivots.
- Existing modular root frames now visibly connect Rootreclaimers to tree networks.

## Behavior

- Tree stress derives from corruption on the tree footprint.
- Pond stress derives from corruption around its shoreline influence area.
- Falling stress enters a timed recovering material state before returning to healthy.
- Pond dilution creates one short ripple only when cleanup occurs, with a shared cooldown.
- No idle bobbing, global shaking, perpetual glow, or translucent whole-object corruption tint remains.

## Review

- `?rewildReview=response#rewild`
- `tree-response-states-v1-contact-sheet.png`
- `pond-response-states-v1-contact-sheet.png`
- `all-environment-states.png`
- `response-state.png`: desktop runtime composition at 1280 by 720.
- `mobile-response-state.png`: mobile runtime composition at 390 by 844.
- `rewild-expansion-1-review.zip`: complete source, runtime, contact-sheet, screenshot, manifest, prompt, and validation bundle.

The source chroma and alpha masters are preserved under `docs/rewild/expansion-1-sources/` for visual review and reproducible atlas builds.
