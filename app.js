/*
 * HexSplore — app.js
 *
 * Full-screen SQUARE-grid map. Browser-only layer: responsive canvas sizing,
 * procedural grassy-field tile rendering, a chess-piece (pawn) player, and
 * click-to-move. ALL game rules live in game-core.js (window.HexCore).
 */
(function () {
  "use strict";

  const Core = window.HexCore;
  const canvas = document.getElementById("board");
  const ctx = canvas.getContext("2d");

  const moveCountEl = document.getElementById("move-count");
  const visitedCountEl = document.getElementById("visited-count");
  const statusEl = document.getElementById("status");
  const resetButton = document.getElementById("reset-button");

  const COLS = Core.DEFAULT_COLS; // 12
  const ROWS = Core.DEFAULT_ROWS; // 9

  let state = Core.createState(COLS, ROWS);
  let hoverKey = null;

  // Layout computed on every resize: tile size + board origin so the grid is
  // centered and fills as much of the viewport as possible.
  let layout = { tile: 64, originX: 0, originY: 0, w: 0, h: 0 };

  // Per-tile deterministic RNG seed so grass tufts stay stable across redraws.
  function tileSeed(c, r) {
    let h = (c * 73856093) ^ (r * 19349663);
    h = (h ^ (h >>> 13)) * 1274126177;
    return (h ^ (h >>> 16)) >>> 0;
  }
  // Tiny deterministic PRNG (mulberry32) seeded per tile.
  function rngFor(c, r) {
    let a = tileSeed(c, r);
    return function () {
      a |= 0;
      a = (a + 0x6d2b79f5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  // ── Responsive sizing ─────────────────────────────────────────────────────

  function resize() {
    const dpr = window.devicePixelRatio || 1;
    const vw = window.innerWidth;
    const vh = window.innerHeight;

    canvas.width = Math.floor(vw * dpr);
    canvas.height = Math.floor(vh * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    // Largest square tile that fits the whole grid in the viewport.
    const tile = Math.floor(Math.min(vw / COLS, vh / ROWS));
    const w = tile * COLS;
    const h = tile * ROWS;
    layout = {
      tile,
      w,
      h,
      originX: Math.floor((vw - w) / 2),
      originY: Math.floor((vh - h) / 2),
    };
    draw();
  }

  // Tile top-left pixel.
  function tilePixel(c, r) {
    return { x: layout.originX + c * layout.tile, y: layout.originY + r * layout.tile };
  }

  // Convert a viewport pixel to a grid coordinate (may be off-board).
  function pixelToTile(x, y) {
    const c = Math.floor((x - layout.originX) / layout.tile);
    const r = Math.floor((y - layout.originY) / layout.tile);
    return { c, r };
  }

  // ── Grassy field rendering ──────────────────────────────────────────────────

  function drawGrassTile(x, y, size, c, r, opts) {
    const rand = rngFor(c, r);
    // Base grass color varies subtly per tile for a natural, patchy field.
    const checker = (c + r) % 2 === 0;
    const baseH = 100 + Math.floor(rand() * 18); // green hues
    const baseS = 42 + Math.floor(rand() * 12);
    const baseL = (checker ? 30 : 27) + Math.floor(rand() * 6);
    ctx.fillStyle = `hsl(${baseH}, ${baseS}%, ${baseL}%)`;
    ctx.fillRect(x, y, size, size);

    // A soft darker patch or two for texture.
    const patches = 1 + Math.floor(rand() * 2);
    for (let i = 0; i < patches; i++) {
      const px = x + rand() * size;
      const py = y + rand() * size;
      const pr = size * (0.12 + rand() * 0.16);
      const g = ctx.createRadialGradient(px, py, 0, px, py, pr);
      g.addColorStop(0, `hsla(${baseH}, ${baseS}%, ${baseL - 8}%, 0.5)`);
      g.addColorStop(1, "hsla(0,0%,0%,0)");
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(px, py, pr, 0, Math.PI * 2);
      ctx.fill();
    }

    // Grass blades: little upward strokes scattered across the tile.
    const blades = Math.floor(size / 7) + Math.floor(rand() * 4);
    ctx.lineWidth = Math.max(1, size * 0.02);
    ctx.lineCap = "round";
    for (let i = 0; i < blades; i++) {
      const bx = x + 4 + rand() * (size - 8);
      const by = y + 6 + rand() * (size - 8);
      const hgt = size * (0.08 + rand() * 0.12);
      const lean = (rand() - 0.5) * size * 0.06;
      const shade = 34 + Math.floor(rand() * 22);
      ctx.strokeStyle = `hsl(${baseH + 4}, ${baseS + 8}%, ${shade}%)`;
      ctx.beginPath();
      ctx.moveTo(bx, by);
      ctx.quadraticCurveTo(bx + lean * 0.5, by - hgt * 0.6, bx + lean, by - hgt);
      ctx.stroke();
    }

    // Subtle tile grid line.
    ctx.strokeStyle = "rgba(0,0,0,0.16)";
    ctx.lineWidth = 1;
    ctx.strokeRect(x + 0.5, y + 0.5, size - 1, size - 1);

    // Highlight reachable neighbor tiles and hover.
    if (opts.reachable) {
      ctx.fillStyle = opts.hover ? "rgba(255,255,120,0.28)" : "rgba(255,255,180,0.14)";
      ctx.fillRect(x, y, size, size);
      ctx.strokeStyle = opts.hover ? "rgba(255,255,150,0.95)" : "rgba(255,255,180,0.55)";
      ctx.lineWidth = Math.max(2, size * 0.03);
      ctx.strokeRect(x + 1.5, y + 1.5, size - 3, size - 3);
    } else if (opts.visited && !opts.player) {
      // A faint worn trail on tiles you've already walked.
      ctx.fillStyle = "rgba(70,45,20,0.12)";
      ctx.fillRect(x, y, size, size);
    }
  }

  // ── Chess-piece (pawn) player ──────────────────────────────────────────────

  function drawPawn(cx, baseY, size) {
    // A vector pawn: base, collar, body (bell), and head. Drawn in white-ivory
    // with shading so it reads as a chess piece on the field.
    const s = size; // tile size scale reference
    ctx.save();

    // Drop shadow ellipse.
    ctx.fillStyle = "rgba(0,0,0,0.30)";
    ctx.beginPath();
    ctx.ellipse(cx, baseY + s * 0.02, s * 0.30, s * 0.10, 0, 0, Math.PI * 2);
    ctx.fill();

    const grad = ctx.createLinearGradient(cx - s * 0.2, 0, cx + s * 0.2, 0);
    grad.addColorStop(0, "#ffffff");
    grad.addColorStop(0.5, "#f4efe4");
    grad.addColorStop(1, "#cfc7b4");

    const stroke = "#3a352c";
    ctx.strokeStyle = stroke;
    ctx.lineWidth = Math.max(1.5, s * 0.025);
    ctx.lineJoin = "round";
    ctx.fillStyle = grad;

    const topY = baseY - s * 0.62; // where the head sits

    // Base (wide foot).
    ctx.beginPath();
    ctx.moveTo(cx - s * 0.26, baseY);
    ctx.quadraticCurveTo(cx - s * 0.30, baseY - s * 0.06, cx - s * 0.18, baseY - s * 0.09);
    ctx.lineTo(cx + s * 0.18, baseY - s * 0.09);
    ctx.quadraticCurveTo(cx + s * 0.30, baseY - s * 0.06, cx + s * 0.26, baseY);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    // Body (bell shape) from base up to collar.
    ctx.beginPath();
    ctx.moveTo(cx - s * 0.16, baseY - s * 0.09);
    ctx.quadraticCurveTo(cx - s * 0.22, baseY - s * 0.28, cx - s * 0.10, baseY - s * 0.34);
    ctx.lineTo(cx + s * 0.10, baseY - s * 0.34);
    ctx.quadraticCurveTo(cx + s * 0.22, baseY - s * 0.28, cx + s * 0.16, baseY - s * 0.09);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    // Collar ring.
    ctx.beginPath();
    ctx.ellipse(cx, baseY - s * 0.35, s * 0.13, s * 0.045, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    // Neck.
    ctx.beginPath();
    ctx.moveTo(cx - s * 0.07, baseY - s * 0.36);
    ctx.quadraticCurveTo(cx - s * 0.09, baseY - s * 0.44, cx - s * 0.05, baseY - s * 0.48);
    ctx.lineTo(cx + s * 0.05, baseY - s * 0.48);
    ctx.quadraticCurveTo(cx + s * 0.09, baseY - s * 0.44, cx + s * 0.07, baseY - s * 0.36);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    // Head (sphere).
    ctx.beginPath();
    ctx.arc(cx, topY + s * 0.02, s * 0.12, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    // Head sheen.
    ctx.fillStyle = "rgba(255,255,255,0.55)";
    ctx.beginPath();
    ctx.arc(cx - s * 0.04, topY - s * 0.02, s * 0.04, 0, Math.PI * 2);
    ctx.fill();

    ctx.restore();
  }

  // ── Full draw ────────────────────────────────────────────────────────────────

  function draw() {
    // Fill the whole viewport (a border of field color around the grid).
    ctx.fillStyle = "#274d22";
    ctx.fillRect(0, 0, window.innerWidth, window.innerHeight);

    const size = layout.tile;
    const playerKey = Core.key(state.player.c, state.player.r);

    for (const tile of Core.generateBoard(COLS, ROWS)) {
      const { x, y } = tilePixel(tile.c, tile.r);
      const k = Core.key(tile.c, tile.r);
      drawGrassTile(x, y, size, tile.c, tile.r, {
        reachable: Core.canMoveTo(state, tile.c, tile.r),
        hover: k === hoverKey,
        visited: state.visited.includes(k),
        player: k === playerKey,
      });
    }

    // Player on top, feet centered near the bottom of its tile.
    const pp = tilePixel(state.player.c, state.player.r);
    drawPawn(pp.x + size / 2, pp.y + size * 0.82, size);
  }

  // ── Input ─────────────────────────────────────────────────────────────────────

  function eventPixel(evt) {
    const rect = canvas.getBoundingClientRect();
    return { x: evt.clientX - rect.left, y: evt.clientY - rect.top };
  }

  let statusTimer = null;
  function setStatus(msg) {
    statusEl.textContent = msg;
    statusEl.classList.add("show");
    clearTimeout(statusTimer);
    statusTimer = setTimeout(() => statusEl.classList.remove("show"), 1800);
  }

  function handleClick(px, py) {
    const t = pixelToTile(px, py);
    if (t.c === state.player.c && t.r === state.player.r) return;
    if (!Core.isOnBoard(t.c, t.r, COLS, ROWS)) return;
    if (!Core.canMoveTo(state, t.c, t.r)) {
      setStatus("Only one tile at a time — pick an adjacent square.");
      return;
    }
    state = Core.move(state, t.c, t.r);
    moveCountEl.textContent = String(state.moves);
    visitedCountEl.textContent = String(Core.visitedCount(state));
    draw();
    setStatus(`Move ${state.moves}`);
  }

  canvas.addEventListener("click", (evt) => {
    const p = eventPixel(evt);
    handleClick(p.x, p.y);
  });

  canvas.addEventListener("mousemove", (evt) => {
    const p = eventPixel(evt);
    const t = pixelToTile(p.x, p.y);
    const k =
      Core.isOnBoard(t.c, t.r, COLS, ROWS) && Core.canMoveTo(state, t.c, t.r)
        ? Core.key(t.c, t.r)
        : null;
    if (k !== hoverKey) {
      hoverKey = k;
      canvas.style.cursor = k ? "pointer" : "default";
      draw();
    }
  });

  canvas.addEventListener("mouseleave", () => {
    if (hoverKey !== null) {
      hoverKey = null;
      draw();
    }
  });

  resetButton.addEventListener("click", () => {
    state = Core.createState(COLS, ROWS);
    hoverKey = null;
    moveCountEl.textContent = "0";
    visitedCountEl.textContent = "1";
    draw();
    setStatus("Field reset");
  });

  window.addEventListener("resize", resize);

  // ── Boot ─────────────────────────────────────────────────────────────────────
  resize();
})();
