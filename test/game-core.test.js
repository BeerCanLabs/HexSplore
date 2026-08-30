const test = require("node:test");
const assert = require("node:assert/strict");
const {
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
} = require("../game-core.js");

// ── Board generation ─────────────────────────────────────────────────────────

test("KPF: a radius-0 board is a single tile", () => {
  const board = generateBoard(0);
  assert.equal(board.length, 1);
  assert.deepEqual(board[0], { q: 0, r: 0 });
});

test("KPF: board size matches the hex-number formula", () => {
  for (const radius of [0, 1, 2, 3, 4, 5]) {
    assert.equal(generateBoard(radius).length, tileCount(radius));
  }
});

test("KPF: default board is radius 3 with 37 tiles", () => {
  assert.equal(DEFAULT_RADIUS, 3);
  assert.equal(tileCount(3), 37);
  assert.equal(generateBoard().length, 37);
});

test("KPF: every generated tile lies on the board", () => {
  const radius = 3;
  for (const t of generateBoard(radius)) {
    assert.ok(isOnBoard(t.q, t.r, radius), `${key(t.q, t.r)} should be on board`);
  }
});

test("KPF: generateBoard rejects a negative radius", () => {
  assert.throws(() => generateBoard(-1));
});

// ── Neighbor / distance math ─────────────────────────────────────────────────

test("KPF: there are exactly six hex directions", () => {
  assert.equal(DIRECTIONS.length, 6);
});

test("KPF: the center tile has six neighbors", () => {
  assert.equal(neighbors(0, 0).length, 6);
});

test("KPF: a corner tile has fewer on-board neighbors than six", () => {
  const corner = { q: 3, r: 0 }; // on the edge of a radius-3 board
  assert.ok(neighborsOnBoard(corner.q, corner.r, 3).length < 6);
  assert.ok(neighborsOnBoard(corner.q, corner.r, 3).length >= 2);
});

test("KPF: distance from center to an edge equals the radius", () => {
  assert.equal(hexDistance(0, 0, 3, 0), 3);
  assert.equal(hexDistance(0, 0, 0, 3), 3);
  assert.equal(hexDistance(0, 0, -3, 3), 3);
});

test("KPF: adjacent tiles are one step apart", () => {
  for (const d of DIRECTIONS) {
    assert.equal(hexDistance(0, 0, d.q, d.r), 1);
    assert.ok(areNeighbors(0, 0, d.q, d.r));
  }
});

test("KPF: a tile is not its own neighbor", () => {
  assert.equal(areNeighbors(0, 0, 0, 0), false);
});

test("KPF: tiles two steps apart are not neighbors", () => {
  assert.equal(areNeighbors(0, 0, 2, 0), false);
});

// ── Game state & movement ────────────────────────────────────────────────────

test("KPF: a fresh game starts on the center with zero moves", () => {
  const s = createState();
  assert.deepEqual(s.player, { q: 0, r: 0 });
  assert.equal(s.moves, 0);
  assert.equal(visitedCount(s), 1);
});

test("KPF: the player may move to any neighboring tile", () => {
  const s = createState();
  for (const d of DIRECTIONS) {
    assert.ok(canMoveTo(s, d.q, d.r), `should allow move to ${key(d.q, d.r)}`);
  }
});

test("KPF: moving to a neighbor increments the move counter", () => {
  const s0 = createState();
  const s1 = move(s0, 1, 0);
  assert.deepEqual(s1.player, { q: 1, r: 0 });
  assert.equal(s1.moves, 1);
});

test("KPF: move() does not mutate the previous state", () => {
  const s0 = createState();
  move(s0, 1, 0);
  assert.deepEqual(s0.player, { q: 0, r: 0 });
  assert.equal(s0.moves, 0);
});

test("KPF: the player cannot teleport to a non-neighbor tile", () => {
  const s = createState();
  assert.equal(canMoveTo(s, 2, 0), false);
  const after = move(s, 2, 0);
  assert.equal(after.moves, 0);
  assert.deepEqual(after.player, { q: 0, r: 0 });
});

test("KPF: the player cannot move off the edge of the board", () => {
  // Walk step by step out to the eastern edge (each move is one neighbor hop).
  let s = createState();
  s = move(s, 1, 0);
  s = move(s, 2, 0);
  s = move(s, 3, 0);
  assert.equal(s.player.q, 3);
  // (4,0) would be off a radius-3 board even though it is adjacent
  assert.equal(canMoveTo(s, 4, 0), false);
  assert.equal(move(s, 4, 0).moves, s.moves);
});

test("KPF: the player cannot stand still (moving onto self is illegal)", () => {
  const s = createState();
  assert.equal(canMoveTo(s, 0, 0), false);
});

test("KPF: revisiting a tile still counts as a move but not a new visit", () => {
  let s = createState();
  s = move(s, 1, 0); // moves 1, visited 2
  s = move(s, 0, 0); // back to center: moves 2, visited still 2
  assert.equal(s.moves, 2);
  assert.equal(visitedCount(s), 2);
});

test("KPF: visiting new tiles grows the visited set", () => {
  let s = createState();
  s = move(s, 1, 0);
  s = move(s, 1, 1);
  assert.equal(s.moves, 2);
  assert.equal(visitedCount(s), 3);
});

test("KPF: a full walk around the center returns home with six moves", () => {
  let s = createState();
  for (const d of DIRECTIONS) {
    s = move(s, d.q, d.r); // step onto a ring tile
    s = move(s, 0, 0); // step back to center
  }
  assert.equal(s.moves, 12);
  assert.equal(s.player.q, 0);
  assert.equal(s.player.r, 0);
});
