const test = require("node:test");
const assert = require("node:assert/strict");
const {
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
} = require("../game-core.js");

// ── Board generation ─────────────────────────────────────────────────────────

test("KPF: a 1x1 board is a single tile", () => {
  const board = generateBoard(1, 1);
  assert.equal(board.length, 1);
  assert.deepEqual(board[0], { x: 0, y: 0 });
});

test("KPF: board size equals width times height", () => {
  for (const [w, h] of [[1, 1], [3, 3], [12, 9], [20, 4]]) {
    assert.equal(generateBoard(w, h).length, tileCount(w, h));
    assert.equal(tileCount(w, h), w * h);
  }
});

test("KPF: default field is 12x9 with 108 tiles", () => {
  assert.equal(DEFAULT_WIDTH, 12);
  assert.equal(DEFAULT_HEIGHT, 9);
  assert.equal(tileCount(), 108);
  assert.equal(generateBoard().length, 108);
});

test("KPF: every generated tile lies on the board", () => {
  for (const t of generateBoard(12, 9)) {
    assert.ok(isOnBoard(t.x, t.y, 12, 9), `${key(t.x, t.y)} should be on board`);
  }
});

test("KPF: tiles are square coordinates in row-major order", () => {
  const board = generateBoard(3, 2);
  assert.deepEqual(board, [
    { x: 0, y: 0 }, { x: 1, y: 0 }, { x: 2, y: 0 },
    { x: 0, y: 1 }, { x: 1, y: 1 }, { x: 2, y: 1 },
  ]);
});

test("KPF: generateBoard rejects non-positive dimensions", () => {
  assert.throws(() => generateBoard(0, 5));
  assert.throws(() => generateBoard(5, 0));
  assert.throws(() => generateBoard(-1, 5));
});

// ── Neighbor / distance math ─────────────────────────────────────────────────

test("KPF: a square tile has exactly four directions", () => {
  assert.equal(DIRECTIONS.length, 4);
});

test("KPF: an interior tile has four neighbors", () => {
  assert.equal(neighbors(5, 4).length, 4);
  assert.equal(neighborsOnBoard(5, 4, 12, 9).length, 4);
});

test("KPF: a corner tile has exactly two on-board neighbors", () => {
  assert.equal(neighborsOnBoard(0, 0, 12, 9).length, 2);
  assert.equal(neighborsOnBoard(11, 8, 12, 9).length, 2);
});

test("KPF: an edge (non-corner) tile has three on-board neighbors", () => {
  assert.equal(neighborsOnBoard(5, 0, 12, 9).length, 3);
});

test("KPF: adjacent tiles are one step apart (up/down/left/right only)", () => {
  for (const d of DIRECTIONS) {
    assert.equal(gridDistance(5, 4, 5 + d.x, 4 + d.y), 1);
    assert.ok(areNeighbors(5, 4, 5 + d.x, 4 + d.y));
  }
});

test("KPF: diagonal tiles are NOT neighbors", () => {
  assert.equal(areNeighbors(5, 4, 6, 5), false);
  assert.equal(gridDistance(5, 4, 6, 5), 2);
});

test("KPF: a tile is not its own neighbor", () => {
  assert.equal(areNeighbors(5, 4, 5, 4), false);
});

test("KPF: tiles two steps apart are not neighbors", () => {
  assert.equal(areNeighbors(5, 4, 7, 4), false);
});

// ── Game state & movement ────────────────────────────────────────────────────

test("KPF: the player starts on the center tile of the field", () => {
  const s = createState();
  assert.deepEqual(s.player, centerOf(DEFAULT_WIDTH, DEFAULT_HEIGHT));
});

test("KPF: a fresh game starts with zero moves and one visited tile", () => {
  const s = createState();
  assert.equal(s.moves, 0);
  assert.equal(visitedCount(s), 1);
});

test("KPF: the player may move to any orthogonal neighbor", () => {
  const s = createState();
  for (const d of DIRECTIONS) {
    assert.ok(
      canMoveTo(s, s.player.x + d.x, s.player.y + d.y),
      `should allow move to neighbor ${key(d.x, d.y)}`
    );
  }
});

test("KPF: moving to a neighbor increments the move counter", () => {
  const s0 = createState();
  const s1 = move(s0, s0.player.x + 1, s0.player.y);
  assert.deepEqual(s1.player, { x: s0.player.x + 1, y: s0.player.y });
  assert.equal(s1.moves, 1);
});

test("KPF: move() does not mutate the previous state", () => {
  const s0 = createState();
  const start = { ...s0.player };
  move(s0, s0.player.x + 1, s0.player.y);
  assert.deepEqual(s0.player, start);
  assert.equal(s0.moves, 0);
});

test("KPF: the player cannot teleport to a non-neighbor tile", () => {
  const s = createState();
  assert.equal(canMoveTo(s, s.player.x + 2, s.player.y), false);
  const after = move(s, s.player.x + 2, s.player.y);
  assert.equal(after.moves, 0);
  assert.deepEqual(after.player, s.player);
});

test("KPF: the player cannot move diagonally", () => {
  const s = createState();
  assert.equal(canMoveTo(s, s.player.x + 1, s.player.y + 1), false);
});

test("KPF: the player cannot move off the edge of the field", () => {
  let s = createState(3, 3); // center is (1,1)
  s = move(s, 2, 1); // step to right edge
  assert.deepEqual(s.player, { x: 2, y: 1 });
  assert.equal(canMoveTo(s, 3, 1), false); // (3,1) is off a 3-wide field
  assert.equal(move(s, 3, 1).moves, s.moves);
});

test("KPF: the player cannot stand still (moving onto self is illegal)", () => {
  const s = createState();
  assert.equal(canMoveTo(s, s.player.x, s.player.y), false);
});

test("KPF: revisiting a tile still counts as a move but not a new visit", () => {
  let s = createState();
  const start = { ...s.player };
  s = move(s, start.x + 1, start.y); // moves 1, visited 2
  s = move(s, start.x, start.y); // back: moves 2, visited still 2
  assert.equal(s.moves, 2);
  assert.equal(visitedCount(s), 2);
});

test("KPF: visiting new tiles grows the visited set", () => {
  let s = createState();
  const start = { ...s.player };
  s = move(s, start.x + 1, start.y);
  s = move(s, start.x + 1, start.y + 1);
  assert.equal(s.moves, 2);
  assert.equal(visitedCount(s), 3);
});

test("KPF: a loop around a square returns home in four moves", () => {
  let s = createState();
  const c = { ...s.player };
  s = move(s, c.x + 1, c.y); // right
  s = move(s, c.x + 1, c.y + 1); // down
  s = move(s, c.x, c.y + 1); // left
  s = move(s, c.x, c.y); // up -> home
  assert.equal(s.moves, 4);
  assert.deepEqual(s.player, c);
});
