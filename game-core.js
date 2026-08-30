/*
 * HexSplore — game-core.js
 *
 * Pure, framework-free SQUARE-grid logic. No DOM, no canvas. Imported by both
 * the browser (window.HexCore) and the Node test runner (module.exports), which
 * is what lets the deploy pipeline gate on `node --test`.
 *
 * Coordinate system: (col, row). Origin (0,0) is the top-left tile.
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

  // Build every tile of a COLS x ROWS board. Returns { c, r } in row-major order.
  function generateBoard(cols = DEFAULT_COLS, rows = DEFAULT_ROWS) {
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

  // Number of tiles on a cols x rows board.
  function tileCount(cols = DEFAULT_COLS, rows = DEFAULT_ROWS) {
    return cols * rows;
  }

  // True if a coordinate lies within a cols x rows board.
  function isOnBoard(c, r, cols = DEFAULT_COLS, rows = DEFAULT_ROWS) {
    return c >= 0 && c < cols && r >= 0 && r < rows;
  }

  // The eight neighbors of a tile, regardless of board bounds.
  function neighbors(c, r) {
    return DIRECTIONS.map((d) => ({ c: c + d.c, r: r + d.r }));
  }

  // Neighbors that actually exist on a cols x rows board.
  function neighborsOnBoard(c, r, cols = DEFAULT_COLS, rows = DEFAULT_ROWS) {
    return neighbors(c, r).filter((n) => isOnBoard(n.c, n.r, cols, rows));
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

  // ── Game state ─────────────────────────────────────────────────────────────

  // Fresh game state: player parked on the center tile, zero moves made.
  function createState(cols = DEFAULT_COLS, rows = DEFAULT_ROWS) {
    const start = { c: Math.floor(cols / 2), r: Math.floor(rows / 2) };
    return {
      cols,
      rows,
      player: { c: start.c, r: start.r },
      moves: 0,
      visited: [key(start.c, start.r)],
    };
  }

  // Can the player move to (c, r) from their current tile?
  // Legal only if the target is on the board AND a direct neighbor.
  function canMoveTo(state, c, r) {
    if (!isOnBoard(c, r, state.cols, state.rows)) return false;
    return areNeighbors(state.player.c, state.player.r, c, r);
  }

  // Attempt to move the player to (c, r). Returns a NEW state object; the
  // input state is never mutated. Illegal moves return the state unchanged.
  function move(state, c, r) {
    if (!canMoveTo(state, c, r)) return state;
    const visited = state.visited.includes(key(c, r))
      ? state.visited.slice()
      : state.visited.concat(key(c, r));
    return {
      cols: state.cols,
      rows: state.rows,
      player: { c, r },
      moves: state.moves + 1,
      visited,
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
