// Pac-Man — Single Ghost (improved)
// Save as game.js and open index.html in VS Code (Live Server recommended).

// CONFIG
const TILE = 28;            // tile size in internal pixels
const COLS = 28;            // standard pac-man grid width
const ROWS = 36;            // taller for a larger maze (keeps proportions)
const CANVAS_W = COLS * TILE;
const CANVAS_H = ROWS * TILE;

const PAC_SPEED = 3.0;      // pixels per frame (slow)
const GHOST_SPEED = 2.2;    // ghost speed (slightly slower than pac)
const TURN_THRESHOLD = 4;   // how close to tile center before allowing turn (pixels)

const canvas = document.getElementById("gameCanvas");
canvas.width = CANVAS_W;
canvas.height = CANVAS_H;
const ctx = canvas.getContext("2d");

const scoreEl = document.getElementById("score");
const livesEl = document.getElementById("lives");

// TILE MAP LEGEND:
// 0 = pellet, 1 = wall, 2 = empty (no pellet)
const rawMap = [
// 28 columns — create a simple, open but walled map (you can edit later)
"1111111111111111111111111111",
"1000000000000000000000000001",
"1011110111111101111110111101",
"1020000100000101000010000201",
"1011101110111101110111011101",
"1000100000100000000100001001",
"1110101110111111110111010111",
"1000001000000000000100000001",
"1011111011111111111011111101",
"1000000010001100001000000001",
"1111111010110111010111111111",
"1000000010000000001000000001",
"1011111110111111111011111101",
"1000000000000000000000000001",
"1011111111110111111111111101",
"1000000000000000000000000001",
"1011110111111111111011111101",
"1000000000100000000000000001",
"1111111110111111101111111111",
"1000000000000000000000000001",
"1011111111110111111111111101",
"1000000000000100000000000001",
"1011111111110111111111111101",
"1000000000000000000000000001",
"1011111011111111111011111101",
"1000000010000000001000000001",
"1111101110110111010111110111",
"1000000000100000000100000001",
"1011111110111111111011111101",
"1000000000000000000000000001",
"1011111111111111111111111101",
"1000000000000000000000000001",
"1011111111111111111111111101",
"1000000000000000000000000001",
"1111111111111111111111111111",
"1000000000000000000000000001",
"1111111111111111111111111111"
];

// convert map to mutable 2D array
let map = rawMap.slice(0, ROWS).map(r => r.split("").map(ch => ch === "1" ? 1 : (ch === "0" ? 0 : 2)));

let score = 0;
let lives = 3;
let pelletsRemaining = map.flat().filter(v => v === 0).length;

