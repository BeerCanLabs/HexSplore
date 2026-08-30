/*
 * HexSplore — game-core.js
 *
 * Pure, framework-free hex-grid logic. No DOM, no canvas. This module is
 * imported by both the browser (window.HexCore) and the Node test runner
 * (module.exports), which is what lets the deploy pipeline gate on `node --test`.
 *
 * Coordinate system: axial (q, r) for a POINTY-TOP hex layout.
 * See https://www.redblobgames.com/grids/hexagons/ for the reference math.
 */
(function (root, factory) {
  const core = factory();
  if (typeof module !== "undefined" && module.exports) module.exports = core;
  root.HexCore = core;
})(typeof window !== "undefined" ? window : globalThis, () => {
  // Default board radius (in hexes) measured from the center tile.
  const DEFAULT_RADIUS = 3;

  // The six axial neighbor directions for a pointy-top hex grid.
  const DIRECTIONS = [
    { q: 1, r: 0 },
    { q: 1, r: -1 },
    { q: 0, r: -1 },
    { q: -1, r: 0 },
    { q: -1, r: 1 },
    { q: 0, r: 1 },
  ];

  // A stable string key for an axial coordinate, used for Set/Map membership.
  function key(q, r) {
    return `${q},${r}`;
  }

  // Build the set of tiles that make up a hexagon-shaped board of `radius`.
  // Returns an array of { q, r } in a deterministic order.
  function generateBoard(radius = DEFAULT_RADIUS) {
    if (!Number.isInteger(radius) || radius < 0) {
      throw new Error("radius must be a non-negative integer");
    }
    const tiles = [];
    for (let q = -radius; q <= radius; q++) {
      const rLow = Math.max(-radius, -q - radius);
      const rHigh = Math.min(radius, -q + radius);
      for (let r = rLow; r <= rHigh; r++) {
        // `+ 0` normalizes any -0 produced by the loop bounds to plain 0.
        tiles.push({ q: q + 0, r: r + 0 });
      }
    }
    return tiles;
  }

  // Number of tiles on a hex board of `radius`: 1 + 3*radius*(radius+1).
  function tileCount(radius = DEFAULT_RADIUS) {
    return 1 + 3 * radius * (radius + 1);
  }

  // True if a coordinate lies within a hexagon board of `radius`.
  function isOnBoard(q, r, radius = DEFAULT_RADIUS) {
    return hexDistance(0, 0, q, r) <= radius;
  }

  // The six neighbors of a tile, regardless of board bounds.
  function neighbors(q, r) {
    return DIRECTIONS.map((d) => ({ q: q + d.q, r: r + d.r }));
  }

  // Neighbors that actually exist on a board of `radius`.
  function neighborsOnBoard(q, r, radius = DEFAULT_RADIUS) {
    return neighbors(q, r).filter((n) => isOnBoard(n.q, n.r, radius));
  }

  // Axial distance between two hexes (number of steps along the grid).
  function hexDistance(q1, r1, q2, r2) {
    const dq = q1 - q2;
    const dr = r1 - r2;
    // Convert to cube and take the standard hex distance.
    return (Math.abs(dq) + Math.abs(dr) + Math.abs(dq + dr)) / 2;
  }

  // Are two tiles adjacent (exactly one step apart)?
  function areNeighbors(q1, r1, q2, r2) {
    if (q1 === q2 && r1 === r2) return false;
    return hexDistance(q1, r1, q2, r2) === 1;
  }

  // ── Game state ─────────────────────────────────────────────────────────────

  // Fresh game state: player parked on the center tile, zero moves made.
  function createState(radius = DEFAULT_RADIUS) {
    return {
      radius,
      player: { q: 0, r: 0 },
      moves: 0,
      visited: [key(0, 0)],
    };
  }

  // Can the player move to (q, r) from their current tile?
  // Legal only if the target is on the board AND a direct neighbor.
  function canMoveTo(state, q, r) {
    if (!isOnBoard(q, r, state.radius)) return false;
    return areNeighbors(state.player.q, state.player.r, q, r);
  }

  // Attempt to move the player to (q, r). Returns a NEW state object; the
  // input state is never mutated. If the move is illegal, returns the state
  // unchanged (moves counter does not advance).
  function move(state, q, r) {
    if (!canMoveTo(state, q, r)) return state;
    const visited = state.visited.includes(key(q, r))
      ? state.visited.slice()
      : state.visited.concat(key(q, r));
    return {
      radius: state.radius,
      player: { q, r },
      moves: state.moves + 1,
      visited,
    };
  }

  // How many distinct tiles the player has stood on.
  function visitedCount(state) {
    return state.visited.length;
  }

  return {
    DEFAULT_RADIUS,
    DIRECTIONS,
    key,
    generateBoard,
    tileCount,
    isOnBoard,
    neighbors,
    neighborsOnBoard,
    hexDistance,
    areNeighbors,
    createState,
    canMoveTo,
    move,
    visitedCount,
  };
});
