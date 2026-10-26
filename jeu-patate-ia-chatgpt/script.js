// Patate Paradise - JavaScript natif, sans bibliothèque externe.

const canvas = document.querySelector("#game");
const ctx = canvas.getContext("2d");

const scoreEl = document.querySelector("#score");
const harvestEl = document.querySelector("#harvest");
const livesEl = document.querySelector("#lives");
const timerEl = document.querySelector("#timer");
const overlay = document.querySelector("#overlay");
const overlayTitle = document.querySelector("#overlay-title");
const overlayText = document.querySelector("#overlay-text");
const startBtn = document.querySelector("#start-btn");

const WIDTH = canvas.width;
const HEIGHT = canvas.height;
const GOAL = 20;
const GAME_SECONDS = 60;

let player;
let items = [];
let particles = [];
let keys = {};
let score = 0;
let harvest = 0;
let lives = 3;
let timeLeft = GAME_SECONDS;
let running = false;
let lastFrame = 0;
let spawnClock = 0;
let tideClock = 0;
let tide = null;
let lastTideAt = 0;
let animationId = null;

const random = (min, max) => Math.random() * (max - min) + min;

function resetGame() {
  player = { x: WIDTH / 2, y: HEIGHT / 2, radius: 19, speed: 235, invulnerable: 0 };
  items = [];
  particles = [];
  score = 0;
  harvest = 0;
  lives = 3;
  timeLeft = GAME_SECONDS;
  spawnClock = 0;
  tideClock = 0;
  tide = null;
  lastTideAt = 0;
  keys = {};
  for (let i = 0; i < 9; i++) spawnItem();
  updateHud();
}

function updateHud() {
  scoreEl.textContent = score;
  harvestEl.textContent = harvest;
  livesEl.textContent = "❤️".repeat(lives) + "🖤".repeat(3 - lives);
  timerEl.textContent = Math.ceil(timeLeft);
}

function spawnItem() {
  const roll = Math.random();
  let type = "normal";
  if (roll < 0.12) type = "rotten";
  else if (roll < 0.19) type = "golden";

  items.push({
    x: random(35, WIDTH - 35),
    y: random(65, HEIGHT - 35),
    radius: type === "golden" ? 17 : 15,
    type,
    wobble: random(0, Math.PI * 2)
  });
}

function startGame() {
  if (animationId) cancelAnimationFrame(animationId);
  resetGame();
  running = true;
  overlay.classList.add("hidden");
  lastFrame = performance.now();
  animationId = requestAnimationFrame(gameLoop);
}

function endGame(won, reason) {
  running = false;
  overlay.classList.remove("hidden");
  overlayTitle.textContent = won ? "🏆 Vacances réussies !" : "🌴 Fin des vacances…";
  overlayText.textContent = `${reason} Score final : ${score} points et ${harvest}/${GOAL} bonnes patates récoltées.`;
  startBtn.textContent = "Rejouer  ↻";
}

function gameLoop(timestamp) {
  if (!running) return;
  const dt = Math.min((timestamp - lastFrame) / 1000, 0.035);
  lastFrame = timestamp;
  update(dt);
  draw();
  if (running) animationId = requestAnimationFrame(gameLoop);
}

function update(dt) {
  timeLeft -= dt;
  if (timeLeft <= 0) {
    timeLeft = 0;
    updateHud();
    endGame(harvest >= GOAL, harvest >= GOAL
      ? "Tu as atteint l'objectif avant la fin du temps !"
      : "Le chrono est terminé. Il te fallait 20 bonnes patates.");
    return;
  }

  movePlayer(dt);

  if (player.invulnerable > 0) player.invulnerable -= dt;
  spawnClock += dt;
  if (spawnClock >= 1.25 && items.length < 15) {
    spawnClock = 0;
    spawnItem();
  }

  // Mécanique personnelle : une marée arrive toutes les 12 secondes.
  tideClock += dt;
  if (!tide && tideClock >= 12) {
    tideClock = 0;
    tide = { x: -180, width: 155, speed: 290, phase: "incoming", safeY: random(100, HEIGHT - 100) };
  }
  updateTide(dt);

  for (const item of items) item.wobble += dt * 3;
  collectItems();
  updateParticles(dt);
  updateHud();

  if (harvest >= GOAL) {
    endGame(true, "Excellent ! Tu as récolté assez de patates.");
  } else if (lives <= 0) {
    endGame(false, "Tu n'as plus de vies.");
  }
}

