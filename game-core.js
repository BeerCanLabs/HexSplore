/*
 * HexSplore — game-core.js
 *
 * Pure, framework-free GRID logic. No DOM, no canvas. This module is imported
 * by both the browser (window.HexCore) and the Node test runner
 * (module.exports), which is what lets the deploy pipeline gate on `node --test`.
 *
 * The world is a rectangular field of SQUARE tiles addressed by (x, y) with
 * x in [0, width) and y in [0, height). Movement is orthogonal: a tile's
 * neighbors are the squares directly up, down, left, and right of it. Moving
 * onto a neighboring square counts as exactly one move. (The public API name
 * `HexCore` is kept for backwards compatibility with existing markup.)
 */
(function (root, factory) {
  const core = factory();
  if (typeof module !== "undefined" && module.exports) module.exports = core;
  root.HexCore = core;
})(typeof window !== "undefined" ? window : globalThis, () => {
  // Default field size in tiles (a wide, roomy grassy field).
  const DEFAULT_WIDTH = 12;
  const DEFAULT_HEIGHT = 9;

  // The four orthogonal neighbor directions for a square grid.
  const DIRECTIONS = [
    { x: 1, y: 0 }, // right
    { x: -1, y: 0 }, // left
    { x: 0, y: 1 }, // down
    { x: 0, y: -1 }, // up
  ];

  // A stable string key for a coordinate, used for Set/Map membership.
  function key(x, y) {
    return `${x},${y}`;
  }

  // Build every tile of a width×height field, in row-major order.
  function generateBoard(width = DEFAULT_WIDTH, height = DEFAULT_HEIGHT) {
    if (!Number.isInteger(width) || !Number.isInteger(height)) {
      throw new Error("width and height must be integers");
    }
    if (width < 1 || height < 1) {
      throw new Error("width and height must be at least 1");
    }
    const tiles = [];
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        tiles.push({ x, y });
      }
    }
    return tiles;
  }

  // Number of tiles on a width×height field.
  function tileCount(width = DEFAULT_WIDTH, height = DEFAULT_HEIGHT) {
    return width * height;
  }

  // True if (x, y) lies inside a width×height field.
  function isOnBoard(x, y, width = DEFAULT_WIDTH, height = DEFAULT_HEIGHT) {
    return x >= 0 && y >= 0 && x < width && y < height;
  }

  // The four neighbors of a tile, regardless of board bounds.
  function neighbors(x, y) {
    return DIRECTIONS.map((d) => ({ x: x + d.x, y: y + d.y }));
  }

  // Neighbors that actually exist on a width×height field.
  function neighborsOnBoard(x, y, width = DEFAULT_WIDTH, height = DEFAULT_HEIGHT) {
    return neighbors(x, y).filter((n) => isOnBoard(n.x, n.y, width, height));
  }

  // Manhattan distance between two squares (steps along the grid).
  function gridDistance(x1, y1, x2, y2) {
    return Math.abs(x1 - x2) + Math.abs(y1 - y2);
  }

  // Are two tiles orthogonally adjacent (exactly one step apart)?
  function areNeighbors(x1, y1, x2, y2) {
    if (x1 === x2 && y1 === y2) return false;
    return gridDistance(x1, y1, x2, y2) === 1;
  }

  // ── Game state ─────────────────────────────────────────────────────────────

  // Fresh game state: player parked on the center tile, zero moves made.
  function centerOf(width, height) {
    return { x: Math.floor(width / 2), y: Math.floor(height / 2) };
  }

  function createState(width = DEFAULT_WIDTH, height = DEFAULT_HEIGHT) {
    const start = centerOf(width, height);
    return {
      width,
      height,
      player: { x: start.x, y: start.y },
      moves: 0,
      visited: [key(start.x, start.y)],
    };
  }

  // Can the player move to (x, y) from their current tile?
  // Legal only if the target is on the board AND a direct neighbor.
  function canMoveTo(state, x, y) {
    if (!isOnBoard(x, y, state.width, state.height)) return false;
    return areNeighbors(state.player.x, state.player.y, x, y);
  }

  // Attempt to move the player to (x, y). Returns a NEW state object; the input
  // state is never mutated. Illegal moves return the state unchanged (the moves
  // counter does not advance).
  function move(state, x, y) {
    if (!canMoveTo(state, x, y)) return state;
    const visited = state.visited.includes(key(x, y))
      ? state.visited.slice()
      : state.visited.concat(key(x, y));
    return {
      width: state.width,
      height: state.height,
      player: { x, y },
      moves: state.moves + 1,
      visited,
    };
  }

  // How many distinct tiles the player has stood on.
  function visitedCount(state) {
    return state.visited.length;
  }

  return {
    DEFAULT_WIDTH,
    DEFAULT_HEIGHT,
    DIRECTIONS,
    key,
    centerOf,
    generateBoard,
    tileCount,
    isOnBoard,
    neighbors,
    neighborsOnBoard,
    gridDistance,
    areNeighbors,
    createState,
    canMoveTo,
    move,
    visitedCount,
  };
});
