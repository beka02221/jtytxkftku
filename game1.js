/* game1.js - Раннер с динозавром */

let dinoInterval = null;
let dinoCtx = null;

// Параметры игры
let dinoX = 50;
let dinoY = 180;
let velocityY = 0;
let gravity = 0.5;
let isJumping = false;
let obstacles = [];
let obstacleSpeed = 3;
let frameCount = 0;

/**
 * Инициализация игры (запускается при открытии).
 */
function initGame1() {
  const canvas = document.getElementById('gameCanvas');
  dinoCtx = canvas.getContext('2d');

  // Сбрасываем параметры
  dinoX = 50;
  dinoY = 180;
  velocityY = 0;
  isJumping = false;
  obstacles = [];
  obstacleSpeed = 3;
  frameCount = 0;

  // Слушатели
  window.addEventListener('keydown', handleDinoKeyDown);
  canvas.addEventListener('click', handleDinoJump);

  // Запуск цикла
  dinoInterval = requestAnimationFrame(dinoGameLoop);
}

/**
 * Сброс игры (когда она завершается).
 */
function resetGame1() {
  if (dinoInterval) {
    cancelAnimationFrame(dinoInterval);
    dinoInterval = null;
  }
  window.removeEventListener('keydown', handleDinoKeyDown);
  const canvas = document.getElementById('gameCanvas');
  canvas.removeEventListener('click', handleDinoJump);
  dinoCtx = null;
}

/* Управление */
function handleDinoKeyDown(e) {
  if (e.code === 'Space') {
    handleDinoJump();
  }
}
function handleDinoJump() {
  if (!isJumping) {
    velocityY = -10;
    isJumping = true;
  }
}

function spawnObstacle() {
  obstacles.push({
    x: 400,
    y: 180,
    width: 20,
    height: 20
  });
}

function dinoUpdate() {
  // Движение динозавра
  dinoY += velocityY;
  velocityY += gravity;
  if (dinoY >= 180) {
    dinoY = 180;
    isJumping = false;
  }

  // Спавн препятствий
  frameCount++;
  if (frameCount % 100 === 0) {
    spawnObstacle();
  }

  // Движение препятствий
  obstacles.forEach(obs => {
    obs.x -= obstacleSpeed;
  });

  // Проверка столкновений
  obstacles.forEach(obs => {
    if (
      dinoX < obs.x + obs.width &&
      dinoX + 20 > obs.x &&
      dinoY < obs.y + obs.height &&
      dinoY + 20 > obs.y
    ) {
      // Проигрыш
      const pointsEarned = frameCount;  // например, очки = количество кадров
      showEndGameModal('Игра окончена',
        `Вы врезались в препятствие!\nЗаработанные очки: ${pointsEarned}`);
      resetGame1();
    }
  });

  // Удаляем объекты вне экрана
  obstacles = obstacles.filter(obs => obs.x + obs.width > 0);
}

function dinoDraw() {
  if (!dinoCtx) return;
  dinoCtx.clearRect(0, 0, 400, 200);

  // Динозавр
  dinoCtx.fillStyle = '#00FF00';
  dinoCtx.fillRect(dinoX, dinoY, 20, 20);

  // Препятствия
  dinoCtx.fillStyle = 'red';
  obstacles.forEach(obs => {
    dinoCtx.fillRect(obs.x, obs.y, obs.width, obs.height);
  });

  // "Пол"
  dinoCtx.fillStyle = '#555';
  dinoCtx.fillRect(0, 190, 400, 10);
}

function dinoGameLoop() {
  if (!dinoCtx) return; // Если уже сбросили
  dinoUpdate();
  dinoDraw();
  dinoInterval = requestAnimationFrame(dinoGameLoop);
}