function movePlayer(dt) {
  let dx = 0;
  let dy = 0;
  if (keys.ArrowLeft || keys.q || keys.Q || keys.a || keys.A) dx--;
  if (keys.ArrowRight || keys.d || keys.D) dx++;
  if (keys.ArrowUp || keys.z || keys.Z || keys.w || keys.W) dy--;
  if (keys.ArrowDown || keys.s || keys.S) dy++;
  if (dx && dy) { dx *= Math.SQRT1_2; dy *= Math.SQRT1_2; }
  player.x += dx * player.speed * dt;
  player.y += dy * player.speed * dt;
  player.x = Math.max(player.radius + 5, Math.min(WIDTH - player.radius - 5, player.x));
  player.y = Math.max(player.radius + 5, Math.min(HEIGHT - player.radius - 5, player.y));
}

function updateTide(dt) {
  if (!tide) return;
  tide.x += tide.speed * dt;

  // La vague traverse l'écran. La bande bleue représente la zone dangereuse.
  if (tide.phase === "incoming" && tide.x > WIDTH * 0.25) tide.phase = "crossing";
  if (tide.phase === "crossing") {
    const inWave = player.x > tide.x - 25 && player.x < tide.x + tide.width + 25;
    const awayFromSafeStrip = Math.abs(player.y - tide.safeY) > 65;
    if (inWave && awayFromSafeStrip && player.invulnerable <= 0) {
      loseLife("La marée t'a emporté !");
    }
  }
  if (tide.x > WIDTH + 40) tide = null;
}

function collectItems() {
  for (let i = items.length - 1; i >= 0; i--) {
    const item = items[i];
    const distance = Math.hypot(player.x - item.x, player.y - item.y);
    if (distance < player.radius + item.radius) {
      if (item.type === "rotten") {
        score = Math.max(0, score - 15);
        loseLife("Patate pourrie !");
        burst(item.x, item.y, "#7b4f9b");
      } else if (item.type === "golden") {
        score += 50;
        harvest++;
        burst(item.x, item.y, "#ffb703");
      } else {
        score += 10;
        harvest++;
        burst(item.x, item.y, "#e9a34b");
      }
      items.splice(i, 1);
      if (harvest >= GOAL) break;
    }
  }
}

function loseLife(message) {
  if (player.invulnerable > 0) return;
  lives--;
  player.invulnerable = 1.25;
  // Petit effet visuel : des particules rouges signalent la collision.
  burst(player.x, player.y, "#ff595e");
}

function burst(x, y, color) {
  for (let i = 0; i < 10; i++) {
    const angle = Math.random() * Math.PI * 2;
    const speed = random(35, 115);
    particles.push({ x, y, vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed, life: .45, color });
  }
}

function updateParticles(dt) {
  for (let i = particles.length - 1; i >= 0; i--) {
    const p = particles[i];
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    p.life -= dt;
    if (p.life <= 0) particles.splice(i, 1);
  }
}

function draw() {
  drawBeach();
  drawItems();
  drawTide();
  drawPlayer();
  drawParticles();
}

