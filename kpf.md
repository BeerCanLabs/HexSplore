# Key Product Functionality (KPF)

Each row is a user-visible promise for **HexSplore**. Its automated test must
keep passing on every commit (`npm test`, Node's built-in runner, no deps).

| KPF | Expected behavior | Automated coverage |
| --- | --- | --- |
| Square field | The world is a rectangular field of square tiles; the default field is 12×9 (108 tiles). | `default field is 12x9 with 108 tiles`, `board size equals width times height` |
| Tiles are squares | Tiles are addressed by `(x, y)` and generated in row-major order. | `tiles are square coordinates in row-major order` |
| Center start | The player (a chess pawn) starts on the center tile of the field. | `the player starts on the center tile of the field` |
| Fresh game | A new game has zero moves and one visited tile. | `a fresh game starts with zero moves and one visited tile` |
| Four neighbors | An interior square has four neighbors (up, down, left, right). | `an interior tile has four neighbors` |
| Board edges | Corner squares have two on-board neighbors; edge squares have three. | `a corner tile has exactly two on-board neighbors`, `an edge (non-corner) tile has three on-board neighbors` |
| Click to move | Clicking a neighboring square moves the pawn onto it. | `the player may move to any orthogonal neighbor`, `moving to a neighbor increments the move counter` |
| Move counter | Each legal move increases the move count by exactly one. | `moving to a neighbor increments the move counter` |
| No diagonals | Diagonal squares are not neighbors and cannot be moved to. | `diagonal tiles are NOT neighbors`, `the player cannot move diagonally` |
| Only neighbors | Non-adjacent squares cannot be reached and never change game state. | `the player cannot teleport to a non-neighbor tile` |
| Stay on the field | Moves off the edge of the field are rejected without mutation. | `the player cannot move off the edge of the field` |
| No self-move | Clicking the pawn's own square does not count as a move. | `the player cannot stand still (moving onto self is illegal)` |
| Explored tiles | Tiles the pawn has stood on are remembered; revisiting still counts as a move but not a new visit. | `visiting new tiles grows the visited set`, `revisiting a tile still counts as a move but not a new visit` |
| Pure state | `move()` returns a new state and never mutates the previous one. | `move() does not mutate the previous state` |

## Test command

Run `npm test`. It uses Node's built-in test runner and downloads no
dependencies.

## UI note (the map is the game)

The field fills the entire browser viewport — there is no page chrome or card
shell. A small floating HUD (Moves / Explored / Reset) sits at the top and a
status line at the bottom, both overlaid on the field.

## UI note (grassy field)

Every tile is drawn as grass on an HTML canvas: a subtle two-tone "mowed"
checkerboard, per-tile color variation, scattered grass blades, and the
occasional wildflower. Squares the pawn can step to are highlighted; visited
tiles get a faint trampled tint.

## UI note (chess-piece player)

The player is rendered as a classic **chess pawn** (ivory body, dark outline,
rounded base, collar, and a sphere head) sitting on its tile with a soft
shadow — not a plain marker.

## UI note (rendering)

Canvas-based, sized to the viewport with devicePixelRatio scaling for crisp
edges, and re-fit on window resize. No image assets, no build step — open
`index.html` (or run `npm start`) and it works.