// Helper: draw rounded ghost base (simple)
function drawGhost(x, y, size, color) {
  ctx.fillStyle = color;
  // body (semi-circle top + rectangle bottom with scallop)
  ctx.beginPath();
  ctx.arc(x + size / 2, y + size / 2 - 2, size * 0.42, Math.PI, 0, false);
  ctx.fill();
  // bottom scallop
  ctx.fillRect(x, y + size * 0.25, size, size * 0.6);
  // eyes
  ctx.fillStyle = "#fff";
  ctx.beginPath();
  ctx.arc(x + size * 0.35, y + size * 0.35, size * 0.12, 0, Math.PI * 2);
  ctx.arc(x + size * 0.65, y + size * 0.35, size * 0.12, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#000";
  ctx.beginPath();
  ctx.arc(x + size * 0.35, y + size * 0.36, size * 0.06, 0, Math.PI * 2);
  ctx.arc(x + size * 0.65, y + size * 0.36, size * 0.06, 0, Math.PI * 2);
  ctx.fill();
}

// Entities are positioned in pixels (not tile indices), but tile alignment is used
const pac = {
  px: (COLS / 2) * TILE,    // center start
  py: (ROWS / 2) * TILE,
  dirX: 0, dirY: 0,         // current direction in tile steps (-1,0,1)
  wantX: 0, wantY: 0,       // desired direction while key held
  radius: TILE * 0.42,
  speed: PAC_SPEED
};

const ghost = {
  px: (COLS / 2 - 3) * TILE,
  py: (ROWS / 2 - 3) * TILE,
  dirX: 1, dirY: 0,
  radius: TILE * 0.42,
  speed: GHOST_SPEED,
  color: "#ff4d4d"
};

// Input: only move while key held
const keyState = { ArrowUp:false, ArrowDown:false, ArrowLeft:false, ArrowRight:false };
window.addEventListener("keydown", (e) => {
  if (e.key in keyState) {
    keyState[e.key] = true;
    updateDesiredDirFromKeys(); // immediately set desired direction
    e.preventDefault();
  }
});
window.addEventListener("keyup", (e) => {
  if (e.key in keyState) {
    keyState[e.key] = false;
    updateDesiredDirFromKeys(); // will stop if none held
    e.preventDefault();
  }
});

function updateDesiredDirFromKeys() {
  // Priority: Up, Left, Down, Right (change if you like)
  if (keyState.ArrowUp) { pac.wantX = 0; pac.wantY = -1; }
  else if (keyState.ArrowLeft) { pac.wantX = -1; pac.wantY = 0; }
  else if (keyState.ArrowDown) { pac.wantX = 0; pac.wantY = 1; }
  else if (keyState.ArrowRight) { pac.wantX = 1; pac.wantY = 0; }
  else { pac.wantX = 0; pac.wantY = 0; } // no key held → stop moving
}

// Helpers: tile / pixel conversion
function tileCenter(tileIndex) { return tileIndex * TILE + TILE / 2; }
function pixelToTile(px) { return Math.floor(px / TILE); }
function isWallTile(tx, ty) {
  if (tx < 0 || tx >= COLS || ty < 0 || ty >= ROWS) return true;
  return map[ty][tx] === 1;
}

// Align pac to center when nearly aligned (to avoid jitter)
function nearCenter(px, py) {
  const tx = pixelToTile(px);
  const ty = pixelToTile(py);
  const centerX = tileCenter(tx);
  const centerY = tileCenter(ty);
  const dx = Math.abs(px - centerX);
  const dy = Math.abs(py - centerY);
  return { tx, ty, dx, dy, centerX, centerY };
}

function canMoveFromPixel(px, py, dirX, dirY) {
  // test next tile occupancy based on direction
  const nx = px + dirX * TILE * 0.5; // small step reach to next tile
  const ny = py + dirY * TILE * 0.5;
  const tnx = pixelToTile(nx + (dirX===1? TILE*0.45: dirX===-1? -TILE*0.45 : 0));
  const tny = pixelToTile(ny + (dirY===1? TILE*0.45: dirY===-1? -TILE*0.45 : 0));
  return !isWallTile(tnx, tny);
}

// Pellet consumption
function tryConsumePellet(px, py) {
  const tx = pixelToTile(px);
  const ty = pixelToTile(py);
  if (ty >= 0 && ty < ROWS && tx >= 0 && tx < COLS && map[ty][tx] === 0) {
    map[ty][tx] = 2; // consumed
    score += 10;
    pelletsRemaining--;
    updateUI();
  }
}

function updateUI(){
  scoreEl.textContent = `SCORE: ${score}`;
  livesEl.textContent = `LIVES: ${lives}`;
}

// Ghost decision at intersections:
// choose direction that reduces Manhattan distance to Pac-Man, but don't reverse unless forced
function chooseGhostDir(g) {
  const gx = pixelToTile(g.px + TILE/2);
  const gy = pixelToTile(g.py + TILE/2);
  const pxTile = pixelToTile(pac.px + TILE/2);
  const pyTile = pixelToTile(pac.py + TILE/2);

  const possible = [];
  const dirs = [{x:1,y:0},{x:-1,y:0},{x:0,y:1},{x:0,y:-1}];
  for (const d of dirs) {
    const nx = gx + d.x, ny = gy + d.y;
    // avoid reversing direction unless no other option
    if (d.x === -g.dirX && d.y === -g.dirY) continue;
    if (!isWallTile(nx, ny)) possible.push(d);
  }
  if (possible.length === 0) { // reversal forced
    return {x:-g.dirX, y:-g.dirY};
  }
  // score candidates by manhattan distance
  possible.sort((a,b)=>{
    const da = Math.abs((gx + a.x) - pxTile) + Math.abs((gy + a.y) - pyTile);
    const db = Math.abs((gx + b.x) - pxTile) + Math.abs((gy + b.y) - pyTile);
    return da - db;
  });
  // sometimes pick second-best for unpredictability
  if (Math.random() < 0.15 && possible.length > 1) return possible[1];
  return possible[0];
}

let lastTime = 0;
function gameLoop(ts) {
  if (!lastTime) lastTime = ts;
  const dt = Math.min(40, ts - lastTime); // cap delta
  lastTime = ts;

  // PAC-MAN movement: only while key held (pac.wantX/ wantY)
  // align to tile center to allow turns
  // check if pac wants to change direction and if allowed
  const near = nearCenter(pac.px, pac.py);
  // if near center, snap to center (keeps alignment)
  if (near.dx < TURN_THRESHOLD && near.dy < TURN_THRESHOLD) {
    pac.px = near.centerX;
    pac.py = near.centerY;

    // if desired direction is non-zero, check if that tile is free
    if ((pac.wantX !== 0 || pac.wantY !== 0)) {
      const nextTileX = pixelToTile(pac.px + pac.wantX * TILE);
      const nextTileY = pixelToTile(pac.py + pac.wantY * TILE);
      if (!isWallTile(nextTileX, nextTileY)) {
        pac.dirX = pac.wantX;
        pac.dirY = pac.wantY;
      } else {
        // cannot take desired dir, stop movement (per requirement)
        pac.dirX = 0;
        pac.dirY = 0;
      }
    } else {
      // no key held → stop
      pac.dirX = 0;
      pac.dirY = 0;
    }
  } else {
    // not yet at center; keep moving in current dir only if there is one
    if (!canMoveFromPixel(pac.px, pac.py, pac.dirX, pac.dirY)) {
      pac.dirX = 0; pac.dirY = 0; // blocked
    }
  }

  // apply movement
  pac.px += pac.dirX * pac.speed * (dt / 16);
  pac.py += pac.dirY * pac.speed * (dt / 16);

  // wrap-around horizontally (tunnel)
  if (pac.px < -TILE) pac.px = CANVAS_W + TILE;
  if (pac.px > CANVAS_W + TILE) pac.px = -TILE;

  // consume pellet when at center
  if (near.dx < TURN_THRESHOLD && near.dy < TURN_THRESHOLD) {
    tryConsumePellet(pac.px, pac.py);
  }

  // GHOST movement: move until center of tile, then decide
  const gnear = nearCenter(ghost.px, ghost.py);
  if (gnear.dx < TURN_THRESHOLD && gnear.dy < TURN_THRESHOLD) {
    ghost.px = gnear.centerX;
    ghost.py = gnear.centerY;
    const newDir = chooseGhostDir(ghost);
    ghost.dirX = newDir.x; ghost.dirY = newDir.y;
  }
  // apply ghost movement
  ghost.px += ghost.dirX * ghost.speed * (dt / 16);
  ghost.py += ghost.dirY * ghost.speed * (dt / 16);

  // wrap ghost too
  if (ghost.px < -TILE) ghost.px = CANVAS_W + TILE;
  if (ghost.px > CANVAS_W + TILE) ghost.px = -TILE;

  // collision check (distance)
  const dx = (pac.px - ghost.px);
  const dy = (pac.py - ghost.py);
  const dist = Math.hypot(dx, dy);
  if (dist < TILE * 0.6) {
    // collision -> lose life and reset positions
    lives--;
    updateUI();
    if (lives <= 0) {
      setTimeout(()=> {
        alert(`GAME OVER\nFinal Score: ${score}`);
        resetGame();
      }, 50);
      return; // stop this frame; resetGame will restart state
    } else {
      resetPositions();
    }
  }

  // win check
  if (pelletsRemaining <= 0) {
    setTimeout(()=> {
      alert(`LEVEL CLEAR! Score: ${score}`);
      // simple restart with pellet refill
      refillPellets();
      resetPositions();
      updateUI();
    }, 50);
    return;
  }

  draw();
  window.requestAnimationFrame(gameLoop);
}

function draw() {
  ctx.clearRect(0, 0, CANVAS_W, CANVAS_H);

  // draw map
  for (let y = 0; y < ROWS; y++) {
    for (let x = 0; x < COLS; x++) {
      const v = map[y][x];
      const px = x * TILE, py = y * TILE;
      if (v === 1) {
        // wall - draw rounded blocks
        ctx.fillStyle = "#007777";
        ctx.fillRect(px, py, TILE, TILE);
        ctx.fillStyle = "#003333";
        ctx.fillRect(px + 2, py + 2, TILE - 4, TILE - 4);
      } else if (v === 0) {
        // pellet
        ctx.fillStyle = "#fff";
        ctx.beginPath();
        ctx.arc(px + TILE/2, py + TILE/2, Math.max(2, TILE * 0.08), 0, Math.PI * 2);
        ctx.fill();
      }
      // v === 2 : empty tile; nothing to draw
    }
  }

  // draw Pac-Man (mouth animated simple by time)
  const t = Date.now() / 150;
  const mouth = 0.22 + (Math.abs(Math.sin(t)) * 0.18);
  ctx.fillStyle = "#ffd700";
  ctx.beginPath();
  const pacX = pac.px + TILE/2 - TILE/2; // pac.px is already left-top aligned; we used center coords earlier.
  // Note: pac.px is left-top anchored actually; to draw correct, center at pac.px+TILE/2
  const centerX = pac.px + TILE/2, centerY = pac.py + TILE/2;
  const startAng = mouth * Math.PI;
  ctx.moveTo(centerX, centerY);
  ctx.arc(centerX, centerY, TILE * 0.42, startAng, Math.PI*2 - startAng);
  ctx.closePath();
  ctx.fill();

  // draw ghost
  drawGhost(ghost.px, ghost.py, TILE, ghost.color);

  // small debug optional: draw grid centers (disabled)
  // ctx.strokeStyle = "rgba(255,255,255,0.02)";
  // for (let y=0;y<ROWS;y++)for(let x=0;x<COLS;x++)ctx.strokeRect(x*TILE,y*TILE,TILE,TILE);
}

// Resets positions to their starts (keep score/lives)
function resetPositions() {
  pac.px = (COLS / 2) * TILE;
  pac.py = (ROWS / 2) * TILE;
  pac.dirX = pac.dirY = pac.wantX = pac.wantY = 0;
  ghost.px = (COLS / 2 - 3) * TILE;
  ghost.py = (ROWS / 2 - 3) * TILE;
  ghost.dirX = 1; ghost.dirY = 0;
}

// Full reset
function resetGame() {
  score = 0; lives = 3;
  refillPellets();
  updateUI();
  resetPositions();
  window.requestAnimationFrame(gameLoop);
}

function refillPellets() {
  pelletsRemaining = 0;
  map.forEach((row, y) => {
    row.forEach((v, x) => {
      // leave walls intact, fill floor tiles with pellets
      if (v === 1) return;
      map[y][x] = 0;
      pelletsRemaining++;
    });
  });
  // optionally create some blank spaces (like ghost house) - keep simple for now
}

// initialize
refillPellets();
updateUI();
resetPositions();
window.requestAnimationFrame(gameLoop);