# Batch 02: plant and enemy units

Nine of the ten roster-mapped unit sprites are stored as individual 32×32 PNG files under
`assets/rewild/v4/entities-source/`: `plant-sunbloom`, `plant-thornbramble`, `plant-sporecap`,
`plant-vinewhip`, `plant-rootreclaimer`, `plant-elderoak`, `plant-elderoak-mature`,
`enemy-clickbait`, `enemy-deepfake`, `enemy-fragment`. `npm run build:rewild-v4-entities` packs
them at native pixel size into `public/rewild/v4/entities-atlas-v4.png` (+ `.json` metadata).
Generated atlas/source copies are gitignored the same way as Batch 01B/01C; the build recreates
them.

`plant-elderoak` and `plant-elderoak-mature` are intentionally the same authored source file.
Only one oak identity was produced; the renderer already presents `elderoak` at two different
`scale` values depending on `plant.age`, so one sprite covers both states per
`PRODUCTION_RULES.md` #1 ("elderoak may have young/mature visual states, but it remains one
gameplay unit type").

## Origin and selection

These sprites came from 14 objects already sitting in `review:awaiting-selection` status in the
connected PixelLab account from an earlier, unfinished session — not a fresh generation by this
batch. The account's subscription generation balance was `0` when this batch ran, so no new
PixelLab generations were possible; work was limited to reviewing and finalizing existing
candidates. For each of the 9 accepted units, candidate frame 0 of 64 was inspected at 8×
nearest-neighbor upscale and selected via `select_object_frames`. The other 63 candidates per
object were not exhaustively reviewed; PixelLab candidate batches are consistent-style variants
of one generation, and frame 0 was already clean and on-model in every case.

Four of the 14 review objects were **not** integrated and are unrelated to this batch's scope:
- `enemy-popup` — see "Known exclusion" below.
- House, Datacenter, Mainframe candidates — out of scope (this batch covers units, not
  structures) and, on inspection, generated as full isometric building facades (visible walls,
  a window, roof pitch) rather than strict-overhead. They remain in PixelLab review, untouched.
- One generic "cozy 16-bit isometric asset pack" style-test object — not mapped to any roster
  ID, left untouched.

## Known exclusion: `enemy-popup`

All sampled `enemy-popup` candidates (frames 0, 10, 30, 50 of 64) rendered as a vertical,
wall-mounted glass pane/window at an oblique angle with visible frame depth — consistent with
the batch's prompt, which requested "2:1 isometric perspective." This directly conflicts with
`VISUAL_TARGET_CONTRACT.md` section 2 (`projection: strict 90-degree overhead orthographic`) and
`config/rewild/visual-assets.json`'s `visualContract.projection: "strict-overhead-orthographic"`.
No candidate in this batch is usable for `enemy-popup`; it remains on the v3 atlas. A future
batch needs a fresh generation with an explicit top-down/ground-level device framing (the
manifest's required cue is "screen/sign/device body with mechanical legs/wheels" seen from
above, not a mounted screen facing the camera).

## Scale compensation

Source sprites are authored at 32px native. The existing v3 entity atlas — and every `scale`
constant already tuned against it in `rewild-production-renderer.ts` (`drawPlant`, `drawEnemy`,
`enemyScale`) — assumes 64px native frames. `app/rewild-entity-atlas-v4.ts` doubles its internal
draw size (`NATIVE_TO_LEGACY_SCALE = 2`) so passing the same `scale` values produces the same
on-screen footprint as before. This keeps the renderer and gameplay-tuned scale constants
untouched.

## Shared build/validate tooling

`scripts/build-rewild-v4-entities-atlas.mjs` and `scripts/validate-rewild-v4-entities-atlas.mjs`
share their atlas-packing (canvas composite + metadata JSON write) and atlas-decoding
(alpha check + corner-transparency check) logic with the Batch 01B/01C detail-atlas
scripts, via `scripts/rewild-v4-atlas-pack.mjs` and `scripts/rewild-v4-atlas-validate-pixels.mjs`
respectively. Both `build-rewild-v4-detail-atlas.mjs` and `validate-rewild-v4-detail-atlas.mjs`
were updated to call the same shared helpers instead of duplicating that logic; the detail
atlas's built output (`environment-details-atlas-v4.png`/`.json`) is byte-identical before and
after. Unlike the atlas-family entry points themselves, these two shared helpers are plain
Node/`sharp` logic with no browser dependency, so they carry direct unit-test coverage
(`tests/rewild-v4-atlas-pack.test.mjs`) rather than a `sonar.coverage.exclusions` entry.

## Integration seam

`app/rewild-pixel-atlas.ts` (the existing v3→v2 compatibility facade already consumed by the
renderer) now checks the new roster first and routes those 9 ids to
`drawRewildEntityV4Sprite`; every other id falls through to the pre-existing v3→v2 chain
unchanged. `rewild-production-renderer.ts` was not modified.

## Known pre-existing issue (not introduced by this batch)

`public/rewild/overhead/entities-atlas-v3.png` fails strict PNG decoding (`sharp`/`libvips`
reports "invalid chunk checksum"); this is why `overhead-atlas-contract.json` already declares
`"decodePolicy": "warn-on-v3-decoder-error"` for `entities-v3`, and browsers tolerate it via
`app/rewild-pixel-atlas.ts`'s canvas-based visibility probe. This batch does not touch or fix
that file.
