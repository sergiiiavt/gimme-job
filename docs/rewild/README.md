# Rewild visual production

This directory contains the Rewild visual-production contracts and review history.

## Current authority

- [`ART_BIBLE.md`](ART_BIBLE.md) is now a **canonical authority wrapper**. It points to the current audited contracts instead of carrying a second independent visual specification.
- [`visual-bible/`](visual-bible/) contains the seven retained Visual Bible images plus their audited usage policy.
  - [`visual-bible/REFERENCE_STATUS.json`](visual-bible/REFERENCE_STATUS.json) defines which images are approved, limited, inspiration-only, composition-only, or rejected.
  - [`visual-bible/README.md`](visual-bible/README.md) defines the current source-of-truth hierarchy, exact roster, state interpretation and corruption rule.
  - [`visual-bible/PRODUCTION_RULES.md`](visual-bible/PRODUCTION_RULES.md) defines the mandatory production workflow.
  - [`visual-bible/SPRITE_MANIFEST.md`](visual-bible/SPRITE_MANIFEST.md) is the production-art checklist.
  - [`visual-bible/PREFLIGHT.md`](visual-bible/PREFLIGHT.md) must be checked before every sprite batch.
  - [`visual-bible/HEX_GEOMETRY_CONTRACT.md`](visual-bible/HEX_GEOMETRY_CONTRACT.md) records the implemented regular flat-top geometry.
- [`VISUAL_TARGET_CONTRACT.md`](VISUAL_TARGET_CONTRACT.md) defines current scene-level visual acceptance criteria without changing gameplay.

## Supporting / historical documents

- [`ASSET_GAP_MATRIX.md`](ASSET_GAP_MATRIX.md) audits active atlas gaps and fallback risks.
- [`ASSET_AUDIT.md`](ASSET_AUDIT.md) records keep/rework/replace decisions for older assets.
- [`VERTICAL_SLICE_PLAN.md`](VERTICAL_SLICE_PLAN.md), [`PHASE1_BENCHMARK_WORLD.md`](PHASE1_BENCHMARK_WORLD.md), old prompts, `reviews/`, and `references/` contain historical planning/review material. They may contain superseded geometry, reference, roster or state wording and **must not override the current authority chain above**.

## Important audit result

The seven Visual Bible images no longer share blanket approval:
- `02-style-scale-footprint.webp` and `04-terrain-transitions.webp` are rejected and retained only for provenance;
- `01-environment-detail.webp` is useful for environment details but its roads are not an approved production road target;
- `05-industrial-modular-kit.webp` and `06-damage-states.webp` are inspiration-only within explicitly limited scopes;
- `07-gameplay-target.webp` is composition-only;
- `03-mainframe-interactions.webp` is the strongest approved interaction/composition reference.

Generated reference images are never runtime backgrounds. Runtime art must be reconstructed as separate, validated sprite/terrain modules and composed by the renderer. Gameplay code remains authoritative for entities, behavior, state, footprints and hex geometry.
