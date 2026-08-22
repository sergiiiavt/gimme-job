# Rewild Sprite Manifest v4

This manifest is the production-art checklist. Gameplay-owned entries must map to code. Visual-only props must never be treated as gameplay entities. Generated concept-sheet labels are not runtime state or entity definitions.

Status values include: `existing-v3`, `planned-v4`, `review`, `approved`, `integrated`, `redesign-required`.

## A. Gameplay structures

Exact runtime visual-state mapping must come from code/renderer behavior, not from `06-damage-states.webp` labels.

| ID | Code concept | Footprint | Code-backed visual cues / mapping | Status |
| --- | --- | --- | --- | --- |
| `structure-house` | House | multi-hex | current runtime uses `house` and `house-damaged`, selected from HP; any additional variants require an explicit HP/state mapping | planned-v4 |
| `structure-datacenter` | regular `DataNode` | multi-hex | `buildProgress`, HP, shutdown/collapse effects; exact damage variants must be explicitly mapped | planned-v4 |
| `structure-mainframe` | boss `DataNode` | multi-hex | same code-backed DataNode cues, with boss scale/footprint; exact damage variants must be explicitly mapped | planned-v4 |
| `structure-facility-ruin` | `FacilityRuin` | inherits node footprint | collapsed/rubble representation after facility collapse | planned-v4 |

Do **not** infer runtime states such as `critical`, `destroyed`, `failing`, `overloaded`, or `heavily-damaged` from generated concept-sheet labels.

## B. Player plant units — exact current roster

| ID | `PlantKind` | Footprint | Required visual cues | Status |
| --- | --- | --- | --- | --- |
| `plant-sunbloom` | `sunbloom` | 1 hex | idle/resource cue, HP damage readability | integrated (v4) |
| `plant-thornbramble` | `thornbramble` | 1 hex | idle, automatic attack cue, HP damage readability | integrated (v4) |
| `plant-sporecap` | `sporecap` | 1 hex | idle, pulse attack cue, HP damage readability | integrated (v4) |
| `plant-vinewhip` | `vinewhip` | 1 hex | idle, ranged attack/slow cue, HP damage readability | integrated (v4) |
| `plant-rootreclaimer` | `rootreclaimer` | 1 hex | idle, reclaim cue, HP damage readability | integrated (v4) |
| `plant-elderoak` | `elderoak` | 1 gameplay anchor, visually larger | young/mature age presentation, attack cue, HP damage readability | integrated (v4) — `plant-elderoak` and `plant-elderoak-mature` intentionally share one authored oak identity at two renderer scales; no separate young sprite was produced |

## C. Enemy units — exact current roster

| ID | `EnemyKind` | Footprint | Locomotion visual language | Required visual cues | Status |
| --- | --- | --- | --- | --- | --- |
| `enemy-clickbait` | `clickbait` | 1 hex | small device swarm / wheels / compact moving hardware | six-direction movement readability, attack, HP damage/death feedback | integrated (v4) — single default frame only; direction/attack/death frames remain a future batch |
| `enemy-deepfake` | `deepfake` | 1 hex | heavier technical media/device mass on tracks or wheels; distinct silhouette from clickbait | six-direction movement readability, attack, HP damage/death feedback | integrated (v4) — single default frame only; direction/attack/death frames remain a future batch |
| `enemy-popup` | `popup` | 1 hex | screen/sign/device body with mechanical legs/wheels; clearly different from other enemies | six-direction movement readability, disable/attack cue, HP damage/death feedback | existing-v3 → planned-v4, blocked — see note below |
| `enemy-fragment` | `fragment` | 1 hex | compact broken server/device fragment on small tracks/wheels | six-direction movement readability, attack, HP damage/death feedback | integrated (v4) — single default frame only; direction/attack/death frames remain a future batch |

`enemy-popup`'s only generated PixelLab candidates (batch reviewed 2026-08-22) rendered consistently as a vertical wall-mounted window/pane at an oblique angle — incompatible with the `strict-overhead-orthographic` projection in `VISUAL_TARGET_CONTRACT.md`. Those candidates were left in PixelLab review and not integrated. `enemy-popup` remains on the v3 atlas until a fresh batch is generated with an explicit top-down/ground-level device framing.

