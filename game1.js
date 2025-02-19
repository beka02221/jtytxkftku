/* game1.js - Улучшенный уровень в стиле Geometry Dash

Требования:
• Геймплей:
  – 5-минутный таймер (прогресс-бар, заполняется до верха)
  – Стартовый экран с надписью «Тап, чтобы старт» (нестандартный шрифт)
  – Прогресс отслеживается с помощью жетонов (1 жетон = 5 единиц прогресса); прогресс в UI обновляется в реальном времени,
    но сохраняется в БД только по окончании игры.
• Оформление:
  – Земля – черная.
  – Все объекты (земля, шипы, платформы) находятся на одном ровном уровне – персонаж не появляется под землей.
  – Платформы – кубы с текстурой (wall1.jpg), каждый куб имеет чёткую черную обводку, отдельные блоки не сливаются.
  – Шипы – размещаются на одном уровне с кубическими платформами.
• Игровая логика:
  – Если игрок не успевает запрыгнуть на платформу вовремя (то есть приземляется на базовую землю), он погибает.
  – При приземлении на платформу персонаж должен ровно касаться её верхней границы (исправлен баг «на половине блока»).

*/

let dinoInterval = null;
let dinoCtx = null;

// Базовое разрешение для расчёта масштабирования
const baseWidth = 400;
const baseHeight = 600;
let scale = 1; // рассчитывается в initGame1

// Размеры игровых объектов (устанавливаются в initGame1 с учётом scale)
let playerWidth, playerHeight;
let obstacleWidth, obstacleHeight;
let platformHeight;
let coinWidth, coinHeight;
let groundHeight;
let groundY;
let platformBlockSize; // размер одного куба платформы

// Параметры игрока
let dinoX = 50;
let dinoY = 0; // установится в initGame1
let velocityY = 0;
const gravity = 0.5;
let isJumping = false;

// Геймплейные переменные
let gameStarted = false;
let gameStartTime = 0;     // время старта игры (в мс)
const gameDuration = 300000; // 5 минут = 300000 мс
let progressUnits = 0;     // прогресс в секундах
// Жетоны: 1 жетон = 5 единиц прогресса (то есть, каждые 5 сек – 1 жетон)

// Массивы игровых объектов
let obstacles = [];   // шипы
let platforms = [];   // платформы (наборы кубов)
let coins = [];       // монеты (overlay для анимации)
let frameCount = 0;
let obstacleSpeed = 3; // масштабируется в initGame1

// Фоновое изображение
let bgImg = new Image();
bgImg.crossOrigin = "anonymous";
bgImg.src = "https://cdn-edge.kwork.ru/pics/t3/01/17643818-1636742001.jpg";
let bgX = 0;

// GIF для персонажа
let playerImg = new Image();
playerImg.crossOrigin = "anonymous";
playerImg.src = "https://cdn.masto.host/rigczclub/accounts/avatars/000/000/001/original/7a2c1ce45c8f8d02.gif";

// GIF для монеты
let coinImg = new Image();
coinImg.crossOrigin = "anonymous";
coinImg.src = "https://donatepay.ru/uploads/notification/images/830208_1664005822.gif";

// Текстура для платформ (wall1.jpg, 300×300)
let platformImg = new Image();
platformImg.crossOrigin = "anonymous";
platformImg.src = "wall1.jpg";

// --- Overlay элементы для анимации (чтобы GIF анимировались в Telegram Web App) ---
// Для персонажа – один overlay-элемент
let playerOverlay = null;
// Для монет – при спавне каждой монеты создаётся overlay (сохраняется в свойстве overlay объекта)

// Функция для обновления позиций overlay элементов (персонажа и монет)
function updateOverlays() {
  if (playerOverlay) {
    playerOverlay.style.left = dinoX + "px";
    playerOverlay.style.top = dinoY + "px";
  }
  coins.forEach(coin => {
    if (coin.overlay) {
      coin.overlay.style.left = coin.x + "px";
      coin.overlay.style.top = coin.y + "px";
    }
  });
}

// Функция для отрисовки таймера (прогресс-бар) вверху экрана
function drawTimer(ctx, canvasWidth) {
  const elapsed = performance.now() - gameStartTime;
  const progress = Math.min(elapsed / gameDuration, 1);
  const barWidth = canvasWidth - 20;
  const barHeight = 20;
  ctx.strokeStyle = "white";
  ctx.lineWidth = 2;
  ctx.strokeRect(10, 10, barWidth, barHeight);
  ctx.fillStyle = "lime";
  ctx.fillRect(10, 10, barWidth * progress, barHeight);
}

