/* game1.js - Обновлённый Раннер
   - Пропорциональное масштабирование (базовое разрешение 400×600)
   - Анимация персонажа и монет через gifler (проверьте CORS)
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

// Размеры игровых объектов (будут установлены с учётом scale)
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
let obstacleSpeed = 3; // масштабируется в initGame1

// Фоновое изображение
let bgImg = new Image();
bgImg.crossOrigin = "anonymous";
bgImg.src = "https://img.ixbt.site/live/images/original/31/98/97/2023/08/22/13847b747e.jpg";
let bgX = 0;

// GIF для персонажа
let playerImg = new Image();
playerImg.crossOrigin = "anonymous";
playerImg.src = "https://cdn.masto.host/rigczclub/accounts/avatars/000/000/001/original/7a2c1ce45c8f8d02.gif";

// GIF для монеты (новый URL)
let coinImg = new Image();
coinImg.crossOrigin = "anonymous";
coinImg.src = "https://donatepay.ru/uploads/notification/images/830208_1664005822.gif";

// Текстура для платформы
let platformImg = new Image();
platformImg.crossOrigin = "anonymous";
platformImg.src = "wall1.jpg"; // убедитесь, что файл доступен

// Offscreen canvas для анимации через gifler
let playerAnimCanvas, playerAnimCtx, playerAnimReady = false;
let coinAnimCanvas, coinAnimCtx, coinAnimReady = false;

function initGame1() {
  const canvas = document.getElementById('gameCanvas');
  dinoCtx = canvas.getContext('2d');
  canvas.style.display = 'block';
  
  const canvasWidth = canvas.width;
  const canvasHeight = canvas.height;
  
  // Расчёт масштаба относительно базового разрешения
  scale = canvasWidth / baseWidth;
  
  // Устанавливаем размеры объектов с учётом масштаба
  playerWidth    = 60 * scale;
  playerHeight   = 60 * scale;
  obstacleWidth  = 20 * scale;
  obstacleHeight = 25 * scale; // немного увеличили высоту шипов
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
  coins = [];
  frameCount = 0;
  obstacleSpeed = 3 * scale;
  bgX = 0;
  
  window.addEventListener('keydown', handleDinoKeyDown);
  canvas.addEventListener('click', handleDinoJump);
  
  // Загружаем анимацию персонажа через gifler
  if (!playerAnimCanvas) {
    playerAnimCanvas = document.createElement('canvas');
    playerAnimCanvas.width = playerWidth;
    playerAnimCanvas.height = playerHeight;
    playerAnimCtx = playerAnimCanvas.getContext('2d');
    gifler(playerImg.src).get(function(anim) {
      anim.onDraw = function(ctx) {
        playerAnimCtx.clearRect(0, 0, playerWidth, playerHeight);
        playerAnimCtx.drawImage(ctx.canvas, 0, 0, playerWidth, playerHeight);
        playerAnimReady = true;
      };
      anim.onError = function(err) {
        console.error("Ошибка загрузки GIF персонажа:", err);
      };
      anim.play();
    });
  }
  
  // Загружаем анимацию монеты через gifler
  if (!coinAnimCanvas) {
    coinAnimCanvas = document.createElement('canvas');
    coinAnimCanvas.width = coinWidth;
    coinAnimCanvas.height = coinHeight;
    coinAnimCtx = coinAnimCanvas.getContext('2d');
    gifler(coinImg.src).get(function(anim) {
      anim.onDraw = function(ctx) {
        coinAnimCtx.clearRect(0, 0, coinWidth, coinHeight);
        coinAnimCtx.drawImage(ctx.canvas, 0, 0, coinWidth, coinHeight);
        coinAnimReady = true;
      };
      anim.onError = function(err) {
        console.error("Ошибка загрузки GIF монеты:", err);
      };
      anim.play();
    });
  }
  
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
    velocityY = -12 * scale; // увеличенная сила прыжка
    isJumping = true;
  }
}

// Функция для проверки, находится ли точка внутри треугольника
function pointInTriangle(px, py, ax, ay, bx, by, cx, cy) {
  const areaOrig = Math.abs((bx - ax) * (cy - ay) - (cx - ax) * (by - ay));
  const area1 = Math.abs((ax - px) * (by - py) - (bx - px) * (ay - py));
  const area2 = Math.abs((bx - px) * (cy - py) - (cx - px) * (by - py));
  const area3 = Math.abs((cx - px) * (ay - py) - (ax - px) * (cy - py));
  return Math.abs(area1 + area2 + area3 - areaOrig) < 0.1;
}

// Спавн шипа (обstacle) — появляется только если в этом месте нет платформы
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

// Спавн платформы: платформа состоит из 1–3 блоков
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

// Спавн монеты
function spawnCoin() {
  const offset = (50 + Math.random() * 100) * scale;
  coins.push({
    x: dinoCtx.canvas.width,
    y: groundY - coinHeight - offset,
    width: coinWidth,
    height: coinHeight,
    type: 'coin'
  });
}

function dinoUpdate() {
  const canvasWidth = dinoCtx.canvas.width;
  
  // Обновляем фон
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
  
  obstacles.forEach(obs => { obs.x -= obstacleSpeed; });
  platforms.forEach(plat => { plat.x -= obstacleSpeed; });
  coins.forEach(coin => { coin.x -= obstacleSpeed; });
  
  localUserData.points++;
  updateTopBar();
  
  // Столкновение с шипами: проверяем, попадает ли нижняя центральная точка игрока в треугольник
  const playerCenterX = dinoX + playerWidth / 2;
  const playerBottomY = dinoY + playerHeight;
  obstacles.forEach(obs => {
    const ax = obs.x;
    const ay = obs.y + obs.height;
    const bx = obs.x + obs.width / 2;
    const by = obs.y;
    const cx = obs.x + obs.width;
    const cy = obs.y + obs.height;
    if (pointInTriangle(playerCenterX, playerBottomY, ax, ay, bx, by, cx, cy)) {
      showEndGameModal(
        'Игра окончена',
        `Вы врезались в препятствие!\nНабрано очков: ${localUserData.points}`
      );
      resetGame1();
    }
  });
  
  // Подбор монет (простой прямоугольный коллиз)
  coins = coins.filter(coin => {
    if (
      dinoX < coin.x + coin.width &&
      dinoX + playerWidth > coin.x &&
      dinoY < coin.y + coin.height &&
      dinoY + playerHeight > coin.y
    ) {
      localUserData.coins = (localUserData.coins || 0) + 1;
      updateTopBar();
      return false;
    }
    return true;
  });
  
  obstacles = obstacles.filter(obs => obs.x + obs.width > 0);
  platforms = platforms.filter(plat => plat.x + plat.width > 0);
  coins = coins.filter(coin => coin.x + coin.width > 0);
}

function dinoDraw() {
  const canvasWidth = dinoCtx.canvas.width;
  const canvasHeight = dinoCtx.canvas.height;
  dinoCtx.clearRect(0, 0, canvasWidth, canvasHeight);
  
  // Рисуем фон (две копии для плавного цикла)
  dinoCtx.drawImage(bgImg, bgX, 0, canvasWidth, canvasHeight);
  dinoCtx.drawImage(bgImg, bgX + canvasWidth, 0, canvasWidth, canvasHeight);
  
  // Рисуем платформы: по каждому блоку платформы отрисовываем текстуру
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
  
  // Рисуем монеты (с анимацией, если готовы)
  coins.forEach(coin => {
    if (coinAnimReady) {
      dinoCtx.drawImage(coinAnimCanvas, coin.x, coin.y, coin.width, coin.height);
    } else {
      dinoCtx.fillStyle = 'yellow';
      dinoCtx.beginPath();
      dinoCtx.arc(coin.x + coin.width/2, coin.y + coin.height/2, coin.width/2, 0, Math.PI * 2);
      dinoCtx.fill();
    }
  });
  
  // Рисуем игрока (если анимация готова, отрисовываем её, иначе пробуем сам Image)
  if (playerAnimReady) {
    dinoCtx.drawImage(playerAnimCanvas, dinoX, dinoY, playerWidth, playerHeight);
  } else if (playerImg.complete) {
    dinoCtx.drawImage(playerImg, dinoX, dinoY, playerWidth, playerHeight);
  } else {
    dinoCtx.fillStyle = '#00FF00';
    dinoCtx.fillRect(dinoX, dinoY, playerWidth, playerHeight);
  }
  
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
