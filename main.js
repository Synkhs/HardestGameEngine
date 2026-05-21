import GameCore from './engine/core.js';
import LevelLoader from './engine/levelLoader.js';
import InputManager from './engine/input.js';
import SoundManager from './engine/soundManager.js';

// Niveles disponibles
const levels = [
  'levels/level1.json',
  'levels/level2.json',
  'levels/level3.json',
  'levels/level4.json',
  'levels/level5.json',
  'levels/level6.json',
  'levels/level7.json',
  'levels/level8.json',
  'levels/level9.json',
  'levels/level10.json',
  'levels/level11.json',
  'levels/level12.json',
  'levels/level13.json',
  'levels/level14.json',
  'levels/level15.json',
  'levels/level16.json',
  'levels/level17.json',
  'levels/level18.json',
  'levels/level19.json',
  'levels/level20.json',
];

// Config del canvas y motor
const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');
const TILE_SIZE = 32;

// Instancias
let gameCore = null;
let levelLoader = new LevelLoader();
let inputManager = new InputManager();
let soundManager = new SoundManager();

let currentLevelIndex = 0;
let deathCount = 0;
let levelStartTime = 0;

// DOM Elements
const menu = document.getElementById('menu');
const levelSelector = document.getElementById('levelSelector');
const instructions = document.getElementById('instructions');
const hud = document.getElementById('hud');
const pauseOverlay = document.getElementById('pauseOverlay');
const gameOverOverlay = document.getElementById('gameOverOverlay');
const levelCompleteOverlay = document.getElementById('levelCompleteOverlay');

// Botones del menú
const playBtn = document.getElementById('playBtn');
const levelsBtn = document.getElementById('levelsBtn');
const instructionsBtn = document.getElementById('instructionsBtn');
const editorBtn = document.getElementById('editorBtn');
const backBtn = document.getElementById('backBtn');
const closeInstructionsBtn = document.getElementById('closeInstructionsBtn');
const gameOverBtn = document.getElementById('gameOverBtn');
const nextLevelBtn = document.getElementById('nextLevelBtn');

// Event Listeners del menú
playBtn.addEventListener('click', startGame);
levelsBtn.addEventListener('click', showLevelSelector);
instructionsBtn.addEventListener('click', showInstructions);
editorBtn.addEventListener('click', openEditor);
backBtn.addEventListener('click', showMenu);
closeInstructionsBtn.addEventListener('click', showMenu);
gameOverBtn.addEventListener('click', showMenu);
nextLevelBtn.addEventListener('click', nextLevel);

// Mostrar menú
function showMenu() {
  menu.style.display = 'flex';
  levelSelector.classList.remove('active');
  instructions.classList.remove('active');
  pauseOverlay.classList.remove('active');
  gameOverOverlay.classList.remove('active');
  levelCompleteOverlay.classList.remove('active');
  hud.style.display = 'none';
  if (gameCore) gameCore.stop();
  soundManager.stopAll();
}

// Mostrar selector de niveles
function showLevelSelector() {
  menu.style.display = 'none';
  levelSelector.classList.add('active');

  const levelGrid = document.getElementById('levelGrid');
  levelGrid.innerHTML = '';

  levels.forEach((level, index) => {
    const btn = document.createElement('button');
    btn.className = 'levelBtn';
    btn.textContent = `Level ${index + 1}`;
    btn.addEventListener('click', () => {
      currentLevelIndex = index;
      deathCount = 0;
      startGame();
    });
    levelGrid.appendChild(btn);
  });
}

// Mostrar instrucciones
function showInstructions() {
  menu.style.display = 'none';
  instructions.classList.add('active');
}

// Abrir editor
function openEditor() {
  window.location.href = 'editor/index.html';
}

// Iniciar juego
async function startGame() {
  menu.style.display = 'none';
  levelSelector.classList.remove('active');
  instructions.classList.remove('active');
  hud.style.display = 'flex';

  // Cargar nivel
  const levelData = await levelLoader.load(levels[currentLevelIndex]);
  
  if (!levelData) {
    alert('Error cargando nivel');
    showMenu();
    return;
  }

  // Actualizar HUD
  document.getElementById('levelNumber').textContent = currentLevelIndex + 1;
  document.getElementById('deathCount').textContent = deathCount;
  levelStartTime = Date.now();

  // Crear instancia del motor
  gameCore = new GameCore(canvas, ctx, TILE_SIZE, levelData);
  gameCore.onDeath = handleDeath;
  gameCore.onLevelComplete = handleLevelComplete;
  gameCore.onGameStateChange = handleGameStateChange;

  // Iniciar loop
  gameCore.start();

  // Iniciar actualización de HUD de tiempo
  updateTimeDisplay();
}

// Manejar muerte
function handleDeath() {
  deathCount++;
  document.getElementById('deathCount').textContent = deathCount;
  soundManager.play('death');
}

// Manejar completar nivel
function handleLevelComplete() {
  soundManager.play('victory');
  levelCompleteOverlay.classList.add('active');
  gameCore.pause();

  // Siguiente nivel en 3 segundos o click
  const timeoutId = setTimeout(() => {
    nextLevel();
  }, 3000);

  nextLevelBtn.onclick = () => {
    clearTimeout(timeoutId);
    nextLevel();
  };
}

// Siguiente nivel
function nextLevel() {
  currentLevelIndex++;

  if (currentLevelIndex >= levels.length) {
    // ¡Ganaste!
    gameOverOverlay.classList.add('active');
    document.getElementById('gameOverText').textContent = `¡Has completado todos los 20 niveles!\nMuertes totales: ${deathCount}`;
    gameCore.stop();
  } else {
    levelCompleteOverlay.classList.remove('active');
    startGame();
  }
}

// Manejar cambio de estado (pausa)
function handleGameStateChange(state) {
  if (state === 'PAUSED') {
    pauseOverlay.classList.add('active');
  } else if (state === 'PLAYING') {
    pauseOverlay.classList.remove('active');
  }
}

// Actualizar tiempo en HUD
function updateTimeDisplay() {
  const interval = setInterval(() => {
    if (!gameCore || gameCore.state === 'MENU') {
      clearInterval(interval);
      return;
    }

    const elapsed = Math.floor((Date.now() - levelStartTime) / 1000);
    document.getElementById('timeCount').textContent = elapsed;
  }, 100);
}

// Mostrar menú inicial
showMenu();