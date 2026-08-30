# HexSplore

A tiny browser game played on an **infinite grassy field of square tiles surrounded by rolling cloud cover**.
You control a **chess pawn** on its exploration of an endless snowy mountain valley. **Click and hold with your mouse (or drag with your touch finger) to pan the camera freely. Click any neighboring revealed square to move.**

Play it in the browser, no install required.

## Live

Served from GitHub Pages (branch-deploy from `main`, repo root):
**https://beercanlabs.github.io/HexSplore/**

> Note: an Actions-based `deploy.yml` (with a pre-deploy test gate) is the
> intended CI. It couldn't be committed because the current token lacks the
> `workflow` scope, so Pages is configured in classic branch-deploy mode for
> now. Run `npm test` locally before pushing.

## Run locally

```bash
npm start      # serves the folder at http://localhost:3000
# or just open index.html in a browser
```

## Test

```bash
npm test       # node --test — pure grid + movement logic
```

The test suite gates the deploy: if the KPF (Key Product Functionality) tests
fail, the site is not published.

## How it's built

Pure static files — no build step, no framework.

| File           | Role                                                                    |
| -------------- | ----------------------------------------------------------------------- |
| `game-core.js` | All game rules (square-grid math, board, legal moves, move counting, infinite map expansion). UMD so it runs in both the browser and Node's test runner. |
| `app.js`       | Browser-only: full-screen canvas rendering (grass tiles, mountains, vector pawn, cloud fog), click-and-drag camera panning, click handling. |
| `index.html`   | Full-screen canvas + a minimal floating HUD (moves, tiles explored).    |
| `style.css`    | Full-viewport layout and HUD styling.                                   |
| `test/`        | `node --test` suite covering board generation, neighbor math, movement, and boundary expansion. |

### Coordinate system

Plain `(col, row)` grid coordinates on a rectangular field of **square** tiles
(default **12 × 9 = 108 tiles** at start). Movement is 8-directional (orthogonal + diagonal):
a tile's neighbors are the squares directly adjacent to it, just like a chess king.

The board expands dynamically by 3 rows/columns in the corresponding direction whenever the player steps onto any outer boundary coordinate, pushing into negative coordinates cleanly.

> The public game module is still exported as `window.HexCore` for backwards
> compatibility with earlier markup; the world itself is now a square grid.

## Roadmap ideas

- Zoom in/out support on camera
- Sound effects for stepping, cloud reveals, and clicking
- More chess pieces with their own movement rules (e.g. Knight leaps, Rook lines)
