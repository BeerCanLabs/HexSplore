/*
 * HexSplore — game-core.js
 *
 * Pure, framework-free SQUARE-grid logic. No DOM, no canvas. Imported by both
 * the browser (window.HexCore) and the Node test runner (module.exports), which
 * is what lets the deploy pipeline gate on `node --test`.
 *
 * Coordinate system: (col, row). Origin (0,0) is the top-left tile at start.
 * Board can expand infinitely in all directions when the player hits the boundary,
 * pushing bounds into negative coordinates cleanly.
 * Movement is 8-directional (orthogonal + diagonal, like a chess king).
 */
(function (root, factory) {
  const core = factory();
  if (typeof module !== "undefined" && module.exports) module.exports = core;
  root.HexCore = core;
})(typeof window !== "undefined" ? window : globalThis, () => {
  // Default board size in tiles (a COLS x ROWS square-ish field).
  const DEFAULT_COLS = 12;
  const DEFAULT_ROWS = 9;

  // The eight neighbor directions for a square grid (king moves).
  const DIRECTIONS = [
    { c: 1, r: 0 },
    { c: -1, r: 0 },
    { c: 0, r: 1 },
    { c: 0, r: -1 },
    { c: 1, r: 1 },
    { c: 1, r: -1 },
    { c: -1, r: 1 },
    { c: -1, r: -1 },
  ];

  // A stable string key for a coordinate, used for Set/Map membership.
  function key(c, r) {
    return `${c},${r}`;
  }

  // Build every tile of a COLS x ROWS board or the current state bounding box.
  function generateBoard(colsOrState = DEFAULT_COLS, rows = DEFAULT_ROWS) {
    if (colsOrState && typeof colsOrState === "object") {
      const state = colsOrState;
      const tiles = [];
      const minCol = typeof state.minCol !== "undefined" ? state.minCol : 0;
      const maxCol = typeof state.maxCol !== "undefined" ? state.maxCol : DEFAULT_COLS - 1;
      const minRow = typeof state.minRow !== "undefined" ? state.minRow : 0;
      const maxRow = typeof state.maxRow !== "undefined" ? state.maxRow : DEFAULT_ROWS - 1;

      for (let r = minRow; r <= maxRow; r++) {
        for (let c = minCol; c <= maxCol; c++) {
          tiles.push({ c, r });
        }
      }
      return tiles;
    }

    const cols = colsOrState;
    if (!Number.isInteger(cols) || !Number.isInteger(rows) || cols < 1 || rows < 1) {
      throw new Error("cols and rows must be positive integers");
    }
    const tiles = [];
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        tiles.push({ c, r });
      }
    }
    return tiles;
  }

  // Number of tiles on a cols x rows board or state.
  function tileCount(colsOrState = DEFAULT_COLS, rows = DEFAULT_ROWS) {
    if (colsOrState && typeof colsOrState === "object") {
      const state = colsOrState;
      return (state.maxCol - state.minCol + 1) * (state.maxRow - state.minRow + 1);
    }
    return colsOrState * rows;
  }

  // True if a coordinate lies within the board bounds.
  function isOnBoard(c, r, colsOrState = DEFAULT_COLS, rows = DEFAULT_ROWS) {
    if (colsOrState && typeof colsOrState === "object") {
      const state = colsOrState;
      return c >= state.minCol && c <= state.maxCol && r >= state.minRow && r <= state.maxRow;
    }
    const cols = colsOrState;
    return c >= 0 && c < cols && r >= 0 && r < rows;
  }

  // The eight neighbors of a tile, regardless of board bounds.
  function neighbors(c, r) {
    return DIRECTIONS.map((d) => ({ c: c + d.c, r: r + d.r }));
  }

  // Neighbors that actually exist on a board.
  function neighborsOnBoard(c, r, colsOrState = DEFAULT_COLS, rows = DEFAULT_ROWS) {
    return neighbors(c, r).filter((n) => isOnBoard(n.c, n.r, colsOrState, rows));
  }

  // Chebyshev distance (king moves) between two tiles.
  function tileDistance(c1, r1, c2, r2) {
    return Math.max(Math.abs(c1 - c2), Math.abs(r1 - r2));
  }

  // Are two tiles adjacent (exactly one king-step apart)?
  function areNeighbors(c1, r1, c2, r2) {
    if (c1 === c2 && r1 === r2) return false;
    return tileDistance(c1, r1, c2, r2) === 1;
  }

  // ── Procedural layout generation ───────────────────────────────────────────

  function generateRichLayout(state) {
    const start = state.player;

    // 1. Generate random mountain obstacles for each tile (15% density)
    for (let r = state.minRow; r <= state.maxRow; r++) {
      for (let c = state.minCol; c <= state.maxCol; c++) {
        const k = key(c, r);
        
        // Keep starting tile and its immediate 8 neighbors clear grass
        if (Math.max(Math.abs(c - start.c), Math.abs(r - start.r)) <= 1) {
          continue;
        }

        const rand = Math.random();
        if (rand < 0.15) {
          state.obstacles.push(k);
        }
      }
    }

    // 2. Set up initial revealed fog of war set (sight radius 2 = 5x5 square)
    const revealed = [key(start.c, start.r)];
    const R_RANGE = 2;
    for (let dr = -R_RANGE; dr <= R_RANGE; dr++) {
      for (let dc = -R_RANGE; dc <= R_RANGE; dc++) {
        const nc = start.c + dc;
        const nr = start.r + dr;
        if (isOnBoard(nc, nr, state)) {
          const nk = key(nc, nr);
          if (!revealed.includes(nk)) {
            revealed.push(nk);
          }
        }
      }
    }

    state.revealed = revealed;
  }

  // Generates terrain (mountains) for newly expanded board coordinates.
  function generateNewRegion(startCol, endCol, startRow, endRow, obstacles) {
    for (let r = startRow; r <= endRow; r++) {
      for (let c = startCol; c <= endCol; c++) {
        const k = key(c, r);
        const rand = Math.random();
        
        // 15% Mountain obstacles
        if (rand < 0.15) {
          obstacles.push(k);
        }
      }
    }
  }

  // ── Game state ─────────────────────────────────────────────────────────────

  // Fresh game state: player parked on the center tile, zero moves made.
  // Options can include { richMode: true } to procedurally build an exploration map.
  function createState(cols = DEFAULT_COLS, rows = DEFAULT_ROWS, options = {}) {
    const start = { c: Math.floor(cols / 2), r: Math.floor(rows / 2) };
    const state = {
      minCol: 0,
      maxCol: cols - 1,
      minRow: 0,
      maxRow: rows - 1,
      player: { c: start.c, r: start.r },
      moves: 0,
      visited: [key(start.c, start.r)],
      obstacles: [],
      revealed: [key(start.c, start.r)],
    };

    if (options.richMode) {
      generateRichLayout(state);
    }

    return state;
  }

  // Can the player move to (c, r) from their current tile?
  // Legal only if the target is on the board AND a direct neighbor AND not blocked.
  function canMoveTo(state, c, r) {
    if (!isOnBoard(c, r, state)) return false;
    const k = key(c, r);
    if (state.obstacles && state.obstacles.includes(k)) return false;
    return areNeighbors(state.player.c, state.player.r, c, r);
  }

  // Attempt to move the player to (c, r). Returns a NEW state object; the
  // input state is never mutated. Illegal moves return the state unchanged.
  function move(state, c, r) {
    if (!canMoveTo(state, c, r)) return state;

    const k = key(c, r);
    const visited = state.visited.includes(k)
      ? state.visited.slice()
      : state.visited.concat(k);

    // Boundary Expansion Checks!
    let minCol = state.minCol;
    let maxCol = state.maxCol;
    let minRow = state.minRow;
    let maxRow = state.maxRow;
    let obstacles = state.obstacles ? state.obstacles.slice() : [];

    const expandLeft = (c === minCol);
    const expandRight = (c === maxCol);
    const expandUp = (r === minRow);
    const expandDown = (r === maxRow);

    if (expandLeft) {
      const oldMin = minCol;
      minCol -= 3;
      generateNewRegion(minCol, oldMin - 1, minRow, maxRow, obstacles);
    }
    if (expandRight) {
      const oldMax = maxCol;
      maxCol += 3;
      generateNewRegion(oldMax + 1, maxCol, minRow, maxRow, obstacles);
    }
    if (expandUp) {
      const oldMin = minRow;
      minRow -= 3;
      generateNewRegion(minCol, maxCol, minRow, oldMin - 1, obstacles);
    }
    if (expandDown) {
      const oldMax = maxRow;
      maxRow += 3;
      generateNewRegion(minCol, maxCol, oldMax + 1, maxRow, obstacles);
    }

    // Reveal fog of war (sight range 2 = 5x5 area centered on player)
    let revealed = state.revealed ? state.revealed.slice() : [k];
    if (!revealed.includes(k)) {
      revealed.push(k);
    }
    const R_RANGE = 2;
    for (let dr = -R_RANGE; dr <= R_RANGE; dr++) {
      for (let dc = -R_RANGE; dc <= R_RANGE; dc++) {
        const nc = c + dc;
        const nr = r + dr;
        // Check with the freshly expanded state bounds!
        const tempState = { minCol, maxCol, minRow, maxRow };
        if (isOnBoard(nc, nr, tempState)) {
          const nk = key(nc, nr);
          if (!revealed.includes(nk)) {
            revealed.push(nk);
          }
        }
      }
    }

    return {
      minCol,
      maxCol,
      minRow,
      maxRow,
      cols: maxCol - minCol + 1,
      rows: maxRow - minRow + 1,
      player: { c, r },
      moves: state.moves + 1,
      visited,
      obstacles,
      revealed,
    };
  }

  // How many distinct tiles the player has stood on.
  function visitedCount(state) {
    return state.visited.length;
  }

  return {
    DEFAULT_COLS,
    DEFAULT_ROWS,
    DIRECTIONS,
    key,
    generateBoard,
    tileCount,
    isOnBoard,
    neighbors,
    neighborsOnBoard,
    tileDistance,
    areNeighbors,
    createState,
    canMoveTo,
    move,
    visitedCount,
  };
});
