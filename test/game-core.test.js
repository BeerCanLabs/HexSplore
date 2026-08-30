const test = require("node:test");
const assert = require("node:assert/strict");
const {
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
} = require("../game-core.js");

// ── Board generation ─────────────────────────────────────────────────────────

test("KPF: a 1x1 board is a single tile", () => {
  const board = generateBoard(1, 1);
  assert.equal(board.length, 1);
  assert.deepEqual(board[0], { c: 0, r: 0 });
});

test("KPF: board size equals cols * rows", () => {
  for (const [c, r] of [[1, 1], [3, 3], [12, 9], [20, 15]]) {
    assert.equal(generateBoard(c, r).length, tileCount(c, r));
    assert.equal(tileCount(c, r), c * r);
  }
});

test("KPF: default board is 12x9 (108 tiles)", () => {
  assert.equal(DEFAULT_COLS, 12);
  assert.equal(DEFAULT_ROWS, 9);
  assert.equal(generateBoard().length, 108);
});

test("KPF: every generated tile lies on the board", () => {
  for (const t of generateBoard(12, 9)) {
    assert.ok(isOnBoard(t.c, t.r, 12, 9), `${key(t.c, t.r)} should be on board`);
  }
});

test("KPF: coordinates outside the grid are off-board", () => {
  assert.equal(isOnBoard(-1, 0, 12, 9), false);
  assert.equal(isOnBoard(0, -1, 12, 9), false);
  assert.equal(isOnBoard(12, 0, 12, 9), false);
  assert.equal(isOnBoard(0, 9, 12, 9), false);
});

test("KPF: generateBoard rejects non-positive dimensions", () => {
  assert.throws(() => generateBoard(0, 5));
  assert.throws(() => generateBoard(5, 0));
  assert.throws(() => generateBoard(-3, 3));
});

// ── Neighbor / distance math (8-directional) ─────────────────────────────────

test("KPF: there are exactly eight king directions", () => {
  assert.equal(DIRECTIONS.length, 8);
});

test("KPF: an interior tile has eight neighbors", () => {
  assert.equal(neighbors(5, 5).length, 8);
  assert.equal(neighborsOnBoard(5, 5, 12, 9).length, 8);
});

test("KPF: a corner tile has three on-board neighbors", () => {
  assert.equal(neighborsOnBoard(0, 0, 12, 9).length, 3);
});

test("KPF: an edge tile has five on-board neighbors", () => {
  assert.equal(neighborsOnBoard(0, 4, 12, 9).length, 5);
});

test("KPF: diagonal and orthogonal steps are both distance 1", () => {
  assert.equal(tileDistance(5, 5, 6, 5), 1); // orthogonal
  assert.equal(tileDistance(5, 5, 6, 6), 1); // diagonal
});

test("KPF: all eight directions are neighbors of a tile", () => {
  for (const d of DIRECTIONS) {
    assert.ok(areNeighbors(5, 5, 5 + d.c, 5 + d.r));
    assert.equal(tileDistance(5, 5, 5 + d.c, 5 + d.r), 1);
  }
});

test("KPF: a tile is not its own neighbor", () => {
  assert.equal(areNeighbors(5, 5, 5, 5), false);
});

test("KPF: tiles two steps apart are not neighbors", () => {
  assert.equal(areNeighbors(5, 5, 7, 5), false);
  assert.equal(areNeighbors(5, 5, 7, 7), false);
});

// ── Game state & movement ────────────────────────────────────────────────────

test("KPF: a fresh game starts on the center with zero moves", () => {
  const s = createState(12, 9);
  assert.deepEqual(s.player, { c: 6, r: 4 });
  assert.equal(s.moves, 0);
  assert.equal(visitedCount(s), 1);
});

test("KPF: the player may move to any of its eight neighbors", () => {
  const s = createState(12, 9);
  for (const d of DIRECTIONS) {
    const c = s.player.c + d.c;
    const r = s.player.r + d.r;
    assert.ok(canMoveTo(s, c, r), `should allow move to ${key(c, r)}`);
  }
});

test("KPF: moving to a neighbor increments the move counter", () => {
  const s0 = createState(12, 9);
  const s1 = move(s0, s0.player.c + 1, s0.player.r);
  assert.equal(s1.player.c, s0.player.c + 1);
  assert.equal(s1.moves, 1);
});

test("KPF: a diagonal move is legal and counts as one move", () => {
  const s0 = createState(12, 9);
  const s1 = move(s0, s0.player.c + 1, s0.player.r + 1);
  assert.equal(s1.moves, 1);
  assert.deepEqual(s1.player, { c: s0.player.c + 1, r: s0.player.r + 1 });
});

test("KPF: move() does not mutate the previous state", () => {
  const s0 = createState(12, 9);
  move(s0, s0.player.c + 1, s0.player.r);
  assert.deepEqual(s0.player, { c: 6, r: 4 });
  assert.equal(s0.moves, 0);
});

