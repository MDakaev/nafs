# Tree SVG stages

Lightweight botanical stages for the spiritual tree. Total ~13KB raw.

| File | Stage |
|------|-------|
| `00-soil.svg` | empty soil |
| `01-seed.svg` | seed under mound |
| `02-sprout-tiny.svg` | tiny sprout |
| `03-sprout.svg` | sprout |
| `04-treelet.svg` | little tree |
| `05-sapling.svg` | sapling |
| `06-young.svg` | young tree |

Each SVG uses layers:
- `.layer-soil` — ground
- `.layer-alive` — living growth / trunk+crown
- `.layer-dry` — yellow / dry parts
- `.layer-dead` — black / rotten parts
- `.layer-poison` — nafs marks
- `.layer-light` — soft sun

Replace these files to upgrade art without touching app logic. Keep viewBox `0 0 200 200` and the same layer class names.
