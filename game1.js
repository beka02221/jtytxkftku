/* game1.js - Раннер с динозавром (обновленный)
   - Все объекты масштабируются пропорционально базовому разрешению (400×600)
   - Добавлена настройка crossOrigin для корректной загрузки GIF
   - Если гиф не готов, отображается fallback (серый прямоугольник)
*/

let dinoInterval = null;
let dinoCtx = null;

// Базовое разрешение для расчета пропорций
const baseWidth = 400;
const baseHeight = 600;
let scale = 1; // будет рассчитан в initGame1

// Параметры, зависящие от масштаба (будут установлены в initGame1)
let playerWidth, playerHeight;
let obstacleWidth, obstacleHeight;
let platformHeight;
let coinWidth, coinHeight;
let groundHeight;
let groundY;

// Параметры игрока
let dinoX = 50;
let dinoY = 0; // установится в initGame1
let velocityY = 0;
const gravity = 0.5;
let isJumping = false;

// Объекты игры
let obstacles = [];   // deadly obstacles (отрисовываются как треугольники)
let platforms = [];   // платформы (блоки, выступающие из земли)
let coins = [];       // монеты для подбора
let obstacleSpeed = 3;
let frameCount = 0;

// Движущийся фон
let bgImg = new Image();
bgImg.crossOrigin = "anonymous";
bgImg.src = "https://img.ixbt.site/live/images/original/31/98/97/2023/08/22/13847b747e.jpg"; // замените на нужный URL
let bgX = 0;

// Гифки для игрока и монет
let playerImg = new Image();
playerImg.crossOrigin = "anonymous";
playerImg.src = "https://images.gaming-legion.net/products/spoofing/features/autowalk2.gif"; // URL гифки игрока

let coinImg = new Image();
coinImg.crossOrigin = "anonymous";
coinImg.src = "https://media.tenor.com/4oO9Ztxk2sEAAAAd/coin-spin-coin.gif"; // URL гифки монеты

// Offscreen canvas для анимации (с помощью gifler)
let playerAnimCanvas, playerAnimCtx, playerAnimReady = false;
let coinAnimCanvas, coinAnimCtx, coinAnimReady = false;

function initGame1() {
  const canvas = document.getElementById('gameCanvas');
  dinoCtx = canvas.getContext('2d');
  canvas.style.display = 'block';
  
  // Получаем размеры canvas
  const canvasWidth = canvas.width;
  const canvasHeight = canvas.height;
  
  // Расчет масштаба относительно базового разрешения
  scale = canvasWidth / baseWidth;
  
  // Устанавливаем размеры объектов с учетом масштаба
  playerWidth    = 60 * scale;
  playerHeight   = 60 * scale;
  obstacleWidth  = 20 * scale;
  obstacleHeight = 20 * scale;
  platformHeight = 10 * scale;
  coinWidth      = 30 * scale;
  coinHeight     = 30 * scale;
  groundHeight   = 10 * scale;
  groundY        = canvasHeight - groundHeight;
  
  // Начальное положение игрока (на земле)
  dinoX = 50 * scale;
  dinoY = groundY - playerHeight;
  velocityY = 0;
  isJumping = false;
  
  // Сброс игровых объектов
  obstacles = [];
  platforms = [];
  coins = [];
  obstacleSpeed = 3 * scale; // скорость тоже масштабируем
  frameCount = 0;
  bgX = 0;
  
  // Добавляем обработчики событий
  window.addEventListener('keydown', handleDinoKeyDown);
  canvas.addEventListener('click', handleDinoJump);

  // Загружаем анимацию игрока через gifler
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
    velocityY = -10 * scale;
    isJumping = true;
  }
}

// Создаем deadly obstacle (отрисовывается как треугольник)
function spawnObstacle() {
  obstacles.push({
    x: dinoCtx.canvas.width,
    y: groundY - obstacleHeight,
    width: obstacleWidth,
    height: obstacleHeight,
    type: 'deadly'
  });
}

// Создаем платформу (блок на уровне земли)
function spawnPlatform() {
  const platformWidth = (50 + Math.random() * 50) * scale;
  platforms.push({
    x: dinoCtx.canvas.width,
    y: groundY - platformHeight,
    width: platformWidth,
    height: platformHeight,
    type: 'platform'
  });
}

// Создаем монету
function spawnCoin() {
  // Монета появляется на случайной высоте над землей (от 50 до 150 базовых единиц)
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
  // Спавним объекты через определенные интервалы (с учетом FPS)
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
  
  // Столкновение с deadly obstacles (треугольники)
  obstacles.forEach(obs => {
    if (
      dinoX < obs.x + obs.width &&
      dinoX + playerWidth > obs.x &&
      dinoY < obs.y + obs.height &&
      dinoY + playerHeight > obs.y
    ) {
      showEndGameModal(
        'Игра окончена',
        `Вы врезались в препятствие!\nНабрано очков: ${localUserData.points}`
      );
      resetGame1();
    }
  });
  
  // Подбор монет
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
  
  // Удаляем вышедшие объекты
  obstacles = obstacles.filter(obs => obs.x + obs.width > 0);
  platforms = platforms.filter(plat => plat.x + plat.width > 0);
  coins = coins.filter(coin => coin.x + coin.width > 0);
}

function dinoDraw() {
  const canvasWidth = dinoCtx.canvas.width;
  const canvasHeight = dinoCtx.canvas.height;
  dinoCtx.clearRect(0, 0, canvasWidth, canvasHeight);
  
  // Фон (две копии для плавного цикла)
  dinoCtx.drawImage(bgImg, bgX, 0, canvasWidth, canvasHeight);
  dinoCtx.drawImage(bgImg, bgX + canvasWidth, 0, canvasWidth, canvasHeight);
  
  // Платформы (коричневые блоки)
  dinoCtx.fillStyle = '#8B4513';
  platforms.forEach(plat => {
    dinoCtx.fillRect(plat.x, plat.y, plat.width, plat.height);
  });
  
  // Deadly obstacles – треугольники
  dinoCtx.fillStyle = 'red';
  obstacles.forEach(obs => {
    dinoCtx.beginPath();
    dinoCtx.moveTo(obs.x, obs.y + obs.height);
    dinoCtx.lineTo(obs.x + obs.width / 2, obs.y);
    dinoCtx.lineTo(obs.x + obs.width, obs.y + obs.height);
    dinoCtx.closePath();
    dinoCtx.fill();
  });
  
  // Монеты (с анимацией, если готовы)
  coins.forEach(coin => {
    if (coinAnimReady) {
      dinoCtx.drawImage(coinAnimCanvas, coin.x, coin.y, coin.width, coin.height);
    } else {
      dinoCtx.fillStyle = 'yellow';
      dinoCtx.beginPath();
      dinoCtx.arc(coin.x + coin.width/2, coin.y + coin.height/2, coin.width/2, 0, Math.PI*2);
      dinoCtx.fill();
    }
  });
  
  // Игрок (с анимацией, если готов)
  if (playerAnimReady) {
    dinoCtx.drawImage(playerAnimCanvas, dinoX, dinoY, playerWidth, playerHeight);
  } else {
    dinoCtx.fillStyle = '#00FF00';
    dinoCtx.fillRect(dinoX, dinoY, playerWidth, playerHeight);
  }
  
  // Земля
  dinoCtx.fillStyle = '#555';
  dinoCtx.fillRect(0, groundY, canvasWidth, groundHeight);
}

function dinoGameLoop() {
  if (!dinoCtx) return;
  dinoUpdate();
  dinoDraw();
  dinoInterval = requestAnimationFrame(dinoGameLoop);
}
