/*
 * HexSplore — app.js
 *
 * Browser-only layer: canvas rendering, pixel<->hex conversion, click handling.
 * ALL game rules (what a legal move is, how moves are counted) live in
 * game-core.js (window.HexCore). This file just draws state and forwards
 * clicks into HexCore.move().
 */
(function () {
  "use strict";

  const Core = window.HexCore;
  const canvas = document.getElementById("board");
  const ctx = canvas.getContext("2d");

  const moveCountEl = document.getElementById("move-count");
  const visitedCountEl = document.getElementById("visited-count");
  const posValueEl = document.getElementById("pos-value");
  const statusEl = document.getElementById("status");
  const resetButton = document.getElementById("reset-button");

  const RADIUS = Core.DEFAULT_RADIUS; // board radius in hexes
  const HEX_SIZE = 46; // pixel radius of a single hex (center to corner)
  const CENTER = { x: canvas.width / 2, y: canvas.height / 2 };

  // Pointy-top hex geometry: width = sqrt(3)*size, height = 2*size.
  const SQRT3 = Math.sqrt(3);

  let state = Core.createState(RADIUS);
  let hoverKey = null; // key of the tile currently under the cursor

  // ── Coordinate conversion (pointy-top axial <-> pixel) ─────────────────────

  function axialToPixel(q, r) {
    const x = HEX_SIZE * SQRT3 * (q + r / 2) + CENTER.x;
    const y = HEX_SIZE * 1.5 * r + CENTER.y;
    return { x, y };
  }

  function pixelToAxial(x, y) {
    const px = x - CENTER.x;
    const py = y - CENTER.y;
    const q = ((SQRT3 / 3) * px - (1 / 3) * py) / HEX_SIZE;
    const r = ((2 / 3) * py) / HEX_SIZE;
    return axialRound(q, r);
  }

  // Round fractional axial coords to the nearest hex (via cube rounding).
  function axialRound(q, r) {
    let x = q;
    let z = r;
    let y = -x - z;
    let rx = Math.round(x);
    let ry = Math.round(y);
    let rz = Math.round(z);
    const dx = Math.abs(rx - x);
    const dy = Math.abs(ry - y);
    const dz = Math.abs(rz - z);
    if (dx > dy && dx > dz) rx = -ry - rz;
    else if (dy > dz) ry = -rx - rz;
    else rz = -rx - ry;
    return { q: rx, r: rz };
  }

  // ── Drawing ─────────────────────────────────────────────────────────────────

  function hexCorner(cx, cy, i) {
    // Pointy-top: first corner at -90deg, then every 60deg.
    const angle = (Math.PI / 180) * (60 * i - 90);
    return { x: cx + HEX_SIZE * Math.cos(angle), y: cy + HEX_SIZE * Math.sin(angle) };
  }

  function tracePath(cx, cy) {
    ctx.beginPath();
    for (let i = 0; i < 6; i++) {
      const c = hexCorner(cx, cy, i);
      if (i === 0) ctx.moveTo(c.x, c.y);
      else ctx.lineTo(c.x, c.y);
    }
    ctx.closePath();
  }

  function draw() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    const board = Core.generateBoard(RADIUS);
    const playerKey = Core.key(state.player.q, state.player.r);

    for (const tile of board) {
      const { x, y } = axialToPixel(tile.q, tile.r);
      const k = Core.key(tile.q, tile.r);
      const visited = state.visited.includes(k);
      const isPlayer = k === playerKey;
      const reachable = Core.canMoveTo(state, tile.q, tile.r);
      const isHover = k === hoverKey;

      tracePath(x, y);

      // Fill: player tile, then reachable neighbors, then visited, then plain.
      if (isPlayer) {
        ctx.fillStyle = "#1c3a34";
      } else if (reachable) {
        ctx.fillStyle = isHover ? "#25506a" : "#1b3346";
      } else if (visited) {
        ctx.fillStyle = "#1a2130";
      } else {
        ctx.fillStyle = "#141b26";
      }
      ctx.fill();

      // Border.
      if (reachable) {
        ctx.strokeStyle = isHover ? "#6aa8ff" : "#3d6f96";
        ctx.lineWidth = 2.5;
      } else {
        ctx.strokeStyle = "rgba(255,255,255,0.10)";
        ctx.lineWidth = 1.5;
      }
      ctx.stroke();

      // The player marker.
      if (isPlayer) {
        ctx.beginPath();
        ctx.arc(x, y, HEX_SIZE * 0.42, 0, Math.PI * 2);
        const grad = ctx.createRadialGradient(x, y, 2, x, y, HEX_SIZE * 0.42);
        grad.addColorStop(0, "#8affd4");
        grad.addColorStop(1, "#2fae82");
        ctx.fillStyle = grad;
        ctx.fill();
        ctx.strokeStyle = "#eafff6";
        ctx.lineWidth = 2;
        ctx.stroke();
      }
    }
  }

  // ── HUD + status ─────────────────────────────────────────────────────────────

  function updateHud() {
    moveCountEl.textContent = String(state.moves);
    visitedCountEl.textContent = String(Core.visitedCount(state));
    posValueEl.textContent = `${state.player.q}, ${state.player.r}`;
  }

  function setStatus(msg) {
    statusEl.textContent = msg;
  }

  // ── Input ─────────────────────────────────────────────────────────────────────

  // Translate a mouse event into board (canvas-pixel) coordinates, accounting
  // for the canvas being CSS-scaled to fit its container.
  function eventToCanvasPixel(evt) {
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    return {
      x: (evt.clientX - rect.left) * scaleX,
      y: (evt.clientY - rect.top) * scaleY,
    };
  }

  canvas.addEventListener("click", (evt) => {
    const p = eventToCanvasPixel(evt);
    const hex = pixelToAxial(p.x, p.y);

    if (hex.q === state.player.q && hex.r === state.player.r) {
      setStatus("You're already standing there.");
      return;
    }
    if (!Core.isOnBoard(hex.q, hex.r, RADIUS)) {
      setStatus("That's beyond the edge of the world.");
      return;
    }
    if (!Core.canMoveTo(state, hex.q, hex.r)) {
      setStatus("Too far — you can only step onto a neighboring tile.");
      return;
    }

    state = Core.move(state, hex.q, hex.r);
    updateHud();
    draw();
    setStatus(`Moved to (${hex.q}, ${hex.r}). That's ${state.moves} move${state.moves === 1 ? "" : "s"}.`);
  });

  canvas.addEventListener("mousemove", (evt) => {
    const p = eventToCanvasPixel(evt);
    const hex = pixelToAxial(p.x, p.y);
    const k =
      Core.isOnBoard(hex.q, hex.r, RADIUS) && Core.canMoveTo(state, hex.q, hex.r)
        ? Core.key(hex.q, hex.r)
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
    state = Core.createState(RADIUS);
    hoverKey = null;
    updateHud();
    draw();
    setStatus("World reset. Back to the center.");
  });

  // ── Boot ─────────────────────────────────────────────────────────────────────

  updateHud();
  draw();
})();