## D. World objects already represented by code/art

| ID | Runtime/world concept | Gameplay entity? | Status |
| --- | --- | --- | --- |
| `nature-tree-broadleaf` | tree | no — environment object | existing-v3 → planned variants |
| `nature-tree-pine` | pine | no | existing-v3 → planned variants |
| `nature-rock` | rock | no | existing-v3 → planned variants |
| `nature-shrub` | shrub | no | existing-v3 → planned variants |
| `nature-log` | log | no | existing-v3 → planned variants |
| `nature-flower-cluster` | flowers | no | existing-v3 → planned variants |
| `nature-reed-clump` | reeds | no | existing-v3 → planned variants |
| `nature-water-lilies` | water lilies | no | existing-v3 → planned variants |
| `nature-grass-tuft` | grass detail | no | existing-v3 → planned variants |
| `world-fence` | fence | no | existing-v3 → planned variants |
| `world-sign` | sign | no | existing-v3 → planned variants |

## E. Visual-only detail vocabulary

These improve composition but must not appear in simulation collections as new gameplay entities. Their reference authority is controlled by `REFERENCE_STATUS.json`.

### Nature/details — integrated v4 detail family
- grass tuft variants A/B/C
- wild meadow weeds
- flower patch variants
- mushrooms
- pebbles
- small/medium rocks
- stump
- additional logs
- low shrubs
- reeds
- lily pads

### Road/fence vocabulary — **REDESIGN REQUIRED**
The topology vocabulary remains useful, but the prior visual approval is withdrawn. `01-environment-detail.webp` road art is not a production target, and `04-terrain-transitions.webp` is rejected.

Planned topology vocabulary:
- dirt road straight
- bend/curve
- T-junction
- crossroads
- narrow trail
- worn road edge
- wooden fence straight
- fence corner
- gate opening
- broken fence
- low stone edging

Before producing or integrating this family, define and review a new production road target. Connector topology must use the real six-neighbor runtime grid.

### Industrial detail vocabulary — integrated small-detail family / future expansion controlled
- cable straight/corner/T/junction/terminator
- pipe straight/corner/T/junction/terminator
- pipe outlet into water
- cooling-water intake/outlet
- relay/junction box
- fan/vent
- power box/transformer visual modules
- foundation/platform pieces
- rubble/debris/broken equipment

Names shown in `05-industrial-modular-kit.webp` are visual inspiration only and do not create gameplay module classes.

## F. Connected terrain families

### Healthy nature
- meadow variants
- forest floor/interior/exterior
- water deep/shallow
- shore edges/corners/transitions
- soil/yard

### Road — target not yet re-approved
- interior
- edge
- bends
- junctions
- terminators
- grass intrusion / worn state

### Industrial territory
- industrial floor variants
- platform/foundation transition
- cable/pipe network overlays
- damaged/broken ground

### Wasted/corrupted ground
Corruption levels 1–4 remain gameplay state. Visual language should progress from stressed/polluted ground to severely wasted/electrically stressed industrial blight.

**Forbidden primary corruption language:** purple crystals, fantasy crystal nodes, magical glowing veins.

Required visual transitions once a clean transition target is approved:
- healthy → stressed
- stressed → wasted
- wasted → recovering
- nature ↔ industrial
- water ↔ industrial drainage/cooling
- forest ↔ industry clearing/damage
- water ↔ wasted/polluted edge

`04-terrain-transitions.webp` is rejected and cannot serve as the production source for these transitions.

## G. Production priority

1. Re-establish a clean production target for roads/connected terrain before further road integration.
2. Forest + water connected families using approved references only.
3. House.
4. Datacenter/Mainframe industrial modules and physical connections.
5. Exact six plant units.
6. Exact four enemies.
7. Code-mapped damage/recovery visuals.
8. VFX/attack/reclaim/collapse feedback.

Items 5 and 6 were completed ahead of items 1–4 on explicit user request (2026-08-22): all six plant units and three of four enemies are integrated at v4; `enemy-popup` is blocked (see section C). Items 1–4 remain outstanding.

Before changing this manifest, verify the requested addition against code or explicit user approval and re-check `REFERENCE_STATUS.json`.
