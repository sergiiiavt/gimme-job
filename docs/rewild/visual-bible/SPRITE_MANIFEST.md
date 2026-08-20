# Rewild Sprite Manifest v4

This manifest is the production-art checklist. Gameplay-owned entries must map to code. Visual-only props must never be treated as gameplay entities.

Status values: `existing-v3`, `planned-v4`, `review`, `approved`, `integrated`.

## A. Gameplay structures

| ID | Code concept | Footprint | States | Status |
| --- | --- | --- | --- | --- |
| `structure-house` | House | multi-hex | intact, damaged, critical, destroyed | planned-v4 |
| `structure-datacenter` | regular `DataNode` | multi-hex | construction, active, damaged, failing, ruined | planned-v4 |
| `structure-mainframe` | boss `DataNode` | multi-hex | construction, active, overloaded, heavily-damaged, ruined | planned-v4 |
| `structure-facility-ruin` | `FacilityRuin` | inherits node footprint | collapsed/rubble | planned-v4 |

## B. Player plant units — exact current roster

| ID | `PlantKind` | Footprint | Required visual states | Status |
| --- | --- | --- | --- | --- |
| `plant-sunbloom` | `sunbloom` | 1 hex | idle, attack/resource cue, damaged | existing-v3 → planned-v4 |
| `plant-thornbramble` | `thornbramble` | 1 hex | idle, automatic attack, damaged | existing-v3 → planned-v4 |
| `plant-sporecap` | `sporecap` | 1 hex | idle, pulse attack, damaged | existing-v3 → planned-v4 |
| `plant-vinewhip` | `vinewhip` | 1 hex | idle, ranged attack, damaged | existing-v3 → planned-v4 |
| `plant-rootreclaimer` | `rootreclaimer` | 1 hex | idle, reclaim action, damaged | existing-v3 → planned-v4 |
| `plant-elderoak` | `elderoak` | 1 gameplay anchor, visually larger | young, mature, attack, damaged | existing-v3 → planned-v4 |

## C. Enemy units — exact current roster

| ID | `EnemyKind` | Footprint | Locomotion visual language | Required visual states | Status |
| --- | --- | --- | --- | --- | --- |
| `enemy-clickbait` | `clickbait` | 1 hex | small device swarm / wheels / compact moving hardware | six-direction movement readability, attack, damaged, death | existing-v3 → planned-v4 |
| `enemy-deepfake` | `deepfake` | 1 hex | heavier technical media/device mass on tracks or wheels; distinct silhouette from clickbait | six-direction movement readability, attack, damaged, death | existing-v3 → planned-v4 |
| `enemy-popup` | `popup` | 1 hex | screen/sign/device body with mechanical legs/wheels; clearly different from other enemies | six-direction movement readability, disable/attack cue, damaged, death | existing-v3 → planned-v4 |
| `enemy-fragment` | `fragment` | 1 hex | compact broken server/device fragment on small tracks/wheels | six-direction movement readability, attack, damaged, death | existing-v3 → planned-v4 |

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

## E. Visual-only detail props approved by the Bible

These improve composition but must not appear in simulation collections as new gameplay entities.

### Nature/details
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

### Road/fence vocabulary
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

### Industrial detail vocabulary
- cable straight/corner/T/junction/terminator
- pipe straight/corner/T/junction/terminator
- pipe outlet into water
- cooling-water intake/outlet
- relay/junction box
- fan/vent
- power box/transformer visual modules
- foundation/platform pieces
- rubble/debris/broken equipment

These names are art vocabulary, not new gameplay unit classes.

## F. Connected terrain families

### Healthy nature
- meadow variants
- forest floor/interior/exterior
- water deep/shallow
- shore edges/corners/transitions
- soil/yard

### Road
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
Corruption levels 1–4 remain gameplay state. Visual language should progress from stressed/polluted ground to severely wasted/electrically stressed industrial blight. Avoid making crystals the primary read.

Required transitions:
- healthy → stressed
- stressed → wasted
- wasted → recovering
- nature ↔ industrial
- water ↔ industrial drainage/cooling
- forest ↔ industry clearing/damage
- water ↔ wasted/polluted edge

## G. Production priority

1. Terrain/road/nature-detail primitives.
2. Forest + water connected families.
3. House.
4. Datacenter/Mainframe industrial modules and connections.
5. Exact six plant units.
6. Exact four enemies.
7. Damage/recovery states.
8. VFX/attack/reclaim/collapse feedback.

Before changing this manifest, verify the requested addition against code or explicit user approval.
