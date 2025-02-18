/* game1.js - Раннер с динозавром (модифицированный)
   Добавлен движущийся фон, гифка игрока и два типа объектов:
   - deadly obstacles (убийственные блоки, при столкновении — конец игры)
   - platforms (платформы, на которые можно запрыгнуть)
*/

let dinoInterval = null;
let dinoCtx = null;

// Параметры игрока
let dinoX = 50;
let dinoY = 180;
let velocityY = 0;
let gravity = 0.5;
let isJumping = false;

// Массивы препятствий и платформ
let obstacles = []; // deadly blocks
let platforms = []; // платформы для прыжков
let obstacleSpeed = 3;
let frameCount = 0;

// Движущийся фон
let bgImg = new Image();
bgImg.src = "https://img.ixbt.site/live/images/original/31/98/97/2023/08/22/13847b747e.jpg"; // Замените на URL вашего фонового изображения
let bgX = 0;

// Гифка персонажа
let playerImg = new Image();
playerImg.src = "https://images.gaming-legion.net/products/spoofing/features/autowalk2.gif"; // Замените на URL гифки персонажа

function initGame1() {
  const canvas = document.getElementById('gameCanvas');
  dinoCtx = canvas.getContext('2d');
  canvas.style.display = 'block'; // чтобы canvas был виден

  // Сброс игровых переменных
  dinoX = 50;
  dinoY = 180;
  velocityY = 0;
  isJumping = false;
  obstacles = [];
  platforms = [];
  obstacleSpeed = 3;
  frameCount = 0;
  bgX = 0;

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

// Функция для создания deadly obstacles (убийственных блоков)
function spawnObstacle() {
  obstacles.push({
    x: 400,
    y: 180, // на уровне земли
    width: 20,
    height: 20,
    type: 'deadly'
  });
}

// Функция для создания платформ (на которые можно запрыгнуть)
function spawnPlatform() {
  // Платформа с произвольной шириной и положением по Y
  let platformWidth = 50 + Math.random() * 50; // от 50 до 100
  let platformHeight = 10;
  // Платформа располагается выше земли (например, от 120 до 170)
  let platformY = 120 + Math.random() * 50;
  platforms.push({
    x: 400,
    y: platformY,
    width: platformWidth,
    height: platformHeight,
    type: 'platform'
  });
}

function dinoUpdate() {
  // Обновление положения фона (движется медленнее, чем объекты)
  bgX -= obstacleSpeed / 2;
  if (bgX <= -400) {
    bgX = 0;
  }

  // Применяем гравитацию
  dinoY += velocityY;
  velocityY += gravity;

  // Столкновение с землей
  if (dinoY >= 180) {
    dinoY = 180;
    isJumping = false;
    velocityY = 0;
  }

  // Проверка столкновения с платформами, если персонаж падает
  if (velocityY >= 0) {
    platforms.forEach(platform => {
      // Если по горизонтали игрок пересекает платформу
      if (dinoX + 20 > platform.x && dinoX < platform.x + platform.width) {
        // Если нижняя часть игрока касается верхней поверхности платформы
        if (dinoY + 20 >= platform.y && dinoY + 20 <= platform.y + platform.height + velocityY) {
          dinoY = platform.y - 20; // "встаем" на платформу
          velocityY = 0;
          isJumping = false;
        }
      }
    });
  }

  frameCount++;
  // Каждые 100 кадров — новое убийственное препятствие
  if (frameCount % 100 === 0) {
    spawnObstacle();
  }
  // Каждые 150 кадров — новая платформа
  if (frameCount % 150 === 0) {
    spawnPlatform();
  }

  // Двигаем препятствия
  obstacles.forEach(obs => {
    obs.x -= obstacleSpeed;
  });
  // Двигаем платформы
  platforms.forEach(plat => {
    plat.x -= obstacleSpeed;
  });

  // Увеличиваем локальные очки (1 очко за кадр)
  localUserData.points++;
  updateTopBar();

  // Проверяем столкновения с убийственными блоками
  obstacles.forEach(obs => {
    if (
      dinoX < obs.x + obs.width &&
      dinoX + 20 > obs.x &&
      dinoY < obs.y + obs.height &&
      dinoY + 20 > obs.y
    ) {
      showEndGameModal(
        'Игра окончена',
        `Вы врезались в препятствие!\nНабрано очков: ${localUserData.points}`
      );
      resetGame1();
    }
  });

  // Удаляем вышедшие за левую границу объекты
  obstacles = obstacles.filter(obs => obs.x + obs.width > 0);
  platforms = platforms.filter(plat => plat.x + plat.width > 0);
}

function dinoDraw() {
  if (!dinoCtx) return;
  dinoCtx.clearRect(0, 0, 400, 200);

  // Рисуем движущийся фон (две копии для плавного цикла)
  dinoCtx.drawImage(bgImg, bgX, 0, 400, 200);
  dinoCtx.drawImage(bgImg, bgX + 400, 0, 400, 200);

  // Рисуем платформы (стиль блоков из Geometry Dash)
  dinoCtx.fillStyle = '#8B4513'; // коричневый цвет
  platforms.forEach(plat => {
    dinoCtx.fillRect(plat.x, plat.y, plat.width, plat.height);
  });

  // Рисуем убийственные препятствия
  dinoCtx.fillStyle = 'red';
  obstacles.forEach(obs => {
    dinoCtx.fillRect(obs.x, obs.y, obs.width, obs.height);
  });

  // Рисуем персонажа (используем гифку)
  if (playerImg.complete) {
    dinoCtx.drawImage(playerImg, dinoX, dinoY, 20, 20);
  } else {
    // Если гифка еще не загрузилась, рисуем прямоугольник
    dinoCtx.fillStyle = '#00FF00';
    dinoCtx.fillRect(dinoX, dinoY, 20, 20);
  }

  // Рисуем землю
  dinoCtx.fillStyle = '#555';
  dinoCtx.fillRect(0, 190, 400, 10);
}

function dinoGameLoop() {
  if (!dinoCtx) return; 
  dinoUpdate();
  dinoDraw();
  dinoInterval = requestAnimationFrame(dinoGameLoop);
}
