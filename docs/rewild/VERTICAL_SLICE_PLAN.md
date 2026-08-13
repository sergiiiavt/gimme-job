# Rewild production vertical slice

The slice is a running gameplay area, not another standalone mockup. It proves one complete relationship chain:

`living meadow → house site → road/path → natural pond → defenders/enemies → datacenter compound → corruption → polluted pond → rubble → reclamation`

## Slice boundary

The implementation uses the existing `1200 × 675` battlefield and invisible hex simulation. The review camera must show:

- central house and its inhabited perimeter;
- one healthy pond;
- one pond with a source-connected pollution state;
- one complete datacenter compound occupying `7–10` normal hexes;
- healthy, stressed, exposed, cracked, and severe contamination materials;
- one tree crossing healthy/stressed/corrupted states;
- Sunbloom, Vinewhip, and Sporecap;
- AI Slop Swarm and Deepfake Sludge;
- curved road plus at least one cable/drain crossing;
- destroyed compound rubble and a Rootreclaimer recovery sequence.

## Asset batch specifications

### 01 · Datacenter compound modules

Deliverable: `production/datacenter-modules-v1.png` plus JSON frame metadata.

- shared three-quarter perspective and upper-left light;
- wall straight/corner/end pieces;
- server hall body and roof modules;
- cooling/fan banks;
- transformer/power units;
- loading bay and access module;
- fence/gate/barrier set;
- crates, bins, cabinets, barrels, pallets, work lights;
- no baked meadow, corruption field, or enormous unified compound;
- modules align to ground pivots and can overlap across hex boundaries.

### 02 · Facility ground states

Deliverable: `production/facility-ground-states-v1.png` plus mask metadata.

- survey/excavation;
- compacted foundation;
- concrete apron/trenches;
- active cable/drain connections;
- cracked contaminated ground;
- damaged slab and rubble;
- irregular silhouettes extending beyond logical footprints without exposing hex geometry.

### 03 · House grounding kit

Deliverable: `production/house-grounding-v1.png`.

- worn entrance path;
- small garden rows and soil;
- fence straight/corner/end/gate pieces;
- stones, weeds, barrel/crate, sign, stump;
- wall contact darkening;
- no broad oval house shadow.

### 04 · Environment response states

Deliverables:

- `production/tree-deciduous-response-v1.png`;
- `production/pond-response-v1.png`.

Tree states: healthy, stressed, corrupted, dead/damaged. Pond layers: clean shore/water, stressed shore, polluted inlet, severe polluted water. Water and shore must remain separately composable.

### 05 · Combat action states

Deliverable: `production/combat-actions-v1.png`.

- Sunbloom: idle, anticipation, fire, recovery;
- Vinewhip: idle, anticipation, strike, recovery;
- Sporecap: idle, pulse, impact;
- Swarm: walk, attack, damage, death;
- Sludge: move, attack, split, damage, death;
- consistent pivots and pixel density;
- no perpetual idle bobbing requirement.

### 06 · Connection overlays

Deliverable: `production/world-connections-v1.png`.

- cable straight/bend/split/junction/entry/broken;
- drain clean/polluting/broken;
- road crack/trench/cable crossing;
- root healthy/reclaiming/damaged;
- all connectors cross logical boundaries without seams.

## Renderer milestones

1. Create continuous material masks independent of object sprites.
2. Replace code-drawn datacenter boxes with compound module assembly.
3. Add stateful connection graph for power cables, drains, roots, and road damage.
4. Add object response state derived from nearby contamination and construction.
5. Add short transition timelines for construction, damage, pollution, and reclamation.
6. Build a debug gallery that can freeze every review state.
7. Produce desktop and mobile screenshots for the review pack.

## Review gates

Current status: Gates A and B are complete. Gate C integrates the reviewed atlases into the running renderer and includes construction, contamination, responsive-layout, and relationship screenshots in `reviews/gate-c/`.

### Gate A · Static composition

- Target art, art bible, asset audit, manifest, and validator approved.

### Gate B · Asset coherence

- First production sheets share scale, light, palette, and pivots.
- Contact sheet looks like one game without renderer effects.

### Gate C · Integrated running slice

- No isolated pasted objects.
- Datacenter visibly changes ground and connects physical systems.
- Healthy and corrupted sides transition without a line or visible hexes.

### Gate D · Interaction and motion

- Combat, construction, pollution, destruction, and reclamation are readable.
- Ambient motion stays below the event-motion budget.

### Gate E · Expansion approval

- Only after Gates A–D should remaining maps, defenders, enemies, and compound variants be produced.

## Review pack contents

Each gate ships one ZIP containing:

- current target and baseline;
- all new/changed PNG sheets;
- contact sheets at native and gameplay scale;
- fixed-state screenshots;
- asset-validation report;
- exact file manifest and keep/rework/replace changes.
