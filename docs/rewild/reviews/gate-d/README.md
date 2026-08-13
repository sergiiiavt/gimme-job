# Rewild Gate D — facility lifecycle

Gate D proves that a datacenter, its connections, and the landscape share one persistent state instead of appearing as independent pictures.

## Review screenshots

- `damage-state.png`: a compound has lost cooling/power modules, exposes damaged concrete and rebar, and shuts down below its operational threshold.
- `collapse-state.png`: the destroyed source persists as compact contaminated slabs, structural rubble, a broken cable, and an inactive clean drain.
- `reclamation-state.png`: a Rootreclaimer connects to the same ruin; repaired cells return individually to meadow while unrepaired rubble remains occupied.
- `mobile-reclamation.png`: the frozen reclamation state at `390 × 844` with a 16:9 field and no horizontal overflow.

## Runtime relationships

- Plant attacks generate short localized impacts; no camera shake or ambient global motion is used.
- Facility health disables authored module groups before total collapse.
- Facilities below 20% health stop spreading corruption and manufacturing enemies.
- Dead facilities move into a persistent ruin collection rather than disappearing.
- Broken connections retain their physical route while drains switch to the clean/inactive state.
- World objects stay suppressed under occupied rubble and return only after reclamation clears their cells.
- Rootreclaimers remember their active target and draw connected roots along the invisible-hex route.
- The win condition now requires zero active facilities, zero persistent ruins, zero enemies, and no residual corruption.

## Deterministic review URLs

- `?rewildReview=damage#rewild`
- `?rewildReview=collapse#rewild`
- `?rewildReview=reclamation#rewild`

These states freeze simulation updates while leaving the normal game path unchanged.