function initGame1() {
  const canvas = document.getElementById('gameCanvas');
  dinoCtx = canvas.getContext('2d');
  canvas.style.display = 'block';
  // Задаём позиционирование для canvas и устанавливаем z-index
  canvas.style.position = "relative";
  canvas.style.zIndex = "0";
  
  // Обеспечиваем, чтобы родительский контейнер имел position: relative
  let container = canvas.parentElement;
  if (getComputedStyle(container).position === "static") {
    container.style.position = "relative";
  }
  
  const canvasWidth = canvas.width;
  const canvasHeight = canvas.height;
  
  // Расчёт масштаба относительно базового разрешения
  scale = canvasWidth / baseWidth;
  
  // Устанавливаем размеры объектов с учётом масштаба:
  playerWidth    = 60 * scale;
  playerHeight   = 60 * scale;
  obstacleWidth  = 30 * scale; // шипы
  obstacleHeight = 30 * scale;
  platformBlockSize = 60 * scale; // куб платформы (размер блока равен размеру игрока)
  platformHeight = platformBlockSize; 
  coinWidth      = 50 * scale; // увеличенные монеты
  coinHeight     = 50 * scale;
  groundHeight   = 40 * scale; // увеличенная толщина земли для эффекта возвышенности
  // Фон заканчивается ровно на уровне земли:
  groundY        = canvasHeight - groundHeight;
  
  // Начальное положение игрока – на платформе (на земле) 
  dinoX = 50 * scale;
  dinoY = groundY - playerHeight;
  velocityY = 0;
  isJumping = false;
  
  // Сброс игровых объектов
  obstacles = [];
  platforms = [];
  coins.forEach(coin => {
    if (coin.overlay && coin.overlay.parentElement) {
      coin.overlay.parentElement.removeChild(coin.overlay);
    }
  });
  coins = [];
  
  frameCount = 0;
  obstacleSpeed = 3 * scale;
  bgX = 0;
  
  // Изначально игра не начата – отобразим стартовый экран
  gameStarted = false;
  gameStartTime = 0;
  progressUnits = 0;
  localUserData.tokens = 0; // обнуляем жетоны для текущей сессии
  
  // Создаём overlay для персонажа (GIF-анимация будет нативно проигрываться)
  if (!playerOverlay) {
    playerOverlay = document.createElement("img");
    playerOverlay.src = playerImg.src;
    playerOverlay.style.position = "absolute";
    playerOverlay.style.width = playerWidth + "px";
    playerOverlay.style.height = playerHeight + "px";
    playerOverlay.style.pointerEvents = "none";
    playerOverlay.style.zIndex = "1";
    container.appendChild(playerOverlay);
  } else {
    playerOverlay.style.width = playerWidth + "px";
    playerOverlay.style.height = playerHeight + "px";
  }
  
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
  
  coins.forEach(coin => {
    if (coin.overlay && coin.overlay.parentElement) {
      coin.overlay.parentElement.removeChild(coin.overlay);
    }
  });
  coins = [];
  // Сохраняем прогресс (жетоны) в БД только по окончании игры:
  if (userRef && currentUser) {
    userRef.update({ tokens: localUserData.tokens });
  }
}

function gameOver() {
  showEndGameModal("Игра окончена", "Ваши жетоны: " + localUserData.tokens);
  resetGame1();
}

function handleDinoKeyDown(e) {
  if (e.code === 'Space') {
    handleDinoJump();
  }
}
function handleDinoJump() {
  // Если игра ещё не началась, первый тап запускает игру
  if (!gameStarted) {
    gameStarted = true;
    gameStartTime = performance.now();
    return;
  }
  // Если игра уже идёт, прыжок
  if (!isJumping) {
    velocityY = -14 * scale; // увеличенная сила прыжка
    isJumping = true;
  }
}

