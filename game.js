// Neon Cyber Snake Game Engine
const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

// DOM Elements
const scoreEl = document.getElementById('score');
const highScoreEl = document.getElementById('high-score');
const levelEl = document.getElementById('level');
const speedMeterEl = document.getElementById('speed-meter');
const overlayEl = document.getElementById('overlay');
const overlayTitle = document.getElementById('overlay-title');
const overlaySub = document.getElementById('overlay-subtitle');
const startBtn = document.getElementById('start-btn');
const btnSound = document.getElementById('btn-sound');
const btnMusic = document.getElementById('btn-music');
const btnCrt = document.getElementById('btn-crt');
const btnPause = document.getElementById('btn-pause');
const crtOverlay = document.querySelector('.crt-overlay');
const diffButtons = document.querySelectorAll('.diff-btn');

// Virtual D-Pad
const btnUp = document.getElementById('btn-up');
const btnDown = document.getElementById('btn-down');
const btnLeft = document.getElementById('btn-left');
const btnRight = document.getElementById('btn-right');

// Game Config
const GRID_SIZE = 24; // 24x24 tiles
const TILE_SIZE = canvas.width / GRID_SIZE; // 20px

let snake = [];
let direction = { x: 1, y: 0 };
let nextDirection = { x: 1, y: 0 };
let food = null;
let specialFood = null;
let specialTimer = null;
let particles = [];
let score = 0;
let highScore = parseInt(localStorage.getItem('cybersnake_highscore') || '0', 10);
let level = 1;
let baseSpeed = 100; // ms per tick
let currentSpeed = 100;
let gameInterval = null;
let isRunning = false;
let isPaused = false;
let shakeTime = 0;

// High score init
highScoreEl.textContent = highScore;

// Difficulty selection
diffButtons.forEach(btn => {
  btn.addEventListener('click', () => {
    diffButtons.forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    baseSpeed = parseInt(btn.dataset.speed, 10);
    currentSpeed = baseSpeed;
  });
});

// Particles System
class Particle {
  constructor(x, y, color) {
    this.x = x;
    this.y = y;
    this.vx = (Math.random() - 0.5) * 6;
    this.vy = (Math.random() - 0.5) * 6;
    this.alpha = 1;
    this.decay = Math.random() * 0.03 + 0.02;
    this.color = color;
    this.size = Math.random() * 4 + 2;
  }

  update() {
    this.x += this.vx;
    this.y += this.vy;
    this.alpha -= this.decay;
  }

  draw(context) {
    context.save();
    context.globalAlpha = Math.max(0, this.alpha);
    context.shadowBlur = 10;
    context.shadowColor = this.color;
    context.fillStyle = this.color;
    context.fillRect(this.x, this.y, this.size, this.size);
    context.restore();
  }
}

function spawnExplosion(x, y, color, count = 16) {
  for (let i = 0; i < count; i++) {
    particles.push(new Particle(x, y, color));
  }
}

// Reset Game State
function resetGame() {
  snake = [
    { x: 5, y: 12 },
    { x: 4, y: 12 },
    { x: 3, y: 12 }
  ];
  direction = { x: 1, y: 0 };
  nextDirection = { x: 1, y: 0 };
  score = 0;
  level = 1;
  currentSpeed = baseSpeed;
  particles = [];
  specialFood = null;
  if (specialTimer) clearTimeout(specialTimer);
  updateScoreUI();
  spawnFood();
}

function updateScoreUI() {
  scoreEl.textContent = score;
  levelEl.textContent = level;
  const speedMult = ((100 / currentSpeed)).toFixed(1);
  speedMeterEl.textContent = `${speedMult}x`;

  if (score > highScore) {
    highScore = score;
    highScoreEl.textContent = highScore;
    localStorage.setItem('cybersnake_highscore', highScore);
  }
}

