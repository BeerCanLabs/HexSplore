/*
 * HexSplore — app.js
 *
 * Browser-only layer: full-screen canvas rendering of a grassy square field,
 * pixel<->tile conversion, and click handling. ALL game rules (what a legal
 * move is, how moves are counted) live in game-core.js (window.HexCore). This
 * file just draws the state and forwards clicks into HexCore.move().
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

  const COLS = Core.DEFAULT_WIDTH;
  const ROWS = Core.DEFAULT_HEIGHT;

  let state = Core.createState(COLS, ROWS);
  let hoverKey = null; // key of the reachable tile under the cursor

  // Layout, recomputed on every resize. `tile` is the square edge length in CSS
  // px; the whole board is centered in the viewport with the field filling as
  // much of the screen as it can while keeping tiles square.
  let layout = { tile: 64, originX: 0, originY: 0, dpr: 1 };

  // Deterministic pseudo-random in [0,1) from integer tile coords, so each
  // grass tile looks consistent across redraws (no shimmering).
  function rand(x, y, salt) {
    const n = Math.sin(x * 127.1 + y * 311.7 + salt * 74.7) * 43758.5453;
    return n - Math.floor(n);
  }

  // ── Sizing ─────────────────────────────────────────────────────────────────

  function resize() {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const vw = window.innerWidth;
    const vh = window.innerHeight;

    // Largest square tile that lets the whole field fit on screen.
    const tile = Math.floor(Math.min(vw / COLS, vh / ROWS));
    const boardW = tile * COLS;
    const boardH = tile * ROWS;

    layout = {
      tile,
      originX: Math.floor((vw - boardW) / 2),
      originY: Math.floor((vh - boardH) / 2),
      dpr,
    };

    canvas.width = Math.floor(vw * dpr);
    canvas.height = Math.floor(vh * dpr);
    canvas.style.width = vw + "px";
    canvas.style.height = vh + "px";
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    draw();
  }

  // Tile (x, y) -> top-left pixel of its square.
  function tileToPixel(x, y) {
    return {
      px: layout.originX + x * layout.tile,
      py: layout.originY + y * layout.tile,
    };
  }

  // Pixel -> tile coords (may be off-board; caller validates).
  function pixelToTile(px, py) {
    return {
      x: Math.floor((px - layout.originX) / layout.tile),
      y: Math.floor((py - layout.originY) / layout.tile),
    };
  }

  // ── Grass tile ───────────────────────────────────────────────────────────────

  function drawGrassTile(px, py, size, x, y, opts) {
    // Base grass color: a checkerboard "mowed" pattern plus per-tile variation.
    const mow = (x + y) % 2 === 0;
    const baseL = mow ? 46 : 40; // lightness for the two mow stripes
    const vary = Math.floor(rand(x, y, 1) * 7) - 3;
    const hue = 96 + Math.floor(rand(x, y, 2) * 12) - 6; // greens around 90-102
    ctx.fillStyle = `hsl(${hue}, 46%, ${baseL + vary}%)`;
    ctx.fillRect(px, py, size, size);

    // Soft vertical gradient sheen for a little depth.
    const grad = ctx.createLinearGradient(px, py, px, py + size);
    grad.addColorStop(0, "rgba(255,255,255,0.05)");
    grad.addColorStop(1, "rgba(0,0,0,0.06)");
    ctx.fillStyle = grad;
    ctx.fillRect(px, py, size, size);

    // Scattered grass blades: a handful of short darker/lighter strokes.
    const blades = 6 + Math.floor(rand(x, y, 3) * 4);
    ctx.lineWidth = Math.max(1, size * 0.02);
    ctx.lineCap = "round";
    for (let i = 0; i < blades; i++) {
      const bx = px + rand(x, y, 10 + i) * size;
      const by = py + size * (0.55 + rand(x, y, 20 + i) * 0.4);
      const h = size * (0.1 + rand(x, y, 30 + i) * 0.14);
      const lean = (rand(x, y, 40 + i) - 0.5) * size * 0.12;
      const dark = rand(x, y, 50 + i) > 0.5;
      ctx.strokeStyle = dark
        ? "rgba(24, 58, 20, 0.5)"
        : "rgba(150, 205, 110, 0.55)";
      ctx.beginPath();
      ctx.moveTo(bx, by);
      ctx.lineTo(bx + lean, by - h);
      ctx.stroke();
    }

    // Occasional tiny wildflower for charm.
    if (rand(x, y, 7) > 0.9) {
      const fx = px + (0.25 + rand(x, y, 8) * 0.5) * size;
      const fy = py + (0.25 + rand(x, y, 9) * 0.5) * size;
      ctx.fillStyle = rand(x, y, 11) > 0.5 ? "#f7e463" : "#f2f2f2";
      ctx.beginPath();
      ctx.arc(fx, fy, Math.max(1.2, size * 0.035), 0, Math.PI * 2);
      ctx.fill();
    }

    // State overlays -----------------------------------------------------------
    if (opts.visited && !opts.isPlayer) {
      // A gentle worn/trampled path tint on tiles already walked.
      ctx.fillStyle = "rgba(70, 50, 25, 0.16)";
      ctx.fillRect(px, py, size, size);
    }
    if (opts.reachable) {
      // Highlight the squares the player can step to.
      ctx.fillStyle = opts.hover
        ? "rgba(255, 244, 170, 0.34)"
        : "rgba(255, 255, 210, 0.16)";
      ctx.fillRect(px, py, size, size);
      ctx.strokeStyle = opts.hover
        ? "rgba(255, 248, 190, 0.95)"
        : "rgba(255, 250, 205, 0.55)";
      ctx.lineWidth = Math.max(2, size * 0.04);
      ctx.strokeRect(px + 1, py + 1, size - 2, size - 2);
    }

    // Subtle tile seam so the grid of squares reads clearly.
    ctx.strokeStyle = "rgba(20, 40, 16, 0.28)";
    ctx.lineWidth = 1;
    ctx.strokeRect(px + 0.5, py + 0.5, size - 1, size - 1);
  }

  // ── Chess-piece player (a pawn) ──────────────────────────────────────────────

  function drawPawn(cx, baseY, size) {
    // Proportions relative to tile size; drawn centered on cx, sitting on baseY.
    const s = size;
    const headR = s * 0.13;
    const headCy = baseY - s * 0.62;
    const neckW = s * 0.12;
    const collarY = headCy + headR + s * 0.02;
    const bodyTopY = collarY + s * 0.06;
    const baseW = s * 0.44;
    const baseH = s * 0.1;
    const baseTopY = baseY - baseH;

    ctx.save();

    // Soft drop shadow on the grass.
    ctx.fillStyle = "rgba(0,0,0,0.28)";
    ctx.beginPath();
    ctx.ellipse(cx, baseY + s * 0.01, baseW * 0.55, s * 0.05, 0, 0, Math.PI * 2);
    ctx.fill();

    // A warm ivory piece with a dark outline (classic chess look).
    const fill = "#f3ead6";
    const edge = "#3a2c18";
    ctx.lineJoin = "round";
    ctx.lineWidth = Math.max(1.5, s * 0.02);
    ctx.strokeStyle = edge;

    // Base (rounded trapezoid slab).
    ctx.fillStyle = fill;
    ctx.beginPath();
    ctx.moveTo(cx - baseW / 2, baseTopY + baseH);
    ctx.lineTo(cx + baseW / 2, baseTopY + baseH);
    ctx.lineTo(cx + baseW * 0.36, baseTopY);
    ctx.lineTo(cx - baseW * 0.36, baseTopY);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    // Body: two curves sweeping from the base up to a narrow neck.
    ctx.beginPath();
    ctx.moveTo(cx - baseW * 0.34, baseTopY);
    ctx.quadraticCurveTo(cx - s * 0.02, collarY, cx - neckW / 2, bodyTopY);
    ctx.lineTo(cx + neckW / 2, bodyTopY);
    ctx.quadraticCurveTo(cx + s * 0.02, collarY, cx + baseW * 0.34, baseTopY);
    ctx.closePath();
    ctx.fillStyle = fill;
    ctx.fill();
    ctx.stroke();

    // Collar ring under the head.
    ctx.beginPath();
    ctx.ellipse(cx, collarY, s * 0.14, s * 0.045, 0, 0, Math.PI * 2);
    ctx.fillStyle = fill;
    ctx.fill();
    ctx.stroke();

    // Head (the sphere on top).
    ctx.beginPath();
    ctx.arc(cx, headCy, headR, 0, Math.PI * 2);
    ctx.fillStyle = fill;
    ctx.fill();
    ctx.stroke();

    // A soft highlight on the head for a little sheen.
    ctx.beginPath();
    ctx.arc(cx - headR * 0.3, headCy - headR * 0.3, headR * 0.4, 0, Math.PI * 2);
    ctx.fillStyle = "rgba(255,255,255,0.5)";
    ctx.fill();

    ctx.restore();
  }

  // ── Draw everything ──────────────────────────────────────────────────────────

  function draw() {
    const vw = canvas.width / layout.dpr;
    const vh = canvas.height / layout.dpr;

    // Grassy surround behind the board (in case aspect ratios leave margins).
    ctx.fillStyle = "#3f6a28";
    ctx.fillRect(0, 0, vw, vh);

    const size = layout.tile;
    const playerKey = Core.key(state.player.x, state.player.y);

    for (let y = 0; y < ROWS; y++) {
      for (let x = 0; x < COLS; x++) {
        const { px, py } = tileToPixel(x, y);
        const k = Core.key(x, y);
        drawGrassTile(px, py, size, x, y, {
          visited: state.visited.includes(k),
          reachable: Core.canMoveTo(state, x, y),
          hover: k === hoverKey,
          isPlayer: k === playerKey,
        });
      }
    }

    // Player pawn on top of its tile.
    const { px, py } = tileToPixel(state.player.x, state.player.y);
    drawPawn(px + size / 2, py + size * 0.86, size);
  }

  // ── HUD + status ─────────────────────────────────────────────────────────────

  function updateHud() {
    moveCountEl.textContent = String(state.moves);
    visitedCountEl.textContent = String(Core.visitedCount(state));
  }

  function setStatus(msg) {
    statusEl.textContent = msg;
  }

  // ── Input ─────────────────────────────────────────────────────────────────────

  function eventToPixel(evt) {
    const rect = canvas.getBoundingClientRect();
    return { x: evt.clientX - rect.left, y: evt.clientY - rect.top };
  }

  canvas.addEventListener("click", (evt) => {
    const p = eventToPixel(evt);
    const t = pixelToTile(p.x, p.y);

    if (!Core.isOnBoard(t.x, t.y, COLS, ROWS)) return;
    if (t.x === state.player.x && t.y === state.player.y) {
      setStatus("Your piece is already on that square.");
      return;
    }
    if (!Core.canMoveTo(state, t.x, t.y)) {
      setStatus("Only neighboring squares — up, down, left, or right.");
      return;
    }

    state = Core.move(state, t.x, t.y);
    hoverKey = null;
    updateHud();
    draw();
    setStatus(`Moved to (${t.x}, ${t.y}). That's ${state.moves} move${state.moves === 1 ? "" : "s"}.`);
  });

  canvas.addEventListener("mousemove", (evt) => {
    const p = eventToPixel(evt);
    const t = pixelToTile(p.x, p.y);
    const k =
      Core.isOnBoard(t.x, t.y, COLS, ROWS) && Core.canMoveTo(state, t.x, t.y)
        ? Core.key(t.x, t.y)
        : null;
    if (k !== hoverKey) {
      hoverKey = k;
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
    updateHud();
    draw();
    setStatus("Back to the center of the field.");
  });

  window.addEventListener("resize", resize);

  // ── Boot ─────────────────────────────────────────────────────────────────────

  updateHud();
  resize();
})();