// Функция для проверки, находится ли точка (px,py) внутри треугольника, заданного точками A, B, C
function pointInTriangle(px, py, ax, ay, bx, by, cx, cy) {
  const areaOrig = Math.abs((bx - ax) * (cy - ay) - (cx - ax) * (by - ay));
  const area1 = Math.abs((ax - px) * (by - py) - (bx - px) * (ay - py));
  const area2 = Math.abs((bx - px) * (cy - py) - (cx - px) * (by - py));
  const area3 = Math.abs((cx - px) * (ay - py) - (ax - px) * (cy - py));
  return Math.abs(area1 + area2 + area3 - areaOrig) < 0.1;
}

// Спавн шипа – появляется только если в этой точке нет платформы
function spawnObstacle() {
  let spawnX = dinoCtx.canvas.width;
  let overlap = platforms.some(plat => (plat.x < spawnX + obstacleWidth && plat.x + plat.width > spawnX));
  if (!overlap) {
    obstacles.push({
      x: spawnX,
      y: groundY - obstacleHeight,
      width: obstacleWidth,
      height: obstacleHeight,
      type: 'deadly'
    });
  }
}

// Спавн платформы: платформа состоит из 1–3 кубов (каждый куб – отдельный блок с текстурой и чёрной обводкой)
function spawnPlatform() {
  const blocksCount = Math.floor(Math.random() * 3) + 1; // от 1 до 3 кубов
  const platformWidth = blocksCount * platformBlockSize;
  platforms.push({
    x: dinoCtx.canvas.width,
    y: groundY - platformHeight,
    width: platformWidth,
    height: platformHeight,
    blocks: blocksCount
  });
}

// Спавн монеты: создаётся overlay-элемент для анимации
let coinCounter = 0;
function spawnCoin() {
  const offset = (50 + Math.random() * 100) * scale;
  let coin = {
    id: coinCounter++,
    x: dinoCtx.canvas.width,
    y: groundY - coinHeight - offset,
    width: coinWidth,
    height: coinHeight,
    type: 'coin'
  };
  let coinOverlay = document.createElement("img");
  coinOverlay.src = coinImg.src;
  coinOverlay.style.position = "absolute";
  coinOverlay.style.width = coinWidth + "px";
  coinOverlay.style.height = coinHeight + "px";
  coinOverlay.style.pointerEvents = "none";
  coinOverlay.style.zIndex = "1";
  let container = dinoCtx.canvas.parentElement;
  container.appendChild(coinOverlay);
  coin.overlay = coinOverlay;
  coins.push(coin);
}

function dinoUpdate() {
  const canvasWidth = dinoCtx.canvas.width;
  const currentTime = performance.now();
  
  // Если игра запущена, обновляем таймер и жетоны
  if (gameStarted) {
    const elapsed = currentTime - gameStartTime;
    progressUnits = elapsed / 1000; // прогресс в секундах
    // 1 жетон = 5 секунд
    localUserData.tokens = Math.floor(progressUnits / 5);
    updateTopBar();
    if (elapsed >= gameDuration) {
      gameOver();
      return;
    }
  }
  
  // Обновление фона
  bgX -= obstacleSpeed / 2;
  if (bgX <= -canvasWidth) {
    bgX = 0;
  }
  
  // Физика игрока (обновляем только если игра запущена)
  if (gameStarted) {
    dinoY += velocityY;
    velocityY += gravity * scale;
  
    // Флаг: удалось ли приземлиться на платформу
    let landedOnPlatform = false;
    platforms.forEach(platform => {
      // Проверка горизонтального пересечения
      if (dinoX + playerWidth > platform.x && dinoX < platform.x + platform.width) {
        // Если игрок падает и его нижняя граница касается верхней границы платформы
        if (dinoY + playerHeight >= platform.y && dinoY + playerHeight - velocityY < platform.y) {
          dinoY = platform.y - playerHeight; // ровно над платформой
          velocityY = 0;
          isJumping = false;
          landedOnPlatform = true;
        }
      }
    });
    // Если игрок не приземлился на платформу и достиг базовой земли – это провал
    if (!landedOnPlatform && dinoY >= groundY - playerHeight) {
      dinoY = groundY - playerHeight;
      gameOver();
      return;
    }
  }
  
  frameCount++;
  if (gameStarted && frameCount % 100 === 0) spawnObstacle();
  if (gameStarted && frameCount % 150 === 0) spawnPlatform();
  if (gameStarted && frameCount % 120 === 0) spawnCoin();
  
  obstacles.forEach(obs => { obs.x -= obstacleSpeed; });
  platforms.forEach(plat => { plat.x -= obstacleSpeed; });
  coins.forEach(coin => { coin.x -= obstacleSpeed; });
  
  // Проверка столкновения с шипами: если центральная нижняя точка игрока попадает в треугольник шипа
  const playerCenterX = dinoX + playerWidth / 2;
  const playerBottomY = dinoY + playerHeight;
  obstacles.forEach(obs => {
    const ax = obs.x, ay = obs.y + obs.height;
    const bx = obs.x + obs.width / 2, by = obs.y;
    const cx = obs.x + obs.width, cy = obs.y + obs.height;
    if (pointInTriangle(playerCenterX, playerBottomY, ax, ay, bx, by, cx, cy)) {
      gameOver();
    }
  });
  
  // Проверка подбора монет (прямоугольная коллизия)
  coins = coins.filter(coin => {
    if (
      dinoX < coin.x + coin.width &&
      dinoX + playerWidth > coin.x &&
      dinoY < coin.y + coin.height &&
      dinoY + playerHeight > coin.y
    ) {
      localUserData.tokens = (localUserData.tokens || 0) + 1;
      updateTopBar();
      if (coin.overlay && coin.overlay.parentElement) {
        coin.overlay.parentElement.removeChild(coin.overlay);
      }
      return false;
    }
    return true;
  });
  
  obstacles = obstacles.filter(obs => obs.x + obs.width > 0);
  platforms = platforms.filter(plat => plat.x + plat.width > 0);
  coins = coins.filter(coin => coin.x + coin.width > 0);
  
  updateOverlays();
}

