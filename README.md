# HexSplore

A tiny browser game played on a **full-screen grassy field of square tiles**.
You control a **chess pawn** that starts in the center of the field. **Click any
neighboring square — including diagonals, like a chess king — to step onto it.
Every step counts as a move.**

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
| `game-core.js` | All game rules (square-grid math, board, legal moves, move counting). UMD so it runs in both the browser and Node's test runner. |
| `app.js`       | Browser-only: full-screen canvas rendering (grass tiles + chess pawn), pixel↔tile conversion, click handling. |
| `index.html`   | Full-screen canvas + a minimal floating HUD (moves, tiles explored).    |
| `style.css`    | Full-viewport layout and HUD styling.                                   |
| `test/`        | `node --test` suite covering board generation, neighbor math, and movement rules. |

### Coordinate system

Plain `(x, y)` grid coordinates on a rectangular field of **square** tiles
(default **12 × 9 = 108 tiles**). Movement is orthogonal (4-connected): a tile's
neighbors are the squares directly up, down, left, and right of it — no
diagonals, just like a rook stepping one square.

> The public game module is still exported as `window.HexCore` for backwards
> compatibility with earlier markup; the world itself is now a square grid.

## Roadmap ideas

- Terrain variety (dirt paths, water, trees) as impassable or costly tiles
- Fog of war (reveal tiles as you explore)
- Collectibles and a goal tile
- More chess pieces with their own movement rules
