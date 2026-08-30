# HexSplore

A tiny browser game: a world built out of hexagon tiles. You control a glowing
marker that starts on the center hex. **Click any neighboring hexagon to step
onto it — every step counts as a move.**

Play it in the browser, no install required.

## Live

Deployed automatically to GitHub Pages on every push to `main`:
**https://bestdax.github.io/HexSplore/**

## Run locally

```bash
npm start      # serves the folder at http://localhost:3000
# or just open index.html in a browser
```

## Test

```bash
npm test       # node --test — pure hex-grid + movement logic
```

The test suite gates the deploy: if the KPF (Known-Property/Feature) tests fail,
the site is not published.

## How it's built

Pure static files — no build step, no framework.

| File           | Role                                                                    |
| -------------- | ----------------------------------------------------------------------- |
| `game-core.js` | All game rules (hex math, board, legal moves, move counting). UMD so it runs in both the browser and Node's test runner. |
| `app.js`       | Browser-only: canvas rendering, pixel↔hex conversion, click handling.   |
| `index.html`   | Layout + HUD (moves, tiles explored, position).                         |
| `style.css`    | Styling.                                                                |
| `test/`        | `node --test` suite covering board generation, neighbor math, and movement rules. |

### Coordinate system

Axial `(q, r)` coordinates on a **pointy-top** hex layout. The board is a
hexagon of radius 3 (37 tiles). See
[redblobgames.com/grids/hexagons](https://www.redblobgames.com/grids/hexagons/)
for the reference math.

## Roadmap ideas

- Terrain types / obstacles per tile
- Fog of war (reveal tiles as you explore)
- Collectibles and a goal tile
- Pathfinding preview / multi-step moves
