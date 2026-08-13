# Rewild visual production

This directory is the source of truth for the Rewild art rebuild.

- [`ART_BIBLE.md`](ART_BIBLE.md) defines the camera, pixel language, hierarchy, palette roles, scale, layering, interaction rules, and animation budget.
- [`ASSET_AUDIT.md`](ASSET_AUDIT.md) records what can be kept, reworked, or replaced in the current runtime asset set.
- [`VERTICAL_SLICE_PLAN.md`](VERTICAL_SLICE_PLAN.md) breaks the rebuild into reviewable production gates.
- [`IMAGEGEN_PROMPT.md`](IMAGEGEN_PROMPT.md) preserves the prompt and reference roles used to create the approved vertical-slice target.
- [`reviews/gate-b/`](reviews/gate-b/) contains the modular datacenter, facility-ground, corruption, and world-connection asset review.
- [`references/`](references/) contains the approved direction, the pre-rebuild baseline, and the authoritative vertical-slice target.

Generated reference images are not runtime backgrounds. Runtime art must be reconstructed as separate, stateful sprite modules and composed by the map renderer.