function drawBeach() {
  ctx.clearRect(0, 0, WIDTH, HEIGHT);
  ctx.fillStyle = "#f4dc91";
  ctx.fillRect(0, 0, WIDTH, HEIGHT);

  // Petits grains de sable décoratifs.
  for (let x = 18; x < WIDTH; x += 44) {
    for (let y = 18; y < HEIGHT; y += 39) {
      ctx.fillStyle = ((x + y) % 3 === 0) ? "rgba(180,130,54,.16)" : "rgba(255,255,255,.24)";
      ctx.beginPath();
      ctx.arc(x + (y % 13), y, 2, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  // Océan en haut et ligne d'écume.
  ctx.fillStyle = "#6ec9d5";
  ctx.fillRect(0, 0, WIDTH, 42);
  ctx.fillStyle = "#3aa9c0";
  ctx.fillRect(0, 0, WIDTH, 12);
  ctx.strokeStyle = "rgba(255,255,255,.9)";
  ctx.lineWidth = 3;
  ctx.beginPath();
  for (let x = 0; x <= WIDTH; x += 12) {
    const y = 43 + Math.sin(x * .035) * 3;
    if (x === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
  }
  ctx.stroke();

  // Palmiers simplifiés dans les coins.
  drawPalm(43, 91, .72);
  drawPalm(WIDTH - 45, HEIGHT - 55, .8);
  drawUmbrella(WIDTH - 100, 95);
}

function drawPalm(x, y, scale) {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(scale, scale);
  ctx.strokeStyle = "#9b5d35";
  ctx.lineWidth = 10;
  ctx.beginPath(); ctx.moveTo(0, 0); ctx.quadraticCurveTo(8, -30, 0, -55); ctx.stroke();
  ctx.strokeStyle = "#27865a";
  ctx.lineWidth = 7;
  for (let i = 0; i < 6; i++) {
    const a = -Math.PI + i * Math.PI / 5;
    ctx.beginPath(); ctx.moveTo(0, -54); ctx.quadraticCurveTo(Math.cos(a) * 24, -72 + Math.sin(a) * 12, Math.cos(a) * 39, -54 + Math.sin(a) * 25); ctx.stroke();
  }
  ctx.restore();
}

function drawUmbrella(x, y) {
  ctx.strokeStyle = "#9b5d35"; ctx.lineWidth = 4;
  ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x, y + 55); ctx.stroke();
  ctx.fillStyle = "#ff6b6b";
  ctx.beginPath(); ctx.arc(x, y, 27, Math.PI, 0); ctx.lineTo(x, y + 2); ctx.closePath(); ctx.fill();
  ctx.strokeStyle = "#fff3d1"; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.moveTo(x - 13, y); ctx.lineTo(x - 8, y + 4); ctx.moveTo(x + 13, y); ctx.lineTo(x + 8, y + 4); ctx.stroke();
}

function drawItems() {
  for (const item of items) {
    const bob = Math.sin(item.wobble) * 3;
    ctx.save();
    ctx.translate(item.x, item.y + bob);
    if (item.type === "golden") {
      ctx.shadowColor = "#ffb703"; ctx.shadowBlur = 18;
      drawPotato(0, 0, item.radius, "#ffcc33", "#c88413");
      ctx.shadowBlur = 0;
      ctx.fillStyle = "#fff7b2"; ctx.font = "bold 18px sans-serif"; ctx.textAlign = "center"; ctx.fillText("✦", 0, -22);
    } else if (item.type === "rotten") {
      drawPotato(0, 0, item.radius, "#8b7b69", "#4b6450");
      ctx.fillStyle = "#5a9b55";
      ctx.beginPath(); ctx.arc(-5, -3, 4, 0, Math.PI * 2); ctx.arc(6, 4, 3, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = "#243d35"; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(-7, 7); ctx.lineTo(7, 7); ctx.stroke();
    } else {
      drawPotato(0, 0, item.radius, "#d9a15c", "#9a5f32");
      ctx.fillStyle = "#6f4a2d";
      ctx.beginPath(); ctx.arc(-5, -3, 1.7, 0, Math.PI * 2); ctx.arc(5, 3, 1.7, 0, Math.PI * 2); ctx.fill();
    }
    ctx.restore();
  }
}

function drawPotato(x, y, r, fill, stroke) {
  ctx.fillStyle = fill; ctx.strokeStyle = stroke; ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(x - r * .9, y - r * .15);
  ctx.quadraticCurveTo(x - r * 1.25, y - r * .85, x - r * .35, y - r);
  ctx.quadraticCurveTo(x + r * .8, y - r * 1.1, x + r, y - r * .25);
  ctx.quadraticCurveTo(x + r * 1.2, y + r * .65, x + r * .25, y + r * .9);
  ctx.quadraticCurveTo(x - r * .85, y + r * 1.05, x - r * .9, y - r * .15);
  ctx.closePath(); ctx.fill(); ctx.stroke();
}

function drawPlayer() {
  if (player.invulnerable > 0 && Math.floor(player.invulnerable * 12) % 2 === 0) return;
  ctx.save();
  ctx.translate(player.x, player.y);
  // Ombre au sol.
  ctx.fillStyle = "rgba(76, 62, 37, .2)";
  ctx.beginPath(); ctx.ellipse(2, 15, 19, 7, 0, 0, Math.PI * 2); ctx.fill();
  drawPotato(0, 0, player.radius, "#e5ad6c", "#9c6138");
  // Lunettes de soleil.
  ctx.fillStyle = "#18354a";
  ctx.fillRect(-14, -6, 12, 8); ctx.fillRect(2, -6, 12, 8);
  ctx.fillStyle = "#fff";
  ctx.fillRect(-11, -4, 3, 3); ctx.fillRect(5, -4, 3, 3);
  ctx.strokeStyle = "#18354a"; ctx.lineWidth = 3;
  ctx.beginPath(); ctx.moveTo(-2, -3); ctx.lineTo(2, -3); ctx.stroke();
  ctx.strokeStyle = "#7a452b"; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.arc(0, 5, 5, .15, Math.PI - .15); ctx.stroke();
  // Petit chapeau de vacances.
  ctx.fillStyle = "#ffb703";
  ctx.beginPath(); ctx.ellipse(0, -18, 17, 4, -.08, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = "#fb8500";
  ctx.beginPath(); ctx.moveTo(-11, -19); ctx.lineTo(-5, -31); ctx.lineTo(8, -29); ctx.lineTo(14, -18); ctx.closePath(); ctx.fill();
  ctx.restore();
}

function drawTide() {
  if (!tide) return;
  ctx.save();
  ctx.fillStyle = "rgba(35, 161, 208, .62)";
  ctx.fillRect(tide.x, 44, tide.width, HEIGHT - 44);
  ctx.strokeStyle = "rgba(255,255,255,.9)";
  ctx.lineWidth = 4;
  for (let y = 60; y < HEIGHT; y += 28) {
    ctx.beginPath();
    ctx.moveTo(tide.x + 12, y);
    ctx.quadraticCurveTo(tide.x + tide.width / 2, y - 9, tide.x + tide.width - 12, y);
    ctx.stroke();
  }
  ctx.fillStyle = "rgba(255,255,255,.9)";
  ctx.font = "bold 13px sans-serif";
  ctx.textAlign = "center";
  ctx.fillText("ZONE SÛRE", Math.max(60, Math.min(WIDTH - 60, tide.x + tide.width / 2)), tide.safeY);
  ctx.setLineDash([6, 5]);
  ctx.strokeStyle = "#fff";
  ctx.beginPath(); ctx.moveTo(0, tide.safeY - 65); ctx.lineTo(WIDTH, tide.safeY - 65); ctx.moveTo(0, tide.safeY + 65); ctx.lineTo(WIDTH, tide.safeY + 65); ctx.stroke();
  ctx.restore();
}

function drawParticles() {
  for (const p of particles) {
    ctx.globalAlpha = Math.max(0, p.life / .45);
    ctx.fillStyle = p.color;
    ctx.beginPath(); ctx.arc(p.x, p.y, 3, 0, Math.PI * 2); ctx.fill();
  }
  ctx.globalAlpha = 1;
}

document.addEventListener("keydown", (event) => {
  const keysToPrevent = ["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", " "];
  if (keysToPrevent.includes(event.key)) event.preventDefault();
  keys[event.key] = true;
});
document.addEventListener("keyup", (event) => { keys[event.key] = false; });
window.addEventListener("blur", () => { keys = {}; });
startBtn.addEventListener("click", startGame);

// Dessine un décor même avant le lancement de la première partie.
resetGame();
draw();