// Spawn Standard Food
function spawnFood() {
  let valid = false;
  let newFood;
  while (!valid) {
    newFood = {
      x: Math.floor(Math.random() * GRID_SIZE),
      y: Math.floor(Math.random() * GRID_SIZE),
      pulse: 0
    };
    valid = !snake.some(segment => segment.x === newFood.x && segment.y === newFood.y);
  }
  food = newFood;

  // Chance to spawn special bonus food (1 in 4)
  if (!specialFood && Math.random() < 0.28 && score > 30) {
    spawnSpecialFood();
  }
}

function spawnSpecialFood() {
  let valid = false;
  let sFood;
  while (!valid) {
    sFood = {
      x: Math.floor(Math.random() * GRID_SIZE),
      y: Math.floor(Math.random() * GRID_SIZE),
      timeLeft: 35 // ticks
    };
    valid = !snake.some(s => s.x === sFood.x && s.y === sFood.y) &&
            !(food && food.x === sFood.x && food.y === sFood.y);
  }
  specialFood = sFood;
}

// Controls & Direction
function setDirection(x, y) {
  if (direction.x !== -x && direction.y !== -y) {
    nextDirection = { x, y };
    window.soundEngine.playTurn();
  }
}

// Keyboard input
window.addEventListener('keydown', (e) => {
  if (['ArrowUp', 'KeyW'].includes(e.code)) {
    e.preventDefault();
    setDirection(0, -1);
  } else if (['ArrowDown', 'KeyS'].includes(e.code)) {
    e.preventDefault();
    setDirection(0, 1);
  } else if (['ArrowLeft', 'KeyA'].includes(e.code)) {
    e.preventDefault();
    setDirection(-1, 0);
  } else if (['ArrowRight', 'KeyD'].includes(e.code)) {
    e.preventDefault();
    setDirection(1, 0);
  } else if (e.code === 'Space') {
    e.preventDefault();
    if (!isRunning) {
      startGame();
    } else {
      togglePause();
    }
  }
});

// Touch / Swipe Detection
let touchStartX = 0;
let touchStartY = 0;

canvas.addEventListener('touchstart', (e) => {
  const t = e.touches[0];
  touchStartX = t.clientX;
  touchStartY = t.clientY;
}, { passive: true });

canvas.addEventListener('touchend', (e) => {
  const t = e.changedTouches[0];
  const dx = t.clientX - touchStartX;
  const dy = t.clientY - touchStartY;
  const absDx = Math.abs(dx);
  const absDy = Math.abs(dy);

  if (Math.max(absDx, absDy) > 24) {
    if (absDx > absDy) {
      setDirection(dx > 0 ? 1 : -1, 0);
    } else {
      setDirection(0, dy > 0 ? 1 : -1);
    }
  }
}, { passive: true });

// Virtual D-Pad buttons
btnUp.addEventListener('click', () => setDirection(0, -1));
btnDown.addEventListener('click', () => setDirection(0, 1));
btnLeft.addEventListener('click', () => setDirection(-1, 0));
btnRight.addEventListener('click', () => setDirection(1, 0));

// Audio and Visual Options
btnSound.addEventListener('click', () => {
  window.soundEngine.soundEnabled = !window.soundEngine.soundEnabled;
  btnSound.textContent = `🔊 SOUND: ${window.soundEngine.soundEnabled ? 'ON' : 'OFF'}`;
});

btnMusic.addEventListener('click', () => {
  const on = window.soundEngine.toggleMusic();
  btnMusic.textContent = `🎵 MUSIC: ${on ? 'ON' : 'OFF'}`;
});

btnCrt.addEventListener('click', () => {
  crtOverlay.classList.toggle('disabled');
  const on = !crtOverlay.classList.contains('disabled');
  btnCrt.textContent = `📺 CRT FX: ${on ? 'ON' : 'OFF'}`;
});

btnPause.addEventListener('click', togglePause);

startBtn.addEventListener('click', () => {
  startGame();
});

function startGame() {
  resetGame();
  overlayEl.classList.remove('active');
  isRunning = true;
  isPaused = false;
  btnPause.textContent = '⏸ PAUSE';
  if (gameInterval) clearInterval(gameInterval);
  gameInterval = setInterval(gameStep, currentSpeed);
}

