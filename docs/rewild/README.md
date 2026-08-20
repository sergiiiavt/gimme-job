# Rewild visual production

This directory is the source of truth for the Rewild art rebuild.

- [`ART_BIBLE.md`](ART_BIBLE.md) defines the camera, pixel language, hierarchy, palette roles, scale, layering, interaction rules, and animation budget.
- [`visual-bible/`](visual-bible/) contains the seven approved Visual Bible v1 references plus the production-art rules, exact sprite manifest, and mandatory preflight checklist. Gameplay code remains authoritative for roster and behavior; these images are visual-only references.
- [`VISUAL_TARGET_CONTRACT.md`](VISUAL_TARGET_CONTRACT.md) turns the current post-#245 target into an explicit visual acceptance gate without changing gameplay.
- [`ASSET_GAP_MATRIX.md`](ASSET_GAP_MATRIX.md) audits the active v3 overhead atlases, fallback risks, missing visual vocabulary, and next production priorities.
- [`ASSET_AUDIT.md`](ASSET_AUDIT.md) records what can be kept, reworked, or replaced in the older runtime/source asset set.
- [`VERTICAL_SLICE_PLAN.md`](VERTICAL_SLICE_PLAN.md) breaks the rebuild into reviewable production gates.
- [`IMAGEGEN_PROMPT.md`](IMAGEGEN_PROMPT.md) preserves the prompt and reference roles used to create the approved vertical-slice target.
- [`reviews/gate-b/`](reviews/gate-b/) contains the modular datacenter, facility-ground, corruption, and world-connection asset review.
- [`references/`](references/) contains the approved direction, the pre-rebuild baseline, and the authoritative vertical-slice target.

Generated reference images are not runtime backgrounds. Runtime art must be reconstructed as separate, stateful sprite modules and composed by the map renderer.
