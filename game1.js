/* game1.js - Простейший Dino Runner */

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
 * Инициализация игры (запускается при открытии модалки "Игра 1").
 */
function initGame1() {
  const canvas = document.getElementById('gameCanvas');
  dinoCtx = canvas.getContext('2d');

  // Сбрасываем значения
  dinoX = 50;
  dinoY = 180;
  velocityY = 0;
  isJumping = false;
  obstacles = [];
  obstacleSpeed = 3;
  frameCount = 0;

  // Назначаем слушатели (прыжок по клику и пробелу)
  window.addEventListener('keydown', handleDinoKeyDown);
  canvas.addEventListener('click', handleDinoJump);

  // Запускаем игровой цикл
  dinoInterval = requestAnimationFrame(dinoGameLoop);
}

/**
 * Сброс игры (вызывается при закрытии модалки или окончании игры).
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
    x: 400, // ширина canvas (в index.html - width="400")
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
  if (frameCount % 120 === 0) {
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
      // Столкновение – игра окончена
      // Показываем модалку из index.html (showGlobalModal)
      showGlobalModal('Игра окончена', 'Вы врезались в препятствие!');
      // Сброс
      resetGame1();
    }
  });

  // Удаляем вышедшие за экран препятствия
  obstacles = obstacles.filter(obs => obs.x + obs.width > 0);
}

function dinoDraw() {
  if (!dinoCtx) return;
  dinoCtx.clearRect(0, 0, 400, 200);

  // Рисуем динозавра (просто квадрат)
  dinoCtx.fillStyle = '#00FF00';
  dinoCtx.fillRect(dinoX, dinoY, 20, 20);

  // Рисуем препятствия
  dinoCtx.fillStyle = 'red';
  obstacles.forEach(obs => {
    dinoCtx.fillRect(obs.x, obs.y, obs.width, obs.height);
  });

  // "Пол"
  dinoCtx.fillStyle = '#555';
  dinoCtx.fillRect(0, 190, 400, 10);
}

function dinoGameLoop() {
  if (!dinoCtx) return; // Если сброшено
  dinoUpdate();
  dinoDraw();
  dinoInterval = requestAnimationFrame(dinoGameLoop);
}
