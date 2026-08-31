# Key Product Functionality (KPF)

Each row is a user-visible promise for **HexSplore**. Its automated test must
keep passing on every commit (`npm test`, Node's built-in runner, no deps).

| KPF | Expected behavior | Automated coverage |
| --- | --- | --- |
| Square field | The world is a rectangular field of square tiles; the default field is 12×9 (108 tiles). | `default field is 12x9 (108 tiles)`, `board size equals cols * rows` |
| Tiles are squares | Tiles are addressed by `(col, row)` and generated in row-major order. | `every generated tile lies on the board` |
| Center start | The player (a chess pawn) starts on the center tile of the field. | `the player starts on the center tile of the field` |
| Fresh game | A new game has zero moves and one visited tile. | `a fresh game starts on the center with zero moves` |
| Eight neighbors | An interior square has eight neighbors (orthogonal + diagonal). | `an interior tile has eight neighbors` |
| Board edges | Corner squares have three on-board neighbors; edge squares have five. | `a corner tile has three on-board neighbors`, `an edge tile has five on-board neighbors` |
| Click to move | Clicking a neighboring square moves the pawn onto it. | `the player may move to any of its eight neighbors` |
| Move counter | Each legal move increases the move count by exactly one. | `moving to a neighbor increments the move counter` |
| Diagonals | Diagonal squares are direct neighbors and can be moved to, counting as one move. | `a diagonal move is legal and counts as one move` |
| Only neighbors | Non-adjacent squares cannot be reached and never change game state. | `the player cannot teleport to a non-neighbor tile` |
| Stay on the field | Moves off the edge of the expanded board are rejected without mutation. | `the player cannot move off the edge of the board` |
| No self-move | Clicking the pawn's own square does not count as a move. | `the player cannot stand still (moving onto self is illegal)` |
| Explored tiles | Tiles the pawn has stood on are remembered; revisiting still counts as a move but not a new visit. | `revisiting a tile still counts as a move but not a new visit` |
| Pure state | `move()` returns a new state and never mutates the previous one. | `move() does not mutate the previous state` |
| Mountain Terrain | Rich Mode generates a layout where some tiles are high, snowy peak mountains (impassable obstacles). | `rich mode layout has mountains generated correctly` |
| Impassable Mountains | Snowy mountains block movement. | `cannot move into mountain obstacles` |
| Fog of War | Tiles beyond a sight range of 2 Chebyshev distance start shrouded in fog and reveal as the player moves. | `fog of war reveals adjacent areas on move` |
| Dynamic Expansion Left | Landing on the left-most boundary tile dynamically expands the board by 3 columns of new terrain to the left (negative coordinates). | `moving to left boundary expands board to left` |
| Dynamic Expansion Right | Landing on the right-most boundary tile dynamically expands the board by 3 columns of new terrain to the right. | `moving to right boundary expands board to right` |
| Dynamic Expansion Up | Landing on the top-most boundary tile dynamically expands the board by 3 rows of new terrain upward (negative coordinates). | `moving to top boundary expands board upward` |
| Dynamic Expansion Down | Landing on the bottom-most boundary tile dynamically expands the board by 3 rows of new terrain downward. | `moving to bottom boundary expands board downward` |
| Discovery Gold | Discovering any tile (stepping on it or bumping into a mountain) awards +1 Gold. | `discovering a tile under clouds awards +1 Gold`, `bumping into cloud obstacle reveals it and increments moves and awards gold` |
| Traveler Generation | Travelers generate like mountains but way less often, and they act as solid shops. | `travelers are generated in rich mode and are impassable` |
| Speed Potion | Speed Potion lets you move up to 2 squares. Lasts 10 moves. | `speed potion allows distance-2 moves and decrements appropriately` |

## Test command

Run `npm test`. It uses Node's built-in test runner and downloads no
dependencies.

## UI note (the map is the game)

The field fills the entire browser viewport — there is no page chrome or card
shell. A small floating HUD (Moves / Explored / Reset) sits at the top and a
status line at the bottom, both overlaid on the field.

## UI note (grassy field & mountains)

Every tile is drawn as grass on an HTML canvas: a subtle two-tone "mowed"
checkerboard, per-tile color variation, scattered grass blades, and the
occasional wildflower. Impassable tiles are drawn as snowy peak vector mountains.
Squares the pawn can step to are highlighted; visited tiles get a faint trampled tint.

## UI note (floating clouds)

Fog of War is drawn as puffy semi-transparent white/grey overlapping cloud circles,
which drift off as tiles are explored.

## UI note (chess-piece player)

The player is rendered as a classic **chess pawn** (ivory body, dark outline,
rounded base, collar, and a sphere head) sitting on its tile with a soft
shadow — not a plain marker.

## UI note (click-and-drag camera)

The camera does not follow the player's movement. You can click and drag (or drag
with a touch finger) to pan the camera freely. Panning uses momentum and drag thresholds
to distinguish between camera movements and steps.

## UI note (rendering)

Canvas-based, sized to the viewport with devicePixelRatio scaling for crisp
edges, and re-fit on window resize. No image assets, no build step — open
`index.html` (or run `npm start`) and it works.
