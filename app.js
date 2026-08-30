/*
 * HexSplore — app.js
 *
 * Full-screen SQUARE-grid map. Browser-only layer: responsive canvas sizing,
 * camera-centric scrolling centered on the player, procedural grassy-field 
 * tile rendering, vector trees/rocks obstacles, blue water ponds, gems collection, 
 * gold treasure chests, fog of war, and responsive click-to-move handling.
 *
 * The board expands infinitely in all directions when the player steps on any edge
 * of the current map boundary, pushing negative coordinates cleanly.
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
  const gemsCountEl = document.getElementById("gems-count");
  const gemsContainerEl = document.getElementById("hud-gems-container");
  const statusEl = document.getElementById("status");
  const resetButton = document.getElementById("reset-button");

  // Victory Overlay Elements
  const victoryOverlay = document.getElementById("victory-overlay");
  const vMovesEl = document.getElementById("v-moves");
  const vGemsEl = document.getElementById("v-gems");
  const vExploredEl = document.getElementById("v-explored");
  const victoryResetBtn = document.getElementById("victory-reset-button");

  const COLS = Core.DEFAULT_COLS; // 12
  const ROWS = Core.DEFAULT_ROWS; // 9

  // Start with rich Mode enabled so the game is incredibly engaging!
  let state = Core.createState(COLS, ROWS, { richMode: true });
  let hoverKey = null;

  // Layout computed on every resize: comfortable tile size.
  // The camera centers the player in the middle of the viewport.
  let layout = { tile: 64 };

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

  // ── Responsive Camera & Sizing ────────────────────────────────────────────

  function resize() {
    const dpr = window.devicePixelRatio || 1;
    const vw = window.innerWidth;
    const vh = window.innerHeight;

    canvas.width = Math.floor(vw * dpr);
    canvas.height = Math.floor(vh * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    // Comfortable, responsive tile size scaled to viewport size
    layout.tile = Math.max(54, Math.floor(Math.min(vw, vh) * 0.12));
    if (layout.tile > 88) layout.tile = 88; // cap max size

    draw();
  }

  // Camera-centric tile coordinate translation (centered on player pawn)
  function tilePixel(c, r) {
    const centerX = window.innerWidth / 2;
    const centerY = window.innerHeight / 2;
    const dx = c - state.player.c;
    const dy = r - state.player.r;
    return {
      x: Math.floor(centerX + (dx - 0.5) * layout.tile),
      y: Math.floor(centerY + (dy - 0.5) * layout.tile)
    };
  }

  // Convert a screen pixel back to coordinate matching camera center
  function pixelToTile(x, y) {
    const centerX = window.innerWidth / 2;
    const centerY = window.innerHeight / 2;
    const dx = (x - centerX) / layout.tile + 0.5;
    const dy = (y - centerY) / layout.tile + 0.5;
    return {
      c: Math.floor(state.player.c + dx),
      r: Math.floor(state.player.r + dy)
    };
  }

  // ── Rich tile rendering with terrain & Fog of War ──────────────────────────

  function drawTile(x, y, size, c, r, opts) {
    const rand = rngFor(c, r);
    const k = Core.key(c, r);

    // 1. If NOT revealed, draw Fog of War
    if (state.revealed && !state.revealed.includes(k)) {
      ctx.fillStyle = "#161c22"; // mysterious dark grey
      ctx.fillRect(x, y, size, size);

      // Render misty rolling clouds
      ctx.fillStyle = "rgba(255, 255, 255, 0.025)";
      ctx.beginPath();
      ctx.arc(x + size * 0.4, y + size * 0.4, size * 0.22, 0, Math.PI * 2);
      ctx.arc(x + size * 0.6, y + size * 0.5, size * 0.26, 0, Math.PI * 2);
      ctx.fill();

      // Subtle tile border inside fog
      ctx.strokeStyle = "rgba(255,255,255,0.035)";
      ctx.lineWidth = 1;
      ctx.strokeRect(x + 0.5, y + 0.5, size - 1, size - 1);
      return;
    }

    // 2. Tile is revealed! Determine its base terrain:
    const isObstacle = state.obstacles && state.obstacles.includes(k);
    const isWater = state.water && state.water.includes(k);

    if (isWater) {
      // Draw blue water pond
      const baseH = 200 + Math.floor(rand() * 10); // blue/cyan
      const baseS = 65 + Math.floor(rand() * 15);
      const baseL = 33 + Math.floor(rand() * 8);
      ctx.fillStyle = `hsl(${baseH}, ${baseS}%, ${baseL}%)`;
      ctx.fillRect(x, y, size, size);

      // Draw soft water ripple waves
      ctx.strokeStyle = `hsla(${baseH}, ${baseS}%, ${baseL + 15}%, 0.4)`;
      ctx.lineWidth = Math.max(1.5, size * 0.02);
      ctx.lineCap = "round";
      
      const ripples = 2;
      for (let i = 0; i < ripples; i++) {
        const rx = x + size * 0.15 + rand() * (size * 0.4);
        const ry = y + size * 0.15 + rand() * (size * 0.4);
        const rw = size * 0.15 + rand() * (size * 0.12);
        
        ctx.beginPath();
        ctx.arc(rx, ry, rw, Math.PI * 0.2, Math.PI * 0.8);
        ctx.stroke();
      }

    } else {
      // Grass (normal walkable terrain or tree/rock base)
      const checker = (c + r) % 2 === 0;
      const baseH = 100 + Math.floor(rand() * 18); // green hues
      const baseS = 42 + Math.floor(rand() * 12);
      const baseL = (checker ? 30 : 27) + Math.floor(rand() * 6);
      ctx.fillStyle = `hsl(${baseH}, ${baseS}%, ${baseL}%)`;
      ctx.fillRect(x, y, size, size);

      // Draw darker texture patches
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

      // Scatter grass blades
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

      // Draw a wildflower occasionally!
      if (rand() < 0.08) {
        const fx = x + size * 0.25 + rand() * (size * 0.5);
        const fy = y + size * 0.25 + rand() * (size * 0.5);
        const fr = size * 0.04;
        
        // Flower stem
        ctx.strokeStyle = "#4d7c0f";
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(fx, fy);
        ctx.lineTo(fx, fy + size * 0.12);
        ctx.stroke();

        // Petals
        ctx.fillStyle = rand() < 0.5 ? "#facc15" : "#f472b6"; // yellow or pink
        ctx.beginPath();
        ctx.arc(fx - fr, fy, fr, 0, Math.PI * 2);
        ctx.arc(fx + fr, fy, fr, 0, Math.PI * 2);
        ctx.arc(fx, fy - fr, fr, 0, Math.PI * 2);
        ctx.arc(fx, fy + fr, fr, 0, Math.PI * 2);
        ctx.fill();

        // Center
        ctx.fillStyle = "#ffffff";
        ctx.beginPath();
        ctx.arc(fx, fy, fr * 0.6, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    // 3. Draw vector tree or rock inside obstacles
    if (isObstacle) {
      const px = x + size / 2;
      const py = y + size * 0.85;
      
      if (rand() < 0.5) {
        // Draw Pine Tree
        ctx.save();
        // Shadow
        ctx.fillStyle = "rgba(0,0,0,0.22)";
        ctx.beginPath();
        ctx.ellipse(px, py, size * 0.22, size * 0.08, 0, 0, Math.PI * 2);
        ctx.fill();

        // Trunk
        ctx.fillStyle = "#713f12";
        ctx.fillRect(px - size * 0.05, py - size * 0.2, size * 0.1, size * 0.2);

        // Pine branches (3 layered triangles)
        ctx.fillStyle = "#14532d";
        
        // Bottom triangle
        ctx.beginPath();
        ctx.moveTo(px - size * 0.28, py - size * 0.18);
        ctx.lineTo(px + size * 0.28, py - size * 0.18);
        ctx.lineTo(px, py - size * 0.45);
        ctx.closePath();
        ctx.fill();

        // Middle triangle
        ctx.fillStyle = "#15803d";
        ctx.beginPath();
        ctx.moveTo(px - size * 0.22, py - size * 0.35);
        ctx.lineTo(px + size * 0.22, py - size * 0.35);
        ctx.lineTo(px, py - size * 0.60);
        ctx.closePath();
        ctx.fill();

        // Top triangle
        ctx.fillStyle = "#22c55e";
        ctx.beginPath();
        ctx.moveTo(px - size * 0.15, py - size * 0.50);
        ctx.lineTo(px + size * 0.15, py - size * 0.50);
        ctx.lineTo(px, py - size * 0.72);
        ctx.closePath();
        ctx.fill();
        ctx.restore();

      } else {
        // Draw Rock Boulder
        ctx.save();
        // Shadow
        ctx.fillStyle = "rgba(0,0,0,0.22)";
        ctx.beginPath();
        ctx.ellipse(px, py, size * 0.26, size * 0.1, 0, 0, Math.PI * 2);
        ctx.fill();

        // Boulders (two overlapping rocks)
        // Rock 1 (main)
        ctx.fillStyle = "#4b5563";
        ctx.beginPath();
        ctx.moveTo(px - size * 0.22, py);
        ctx.quadraticCurveTo(px - size * 0.24, py - size * 0.34, px, py - size * 0.36);
        ctx.quadraticCurveTo(px + size * 0.22, py - size * 0.34, px + size * 0.2, py);
        ctx.closePath();
        ctx.fill();

        // Rock 1 Highlight
        ctx.strokeStyle = "#9ca3af";
        ctx.lineWidth = Math.max(1, size * 0.015);
        ctx.beginPath();
        ctx.moveTo(px - size * 0.14, py - size * 0.14);
        ctx.quadraticCurveTo(px - size * 0.12, py - size * 0.3, px, py - size * 0.32);
        ctx.stroke();

        // Rock 2 (smaller overlapping side rock)
        ctx.fillStyle = "#374151";
        ctx.beginPath();
        ctx.moveTo(px + size * 0.05, py);
        ctx.quadraticCurveTo(px + size * 0.02, py - size * 0.22, px + size * 0.18, py - size * 0.24);
        ctx.quadraticCurveTo(px + size * 0.32, py - size * 0.2, px + size * 0.28, py);
        ctx.closePath();
        ctx.fill();
        ctx.restore();
      }
    }

    // 4. Draw Collectibles (Gems)
    const hasGem = state.gems && state.gems.includes(k);
    if (hasGem) {
      ctx.save();
      const cx = x + size / 2;
      const cy = y + size * 0.45;
      
      // Shadow
      ctx.fillStyle = "rgba(0,0,0,0.18)";
      ctx.beginPath();
      ctx.ellipse(cx, cy + size * 0.25, size * 0.12, size * 0.04, 0, 0, Math.PI * 2);
      ctx.fill();

      // Gem shape (Diamond)
      const w = size * 0.12;
      const h = size * 0.18;
      
      const gGrad = ctx.createLinearGradient(cx - w, cy - h, cx + w, cy + h);
      gGrad.addColorStop(0, "#fb7185"); // hot pink/rose gradient
      gGrad.addColorStop(0.5, "#ec4899");
      gGrad.addColorStop(1, "#be185d");

      ctx.fillStyle = gGrad;
      ctx.strokeStyle = "#9d174d";
      ctx.lineWidth = Math.max(1, size * 0.015);
      
      ctx.beginPath();
      ctx.moveTo(cx, cy - h); // top
      ctx.lineTo(cx + w, cy); // right
      ctx.lineTo(cx, cy + h); // bottom
      ctx.lineTo(cx - w, cy); // left
      ctx.closePath();
      ctx.fill();
      ctx.stroke();

      // Facet reflection highlights
      ctx.fillStyle = "rgba(255,255,255,0.45)";
      ctx.beginPath();
      ctx.moveTo(cx, cy - h);
      ctx.lineTo(cx + w * 0.4, cy);
      ctx.lineTo(cx, cy);
      ctx.lineTo(cx - w * 0.4, cy);
      ctx.closePath();
      ctx.fill();

      ctx.restore();
    }

    // 5. Draw Chest (Goal)
    const isChest = state.chest && state.chest.c === c && state.chest.r === r;
    if (isChest) {
      ctx.save();
      const cx = x + size / 2;
      const cy = y + size * 0.5;

      // Golden glow behind chest
      const glow = ctx.createRadialGradient(cx, cy, 0, cx, cy, size * 0.45);
      glow.addColorStop(0, "rgba(234, 179, 8, 0.4)");
      glow.addColorStop(1, "rgba(234, 179, 8, 0)");
      ctx.fillStyle = glow;
      ctx.beginPath();
      ctx.arc(cx, cy, size * 0.45, 0, Math.PI * 2);
      ctx.fill();

      // Shadow
      ctx.fillStyle = "rgba(0,0,0,0.3)";
      ctx.beginPath();
      ctx.ellipse(cx, cy + size * 0.22, size * 0.24, size * 0.08, 0, 0, Math.PI * 2);
      ctx.fill();

      // Chest Body (Wood/Golden Chest)
      const cw = size * 0.42;
      const ch = size * 0.32;
      const bx = cx - cw / 2;
      const by = cy - ch / 2 + size * 0.08;

      // Base Box (Brown)
      ctx.fillStyle = "#78350f"; // wood brown
      ctx.strokeStyle = "#451a03";
      ctx.lineWidth = Math.max(1.5, size * 0.02);
      ctx.fillRect(bx, by, cw, ch);
      ctx.strokeRect(bx, by, cw, ch);

      // Rounded Lid
      const lidH = size * 0.15;
      const lx = bx;
      const ly = by - lidH;

      ctx.fillStyle = "#92400e";
      ctx.beginPath();
      ctx.moveTo(lx, ly + lidH);
      ctx.quadraticCurveTo(lx + cw * 0.1, ly, lx + cw / 2, ly);
      ctx.quadraticCurveTo(lx + cw * 0.9, ly, lx + cw, ly + lidH);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();

      // Gold Trim bands on sides
      ctx.fillStyle = "#eab308"; // Gold
      ctx.fillRect(lx + size * 0.04, ly + lidH * 0.2, size * 0.04, lidH * 0.8 + ch);
      ctx.fillRect(lx + cw - size * 0.08, ly + lidH * 0.2, size * 0.04, lidH * 0.8 + ch);

      // Gold Lock Plate
      ctx.fillStyle = "#ca8a04";
      ctx.fillRect(cx - size * 0.05, by - size * 0.03, size * 0.1, size * 0.12);
      ctx.strokeRect(cx - size * 0.05, by - size * 0.03, size * 0.1, size * 0.12);

      // Silver Keyhole dot
      ctx.fillStyle = "#1e293b";
      ctx.beginPath();
      ctx.arc(cx, by + size * 0.03, size * 0.02, 0, Math.PI * 2);
      ctx.fill();

      ctx.restore();
    }

    // Subtle tile grid line.
    ctx.strokeStyle = "rgba(0,0,0,0.14)";
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
      ctx.fillStyle = "rgba(70,45,20,0.10)";
      ctx.fillRect(x, y, size, size);
    }
  }

  // ── Chess-piece (pawn) player ──────────────────────────────────────────────

  function drawPawn(cx, baseY, size) {
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
    // Fill the whole viewport with deep dark forest color.
    ctx.fillStyle = "#11220e";
    ctx.fillRect(0, 0, window.innerWidth, window.innerHeight);

    const size = layout.tile;
    const playerKey = Core.key(state.player.c, state.player.r);

    // Draw all active tiles on the dynamically expanding board
    for (const tile of Core.generateBoard(state)) {
      const { x, y } = tilePixel(tile.c, tile.r);
      const k = Core.key(tile.c, tile.r);
      
      // Safety clip: only render if tile is on/near the screen boundaries to keep drawing ultra-fast!
      if (x < -size || x > window.innerWidth + size || y < -size || y > window.innerHeight + size) {
        continue;
      }

      // Determine if reachable
      const reachable = Core.canMoveTo(state, tile.c, tile.r);
      
      // Reachable indicators are only visible on revealed tiles
      const isReachableAndRevealed = reachable && (state.revealed && state.revealed.includes(k));

      drawTile(x, y, size, tile.c, tile.r, {
        reachable: isReachableAndRevealed,
        hover: k === hoverKey,
        visited: state.visited.includes(k),
        player: k === playerKey,
      });
    }

    // Player pawn is always drawn locked at the exact screen center!
    const centerX = window.innerWidth / 2;
    const centerY = window.innerHeight / 2;
    drawPawn(centerX, centerY + size * 0.32, size);
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

  function syncHUD() {
    moveCountEl.textContent = String(state.moves);
    visitedCountEl.textContent = String(Core.visitedCount(state));
    
    // Gems counter sync
    if (state.totalGems > 0) {
      gemsContainerEl.style.display = "flex";
      gemsCountEl.textContent = `${state.gemsCollected}/${state.totalGems}`;
    } else {
      gemsContainerEl.style.display = "none";
    }

    // Handle Victory screen popup
    if (state.victory) {
      vMovesEl.textContent = String(state.moves);
      vGemsEl.textContent = `${state.gemsCollected}/${state.totalGems}`;
      
      // Percent explored calculation
      const totalTiles = Core.tileCount(state);
      const exploredCount = state.visited.length;
      const percentExplored = Math.round((exploredCount / totalTiles) * 100);
      vExploredEl.textContent = `${percentExplored}%`;

      victoryOverlay.style.display = "flex";
    } else {
      victoryOverlay.style.display = "none";
    }
  }

  function handleClick(px, py) {
    if (state.victory) return; // Block input on victory

    const t = pixelToTile(px, py);
    if (t.c === state.player.c && t.r === state.player.r) return;
    
    // Check if target is legal coordinate boundary in current state
    if (!Core.isOnBoard(t.c, t.r, state)) return;

    const k = Core.key(t.c, t.r);
    
    // Safety: ensure it is revealed and reachable
    const isRevealed = state.revealed && state.revealed.includes(k);
    if (!isRevealed) {
      setStatus("Can't step blindly into deep fog!");
      return;
    }

    if (!Core.canMoveTo(state, t.c, t.r)) {
      setStatus("Path is blocked or too far!");
      return;
    }

    const previousGems = state.gemsCollected;
    const oldMinCol = state.minCol;
    const oldMaxCol = state.maxCol;
    const oldMinRow = state.minRow;
    const oldMaxRow = state.maxRow;

    state = Core.move(state, t.c, t.r);
    
    // Feedback for boundary expansion!
    const expanded = (state.minCol !== oldMinCol || state.maxCol !== oldMaxCol || 
                      state.minRow !== oldMinRow || state.maxRow !== oldMaxRow);

    if (state.gemsCollected > previousGems) {
      setStatus(`💎 Collected a sparkling ruby! (${state.gemsCollected}/${state.totalGems})`);
    } else if (state.victory) {
      setStatus("👑 Found the Golden Chest! Victory!");
    } else if (expanded) {
      setStatus("🌫️ The mist recedes! Map boundary expanded!");
    } else {
      setStatus(`Move ${state.moves}`);
    }

    syncHUD();
    draw();
  }

  canvas.addEventListener("click", (evt) => {
    const p = eventPixel(evt);
    handleClick(p.x, p.y);
  });

  canvas.addEventListener("mousemove", (evt) => {
    if (state.victory) return;

    const p = eventPixel(evt);
    const t = pixelToTile(p.x, p.y);
    const k = Core.key(t.c, t.r);
    
    // Hover ONLY works on revealed, reachable tiles
    const isHoverValid = Core.isOnBoard(t.c, t.r, state) && 
                         Core.canMoveTo(state, t.c, t.r) &&
                         (state.revealed && state.revealed.includes(k));

    const hoverVal = isHoverValid ? k : null;
    if (hoverVal !== hoverKey) {
      hoverKey = hoverVal;
      canvas.style.cursor = hoverVal ? "pointer" : "default";
      draw();
    }
  });

  canvas.addEventListener("mouseleave", () => {
    if (hoverKey !== null) {
      hoverKey = null;
      draw();
    }
  });

  function startNewGame() {
    state = Core.createState(COLS, ROWS, { richMode: true });
    hoverKey = null;
    syncHUD();
    draw();
    setStatus("Mysterious new world generated");
  }

  resetButton.addEventListener("click", startNewGame);
  victoryResetBtn.addEventListener("click", startNewGame);

  window.addEventListener("resize", resize);

  // ── Boot ─────────────────────────────────────────────────────────────────────
  syncHUD();
  resize();
})();
