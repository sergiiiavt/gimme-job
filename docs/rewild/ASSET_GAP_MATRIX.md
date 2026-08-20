# Rewild authored asset gap matrix

Baseline: `main` at `f7c3c4e33b8e73e6eed9364ca9ba83267fe17d61` (PR #245).

This matrix audits the active strict-overhead runtime path, not the older perspective/source inventory in `ASSET_AUDIT.md`.

Active authored runtime files:

- `public/rewild/overhead/entities-atlas-v3.png`
- `public/rewild/overhead/terrain-atlas-v3.png`
- `app/rewild-pixel-atlas-v3.ts`
- compatibility/fallback facade: `app/rewild-pixel-atlas.ts`
- composition overlay: `app/rewild-authored-overlay.ts`

Decision meanings:

- **Keep** — sufficient as a temporary runtime component while adjacent systems improve.
- **Rework** — recognizable/useful but not sufficient for the target quality bar.
- **Replace** — should not survive as the final target asset/visual role.
- **New** — missing vocabulary required to reach the target.

## 1. Current v3 entity atlas

| Runtime ID / family | Current role | Decision | Gap / next action |
| --- | --- | --- | --- |
| `tree-broadleaf` | forest/environment | Rework | One broadleaf identity cannot create connected canopy. Keep as temporary edge/object variant; add 6–8 broadleaf variants plus canopy interior/exterior pieces. |
| `tree-pine` | forest/environment | Rework | One pine identity is insufficient. Add 3–4 variants and integrate with canopy/undergrowth composition. |
| `rock` | nature prop | Keep | Useful small/medium prop; add several silhouettes and moss/soil/corruption contexts. |
| `shrub` | nature prop | Rework | Needs at least five shrub/undergrowth variants and clustered placement. |
| `log` | nature prop | Keep | Useful meso prop; add stump/root/deadwood variants. |
| `fence` | house/nature prop | Rework | Needs connector/orientation variants rather than a single isolated stamp. |
| `sign` | house/road prop | Keep | Suitable accent; must remain sparse/contextual. |
| `flower-cluster` | meadow prop | Rework | Needs variant family and stressed/dead states. |
| `water-lilies` | water prop | Keep | Useful shoreline/interior accent; use in component-aware lake composition. |
| `grass-tuft` | meadow prop | Keep | Micro-detail only; must not carry scene density. |
| `house` | protected objective | Rework | Visible after #245 fallback, but final house needs dedicated overhead hero art and integrated yard/path framing. |
| `house-damaged` | objective state | Rework | Add critical/destroyed states and keep pivots/footprint stable. |
| `datacenter` | hostile structure | Replace as final | Current single-object role is too isolated. Convert to compound core plus explicit foundation/cooling/power/access modules. |
| `mainframe` | boss structure | Replace as final | Boss needs larger multi-cell compound/state family rather than one isolated sprite. |
| `plant-sunbloom` | defender | Rework | Keep identity, improve strict-overhead silhouette and event states. |
| `plant-thornbramble` | defender | Rework | Improve compact silhouette, contact/root and damage states. |
| `plant-sporecap` | defender | Rework | Add restrained attack pulse/impact state. |
| `plant-vinewhip` | defender | Rework | Add anticipation/strike/recovery/damage states without moving the placed unit. |
| `plant-rootreclaimer` | defender | Rework | Needs visible relationship to reclaim/recovery material. |
| `plant-elderoak` | defender | Rework | Align growth pivot/scale with mature state. |
| `plant-elderoak-mature` | defender | Rework | Preserve large silhouette; add attack/damage states. |
| `enemy-clickbait` | enemy | Rework | Improve contrast on both green and dark ground; add movement/attack/damage frames. |
| `enemy-deepfake` | enemy | Rework | Improve strict-overhead sludge identity and split feedback. |
| `enemy-popup` | enemy | Rework | Improve disable cue and terrain contrast. |
| `enemy-fragment` | enemy | Rework | Needs distinct readable child silhouette at runtime scale. |
| `corruption-node` | corruption/source | Rework | Needs connected veins/stains/tendrils and level/state context. |
| `industrial-fan` | industry prop | Replace fallback-quality | #245 can substitute `datacenter` when v3 is empty. Final art requires dedicated cooling/fan modules. |
| `industrial-power` | industry prop | Replace fallback-quality | #245 can substitute `datacenter`; final requires transformer/power-box family. |
| `industrial-relay` | industry prop | Replace fallback-quality | #245 can substitute `corruption-node`; final requires dedicated relay/terminal family. |
| `industrial-rubble` | industry damage prop | Replace fallback-quality | #245 can substitute `rock`; final requires authored industrial debris/rubble family. |
| `reed-clump` | shoreline prop | Replace fallback-quality | #245 can substitute `grass-tuft`; final needs authored shore vegetation variants. |
| `corruption-spike` | corruption prop | Replace fallback-quality | #245 can substitute `corruption-node`; final needs dedicated spike/tendril family. |

### Immediate risk

PR #245 protects runtime visibility by checking v3 frames at draw time and falling back to v2 when a frame is effectively empty. That is correct as a compatibility guard, but fallback art is not target-quality art. v4 must make frame visibility a build-time/CI contract and remove silent core-asset fallback only after all required v4 frames are proven visible.

## 2. Current v3 terrain atlas

| Runtime ID / family | Decision | Gap / next action |
| --- | --- | --- |
| `grass-a`, `grass-b`, `grass-c` | Rework | Useful base texture vocabulary, but current overlay applies them as per-cell stamps. Move toward clustered meadow regions and quiet/dense compositional zones. |
| `forest-floor` | Rework | Forest needs canopy-level composition and exterior/interior logic; one floor tile cannot define the biome. |
| `water-deep`, `water-shallow` | Rework | Useful values, but lake identity needs exterior-edge shores, integrated vegetation, rocks, and pollution states. |
| `soil` | Keep | Useful house/path/transition material; add yard/path edge variants. |
| `industrial-a`, `industrial-b` | Rework | Too little vocabulary for a compound. Add slabs, foundations, access wear, panels, hazard marks, drains, cracks, damaged states. |
| `corruption-1` … `corruption-4` | Rework | Level values exist but lack connected stains, cracks, veins, contamination motifs, and recovery transitions. |
| `road-dirt`, `road-edge` | Rework | Material exists but current road still reads as repetitive network geometry; add path edge/intersection/grass intrusion/stone variants. |
| `rubble` | Rework | Needs multiple industrial and natural damage variants with local context. |

## 3. Missing nature/environment vocabulary

| Required family | Status | Priority | Notes |
| --- | --- | --- | --- |
| Broadleaf variants (6–8) | New | P0 | Different crown shapes/scales within one pixel language. |
| Pine variants (3–4) | New | P1 | Secondary forest identity. |
| Canopy interior modules | New | P0 | Suppress repetitive interior tree silhouettes. |
| Canopy exterior/edge modules | New | P0 | Irregular connected forest outline. |
| Undergrowth/shrub variants (5+) | New | P0 | Meso density beneath/around canopy. |
| Stumps/deadwood/roots | New | P1 | Environmental storytelling and corruption response. |
| Rock variants | New | P1 | Medium forms, shoreline/forest/meadow use. |
| Meadow cluster decals | New | P1 | Clustered grass/flowers rather than confetti. |
| Shore edge modules | New | P0 | Exterior-edge-aware lake boundary. |
| Reed/shore vegetation variants | New | P0 | Replace `grass-tuft` fallback. |
| Shore rocks/lilies variants | New | P1 | Structured shoreline accents. |
| Polluted inlet/shore pieces | New | P1 | Connect industry/corruption to lake. |

## 4. Missing house/path vocabulary

| Required family | Status | Priority | Notes |
| --- | --- | --- | --- |
| Final intact house | Rework | P0 | Strict-overhead hero read at gameplay scale. |
| Damaged/critical/destroyed house | New/Rework | P1 | Stable footprint/pivot across states. |
| Yard/soil transition kit | New | P0 | Grounds the house in local terrain. |
| Dirt path interior/edge variants | New | P0 | Organic route rather than repeated chunky strip. |
| Path bends/junctions/terminators | New | P0 | Six-edge compatible authored variants. |
| Grass intrusion/stone/wear variants | New | P1 | Integrates path with meadow. |
| Fence/garden/brush kit | New | P1 | House focal-area framing. |

## 5. Missing industrial compound vocabulary

| Required family | Status | Priority | Notes |
| --- | --- | --- | --- |
| Datacenter core variants | New/Rework | P0 | Core structure identity, not the full compound by itself. |
| Mainframe/boss core variants | New/Rework | P1 | Larger footprint and damage/collapse family. |
| Foundation/platform modules | New | P0 | Establish constructed multi-cell surface. |
| Compute modules | New | P0 | Readable functional hierarchy. |
| Cooling/fan/vent modules | New | P0 | Replace generic/fallback fan role. |
| Power/transformer modules | New | P0 | Replace generic/fallback power role. |
| Access/terminal/relay modules | New | P0 | Replace `corruption-node` fallback semantics. |
| Cable trunks/junctions/entries | New | P0 | Connect infrastructure through shared edges. |
| Pipe/conduit/drain modules | New | P0 | Add non-cable network vocabulary. |
| Crates/panels/hazard marks | New | P1 | Meso/micro compound detail. |
| Debris/rubble/destroyed modules | New | P0 | Damage history and collapse states. |
| Industrial cracks/wear | New | P1 | Prevent flat dark slab appearance. |

## 6. Missing corruption/recovery vocabulary

| Required family | Status | Priority | Notes |
| --- | --- | --- | --- |
| Ground stains | New | P0 | Healthy → stressed transition. |
| Cracks/veins | New | P0 | Meso connected contamination. |
| Tendrils | New | P0 | Directional/edge-aware spread identity. |
| Spikes | New | P1 | Dedicated art; no node fallback. |
| Corrupted shrubs/trees | New | P1 | Corruption must affect objects, not only ground. |
| Glowing/source nodes | Rework/New | P0 | Strong source identity with connected residue. |
| Contaminated industrial pieces | New | P1 | Tie contamination to compound infrastructure. |
| Reclaim/recovery transitions | New | P0 | Visible reversal when existing gameplay clears corruption. |

## 7. Missing combat/VFX vocabulary

| Required family | Status | Priority | Notes |
| --- | --- | --- | --- |
| Defender projectile/attack cues | New | P1 | Event-driven only. |
| Impact sprites | New | P1 | Short local feedback. |
| Rootreclaimer pulse/recovery cue | New | P1 | Must correspond to real reclaim events. |
| Popup disable cue | New | P1 | Make behavior readable without extra UI. |
| Slow cue | New | P2 | Restrained status feedback. |
| Corruption spread cue | New | P1 | Short transition, then static material state. |
| Datacenter collapse cue | New | P1 | Ends in static rubble/damaged ground. |

## 8. Renderer/composition gaps that assets alone will not solve

| Current implementation | Decision | Required change |
| --- | --- | --- |
| `drawMeadowLife()` chooses independent props from a per-cell roll | Replace composition strategy | Use deterministic cluster anchors/quiet zones and meso forms; micro props fill around clusters only. |
| `drawForestDensity()` stamps 1–2 tree sprites on qualifying forest cells | Replace composition strategy | Build connected canopy interior/exterior treatment from component/neighbor masks, then layer sparse edge objects. |
| `drawWaterEdges()` checks only whether a cell is boundary and scatters reeds/lilies | Rework | Select exterior edge/shore clusters and attach shoreline art to those edges. |
| `drawIndustrialComplex()` applies texture and random prop chance within node radius | Replace composition strategy | Generate deterministic compound zones around node footprint: platform, cooling, power, access, junction, damage/empty prepared ground. |
| `drawCorruptionDetail()` stamps a terrain level plus occasional spike | Replace composition strategy | Use level-aware connected stains/cracks/veins/tendrils and object contamination. |

## 9. Recommended next production sequence

1. Add per-frame atlas visibility validation and make current fallback usage explicit.
2. Produce the nature source pack first: canopy + undergrowth + shoreline + meadow meso props.
3. Replace forest/water scatter logic with connected component/edge composition.
4. Rebuild road and house grounding.
5. Produce and integrate industrial compound modules.
6. Add corruption/recovery material system.
7. Finish defender/enemy/VFX state families.
8. Only then freeze reviewed deterministic benchmark hashes.

The current #245 runtime remains a safe intermediate implementation, not the final art baseline.