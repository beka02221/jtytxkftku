
/* game1.js - Раннер с динозавром
   Здесь мы во время игры "накручиваем" локальные очки localUserData.points,
   чтобы пользователь видел растущее число в шапке. 
   При столкновении - показываем итоговое окно, очки записываются в БД после закрытия итогового окна.
*/

let dinoInterval = null;
let dinoCtx = null;

// Параметры
let dinoX = 50;
let dinoY = 180;
let velocityY = 0;
let gravity = 0.5;
let isJumping = false;
let obstacles = [];
let obstacleSpeed = 3;
let frameCount = 0;

function initGame1() {
  const canvas = document.getElementById('gameCanvas');
  dinoCtx = canvas.getContext('2d');

  // Сброс
  dinoX = 50;
  dinoY = 180;
  velocityY = 0;
  isJumping = false;
  obstacles = [];
  obstacleSpeed = 3;
  frameCount = 0;

  // Чтобы "стартовые очки" запомнить, 
  // допустим, берём currentPoints = localUserData.points (из index.html)
  // и дальше увеличиваем на frameCount.
  // Или можно начать "с нуля" за текущую сессию.
  // Для наглядности, давайте будем увеличивать localUserData.points динамически.

  window.addEventListener('keydown', handleDinoKeyDown);
  canvas.addEventListener('click', handleDinoJump);

  dinoInterval = requestAnimationFrame(dinoGameLoop);
}

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
    x: 400,
    y: 180,
    width: 20,
    height: 20
  });
}

function dinoUpdate() {
  dinoY += velocityY;
  velocityY += gravity;
  if (dinoY >= 180) {
    dinoY = 180;
    isJumping = false;
  }

  frameCount++;
  // Каждые 100 кадров - новое препятствие
  if (frameCount % 100 === 0) {
    spawnObstacle();
  }

  // Двигаем препятствия
  obstacles.forEach(obs => {
    obs.x -= obstacleSpeed;
  });

  // Увеличиваем локальные очки (например, 1 очко за кадр)
  // localUserData.points += 1 - но лучше делать это реже, чтобы не вызывать лишнюю нагрузку.
  // Для простоты: 1 очко за каждый кадр
  localUserData.points++;
  // Обновляем шапку (чтобы игрок видел, как растут очки)
  updateTopBar();

  // Проверяем столкновения
  obstacles.forEach(obs => {
    if (
      dinoX < obs.x + obs.width &&
      dinoX + 20 > obs.x &&
      dinoY < obs.y + obs.height &&
      dinoY + 20 > obs.y
    ) {
      // Столкновение
      // Покажем итоговое окно (из index.html)
      showEndGameModal(
        'Игра окончена',
        `Вы врезались в препятствие!\nНабрано очков: ${localUserData.points}`
      );
      resetGame1();
    }
  });

  // Удаляем пройденные препятствия
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

  // Пол
  dinoCtx.fillStyle = '#555';
  dinoCtx.fillRect(0, 190, 400, 10);
}

function dinoGameLoop() {
  if (!dinoCtx) return; 
  dinoUpdate();
  dinoDraw();
  dinoInterval = requestAnimationFrame(dinoGameLoop);
}
