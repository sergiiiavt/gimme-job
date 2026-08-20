# Batch 01B/01C production extraction

The accepted small nature and industrial detail sprites are extracted into `public/rewild/v4/sources/` and packed at native source scale into `public/rewild/v4/environment-details-atlas-v4.png`.

Rules:
- no non-uniform resizing during packing;
- no labels or hex outlines in production sprites;
- code remains authoritative for gameplay entities;
- these assets are visual-only environmental details;
- `detail-rock-small-a`, `detail-rock-small-b`, and `detail-rock-medium-a` remain flagged for a later silhouette-variation pass; this does not block the rest of Batch 01B/01C integration.
