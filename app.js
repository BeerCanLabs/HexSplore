/*
 * HexSplore — app.js
 *
 * Full-screen SQUARE-grid map. Browser-only layer: responsive canvas sizing,
 * manual mouse click-and-drag camera panning, procedural grassy-field tile rendering,
 * vector snowy peak mountains (obstacles), fluffy puffy white clouds (fog of war),
 * and tactile neighbor movement.
 *
 * ALL game rules live in game-core.js (window.HexCore).
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

  let state = Core.createState(COLS, ROWS, { richMode: true });
  let hoverKey = null;

  // Layout computed on every resize: comfortable tile size.
  let layout = { tile: 64 };

  // Manual camera offset. Initialized to center on player spawn coordinates.
  let camX = 0;
  let camY = 0;

  // Per-tile deterministic RNG seed so grass tufts & mountain shapes stay stable across redraws.
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

  // ── Responsive Camera & Sizing ────────────────────────────────────────────

  function resize() {
    const dpr = window.devicePixelRatio || 1;
    const vw = window.innerWidth;
    const vh = window.innerHeight;

    canvas.width = Math.floor(vw * dpr);
    canvas.height = Math.floor(vh * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    // Keep the layout tile size fixed and comfortable
    layout.tile = Math.max(54, Math.floor(Math.min(vw, vh) * 0.12));
    if (layout.tile > 88) layout.tile = 88; // cap max size

    // If camera is uninitialized (at start), center it on the player!
    if (camX === 0 && camY === 0) {
      resetCamera();
    }

    draw();
  }

  // Centered camera offset reset
  function resetCamera() {
    const centerX = window.innerWidth / 2;
    const centerY = window.innerHeight / 2;
    camX = Math.floor(centerX - (state.player.c + 0.5) * layout.tile);
    camY = Math.floor(centerY - (state.player.r + 0.5) * layout.tile);
  }

  // Translate grid coordinates to screen pixel positions under manual camera offset
  function tilePixel(c, r) {
    return {
      x: Math.floor(camX + c * layout.tile),
      y: Math.floor(camY + r * layout.tile)
    };
  }

  // Translate screen pixel back to grid coordinates matching manual camera offset
  function pixelToTile(x, y) {
    return {
      c: Math.floor((x - camX) / layout.tile),
      r: Math.floor((y - camY) / layout.tile)
    };
  }

  // ── Fluffy Cloud Vector Rendering (Fog of War) ─────────────────────────────

  function drawCloudTile(x, y, size, rand) {
    ctx.save();
    
    // Draw 5 overlapping puffed circles inside the tile to form a cumulative soft cloud layer
    const numPuffs = 5;
    
    ctx.shadowColor = "rgba(15, 23, 42, 0.08)";
    ctx.shadowBlur = size * 0.08;
    
    for (let i = 0; i < numPuffs; i++) {
      const px = x + size * 0.15 + rand() * (size * 0.7);
      const py = y + size * 0.15 + rand() * (size * 0.7);
      const pr = size * 0.20 + rand() * (size * 0.15);
      
      // Shadow layer
      ctx.fillStyle = "rgba(226, 232, 240, 0.94)"; // slate-grey puffy cloud
      ctx.beginPath();
      ctx.arc(px + size * 0.02, py + size * 0.02, pr, 0, Math.PI * 2);
      ctx.fill();

      // Highlight layer
      ctx.fillStyle = "rgba(255, 255, 255, 0.98)"; // bright white highlight
      ctx.beginPath();
      ctx.arc(px, py, pr, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.restore();
  }

  // ── Snowy Peak Mountain Vector Rendering (Obstacles) ──────────────────────────

  function drawMountain(x, y, size, rand) {
    ctx.save();
    
    // Base shadow
    ctx.fillStyle = "rgba(0,0,0,0.16)";
    ctx.beginPath();
    ctx.ellipse(x + size/2, y + size * 0.82, size * 0.35, size * 0.08, 0, 0, Math.PI * 2);
    ctx.fill();

    // Side Peak (back layer)
    const spX = x + size * 0.3 + rand() * (size * 0.1);
    const spY = y + size * 0.8;
    const spW = size * 0.22;
    const spH = size * 0.35;
    drawPeak(spX, spY, spW, spH, "#52525b", "#3f3f46", "#e4e4e7"); // dark zinc peaks

    // Main Peak (front layer)
    const mpX = x + size * 0.55 - rand() * (size * 0.1);
    const mpY = y + size * 0.82;
    const mpW = size * 0.32;
    const mpH = size * 0.55;
    drawPeak(mpX, mpY, mpW, mpH, "#71717a", "#4b5563", "#ffffff"); // Cool granite peaks

    ctx.restore();
  }

  function drawPeak(cx, baseY, halfW, height, lightColor, shadowColor, snowColor) {
    const topY = baseY - height;
    
    // 1. Shaded Right-Side triangle
    ctx.fillStyle = shadowColor;
    ctx.beginPath();
    ctx.moveTo(cx, topY);
    ctx.lineTo(cx + halfW, baseY);
    ctx.lineTo(cx, baseY);
    ctx.closePath();
    ctx.fill();

    // 2. Highlighted Left-Side triangle
    ctx.fillStyle = lightColor;
    ctx.beginPath();
    ctx.moveTo(cx, topY);
    ctx.lineTo(cx - halfW, baseY);
    ctx.lineTo(cx, baseY);
    ctx.closePath();
    ctx.fill();

    // 3. Snowy peak cap (top 28% of the mountain)
    const snowH = height * 0.28;
    const snowY = topY + snowH;
    const snowW = halfW * 0.28;

    ctx.fillStyle = snowColor;
    ctx.beginPath();
    ctx.moveTo(cx, topY);
    ctx.lineTo(cx + snowW, snowY);
    
    // Jagged snow base line
    ctx.lineTo(cx + snowW * 0.4, snowY + snowH * 0.1);
    ctx.lineTo(cx, snowY - snowH * 0.12);
    ctx.lineTo(cx - snowW * 0.4, snowY + snowH * 0.15);
    
    ctx.lineTo(cx - snowW, snowY);
    ctx.closePath();
    ctx.fill();
  }

  // ── Grass Tile Rendering ──────────────────────────────────────────────────

  function drawGrassTile(x, y, size, c, r, opts) {
    const rand = rngFor(c, r);
    const checker = (c + r) % 2 === 0;
    const baseH = 100 + Math.floor(rand() * 18); // green hues
    const baseS = 42 + Math.floor(rand() * 12);
    const baseL = (checker ? 30 : 27) + Math.floor(rand() * 6);
    ctx.fillStyle = `hsl(${baseH}, ${baseS}%, ${baseL}%)`;
    ctx.fillRect(x, y, size, size);

    // Draw darker grass patches
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

    // Scatter individual grass blades
    const blades = Math.floor(size / 8) + Math.floor(rand() * 4);
    ctx.lineWidth = Math.max(1, size * 0.015);
    ctx.lineCap = "round";
    for (let i = 0; i < blades; i++) {
      const bx = x + 4 + rand() * (size - 8);
      const by = y + 6 + rand() * (size - 8);
      const hgt = size * (0.07 + rand() * 0.1);
      const lean = (rand() - 0.5) * size * 0.05;
      const shade = 35 + Math.floor(rand() * 20);
      ctx.strokeStyle = `hsl(${baseH + 4}, ${baseS + 8}%, ${shade}%)`;
      ctx.beginPath();
      ctx.moveTo(bx, by);
      ctx.quadraticCurveTo(bx + lean * 0.5, by - hgt * 0.6, bx + lean, by - hgt);
      ctx.stroke();
    }

    // Occasional wildflower
    if (rand() < 0.08) {
      const fx = x + size * 0.25 + rand() * (size * 0.5);
      const fy = y + size * 0.25 + rand() * (size * 0.5);
      const fr = size * 0.04;
      
      ctx.strokeStyle = "#4d7c0f";
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(fx, fy);
      ctx.lineTo(fx, fy + size * 0.12);
      ctx.stroke();

      ctx.fillStyle = rand() < 0.5 ? "#facc15" : "#f472b6";
      ctx.beginPath();
      ctx.arc(fx - fr, fy, fr, 0, Math.PI * 2);
      ctx.arc(fx + fr, fy, fr, 0, Math.PI * 2);
      ctx.arc(fx, fy - fr, fr, 0, Math.PI * 2);
      ctx.arc(fx, fy + fr, fr, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = "#ffffff";
      ctx.beginPath();
      ctx.arc(fx, fy, fr * 0.6, 0, Math.PI * 2);
      ctx.fill();
    }

    // Subtle tile borders
    ctx.strokeStyle = "rgba(0,0,0,0.14)";
    ctx.lineWidth = 1;
    ctx.strokeRect(x + 0.5, y + 0.5, size - 1, size - 1);

    // Highlight reachable cells
    if (opts.reachable) {
      ctx.fillStyle = opts.hover ? "rgba(255,255,120,0.28)" : "rgba(255,255,180,0.14)";
      ctx.fillRect(x, y, size, size);
      ctx.strokeStyle = opts.hover ? "rgba(255,255,150,0.95)" : "rgba(255,255,180,0.55)";
      ctx.lineWidth = Math.max(2, size * 0.03);
      ctx.strokeRect(x + 1.5, y + 1.5, size - 3, size - 3);
    } else if (opts.visited && !opts.player) {
      ctx.fillStyle = "rgba(70,45,20,0.10)";
      ctx.fillRect(x, y, size, size);
    }
  }

  // ── Chess-piece (pawn) player ──────────────────────────────────────────────

  function drawPawn(cx, baseY, size) {
    const s = size;
    ctx.save();

    // Shadow
    ctx.fillStyle = "rgba(0,0,0,0.32)";
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

    const topY = baseY - s * 0.62;

    // Base
    ctx.beginPath();
    ctx.moveTo(cx - s * 0.26, baseY);
    ctx.quadraticCurveTo(cx - s * 0.30, baseY - s * 0.06, cx - s * 0.18, baseY - s * 0.09);
    ctx.lineTo(cx + s * 0.18, baseY - s * 0.09);
    ctx.quadraticCurveTo(cx + s * 0.30, baseY - s * 0.06, cx + s * 0.26, baseY);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    // Body
    ctx.beginPath();
    ctx.moveTo(cx - s * 0.16, baseY - s * 0.09);
    ctx.quadraticCurveTo(cx - s * 0.22, baseY - s * 0.28, cx - s * 0.10, baseY - s * 0.34);
    ctx.lineTo(cx + s * 0.10, baseY - s * 0.34);
    ctx.quadraticCurveTo(cx + s * 0.22, baseY - s * 0.28, cx + s * 0.16, baseY - s * 0.09);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    // Collar
    ctx.beginPath();
    ctx.ellipse(cx, baseY - s * 0.35, s * 0.13, s * 0.045, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    // Neck
    ctx.beginPath();
    ctx.moveTo(cx - s * 0.07, baseY - s * 0.36);
    ctx.quadraticCurveTo(cx - s * 0.09, baseY - s * 0.44, cx - s * 0.05, baseY - s * 0.48);
    ctx.lineTo(cx + s * 0.05, baseY - s * 0.48);
    ctx.quadraticCurveTo(cx + s * 0.09, baseY - s * 0.44, cx + s * 0.07, baseY - s * 0.36);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    // Head
    ctx.beginPath();
    ctx.arc(cx, topY + s * 0.02, s * 0.12, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    // Highlight
    ctx.fillStyle = "rgba(255,255,255,0.55)";
    ctx.beginPath();
    ctx.arc(cx - s * 0.04, topY - s * 0.02, s * 0.04, 0, Math.PI * 2);
    ctx.fill();

    ctx.restore();
  }

  // ── Full draw ────────────────────────────────────────────────────────────────

  function draw() {
    ctx.fillStyle = "#11220e";
    ctx.fillRect(0, 0, window.innerWidth, window.innerHeight);

    const size = layout.tile;
    const playerKey = Core.key(state.player.c, state.player.r);

    for (const tile of Core.generateBoard(state)) {
      const { x, y } = tilePixel(tile.c, tile.r);
      const k = Core.key(tile.c, tile.r);
      
      // Safety viewport clip: skip rendering if off-screen to stay high-performance
      if (x < -size || x > window.innerWidth + size || y < -size || y > window.innerHeight + size) {
        continue;
      }

      // Check if tile is revealed
      const isRevealed = state.revealed && state.revealed.includes(k);
      const rand = rngFor(tile.c, tile.r);

      if (!isRevealed) {
        // Shrouded in fluffy clouds
        drawCloudTile(x, y, size, rand);
      } else {
        // Walkable indicators are only on revealed reachable tiles
        const reachable = Core.canMoveTo(state, tile.c, tile.r);
        const isReachableAndRevealed = reachable && isRevealed;

        drawGrassTile(x, y, size, tile.c, tile.r, {
          reachable: isReachableAndRevealed,
          hover: k === hoverKey,
          visited: state.visited.includes(k),
          player: k === playerKey,
        });

        // If obstacle is present, draw a snowy peak mountain!
        const isObstacle = state.obstacles && state.obstacles.includes(k);
        if (isObstacle) {
          drawMountain(x, y, size, rand);
        }
      }
    }

    // Player pawn stays positioned on its tile coordinate (which scrolls freely)
    if (state.revealed && state.revealed.includes(playerKey)) {
      const pp = tilePixel(state.player.c, state.player.r);
      drawPawn(pp.x + size / 2, pp.y + size * 0.82, size);
    }
  }

  // ── Click and Drag / Touch Panning Interaction ──────────────────────────────

  let isPanning = false;
  let lastMouseX = 0;
  let lastMouseY = 0;
  let totalDragDistance = 0;

  function handleStart(clientX, clientY) {
    isPanning = true;
    lastMouseX = clientX;
    lastMouseY = clientY;
    totalDragDistance = 0;
    canvas.style.cursor = "grabbing";
  }

  function handleMove(clientX, clientY) {
    if (!isPanning) return;
    const dx = clientX - lastMouseX;
    const dy = clientY - lastMouseY;
    camX += dx;
    camY += dy;
    lastMouseX = clientX;
    lastMouseY = clientY;
    totalDragDistance += Math.sqrt(dx * dx + dy * dy);
    draw();
  }

  function handleEnd(clientX, clientY) {
    if (!isPanning) return;
    isPanning = false;
    canvas.style.cursor = "default";
    
    // If barely moved, treat as a coordinate click to step the pawn!
    if (totalDragDistance < 6) {
      const rect = canvas.getBoundingClientRect();
      const px = clientX - rect.left;
      const py = clientY - rect.top;
      handleClick(px, py);
    }
  }

  // Mouse Listeners
  canvas.addEventListener("mousedown", (evt) => handleStart(evt.clientX, evt.clientY));
  
  canvas.addEventListener("mousemove", (evt) => {
    if (isPanning) {
      handleMove(evt.clientX, evt.clientY);
    } else {
      const rect = canvas.getBoundingClientRect();
      const px = evt.clientX - rect.left;
      const py = evt.clientY - rect.top;
      const t = pixelToTile(px, py);
      const k = Core.key(t.c, t.r);
      
      const isHoverValid = Core.isOnBoard(t.c, t.r, state) && 
                           Core.canMoveTo(state, t.c, t.r) &&
                           (state.revealed && state.revealed.includes(k));

      const hoverVal = isHoverValid ? k : null;
      if (hoverVal !== hoverKey) {
        hoverKey = hoverVal;
        canvas.style.cursor = hoverVal ? "pointer" : "grab";
        draw();
      }
    }
  });
  
  canvas.addEventListener("mouseup", (evt) => handleEnd(evt.clientX, evt.clientY));
  canvas.addEventListener("mouseleave", () => { isPanning = false; });

  // Touch/Mobile Listeners
  canvas.addEventListener("touchstart", (evt) => {
    if (evt.touches.length === 1) {
      handleStart(evt.touches[0].clientX, evt.touches[0].clientY);
    }
  });

  canvas.addEventListener("touchmove", (evt) => {
    if (evt.touches.length === 1) {
      handleMove(evt.touches[0].clientX, evt.touches[0].clientY);
    }
  });

  canvas.addEventListener("touchend", (evt) => {
    if (evt.changedTouches.length === 1) {
      handleEnd(evt.changedTouches[0].clientX, evt.changedTouches[0].clientY);
    }
  });

  // ── Pawn Movement Handling ──────────────────────────────────────────────────

  function setStatus(msg) {
    statusEl.textContent = msg;
    statusEl.classList.add("show");
    clearTimeout(statusTimer);
    statusTimer = setTimeout(() => statusEl.classList.remove("show"), 1800);
  }
  let statusTimer = null;

  function syncHUD() {
    moveCountEl.textContent = String(state.moves);
    visitedCountEl.textContent = String(Core.visitedCount(state));
  }

  function handleClick(px, py) {
    const t = pixelToTile(px, py);
    if (t.c === state.player.c && t.r === state.player.r) return;
    if (!Core.isOnBoard(t.c, t.r, state)) return;

    const k = Core.key(t.c, t.r);
    const isRevealed = state.revealed && state.revealed.includes(k);
    
    if (!isRevealed) {
      setStatus("You cannot step blindly into deep cloud cover!");
      return;
    }

    if (!Core.canMoveTo(state, t.c, t.r)) {
      setStatus("Those high snowy mountains are impassable!");
      return;
    }

    const oldMinCol = state.minCol;
    const oldMaxCol = state.maxCol;
    const oldMinRow = state.minRow;
    const oldMaxRow = state.maxRow;

    state = Core.move(state, t.c, t.r);
    
    const expanded = (state.minCol !== oldMinCol || state.maxCol !== oldMaxCol || 
                      state.minRow !== oldMinRow || state.maxRow !== oldMaxRow);

    if (expanded) {
      setStatus("☁️ The clouds recede as new territory is revealed!");
    } else {
      setStatus(`Move ${state.moves}`);
    }

    syncHUD();
    draw();
  }

  function startNewGame() {
    state = Core.createState(COLS, ROWS, { richMode: true });
    hoverKey = null;
    resetCamera();
    syncHUD();
    draw();
    setStatus("Endless mountain valley generated");
  }

  resetButton.addEventListener("click", startNewGame);
  window.addEventListener("resize", resize);

  // ── Boot ─────────────────────────────────────────────────────────────────────
  syncHUD();
  resize();
})();
