/* MazeQuest Mini — core game (vanilla JS + Canvas, no dependencies) */
(() => {
  "use strict";

  const TILE = 40;
  const MAX_HEARTS = 3;
  const MOVE_MS = 130;            // time to walk one tile
  const SPIKE_PERIOD = 2400;      // full spike cycle (ms)
  const SPIKE_UP = 1000;          // how long spikes stay up
  const SPIKE_WARN = 350;         // warning wobble before spikes rise
  const INVULN_MS = 1200;

  const DIRS = { up: [0, -1], down: [0, 1], left: [-1, 0], right: [1, 0] };
  const KEYMAP = {
    ArrowUp: "up", KeyW: "up", ArrowDown: "down", KeyS: "down",
    ArrowLeft: "left", KeyA: "left", ArrowRight: "right", KeyD: "right",
  };

  // ---------- DOM ----------
  const $ = (id) => document.getElementById(id);
  const canvas = $("game");
  const ctx = canvas.getContext("2d");
  const screens = {
    menu: $("screen-menu"), howto: $("screen-howto"), pause: $("screen-pause"),
    win: $("screen-win"), over: $("screen-over"),
  };

  // ---------- State ----------
  let level, tiles, W, H, state = "menu", prevState = "menu";
  let player, crate, hasKeyCount, gems, gemsTotal, hearts, gateOpen, plateActive;
  let checkpoint, startTime, elapsed, pausedAt, invulnUntil, path, particles, toasts;
  let muted = false;
  const held = new Set();

  // ---------- Audio (tiny WebAudio synth) ----------
  let actx = null;
  function beep(freq = 440, dur = 0.08, type = "square", vol = 0.05, slide = 0) {
    if (muted) return;
    try {
      actx = actx || new (window.AudioContext || window.webkitAudioContext)();
      const o = actx.createOscillator(), g = actx.createGain();
      o.type = type; o.frequency.value = freq;
      if (slide) o.frequency.linearRampToValueAtTime(freq + slide, actx.currentTime + dur);
      g.gain.value = vol;
      g.gain.exponentialRampToValueAtTime(0.0001, actx.currentTime + dur);
      o.connect(g).connect(actx.destination);
      o.start(); o.stop(actx.currentTime + dur);
    } catch (e) { /* audio unavailable */ }
  }
  const sfx = {
    step: () => beep(180, 0.03, "triangle", 0.02),
    gem: () => { beep(880, 0.06, "square", 0.04); setTimeout(() => beep(1320, 0.08, "square", 0.04), 60); },
    key: () => beep(660, 0.25, "triangle", 0.06, 440),
    door: () => beep(140, 0.25, "sawtooth", 0.05, -60),
    lever: () => beep(300, 0.1, "square", 0.05, 200),
    push: () => beep(90, 0.06, "sawtooth", 0.04),
    plate: () => { beep(400, 0.1, "triangle", 0.06); setTimeout(() => beep(600, 0.15, "triangle", 0.06), 100); },
    hurt: () => beep(200, 0.3, "sawtooth", 0.07, -150),
    heart: () => beep(520, 0.2, "sine", 0.07, 260),
    bump: () => beep(70, 0.05, "square", 0.03),
    win: () => [523, 659, 784, 1046].forEach((f, i) => setTimeout(() => beep(f, 0.18, "triangle", 0.07), i * 120)),
    over: () => [392, 330, 262].forEach((f, i) => setTimeout(() => beep(f, 0.25, "sawtooth", 0.05), i * 180)),
    click: () => beep(600, 0.03, "square", 0.03),
  };

  // ---------- Level setup ----------
  function loadLevel(def) {
    level = def;
    H = def.map.length; W = def.map[0].length;
    tiles = def.map.map((row) => row.split(""));
    crate = null; gemsTotal = 0;
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      const t = tiles[y][x];
      if (t === "S") { player = mkPlayer(x, y); tiles[y][x] = "."; }
      if (t === "B") { crate = { x, y, locked: false }; tiles[y][x] = "."; }
      if (t === "*") gemsTotal++;
    }
    canvas.width = W * TILE; canvas.height = H * TILE;
    hasKeyCount = 0; gems = 0; hearts = MAX_HEARTS;
    gateOpen = false; plateActive = false;
    checkpoint = { x: player.x, y: player.y };
    elapsed = 0; startTime = performance.now(); invulnUntil = 0;
    path = []; particles = []; toasts = [];
    $("level-name").textContent = `Level ${def.id} · ${def.name}`;
    updateHUD();
  }
  function mkPlayer(x, y) {
    return { x, y, px: x, py: y, fromX: x, fromY: y, t: 1, face: "down", moving: false };
  }

  // ---------- Rules ----------
  const inside = (x, y) => x >= 0 && y >= 0 && x < W && y < H;
  const crateAt = (x, y) => crate && !crate.locked && crate.x === x && crate.y === y;

  function passable(x, y) {
    if (!inside(x, y)) return false;
    const t = tiles[y][x];
    if (t === "#" || t === "L" || t === "D") return false;
    if (t === "G") return gateOpen;
    if (t === "H") return plateActive;
    return true;
  }

  function spikeState(x, now = performance.now()) {
    // each spike column has its own phase so they ripple along the corridor
    const t = (now + x * 280) % SPIKE_PERIOD;
    if (t < SPIKE_UP) return "up";
    if (t > SPIKE_PERIOD - SPIKE_WARN) return "warn";
    return "down";
  }

  function tryMove(dir) {
    if (state !== "playing" || player.moving) return false;
    const [dx, dy] = DIRS[dir];
    player.face = dir;
    const nx = player.x + dx, ny = player.y + dy;
    if (!inside(nx, ny)) return false;
    const t = tiles[ny][nx];

    if (t === "D") {
      if (hasKeyCount > 0) {
        hasKeyCount--; tiles[ny][nx] = "."; sfx.door();
        toast("🔓 Door unlocked!"); burst(nx, ny, "#e0b050", 14);
        updateHUD();
      } else { toast("🔒 Locked. Find the golden key."); sfx.bump(); return false; }
    }
    if (t === "L") { toggleLever(nx, ny); return false; }
    if (t === "G" && !gateOpen) { toast("The iron gate is shut. A lever must control it…"); sfx.bump(); return false; }
    if (t === "H" && !plateActive) { toast("Sealed. Something heavy on the plate might open it."); sfx.bump(); return false; }

    if (crateAt(nx, ny)) {
      const cx = nx + dx, cy = ny + dy;
      const ct = inside(cx, cy) ? tiles[cy][cx] : "#";
      if (ct === "." || ct === "P") {
        crate.x = cx; crate.y = cy; sfx.push();
        if (ct === "P") {
          crate.locked = true; plateActive = true; sfx.plate();
          toast("✨ The crate locks into the plate — a gate opens!");
          burst(cx, cy, "#4fd1c5", 20);
        }
      } else { sfx.bump(); return false; }
    }
    if (!passable(nx, ny)) { sfx.bump(); return false; }

    Object.assign(player, { fromX: player.x, fromY: player.y, x: nx, y: ny, t: 0, moving: true });
    sfx.step();
    return true;
  }

  function onArrive() {
    const { x, y } = player, t = tiles[y][x];
    if (t === "*") { tiles[y][x] = "."; gems++; sfx.gem(); burst(x, y, "#7cf3ff", 12); }
    if (t === "k") { tiles[y][x] = "."; hasKeyCount++; sfx.key(); toast("🗝️ You found the golden key!"); burst(x, y, "#ffd54a", 16); }
    if (t === "+") {
      if (hearts < MAX_HEARTS) { tiles[y][x] = "."; hearts++; sfx.heart(); toast("❤️ +1 heart"); burst(x, y, "#ff5a7a", 12); }
    }
    if (t === "c" && (checkpoint.x !== x || checkpoint.y !== y)) {
      checkpoint = { x, y }; toast("🚩 Checkpoint reached"); beep(700, 0.1, "triangle", 0.05);
    }
    if (t === "X") return win();
    updateHUD();
  }

  function toggleLever(lx, ly) {
    const d = Math.abs(lx - player.x) + Math.abs(ly - player.y);
    if (d > 1) { toast("Get closer to pull the lever."); return; }
    gateOpen = !gateOpen; sfx.lever();
    toast(gateOpen ? "⚙️ Clunk! You hear a gate rise in the distance." : "⚙️ The gate slams shut.");
    burst(lx, ly, "#f5a623", 8);
    updateHUD();
  }

  function interact() {
    for (const [dx, dy] of Object.values(DIRS)) {
      const x = player.x + dx, y = player.y + dy;
      if (inside(x, y) && tiles[y][x] === "L") return toggleLever(x, y);
    }
    toast("Nothing to interact with here.");
  }

  function hurt() {
    hearts--; sfx.hurt(); invulnUntil = performance.now() + INVULN_MS;
    shake = 10; burst(player.x, player.y, "#ff3b3b", 18);
    path = [];
    if (hearts <= 0) { updateHUD(); return gameOver(); }
    toast("💥 Ouch! Back to the checkpoint.");
    const { x, y } = checkpoint;
    Object.assign(player, { x, y, fromX: x, fromY: y, px: x, py: y, t: 1, moving: false });
    updateHUD();
  }

  // ---------- Click-to-move (BFS) ----------
  function findPath(tx, ty) {
    const key = (x, y) => y * W + x;
    const goalBlocked = !passable(tx, ty) || crateAt(tx, ty);
    const prev = new Map([[key(player.x, player.y), null]]);
    const q = [[player.x, player.y]];
    while (q.length) {
      const [x, y] = q.shift();
      if (x === tx && y === ty) break;
      for (const [name, [dx, dy]] of Object.entries(DIRS)) {
        const nx = x + dx, ny = y + dy, k = key(nx, ny);
        if (prev.has(k)) continue;
        const isGoal = nx === tx && ny === ty;
        // intermediate tiles must be walkable; the goal itself may be an
        // interactable (door / lever / crate / gate) — the final step bumps into it
        if (!isGoal && (!passable(nx, ny) || crateAt(nx, ny))) continue;
        prev.set(k, { x, y, dir: name });
        if (!isGoal || !goalBlocked) q.push([nx, ny]);
        else { q.length = 0; break; }
      }
    }
    if (!prev.has(key(tx, ty))) return null;
    const dirs = [];
    let cur = { x: tx, y: ty };
    while (prev.get(key(cur.x, cur.y))) {
      const p = prev.get(key(cur.x, cur.y));
      dirs.unshift(p.dir); cur = p;
    }
    return dirs;
  }

  function onCanvasClick(ev) {
    if (state !== "playing") return;
    const r = canvas.getBoundingClientRect();
    const tx = Math.floor(((ev.clientX - r.left) / r.width) * W);
    const ty = Math.floor(((ev.clientY - r.top) / r.height) * H);
    if (!inside(tx, ty) || tiles[ty][tx] === "#") return;
    if (tiles[ty][tx] === "L" && Math.abs(tx - player.x) + Math.abs(ty - player.y) === 1) return toggleLever(tx, ty);
    const p = findPath(tx, ty);
    if (!p) { toast("Can't find a way there (yet)."); sfx.bump(); return; }
    path = p; clickMarker = { x: tx, y: ty, t: performance.now() };
  }
  let clickMarker = null;

  // ---------- Effects ----------
  let shake = 0;
  function burst(tx, ty, color, n) {
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2, s = 1 + Math.random() * 3;
      particles.push({ x: (tx + 0.5) * TILE, y: (ty + 0.5) * TILE, vx: Math.cos(a) * s, vy: Math.sin(a) * s, life: 1, color });
    }
  }
  function toast(msg) {
    const el = $("toast");
    el.textContent = msg; el.classList.add("show");
    clearTimeout(toast._t); toast._t = setTimeout(() => el.classList.remove("show"), 2200);
  }

  // ---------- HUD ----------
  function updateHUD() {
    $("hud-hearts").innerHTML = Array.from({ length: MAX_HEARTS }, (_, i) =>
      `<span class="heart ${i < hearts ? "" : "empty"}">❤</span>`).join("");
    $("hud-gems").textContent = `${gems} / ${gemsTotal}`;
    $("hud-key").classList.toggle("has", hasKeyCount > 0);
    $("hud-key").title = hasKeyCount > 0 ? "You have a key" : "No key";
    $("hud-lever").classList.toggle("on", gateOpen);
  }
  const fmt = (ms) => {
    const s = Math.floor(ms / 1000);
    return `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;
  };

  // ---------- Screens / flow ----------
  function show(name) {
    Object.entries(screens).forEach(([k, el]) => el.classList.toggle("active", k === name));
    document.body.dataset.state = name || "playing";
  }
  function startGame() {
    loadLevel(window.MQ_LEVELS[0]);
    state = "playing"; show(null);
    toast("Find the key, escape the cellar! 🗝️");
    canvas.focus();
  }
  function pause() {
    if (state !== "playing") return;
    state = "paused"; pausedAt = performance.now(); show("pause"); sfx.click();
  }
  function resume() {
    if (state !== "paused") return;
    startTime += performance.now() - pausedAt; state = "playing"; show(null); sfx.click();
  }
  function toMenu() { state = "menu"; show("menu"); sfx.click(); }
  function win() {
    state = "won"; elapsed = performance.now() - startTime; sfx.win();
    const pct = gems / gemsTotal;
    let stars = 1;
    if (pct >= 0.5) stars++;
    if (pct === 1 && elapsed / 1000 <= level.parTimeSec) stars++;
    let best = null;
    try {
      const k = `mq-best-${level.id}`;
      best = Number(localStorage.getItem(k)) || null;
      if (!best || elapsed < best) { localStorage.setItem(k, String(Math.round(elapsed))); }
    } catch (e) { /* storage unavailable */ }
    $("win-time").textContent = fmt(elapsed);
    $("win-gems").textContent = `${gems} / ${gemsTotal}`;
    $("win-hearts").textContent = `${hearts} / ${MAX_HEARTS}`;
    $("win-best").textContent = best && best < elapsed ? fmt(best) : "New record!";
    $("win-stars").innerHTML = [1, 2, 3].map((i) => `<span class="${i <= stars ? "lit" : ""}">★</span>`).join("");
    show("win");
  }
  function gameOver() { state = "over"; sfx.over(); show("over"); }

  // ---------- Loop ----------
  let last = performance.now();
  function frame(now) {
    const dt = now - last; last = now;
    if (state === "playing") update(now, dt);
    render(now);
    requestAnimationFrame(frame);
  }

  function update(now, dt) {
    elapsed = now - startTime;
    $("hud-time").textContent = fmt(elapsed);

    if (player.moving) {
      player.t = Math.min(1, player.t + dt / MOVE_MS);
      player.px = player.fromX + (player.x - player.fromX) * player.t;
      player.py = player.fromY + (player.y - player.fromY) * player.t;
      if (player.t >= 1) { player.moving = false; onArrive(); if (state !== "playing") return; }
    }
    if (!player.moving) {
      if (path.length) {
        const d = path.shift();
        if (!tryMove(d) && !player.moving) path = [];
      } else {
        const dir = [...held].pop();
        if (dir) tryMove(dir);
      }
    }
    // spikes
    if (tiles[player.y][player.x] === "^" && spikeState(player.x, now) === "up" && now > invulnUntil && player.t > 0.5) hurt();

    particles.forEach((p) => { p.x += p.vx; p.y += p.vy; p.vy += 0.08; p.life -= dt / 700; });
    particles = particles.filter((p) => p.life > 0);
    shake *= 0.85;
  }

  // ---------- Rendering ----------
  const PAL = {
    floorA: "#2a2438", floorB: "#2f2940", wallTop: "#5b4f7a", wallFace: "#3b3252", wallEdge: "#72669a",
    gold: "#ffd54a", gem: "#7cf3ff", teal: "#4fd1c5", orange: "#f5a623", red: "#ff5a7a",
  };
  const hash = (x, y) => ((x * 73856093) ^ (y * 19349663)) % 7;

  function render(now) {
    if (!tiles) { drawAttract(now); return; }
    ctx.save();
    if (shake > 0.3) ctx.translate((Math.random() - 0.5) * shake, (Math.random() - 0.5) * shake);
    ctx.fillStyle = "#15111f"; ctx.fillRect(0, 0, canvas.width, canvas.height);
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) drawTile(x, y, tiles[y][x], now);
    if (crate) drawCrate(now);
    if (clickMarker && now - clickMarker.t < 600) {
      const a = 1 - (now - clickMarker.t) / 600;
      ctx.strokeStyle = `rgba(255,255,255,${a})`; ctx.lineWidth = 2;
      ctx.strokeRect(clickMarker.x * TILE + 4, clickMarker.y * TILE + 4, TILE - 8, TILE - 8);
    }
    drawPlayer(now);
    particles.forEach((p) => { ctx.globalAlpha = Math.max(0, p.life); ctx.fillStyle = p.color; ctx.fillRect(p.x - 2, p.y - 2, 4, 4); });
    ctx.globalAlpha = 1;
    drawVignette();
    ctx.restore();
  }

  function drawFloor(px, py, x, y) {
    ctx.fillStyle = (x + y) % 2 ? PAL.floorA : PAL.floorB;
    ctx.fillRect(px, py, TILE, TILE);
    if (hash(x, y) === 0) { ctx.fillStyle = "rgba(255,255,255,0.04)"; ctx.fillRect(px + 8, py + 10, 6, 3); ctx.fillRect(px + 24, py + 26, 8, 3); }
  }

  function drawTile(x, y, t, now) {
    const px = x * TILE, py = y * TILE, cx = px + TILE / 2, cy = py + TILE / 2;
    if (t === "#") {
      ctx.fillStyle = PAL.wallFace; ctx.fillRect(px, py, TILE, TILE);
      ctx.fillStyle = PAL.wallTop; ctx.fillRect(px, py, TILE, TILE - 8);
      ctx.fillStyle = PAL.wallEdge; ctx.fillRect(px, py, TILE, 3);
      ctx.strokeStyle = "rgba(0,0,0,0.25)"; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(px, py + 16); ctx.lineTo(px + TILE, py + 16);
      ctx.moveTo(px + (y % 2 ? 12 : 26), py + 3); ctx.lineTo(px + (y % 2 ? 12 : 26), py + 16);
      ctx.stroke();
      return;
    }
    drawFloor(px, py, x, y);
    const bob = Math.sin(now / 300 + x + y) * 3;
    switch (t) {
      case "*": { // gem
        ctx.save(); ctx.translate(cx, cy + bob);
        ctx.shadowColor = PAL.gem; ctx.shadowBlur = 12;
        ctx.fillStyle = PAL.gem;
        ctx.beginPath(); ctx.moveTo(0, -10); ctx.lineTo(8, -2); ctx.lineTo(0, 10); ctx.lineTo(-8, -2); ctx.closePath(); ctx.fill();
        ctx.shadowBlur = 0; ctx.fillStyle = "rgba(255,255,255,0.6)";
        ctx.beginPath(); ctx.moveTo(0, -10); ctx.lineTo(3, -2); ctx.lineTo(-3, -2); ctx.closePath(); ctx.fill();
        ctx.restore(); break;
      }
      case "k": { // key
        ctx.save(); ctx.translate(cx, cy + bob); ctx.shadowColor = PAL.gold; ctx.shadowBlur = 14;
        ctx.strokeStyle = PAL.gold; ctx.fillStyle = PAL.gold; ctx.lineWidth = 3;
        ctx.beginPath(); ctx.arc(-6, 0, 5, 0, Math.PI * 2); ctx.stroke();
        ctx.fillRect(-1, -1.5, 13, 3); ctx.fillRect(8, 0, 3, 5); ctx.fillRect(4, 0, 2, 4);
        ctx.restore(); break;
      }
      case "+": drawHeart(cx, cy + bob, 9, PAL.red); break;
      case "D": { // locked door
        ctx.fillStyle = "#6b4226"; ctx.fillRect(px + 3, py + 2, TILE - 6, TILE - 4);
        ctx.fillStyle = "#8a5a36"; for (let i = 0; i < 3; i++) ctx.fillRect(px + 6 + i * 10, py + 4, 7, TILE - 8);
        ctx.fillStyle = "#3a2a1a"; ctx.fillRect(px + 3, py + 12, TILE - 6, 3); ctx.fillRect(px + 3, py + 26, TILE - 6, 3);
        ctx.fillStyle = PAL.gold; ctx.beginPath(); ctx.arc(cx, cy, 5, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = "#222"; ctx.fillRect(cx - 1, cy - 2, 2, 5); break;
      }
      case "G": case "H": { // gates
        const open = t === "G" ? gateOpen : plateActive;
        const col = t === "G" ? PAL.orange : PAL.teal;
        ctx.fillStyle = col; ctx.globalAlpha = 0.25; ctx.fillRect(px, py, TILE, 4); ctx.fillRect(px, py + TILE - 4, TILE, 4); ctx.globalAlpha = 1;
        const h = open ? 6 : TILE - 4;
        ctx.fillStyle = "#9aa3b5";
        for (let i = 0; i < 4; i++) ctx.fillRect(px + 5 + i * 9, py + 2, 4, h);
        ctx.fillStyle = col; ctx.fillRect(px + 2, py + 2, TILE - 4, 4);
        break;
      }
      case "L": { // lever
        ctx.fillStyle = "#555"; ctx.fillRect(px + 10, py + 26, 20, 8);
        ctx.save(); ctx.translate(cx, py + 28); ctx.rotate(gateOpen ? 0.6 : -0.6);
        ctx.fillStyle = "#bbb"; ctx.fillRect(-2, -20, 4, 20);
        ctx.fillStyle = gateOpen ? "#5be37d" : PAL.orange; ctx.beginPath(); ctx.arc(0, -20, 5, 0, Math.PI * 2); ctx.fill();
        ctx.restore();
        if (Math.abs(x - player.x) + Math.abs(y - player.y) === 1 && state === "playing") {
          ctx.fillStyle = "rgba(255,255,255,0.9)"; ctx.font = "bold 11px system-ui"; ctx.textAlign = "center";
          ctx.fillText("E / click", cx, py - 4);
        }
        break;
      }
      case "^": { // spikes
        const s = spikeState(x, now);
        ctx.fillStyle = "#1c1826"; ctx.fillRect(px + 4, py + 4, TILE - 8, TILE - 8);
        const hgt = s === "up" ? 14 : s === "warn" ? 4 + Math.sin(now / 30) * 2 : 2;
        ctx.fillStyle = s === "up" ? "#e6e6f0" : "#777";
        for (let i = 0; i < 3; i++) for (let j = 0; j < 2; j++) {
          const bx = px + 9 + i * 11, by = py + 16 + j * 12;
          ctx.beginPath(); ctx.moveTo(bx - 4, by + 2); ctx.lineTo(bx, by + 2 - hgt); ctx.lineTo(bx + 4, by + 2); ctx.fill();
        }
        if (s === "up") { ctx.fillStyle = "rgba(255,60,60,0.12)"; ctx.fillRect(px, py, TILE, TILE); }
        break;
      }
      case "P": { // pressure plate
        ctx.fillStyle = plateActive ? PAL.teal : "#4a4560";
        ctx.fillRect(px + 6, py + 6, TILE - 12, TILE - 12);
        ctx.strokeStyle = plateActive ? "#b8fff7" : "#6d6690"; ctx.lineWidth = 2;
        ctx.strokeRect(px + 6, py + 6, TILE - 12, TILE - 12);
        break;
      }
      case "c": { // checkpoint
        const on = checkpoint && checkpoint.x === x && checkpoint.y === y;
        ctx.fillStyle = "#ccc"; ctx.fillRect(cx - 8, py + 8, 3, 26);
        ctx.fillStyle = on ? "#5be37d" : "#777";
        ctx.beginPath(); ctx.moveTo(cx - 5, py + 8); ctx.lineTo(cx + 10 + (on ? Math.sin(now / 150) * 2 : 0), py + 13); ctx.lineTo(cx - 5, py + 19); ctx.fill();
        break;
      }
      case "X": { // exit portal
        const g = ctx.createRadialGradient(cx, cy, 2, cx, cy, 18);
        g.addColorStop(0, "#fff"); g.addColorStop(0.4, "#b388ff"); g.addColorStop(1, "rgba(120,60,255,0)");
        ctx.fillStyle = g; ctx.beginPath(); ctx.arc(cx, cy, 18, 0, Math.PI * 2); ctx.fill();
        ctx.strokeStyle = "#d9c2ff"; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.arc(cx, cy, 12 + Math.sin(now / 200) * 2, now / 400, now / 400 + 4.5); ctx.stroke();
        break;
      }
    }
  }

  function drawHeart(cx, cy, s, col) {
    ctx.save(); ctx.translate(cx, cy); ctx.fillStyle = col; ctx.shadowColor = col; ctx.shadowBlur = 10;
    ctx.beginPath(); ctx.moveTo(0, s * 0.9);
    ctx.bezierCurveTo(-s * 1.4, -s * 0.2, -s * 0.6, -s * 1.2, 0, -s * 0.4);
    ctx.bezierCurveTo(s * 0.6, -s * 1.2, s * 1.4, -s * 0.2, 0, s * 0.9);
    ctx.fill(); ctx.restore();
  }

  function drawCrate() {
    const px = crate.x * TILE, py = crate.y * TILE;
    if (crate.locked) {
      ctx.fillStyle = "#5a3d24"; ctx.fillRect(px + 7, py + 7, TILE - 14, TILE - 14);
      ctx.strokeStyle = PAL.teal; ctx.lineWidth = 2; ctx.strokeRect(px + 7, py + 7, TILE - 14, TILE - 14);
      return;
    }
    ctx.fillStyle = "rgba(0,0,0,0.3)"; ctx.fillRect(px + 5, py + 8, TILE - 8, TILE - 8);
    ctx.fillStyle = "#a0692f"; ctx.fillRect(px + 3, py + 3, TILE - 6, TILE - 6);
    ctx.strokeStyle = "#6b4520"; ctx.lineWidth = 3;
    ctx.strokeRect(px + 4.5, py + 4.5, TILE - 9, TILE - 9);
    ctx.beginPath(); ctx.moveTo(px + 6, py + 6); ctx.lineTo(px + TILE - 6, py + TILE - 6);
    ctx.moveTo(px + TILE - 6, py + 6); ctx.lineTo(px + 6, py + TILE - 6); ctx.stroke();
  }

  function drawPlayer(now) {
    if (now < invulnUntil && Math.floor(now / 90) % 2) return;
    const cx = (player.px + 0.5) * TILE, cy = (player.py + 0.5) * TILE;
    const bob = player.moving ? Math.sin(player.t * Math.PI) * -4 : Math.sin(now / 400) * 1;
    ctx.save(); ctx.translate(cx, cy + bob);
    // shadow
    ctx.fillStyle = "rgba(0,0,0,0.35)"; ctx.beginPath(); ctx.ellipse(0, 14 - bob, 11, 4, 0, 0, Math.PI * 2); ctx.fill();
    // cape
    ctx.fillStyle = "#c0392b"; ctx.beginPath(); ctx.moveTo(-10, -2); ctx.lineTo(10, -2); ctx.lineTo(12, 13); ctx.lineTo(-12, 13); ctx.closePath(); ctx.fill();
    // body
    ctx.fillStyle = "#3d7bd9"; ctx.fillRect(-8, -2, 16, 13);
    ctx.fillStyle = "#6b4520"; ctx.fillRect(-8, 5, 16, 3); // belt
    // head
    ctx.fillStyle = "#f2c9a0"; ctx.beginPath(); ctx.arc(0, -9, 8, 0, Math.PI * 2); ctx.fill();
    // hat / hair
    ctx.fillStyle = "#2e7d32"; ctx.beginPath(); ctx.arc(0, -11, 8, Math.PI, 0); ctx.fill();
    ctx.beginPath(); ctx.moveTo(6, -13); ctx.lineTo(14, -18); ctx.lineTo(7, -10); ctx.fill();
    // eyes by facing
    const off = { up: [0, -3], down: [0, 0], left: [-3, -1], right: [3, -1] }[player.face];
    ctx.fillStyle = "#1a1a1a";
    if (player.face !== "up") {
      ctx.fillRect(-4 + off[0], -9 + off[1], 2, 3);
      ctx.fillRect(2 + off[0], -9 + off[1], 2, 3);
    }
    ctx.restore();
  }

  function drawVignette() {
    const g = ctx.createRadialGradient(canvas.width / 2, canvas.height / 2, canvas.height * 0.4, canvas.width / 2, canvas.height / 2, canvas.width * 0.7);
    g.addColorStop(0, "rgba(0,0,0,0)"); g.addColorStop(1, "rgba(0,0,0,0.45)");
    ctx.fillStyle = g; ctx.fillRect(0, 0, canvas.width, canvas.height);
  }

  function drawAttract(now) {
    // simple animated background behind the start menu before a level loads
    canvas.width = 21 * TILE; canvas.height = 15 * TILE;
    ctx.fillStyle = "#15111f"; ctx.fillRect(0, 0, canvas.width, canvas.height);
    for (let y = 0; y < 15; y++) for (let x = 0; x < 21; x++) {
      const v = Math.sin(x * 0.5 + now / 900) + Math.cos(y * 0.6 + now / 1100);
      ctx.fillStyle = v > 1.1 ? "#3b3252" : (x + y) % 2 ? "#1d1829" : "#211b2e";
      ctx.fillRect(x * TILE, y * TILE, TILE, TILE);
    }
  }

  // ---------- Input ----------
  window.addEventListener("keydown", (e) => {
    const dir = KEYMAP[e.code];
    if (dir) {
      e.preventDefault();
      if (state === "playing") { path = []; held.delete(dir); held.add(dir); tryMove(dir); }
      return;
    }
    if (e.code === "Escape" || e.code === "KeyP") { state === "playing" ? pause() : state === "paused" && resume(); }
    if ((e.code === "KeyE" || e.code === "Space") && state === "playing") { e.preventDefault(); interact(); }
    if (e.code === "KeyR" && state === "playing") startGame();
    if (e.code === "Enter" && (state === "menu" || state === "won" || state === "over")) startGame();
  });
  window.addEventListener("keyup", (e) => { const d = KEYMAP[e.code]; if (d) held.delete(d); });
  window.addEventListener("blur", () => { held.clear(); pause(); });
  canvas.addEventListener("click", onCanvasClick);

  // on-screen d-pad (hold to keep walking)
  document.querySelectorAll("[data-dir]").forEach((btn) => {
    const dir = btn.dataset.dir;
    const on = (e) => { e.preventDefault(); path = []; held.add(dir); tryMove(dir); };
    const off = () => held.delete(dir);
    btn.addEventListener("pointerdown", on);
    ["pointerup", "pointerleave", "pointercancel"].forEach((ev) => btn.addEventListener(ev, off));
  });
  $("btn-action").addEventListener("click", () => state === "playing" && interact());

  // buttons
  const on = (id, fn) => $(id).addEventListener("click", () => { sfx.click(); fn(); });
  on("btn-play", startGame);
  on("btn-howto", () => { prevState = state; show("howto"); });
  on("btn-howto-back", () => show(prevState === "paused" ? "pause" : "menu"));
  on("btn-pause", () => (state === "playing" ? pause() : resume()));
  on("btn-resume", resume);
  on("btn-restart", startGame);
  on("btn-restart-hud", () => { if (state === "playing" || state === "paused") startGame(); });
  on("btn-pause-howto", () => { prevState = "paused"; show("howto"); });
  on("btn-pause-menu", toMenu);
  on("btn-win-again", startGame);
  on("btn-win-menu", toMenu);
  on("btn-over-retry", startGame);
  on("btn-over-menu", toMenu);
  const mute = () => {
    muted = !muted;
    document.querySelectorAll(".btn-sound").forEach((b) => (b.textContent = muted ? "🔇" : "🔊"));
  };
  document.querySelectorAll(".btn-sound").forEach((b) => b.addEventListener("click", mute));

  try {
    const best = Number(localStorage.getItem("mq-best-1"));
    if (best) $("menu-best").textContent = `Best time: ${fmt(best)}`;
  } catch (e) { /* ignore */ }

  // test / debug hook (read-only snapshot + helpers used by the automated playthrough)
  window.MQ = {
    get state() { return state; },
    snapshot: () => ({ state, player: { x: player?.x, y: player?.y }, gems, gemsTotal, hearts, hasKeyCount, gateOpen, plateActive, crate: crate && { ...crate } }),
    goto: (x, y) => { const p = findPath(x, y); if (p) path = p; return !!p; },
    idle: () => !player.moving && path.length === 0,
    interact, spikeState, start: startGame,
  };

  show("menu");
  requestAnimationFrame(frame);
})();
