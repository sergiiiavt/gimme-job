# Batch 01B/01C production extraction

The accepted small nature and industrial detail sprites are stored as exact base64 PNG payloads under `assets/rewild/v4/source-b64/`. The build decodes those sources and packs them at native pixel size into the generated runtime atlas `public/rewild/v4/environment-details-atlas-v4.png`.

Generated atlas/source files are intentionally ignored by Git; `npm run build:rewild-v4-details` recreates them for local development, validation, and production builds.

Rules:
- no non-uniform resizing during packing;
- transparent-edge cropping in the accepted source payload is allowed only when sprite pixels are unchanged and runtime frame metadata matches exactly;
- no labels or hex outlines in production sprites;
- code remains authoritative for gameplay entities;
- these assets are visual-only environmental details;
- `detail-rock-small-a`, `detail-rock-small-b`, and `detail-rock-medium-a` remain flagged for a later silhouette-variation pass; this does not block the rest of Batch 01B/01C integration.
