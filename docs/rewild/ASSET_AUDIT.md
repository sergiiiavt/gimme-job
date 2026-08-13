# Rewild raster asset audit

Audit decisions are measured against [`ART_BIBLE.md`](./ART_BIBLE.md) and the vertical-slice target. “Keep” means usable in the first slice with renderer grounding. “Rework” means the subject is useful but requires pixel-density, palette, padding, or state treatment. “Replace” means it cannot define the target quality bar.

## Loaded environment assets

| Asset | Decision | Reason / next action |
| --- | --- | --- |
| `obj-tree-deciduous.png` | Rework | Strong silhouette, but the 1254 px source is far above gameplay density. Produce clean healthy, stressed, corrupted, and dead variants with controlled nearest-neighbor export. |
| `obj-tree-pine.png` | Rework | Same density problem; add edge undergrowth and corruption variants rather than a generic oval shadow. |
| `terrain-pond-1.png` | Keep for slice | Strong shoreline detail. Split water body, shoreline, reeds, and pollution overlays for the final renderer. |
| `terrain-pond-2.png` | Keep for slice | Useful visual variation. Needs polluted-shore state and independently animated water detail. |
| `terrain-rock-1.png` | Keep | Good cluster; add grass, moss, residue, and rubble edge overlays. |
| `terrain-rock-2.png` | Keep | Useful smaller counterweight; same grounding-state additions. |
| `terrain-flowers-1.png` | Keep | Works as one colony; reduce repetition and create stressed/dead states. |
| `terrain-flowers-2.png` | Keep | Retain as second colony family with transition scattering. |
| `terrain-shrub-1.png` | Keep | Usable mid-size natural mass; needs corruption response. |
| `terrain-shrub-2.png` | Keep | Usable smaller mass; needs corruption response. |

## House and defenders

| Asset | Decision | Reason / next action |
| --- | --- | --- |
| `obj-house-v2.png` | Rework | Architecture and palette are useful; source is 1254 × 1254 and includes more transparent area than needed. Export a gameplay-scale master and assemble entrance path, garden, fence, weeds, and stones separately. Never add a broad house shadow. |
| `obj-house.png` | Replace | Legacy 40 × 40 placeholder; exclude from runtime/review. |
| `obj-sunbloom.png` | Rework | Recognizable defender but does not share the target’s deliberate pixel density. Clean silhouette, root/contact, attack anticipation, and projectile frames. |
| `obj-thornbramble.png` | Rework | Consolidate the noisy silhouette and add contact/root and damage states. |
| `obj-vinewhip.png` | Rework | Retain behavior identity; create idle, anticipation, strike, recovery, and damage frames. |
| `obj-sporecap.png` | Rework | Retain behavior identity; align palette and produce short pulse/impact states. |
| `obj-rootreclaimer.png` | Rework | Requires visible roots that connect to corrupted material and staged recovery decals. |
| `obj-elderoak-p1.png` | Rework | Align density and growth pivot with the mature form. |
| `obj-elderoak-p2.png` | Rework | Good large silhouette; create mature idle/attack/damage states without constant movement. |

## Hostile units and infrastructure

| Asset | Decision | Reason / next action |
| --- | --- | --- |
| `obj-swarm.png` | Rework | Retain red/black enemy read; clean scale and add walk/attack/damage frames. |
| `obj-sludge.png` | Rework | Retain material identity; connect its footprint to sludge rather than floating above grass. |
| `obj-popup.png` | Rework | Retain role but reduce vertical mismatch and produce controlled attack state. |
| `obj-fragment.png` | Replace | 40 × 40 placeholder quality is below the target. |
| `obj-server.png` | Replace as gameplay structure | May remain a field-guide icon temporarily. Gameplay needs a modular compound kit, not a single rack sprite. |
| `obj-mainframe.png` | Replace as gameplay structure | May remain a field-guide icon temporarily. Boss compound requires multi-system modules and an irregular footprint. |

## Ground and transition assets

| Asset family | Decision | Reason / next action |
| --- | --- | --- |
| `decal-*.png` | Keep | Correct 32 × 32 micro scale. Expand into clustered sets and suppress around readability masks. |
| `terrain-meadow.png` | Reference only | It is a 1836 × 857 RGB field and must not become one static battlefield background. Extract palette/texture ideas into deterministic continuous fields. |
| `terrain-corrupt-*.png` | Rework | Useful texture motifs, but the final system needs five connected material states and source-oriented tendrils/drains. |
| `wang-*.png` | Retire from primary renderer | Square/Wang assumptions conflict with the invisible-hex visual field. Keep only as legacy source material until continuous mask transitions replace them. |

## First production batch

Do not generate the whole game at once. The first slice will create and review:

1. datacenter compound module sheet;
2. excavation/foundation/corruption/rubble ground-state sheet;
3. house grounding kit;
4. one healthy-to-corrupted deciduous tree state family;
5. one healthy-to-polluted pond state family;
6. three cleaned defender states and two enemy states;
7. cable, drain, road-damage, and root connection overlays.

Only after these coexist successfully in one running slice should the remaining roster be produced.
