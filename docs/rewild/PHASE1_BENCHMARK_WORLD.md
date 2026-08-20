# Phase 1 benchmark world

The active Rewild world now uses the same geometry for simulation, rendering, pointer picking and placement.

- logical scene: 1200 x 675
- pointy-top hexes: 37 columns x 15 rows
- radius: 21 logical pixels
- authored deterministic composition: connected forest and lake on the left, protected house left of center, industrial sources on the right
- roads, facility footprints, enemy routing and pointer picking all use the same six-neighbor geometry

This remains the original continuous real-time tower-defense game. The benchmark world changes spatial presentation and authored map composition only; sunlight, waves, automatic targeting, automatic enemy movement, corruption, scoring and win/loss remain governed by the frozen simulation contract.