function dinoDraw() {
  const canvasWidth = dinoCtx.canvas.width;
  const canvasHeight = dinoCtx.canvas.height;
  dinoCtx.clearRect(0, 0, canvasWidth, canvasHeight);
  
  // Рисуем фон – только до уровня земли
  if (bgImg.complete) {
    dinoCtx.drawImage(bgImg, bgX, 0, canvasWidth, groundY);
    dinoCtx.drawImage(bgImg, bgX + canvasWidth, 0, canvasWidth, groundY);
  } else {
    dinoCtx.fillStyle = "#87CEEB";
    dinoCtx.fillRect(0, 0, canvasWidth, groundY);
  }
  
  // Если игра ещё не началась, отобразим стартовый экран
  if (!gameStarted) {
    dinoCtx.fillStyle = "white";
    dinoCtx.font = "bold 30px 'Comic Sans MS'";
    dinoCtx.textAlign = "center";
    dinoCtx.fillText("Тап, чтобы старт", canvasWidth / 2, canvasHeight / 2);
    return;
  }
  
  // Рисуем таймер (прогресс-бар) вверху
  drawTimer(dinoCtx, canvasWidth);
  
  // Рисуем платформы: для каждого куба платформы отрисовываем текстуру (если загрузилась) с чёрной обводкой
  platforms.forEach(platform => {
    for (let i = 0; i < platform.blocks; i++) {
      const blockX = platform.x + i * platformBlockSize;
      if (platformImg.complete) {
        dinoCtx.drawImage(platformImg, blockX, platform.y, platformBlockSize, platformHeight);
      } else {
        dinoCtx.fillStyle = "#8B4513";
        dinoCtx.fillRect(blockX, platform.y, platformBlockSize, platformHeight);
      }
      dinoCtx.strokeStyle = "black";
      dinoCtx.lineWidth = 2;
      dinoCtx.strokeRect(blockX, platform.y, platformBlockSize, platformHeight);
    }
  });
  
  // Рисуем шипы как чёрные треугольники
  dinoCtx.fillStyle = 'black';
  obstacles.forEach(obs => {
    dinoCtx.beginPath();
    dinoCtx.moveTo(obs.x, obs.y + obs.height);
    dinoCtx.lineTo(obs.x + obs.width / 2, obs.y);
    dinoCtx.lineTo(obs.x + obs.width, obs.y + obs.height);
    dinoCtx.closePath();
    dinoCtx.fill();
  });
  
  // Рисуем землю – теперь черную
  dinoCtx.fillStyle = '#000000';
  dinoCtx.fillRect(0, groundY, canvasWidth, groundHeight);
  
  // Игрок и монеты отрисовываются через overlay (GIF-анимация)
}

function dinoGameLoop() {
  if (!dinoCtx) return;
  dinoUpdate();
  dinoDraw();
  dinoInterval = requestAnimationFrame(dinoGameLoop);
}