function togglePause() {
  if (!isRunning) return;
  isPaused = !isPaused;
  if (isPaused) {
    clearInterval(gameInterval);
    overlayTitle.textContent = 'GAME PAUSED';
    overlayTitle.className = 'glitch-text glow-yellow';
    overlaySub.textContent = 'Take a breather, neon warrior.';
    startBtn.textContent = 'RESUME [SPACE]';
    overlayEl.classList.add('active');
    btnPause.textContent = '▶ RESUME';
  } else {
    overlayEl.classList.remove('active');
    btnPause.textContent = '⏸ PAUSE';
    gameInterval = setInterval(gameStep, currentSpeed);
  }
}

function gameOver() {
  isRunning = false;
  clearInterval(gameInterval);
  window.soundEngine.playGameOver();
  shakeTime = 12;

  overlayTitle.textContent = 'SYSTEM OVERLOAD';
  overlayTitle.className = 'glitch-text glow-pink';
  overlaySub.textContent = `FINAL SCORE: ${score}  //  HIGH SCORE: ${highScore}`;
  startBtn.textContent = 'PLAY AGAIN [SPACE]';
  overlayEl.classList.add('active');
}

// Game Tick Logic
function gameStep() {
  direction = nextDirection;
  const head = { x: snake[0].x + direction.x, y: snake[0].y + direction.y };

  // Wall collision check
  if (head.x < 0 || head.x >= GRID_SIZE || head.y < 0 || head.y >= GRID_SIZE) {
    gameOver();
    return;
  }

  // Self collision check
  if (snake.some(segment => segment.x === head.x && segment.y === head.y)) {
    gameOver();
    return;
  }

  snake.unshift(head);

  // Check food collision
  let ate = false;
  if (food && head.x === food.x && head.y === food.y) {
    score += 10;
    spawnExplosion(head.x * TILE_SIZE + TILE_SIZE / 2, head.y * TILE_SIZE + TILE_SIZE / 2, '#00f0ff', 18);
    window.soundEngine.playEat();
    ate = true;

    // Level progression & Speed scaling
    if (score % 50 === 0) {
      level++;
      currentSpeed = Math.max(35, Math.floor(baseSpeed * Math.pow(0.92, level - 1)));
      clearInterval(gameInterval);
      gameInterval = setInterval(gameStep, currentSpeed);
    }
    updateScoreUI();
    spawnFood();
  }

  // Check special food collision
  if (specialFood && head.x === specialFood.x && head.y === specialFood.y) {
    const bonus = specialFood.timeLeft * 2;
    score += bonus;
    spawnExplosion(head.x * TILE_SIZE + TILE_SIZE / 2, head.y * TILE_SIZE + TILE_SIZE / 2, '#ffe600', 30);
    window.soundEngine.playSpecialEat();
    specialFood = null;
    updateScoreUI();
  }

  // Countdown special food
  if (specialFood) {
    specialFood.timeLeft--;
    if (specialFood.timeLeft <= 0) {
      specialFood = null;
    }
  }

  if (!ate) {
    snake.pop();
  }
}