test("KPF: the player cannot teleport to a non-neighbor tile", () => {
  const s = createState(12, 9);
  assert.equal(canMoveTo(s, s.player.c + 2, s.player.r), false);
  const after = move(s, s.player.c + 2, s.player.r);
  assert.equal(after.moves, 0);
});

test("KPF: the player cannot move off the edge of the board", () => {
  // Walk to the top-left corner then try to step off.
  let s = createState(12, 9);
  while (s.player.c > 0 || s.player.r > 0) {
    const nc = Math.max(0, s.player.c - 1);
    const nr = Math.max(0, s.player.r - 1);
    s = move(s, nc, nr);
  }
  // At (0,0) the board has expanded left and up to minCol = -3, minRow = -3.
  // The player should not be able to move beyond the NEW boundaries.
  assert.equal(canMoveTo(s, s.minCol - 1, 0), false);
  assert.equal(canMoveTo(s, 0, s.minRow - 1), false);
  assert.equal(canMoveTo(s, s.minCol - 1, s.minRow - 1), false);
});

test("KPF: the player cannot stand still (moving onto self is illegal)", () => {
  const s = createState(12, 9);
  assert.equal(canMoveTo(s, s.player.c, s.player.r), false);
});

test("KPF: revisiting a tile still counts as a move but not a new visit", () => {
  const s0 = createState(12, 9);
  let s = move(s0, s0.player.c + 1, s0.player.r); // moves 1, visited 2
  s = move(s, s0.player.c, s0.player.r); // back: moves 2, visited still 2
  assert.equal(s.moves, 2);
  assert.equal(visitedCount(s), 2);
});

test("KPF: visiting new tiles grows the visited set", () => {
  const s0 = createState(12, 9);
  let s = move(s0, s0.player.c + 1, s0.player.r);
  s = move(s, s0.player.c + 2, s0.player.r + 1);
  assert.equal(s.moves, 2);
  assert.equal(visitedCount(s), 3);
});

// ── Rich Mode & Exploration Mechanics ───────────────────────────────────────────

test("KPF: rich mode layout has mountains generated correctly", () => {
  const s = createState(12, 9, { richMode: true });
  assert.ok(s.obstacles.length > 0);
});

test("KPF: cannot move into mountain obstacles", () => {
  const s = createState(12, 9);
  // Add a manual mountain obstacle
  s.obstacles.push(key(s.player.c + 1, s.player.r));
  assert.equal(canMoveTo(s, s.player.c + 1, s.player.r), false);
});

test("KPF: fog of war reveals adjacent areas on move", () => {
  let s = createState(12, 9);
  s.revealed = [key(s.player.c, s.player.r)]; // Reset to just center
  s = move(s, s.player.c + 1, s.player.r);
  
  // Chebyshev distance 2 means (c+2, r+2) should be revealed
  const farKey = key(s.player.c + 1, s.player.r);
  assert.ok(s.revealed.includes(farKey));
  assert.ok(s.revealed.includes(key(s.player.c + 2, s.player.r + 2)));
});

// ── Boundary Expansion Mechanics ───────────────────────────────────────────────

test("KPF: moving to left boundary expands board to left", () => {
  let s = createState(12, 9);
  const startMinCol = s.minCol;
  
  // Walk to the original left boundary (0)
  const targetCol = s.minCol;
  while (s.player.c > targetCol) {
    s = move(s, s.player.c - 1, s.player.r);
  }
  
  // Now stand on edge (0). The board expands left (minCol decreases by 3)
  assert.equal(s.minCol, startMinCol - 3);
  assert.equal(s.maxCol, 11);
  assert.equal(s.cols, 15);
});

test("KPF: moving to right boundary expands board to right", () => {
  let s = createState(12, 9);
  const startMaxCol = s.maxCol;
  
  // Walk to right edge (11)
  const targetCol = s.maxCol;
  while (s.player.c < targetCol) {
    s = move(s, s.player.c + 1, s.player.r);
  }
  
  // Land on maxCol (11) -> expands right
  assert.equal(s.maxCol, startMaxCol + 3);
  assert.equal(s.minCol, 0);
  assert.equal(s.cols, 15);
});

test("KPF: moving to top boundary expands board upward", () => {
  let s = createState(12, 9);
  const startMinRow = s.minRow;
  
  // Walk to top edge (r = 0)
  const targetRow = s.minRow;
  while (s.player.r > targetRow) {
    s = move(s, s.player.c, s.player.r - 1);
  }
  
  // Land on edge -> expands up (minRow decreases by 3)
  assert.equal(s.minRow, startMinRow - 3);
  assert.equal(s.maxRow, 8);
  assert.equal(s.rows, 12);
});

test("KPF: moving to bottom boundary expands board downward", () => {
  let s = createState(12, 9);
  const startMaxRow = s.maxRow;
  
  // Walk to bottom edge (r = 8)
  const targetRow = s.maxRow;
  while (s.player.r < targetRow) {
    s = move(s, s.player.c, s.player.r + 1);
  }
  
  // Land on edge -> expands down
  assert.equal(s.maxRow, startMaxRow + 3);
  assert.equal(s.minRow, 0);
  assert.equal(s.rows, 12);
});
