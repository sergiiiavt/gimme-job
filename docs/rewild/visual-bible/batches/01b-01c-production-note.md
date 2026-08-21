# Batch 01B/01C production extraction

The accepted small nature and industrial detail sprites are stored as 22 individual PNG files under `assets/rewild/v4/source/`. These committed files are the production source set for this batch. The build reads them directly and packs them at native pixel size into the generated runtime atlas `public/rewild/v4/environment-details-atlas-v4.png`.

Generated atlas/source copies are intentionally ignored by Git; `npm run build:rewild-v4-details` recreates them for local development, validation, and production builds.

Rules:
- every committed source must strictly decode as PNG and retain alpha;
- the source directory must contain exactly the 22 approved IDs and no extra files;
- no non-uniform resizing during packing;
- transparent-edge cropping is allowed only when sprite pixels are unchanged and runtime frame metadata matches exactly;
- no labels or hex outlines in production sprites;
- code remains authoritative for gameplay entities;
- these assets are visual-only environmental details;
- `detail-rock-small-a`, `detail-rock-small-b`, and `detail-rock-medium-a` remain flagged for a later silhouette-variation pass; this does not block the rest of Batch 01B/01C integration.