// Render Animation Loop (60 FPS smooth rendering)
function render() {
  ctx.save();

  // Screen shake
  if (shakeTime > 0) {
    const sx = (Math.random() - 0.5) * shakeTime;
    const sy = (Math.random() - 0.5) * shakeTime;
    ctx.translate(sx, sy);
    shakeTime *= 0.85;
    if (shakeTime < 0.2) shakeTime = 0;
  }

  // Clear canvas
  ctx.fillStyle = '#060612';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  // Draw grid lines
  ctx.strokeStyle = 'rgba(0, 240, 255, 0.05)';
  ctx.lineWidth = 1;
  for (let x = 0; x <= canvas.width; x += TILE_SIZE) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, canvas.height);
    ctx.stroke();
  }
  for (let y = 0; y <= canvas.height; y += TILE_SIZE) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(canvas.width, y);
    ctx.stroke();
  }

  // Draw Food
  if (food) {
    food.pulse = (food.pulse || 0) + 0.1;
    const pulseScale = 1 + Math.sin(food.pulse) * 0.15;
    const centerX = food.x * TILE_SIZE + TILE_SIZE / 2;
    const centerY = food.y * TILE_SIZE + TILE_SIZE / 2;
    const radius = (TILE_SIZE / 2 - 2) * pulseScale;

    ctx.save();
    ctx.shadowBlur = 15;
    ctx.shadowColor = '#00f0ff';
    ctx.fillStyle = '#00f0ff';
    ctx.beginPath();
    ctx.arc(centerX, centerY, radius, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(centerX, centerY, radius * 0.45, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  // Draw Special Food
  if (specialFood) {
    const centerX = specialFood.x * TILE_SIZE + TILE_SIZE / 2;
    const centerY = specialFood.y * TILE_SIZE + TILE_SIZE / 2;
    const radius = TILE_SIZE / 2 - 1;

    ctx.save();
    ctx.shadowBlur = 20;
    ctx.shadowColor = '#ffe600';
    ctx.fillStyle = '#ffe600';
    ctx.beginPath();
    ctx.arc(centerX, centerY, radius, 0, Math.PI * 2);
    ctx.fill();

    // Pulse ring
    ctx.strokeStyle = 'rgba(255, 230, 0, 0.6)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(centerX, centerY, radius + 4 + Math.sin(Date.now() / 150) * 3, 0, Math.PI * 2);
    ctx.stroke();

    // Timer text
    ctx.fillStyle = '#000';
    ctx.font = 'bold 9px Rajdhani';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(Math.ceil(specialFood.timeLeft / 3), centerX, centerY);
    ctx.restore();
  }

  // Draw Snake
  snake.forEach((seg, index) => {
    ctx.save();
    const isHead = index === 0;
    const x = seg.x * TILE_SIZE;
    const y = seg.y * TILE_SIZE;
    const pad = 1.5;

    if (isHead) {
      ctx.shadowBlur = 18;
      ctx.shadowColor = '#ff007f';
      ctx.fillStyle = '#ff007f';
      ctx.fillRect(x + pad, y + pad, TILE_SIZE - pad * 2, TILE_SIZE - pad * 2);

      // Inner glow
      ctx.fillStyle = '#fff';
      ctx.fillRect(x + pad * 2, y + pad * 2, TILE_SIZE - pad * 4, TILE_SIZE - pad * 4);

      // Cyber eye indicators based on direction
      ctx.fillStyle = '#00f0ff';
      const eyeSize = 3;
      if (direction.x === 1) {
        ctx.fillRect(x + TILE_SIZE - 5, y + 4, eyeSize, eyeSize);
        ctx.fillRect(x + TILE_SIZE - 5, y + TILE_SIZE - 7, eyeSize, eyeSize);
      } else if (direction.x === -1) {
        ctx.fillRect(x + 2, y + 4, eyeSize, eyeSize);
        ctx.fillRect(x + 2, y + TILE_SIZE - 7, eyeSize, eyeSize);
      } else if (direction.y === -1) {
        ctx.fillRect(x + 4, y + 2, eyeSize, eyeSize);
        ctx.fillRect(x + TILE_SIZE - 7, y + 2, eyeSize, eyeSize);
      } else {
        ctx.fillRect(x + 4, y + TILE_SIZE - 5, eyeSize, eyeSize);
        ctx.fillRect(x + TILE_SIZE - 7, y + TILE_SIZE - 5, eyeSize, eyeSize);
      }
    } else {
      // Body gradient from pink to cyan/purple
      const progress = index / snake.length;
      ctx.shadowBlur = 10;
      ctx.shadowColor = progress > 0.5 ? '#9d00ff' : '#ff007f';
      ctx.fillStyle = progress > 0.5 ? '#9d00ff' : '#d9006c';
      ctx.fillRect(x + pad, y + pad, TILE_SIZE - pad * 2, TILE_SIZE - pad * 2);
    }
    ctx.restore();
  });

  // Update & Draw Particles
  particles = particles.filter(p => p.alpha > 0);
  particles.forEach(p => {
    p.update();
    p.draw(ctx);
  });

  ctx.restore();
  requestAnimationFrame(render);
}

// Start rendering loop immediately
render();
resetGame();
