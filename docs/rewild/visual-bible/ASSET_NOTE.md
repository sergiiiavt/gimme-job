# Visual Bible asset note

The checked-in WebP files are review-weight derivatives of the seven original chat images to keep repository size reasonable. They are retained for provenance and are **not production sprites**.

The seven files no longer share one blanket approval status. Read `REFERENCE_STATUS.json` before using any of them. In particular:
- rejected references must not be supplied to generation prompts;
- no Visual Bible image is an approved production-pixel extraction source unless explicitly changed in `REFERENCE_STATUS.json`;
- generated labels, roster panels, state names, footprint diagrams and hex guides are non-authoritative unless code and the manifest explicitly agree.

Production sprites are generated/prepared separately and validated against the permitted reference scopes at actual gameplay scale.
