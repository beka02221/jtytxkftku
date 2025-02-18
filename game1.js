/* game1.js - Обновлённый Раннер
   - Пропорциональное масштабирование (базовое разрешение 400×600)
   - Анимация персонажа и монет реализована через HTML overlay элементы (работает в Telegram Web App)
   - Платформы с текстурой (wall1.jpg), состоящие из 1–3 блоков
   - Шипы (obstacles) отрисовываются как чёрные треугольники, спавнятся только вне платформ
   - Увеличена сила прыжка
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
let platformBlockSize; // размер одного блока платформы

// Параметры игрока
let dinoX = 50;
let dinoY = 0; // установится в initGame1
let velocityY = 0;
const gravity = 0.5;
let isJumping = false;

// Массивы игровых объектов
let obstacles = [];   // шипы (obstacles)
let platforms = [];   // платформы (состоящие из блоков)
let coins = [];       // монеты для подбора
let frameCount = 0;
let obstacleSpeed = 3; // будет масштабироваться в initGame1

// Фоновое изображение
let bgImg = new Image();
bgImg.crossOrigin = "anonymous";
bgImg.src = "https://cdnb.artstation.com/p/assets/images/images/029/816/375/medium/jakub-wulkowicz-post69-3.jpg?1598728411";
let bgX = 0;

// GIF для персонажа
let playerImg = new Image();
playerImg.crossOrigin = "anonymous";
playerImg.src = "https://cdn.masto.host/rigczclub/accounts/avatars/000/000/001/original/7a2c1ce45c8f8d02.gif";

// GIF для монеты (новый URL)
let coinImg = new Image();
coinImg.crossOrigin = "anonymous";
coinImg.src = "https://donatepay.ru/uploads/notification/images/830208_1664005822.gif";

// Текстура для платформы (wall1.jpg, размер 300×300)
let platformImg = new Image();
platformImg.crossOrigin = "anonymous";
platformImg.src = "wall1.jpg";

// --- Overlay элементы для анимации ---
// Для игрока – один overlay-элемент
let playerOverlay;

// Для монет будем хранить их overlay внутри объекта монеты (свойство overlay)
// (overlay создаётся при спавне монеты)

// Функция для обновления позиций overlay элементов (игрока и монет)
function updateOverlays() {
  // Предполагаем, что canvas и overlay'ы находятся в одном контейнере с одинаковой системой координат
  playerOverlay.style.left = dinoX + "px";
  playerOverlay.style.top = dinoY + "px";
  coins.forEach(coin => {
    if (coin.overlay) {
      coin.overlay.style.left = coin.x + "px";
      coin.overlay.style.top = coin.y + "px";
    }
  });
}

function initGame1() {
  const canvas = document.getElementById('gameCanvas');
  dinoCtx = canvas.getContext('2d');
  canvas.style.display = 'block';
  
  // Обеспечим, чтобы родительский контейнер имел position: relative
  let container = canvas.parentElement;
  if (getComputedStyle(container).position === "static") {
    container.style.position = "relative";
  }
  
  const canvasWidth = canvas.width;
  const canvasHeight = canvas.height;
  
  // Расчёт масштаба относительно базового разрешения
  scale = canvasWidth / baseWidth;
  
  // Устанавливаем размеры объектов с учётом масштаба
  playerWidth    = 60 * scale;
  playerHeight   = 60 * scale;
  obstacleWidth  = 20 * scale;
  obstacleHeight = 25 * scale; // шипы немного выше
  platformHeight = playerHeight; // высота платформы равна высоте игрока
  coinWidth      = 30 * scale;
  coinHeight     = 30 * scale;
  groundHeight   = 10 * scale;
  groundY        = canvasHeight - groundHeight;
  platformBlockSize = playerHeight; // каждый блок платформы — квадрат размера игрока
  
  // Начальное положение игрока (на земле)
  dinoX = 50 * scale;
  dinoY = groundY - playerHeight;
  velocityY = 0;
  isJumping = false;
  
  // Сброс игровых объектов
  obstacles = [];
  platforms = [];
  // Если остались overlay монет от предыдущей игры – удалим их
  coins.forEach(coin => {
    if (coin.overlay && coin.overlay.parentElement) {
      coin.overlay.parentElement.removeChild(coin.overlay);
    }
  });
  coins = [];
  
  frameCount = 0;
  obstacleSpeed = 3 * scale;
  bgX = 0;
  
  // Создаём overlay для игрока, если он ещё не создан
  if (!playerOverlay) {
    playerOverlay = document.createElement("img");
    playerOverlay.src = playerImg.src;
    playerOverlay.style.position = "absolute";
    playerOverlay.style.width = playerWidth + "px";
    playerOverlay.style.height = playerHeight + "px";
    playerOverlay.style.pointerEvents = "none";
    container.appendChild(playerOverlay);
  } else {
    // Обновим размеры overlay, если игра перезапускается
    playerOverlay.style.width = playerWidth + "px";
    playerOverlay.style.height = playerHeight + "px";
  }
  
  // Добавляем обработчики событий
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
  
  // Удаляем overlay монет
  coins.forEach(coin => {
    if (coin.overlay && coin.overlay.parentElement) {
      coin.overlay.parentElement.removeChild(coin.overlay);
    }
  });
  coins = [];
  // (playerOverlay можно оставить для повторных запусков)
}

function handleDinoKeyDown(e) {
  if (e.code === 'Space') {
    handleDinoJump();
  }
}
function handleDinoJump() {
  if (!isJumping) {
    velocityY = -12 * scale; // увеличенная сила прыжка
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

// Спавн шипа (obstacle) – появляется только если в этом месте нет платформы
function spawnObstacle() {
  let spawnX = dinoCtx.canvas.width;
  let overlap = platforms.some(plat => {
    return (plat.x < spawnX + obstacleWidth && plat.x + plat.width > spawnX);
  });
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

// Спавн платформы: платформа состоит из 1–3 блоков (блок — квадрат размера игрока)
function spawnPlatform() {
  const blocksCount = Math.floor(Math.random() * 3) + 1; // от 1 до 3 блоков
  const platformWidth = blocksCount * platformBlockSize;
  platforms.push({
    x: dinoCtx.canvas.width,
    y: groundY - platformHeight,
    width: platformWidth,
    height: platformHeight,
    blocks: blocksCount
  });
}

// Спавн монеты: при спавне создаётся overlay-элемент для анимации
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
  // Создаём overlay для монеты
  let coinOverlay = document.createElement("img");
  coinOverlay.src = coinImg.src;
  coinOverlay.style.position = "absolute";
  coinOverlay.style.width = coinWidth + "px";
  coinOverlay.style.height = coinHeight + "px";
  coinOverlay.style.pointerEvents = "none";
  // Добавляем overlay в тот же контейнер, что и canvas
  let container = dinoCtx.canvas.parentElement;
  container.appendChild(coinOverlay);
  coin.overlay = coinOverlay;
  coins.push(coin);
}

function dinoUpdate() {
  const canvasWidth = dinoCtx.canvas.width;
  
  // Обновление фона
  bgX -= obstacleSpeed / 2;
  if (bgX <= -canvasWidth) {
    bgX = 0;
  }
  
  // Физика игрока
  dinoY += velocityY;
  velocityY += gravity * scale;
  if (dinoY >= groundY - playerHeight) {
    dinoY = groundY - playerHeight;
    isJumping = false;
    velocityY = 0;
  }
  
  // Проверка столкновения с платформами (если игрок падает)
  if (velocityY >= 0) {
    platforms.forEach(platform => {
      if (
        dinoX + playerWidth > platform.x &&
        dinoX < platform.x + platform.width
      ) {
        if (dinoY + playerHeight >= platform.y && dinoY + playerHeight - velocityY < platform.y) {
          dinoY = platform.y - playerHeight;
          velocityY = 0;
          isJumping = false;
        }
      }
    });
  }
  
  frameCount++;
  if (frameCount % 100 === 0) {
    spawnObstacle();
  }
  if (frameCount % 150 === 0) {
    spawnPlatform();
  }
  if (frameCount % 120 === 0) {
    spawnCoin();
  }
  
  // Сдвиг объектов влево
  obstacles.forEach(obs => { obs.x -= obstacleSpeed; });
  platforms.forEach(plat => { plat.x -= obstacleSpeed; });
  coins.forEach(coin => { coin.x -= obstacleSpeed; });
  
  // Увеличение очков (1 очко за кадр)
  localUserData.points++;
  updateTopBar();
  
  // Проверка столкновения с шипами: если нижняя центральная точка игрока попадает в треугольник
  const playerCenterX = dinoX + playerWidth / 2;
  const playerBottomY = dinoY + playerHeight;
  obstacles.forEach(obs => {
    const ax = obs.x, ay = obs.y + obs.height;
    const bx = obs.x + obs.width / 2, by = obs.y;
    const cx = obs.x + obs.width, cy = obs.y + obs.height;
    if (pointInTriangle(playerCenterX, playerBottomY, ax, ay, bx, by, cx, cy)) {
      showEndGameModal(
        'Игра окончена',
        `Вы врезались в препятствие!\nНабрано очков: ${localUserData.points}`
      );
      resetGame1();
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
      localUserData.coins = (localUserData.coins || 0) + 1;
      updateTopBar();
      if (coin.overlay && coin.overlay.parentElement) {
        coin.overlay.parentElement.removeChild(coin.overlay);
      }
      return false;
    }
    return true;
  });
  
  // Удаляем вышедшие за левую границу объекты
  obstacles = obstacles.filter(obs => obs.x + obs.width > 0);
  platforms = platforms.filter(plat => plat.x + plat.width > 0);
  coins = coins.filter(coin => coin.x + coin.width > 0);
  
  // Обновляем позиции overlay элементов (игрока и монет)
  updateOverlays();
}

function dinoDraw() {
  const canvasWidth = dinoCtx.canvas.width;
  const canvasHeight = dinoCtx.canvas.height;
  dinoCtx.clearRect(0, 0, canvasWidth, canvasHeight);
  
  // Рисуем фон (две копии для плавного цикла)
  dinoCtx.drawImage(bgImg, bgX, 0, canvasWidth, canvasHeight);
  dinoCtx.drawImage(bgImg, bgX + canvasWidth, 0, canvasWidth, canvasHeight);
  
  // Рисуем платформы: для каждого блока платформы отрисовываем текстуру
  platforms.forEach(platform => {
    for (let i = 0; i < platform.blocks; i++) {
      dinoCtx.drawImage(
        platformImg,
        platform.x + i * platformBlockSize,
        platform.y,
        platformBlockSize,
        platformHeight
      );
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
  
  // Игрок и монеты не отрисовываются на canvas – их анимация осуществляется через overlay элементы
  
  // Рисуем землю
  dinoCtx.fillStyle = '#555';
  dinoCtx.fillRect(0, groundY, canvasWidth, groundHeight);
}

function dinoGameLoop() {
  if (!dinoCtx) return;
  dinoUpdate();
  dinoDraw();
  dinoInterval = requestAnimationFrame(dinoGameLoop);
}

