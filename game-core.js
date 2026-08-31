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

  // Generates terrain (mountains & travelers) for newly expanded board coordinates.
  function generateNewRegionAndTravelers(startCol, endCol, startRow, endRow, obstacles, travelers) {
    for (let r = startRow; r <= endRow; r++) {
      for (let c = startCol; c <= endCol; c++) {
        const k = key(c, r);
        const rand = Math.random();
        
        // 15% Mountain obstacles
        if (rand < 0.15) {
          obstacles.push(k);
        } else if (rand < 0.15 + 0.015) {
          // 1.5% Travelers
          const styles = ["staff", "bag"];
          const style = styles[Math.floor(Math.random() * styles.length)];
          travelers[k] = { style };
        }
      }
    }
  }

  // Backwards compatibility helper
  function generateNewRegion(startCol, endCol, startRow, endRow, obstacles) {
    const dummyTravelers = {};
    generateNewRegionAndTravelers(startCol, endCol, startRow, endRow, obstacles, dummyTravelers);
  }

  // ── Procedural layout generation ───────────────────────────────────────────

  function generateRichLayout(state) {
    const start = state.player;
    state.travelers = {};

    // 1. Generate random mountain obstacles and travelers for each tile
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
        } else if (rand < 0.15 + 0.015) {
          const styles = ["staff", "bag"];
          const style = styles[Math.floor(Math.random() * styles.length)];
          state.travelers[k] = { style };
        }
      }
    }

    // 2. Set up initial revealed fog of war set (sight radius 0 = only starting tile revealed)
    state.revealed = [key(start.c, start.r)];
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
      travelers: {},
      revealed: [key(start.c, start.r)],
      gold: 0,
      inventory: { potion: 0, sword: 0, berries: 0 },
      speedPotionMovesLeft: 0,
    };

    if (options.richMode) {
      generateRichLayout(state);
    }

    return state;
  }

  // Can the player move to (c, r) from their current tile?
  // Legal if it's on board, within range (1, or 2 with speed potion), not a mountain, and not a traveler.
  function canMoveTo(state, c, r) {
    if (!isOnBoard(c, r, state)) return false;
    const k = key(c, r);
    if (state.obstacles && state.obstacles.includes(k)) return false;
    if (state.travelers && state.travelers[k]) return false; // travelers are impassable!
    
    const dist = tileDistance(state.player.c, state.player.r, c, r);
    const maxDist = (state.speedPotionMovesLeft && state.speedPotionMovesLeft > 0) ? 2 : 1;
    if (dist < 1 || dist > maxDist) return false;
    return true;
  }

  // Attempt to move the player or discover a tile at (c, r).
  // Returns a NEW state object; the input state is never mutated.
  function move(state, c, r) {
    if (!isOnBoard(c, r, state)) return state;
    
    const k = key(c, r);
    const dist = tileDistance(state.player.c, state.player.r, c, r);
    const maxDist = (state.speedPotionMovesLeft && state.speedPotionMovesLeft > 0) ? 2 : 1;
    if (dist < 1 || dist > maxDist) return state;

    let minCol = state.minCol;
    let maxCol = state.maxCol;
    let minRow = state.minRow;
    let maxRow = state.maxRow;
    let obstacles = state.obstacles ? state.obstacles.slice() : [];
    let travelers = state.travelers ? { ...state.travelers } : {};
    let revealed = state.revealed ? state.revealed.slice() : [];
    let visited = state.visited ? state.visited.slice() : [];
    let gold = typeof state.gold === "number" ? state.gold : 0;
    let speedPotionMovesLeft = typeof state.speedPotionMovesLeft === "number" ? state.speedPotionMovesLeft : 0;
    let player = { ...state.player };
    let moves = state.moves;

    const isObstacle = obstacles.includes(k);
    const isTraveler = !!travelers[k];

    // Case 1: Clicked an adjacent mountain obstacle or traveler (discover it, don't step on it)
    if (isObstacle || isTraveler) {
      if (!revealed.includes(k)) {
        revealed.push(k);
        gold += 1; // +1 Gold reward for mapping/discovering
      }
      moves += 1;
      if (speedPotionMovesLeft > 0) speedPotionMovesLeft -= 1;

      return {
        ...state,
        revealed,
        moves,
        gold,
        speedPotionMovesLeft,
      };
    }

    // Case 2: Clicked a valid grass tile or adjacent cloud grass tile (move there!)
    const expandLeft = (c === minCol);
    const expandRight = (c === maxCol);
    const expandUp = (r === minRow);
    const expandDown = (r === maxRow);

    if (expandLeft) {
      const oldMin = minCol;
      minCol -= 3;
      generateNewRegionAndTravelers(minCol, oldMin - 1, minRow, maxRow, obstacles, travelers);
    }
    if (expandRight) {
      const oldMax = maxCol;
      maxCol += 3;
      generateNewRegionAndTravelers(oldMax + 1, maxCol, minRow, maxRow, obstacles, travelers);
    }
    if (expandUp) {
      const oldMin = minRow;
      minRow -= 3;
      generateNewRegionAndTravelers(minCol, maxCol, minRow, oldMin - 1, obstacles, travelers);
    }
    if (expandDown) {
      const oldMax = maxRow;
      maxRow += 3;
      generateNewRegionAndTravelers(minCol, maxCol, oldMax + 1, maxRow, obstacles, travelers);
    }

    // Reveal target tile if not already revealed
    if (!revealed.includes(k)) {
      revealed.push(k);
      gold += 1; // Gold reward for discovery
    }
    if (!visited.includes(k)) {
      visited.push(k);
    }

    // If moving 2 squares, also reveal the intermediate tile!
    if (dist === 2) {
      const intC = Math.round((player.c + c) / 2);
      const intR = Math.round((player.r + r) / 2);
      const intK = key(intC, intR);
      if (!revealed.includes(intK)) {
        revealed.push(intK);
        gold += 1; // Gold reward for discovering the intermediate tile too
      }
    }

    player = { c, r };
    moves += 1;
    if (speedPotionMovesLeft > 0) speedPotionMovesLeft -= 1;

    return {
      minCol,
      maxCol,
      minRow,
      maxRow,
      cols: maxCol - minCol + 1,
      rows: maxRow - minRow + 1,
      player,
      moves,
      visited,
      obstacles,
      travelers,
      revealed,
      gold,
      speedPotionMovesLeft,
      inventory: state.inventory, // preserve inventory on move
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
    generateNewRegion,
    generateNewRegionAndTravelers,
  };
});
