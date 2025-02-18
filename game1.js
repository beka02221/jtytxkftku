/* game1.js - Раннер с динозавром (обновленный)
   Изменения:
   - Использование полного размера canvas (вертикальный режим)
   - Увеличенный игрок (60×60)
   - Анимированные гифки для игрока и монет через gifler
   - Платформы генерируются на уровне земли (как блоки)
   - Deadly obstacles отрисовываются в виде треугольников
   - Добавлены монеты, которые можно собирать
*/

let dinoInterval = null;
let dinoCtx = null;

// Глобальные параметры (будут заданы в initGame1 после получения canvas)
let canvasWidth, canvasHeight, groundY;

// Параметры игрока
const playerWidth = 60;
const playerHeight = 60;
let dinoX = 50;
let dinoY = 0; // установится в initGame1
let velocityY = 0;
const gravity = 0.5;
let isJumping = false;

// Объекты игры
let obstacles = [];   // deadly obstacles (отрисовываются как треугольники)
let platforms = [];   // платформы (блоки, выходящие из земли)
let coins = [];       // монеты для подбора
let obstacleSpeed = 3;
let frameCount = 0;

// Движущийся фон
let bgImg = new Image();
bgImg.src = "https://img.ixbt.site/live/images/original/31/98/97/2023/08/22/13847b747e.jpg"; // Замените на нужный URL
let bgX = 0;

// Гифки (как Image – используются только для получения URL)
let playerImg = new Image();
playerImg.src = "https://images.gaming-legion.net/products/spoofing/features/autowalk2.gif"; // URL гифки игрока
let coinImg = new Image();
coinImg.src = "https://media.tenor.com/4oO9Ztxk2sEAAAAd/coin-spin-coin.gif"; // URL гифки монеты

// Offscreen canvas для анимации (с помощью gifler)
let playerAnimCanvas, playerAnimCtx, playerAnimReady = false;
let coinAnimCanvas, coinAnimCtx, coinAnimReady = false;

// Размеры объектов (константы)
const obstacleWidth = 20, obstacleHeight = 20; // для deadly obstacles (треугольник)
const platformHeight = 10; // высота платформы
const coinWidth = 30, coinHeight = 30; // размеры монеты

function initGame1() {
  const canvas = document.getElementById('gameCanvas');
  dinoCtx = canvas.getContext('2d');
  canvas.style.display = 'block';
  
  // Получаем размеры canvas
  canvasWidth = canvas.width;
  canvasHeight = canvas.height;
  groundY = canvasHeight - 10; // «земля» – нижняя полоса высотой 10 пикселей

  // Устанавливаем начальное положение игрока (на земле)
  dinoX = 50;
  dinoY = groundY - playerHeight;
  velocityY = 0;
  isJumping = false;
  
  // Сброс игровых объектов
  obstacles = [];
  platforms = [];
  coins = [];
  obstacleSpeed = 3;
  frameCount = 0;
  bgX = 0;

  // Добавляем обработчики событий
  window.addEventListener('keydown', handleDinoKeyDown);
  canvas.addEventListener('click', handleDinoJump);

  // Загружаем анимацию игрока (gifler)
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
  
  // Загружаем анимацию монеты (gifler)
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
    velocityY = -10;
    isJumping = true;
  }
}

// Функция для создания deadly obstacles (отрисовываются как треугольники)
function spawnObstacle() {
  obstacles.push({
    x: canvasWidth,
    y: groundY - obstacleHeight, // чтобы треугольник «стоял» на земле
    width: obstacleWidth,
    height: obstacleHeight,
    type: 'deadly'
  });
}

// Функция для создания платформ (блоки, на уровне земли)
function spawnPlatform() {
  let platformWidth = 50 + Math.random() * 50; // от 50 до 100
  platforms.push({
    x: canvasWidth,
    y: groundY - platformHeight, // платформа прилегает к земле
    width: platformWidth,
    height: platformHeight,
    type: 'platform'
  });
}

// Функция для создания монеты
function spawnCoin() {
  // Монета появляется на случайной высоте над землей (от 50 до 150 пикселей над платформой)
  let offset = 50 + Math.random() * 100;
  coins.push({
    x: canvasWidth,
    y: groundY - coinHeight - offset,
    width: coinWidth,
    height: coinHeight,
    type: 'coin'
  });
}

function dinoUpdate() {
  // Обновляем положение фона (движется медленнее, чем объекты)
  bgX -= obstacleSpeed / 2;
  if (bgX <= -canvasWidth) {
    bgX = 0;
  }

  // Физика игрока
  dinoY += velocityY;
  velocityY += gravity;
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
        // Если нижняя часть игрока пересекает верх платформы (и игрок был выше)
        if (dinoY + playerHeight >= platform.y && dinoY + playerHeight - velocityY < platform.y) {
          dinoY = platform.y - playerHeight;
          velocityY = 0;
          isJumping = false;
        }
      }
    });
  }

  frameCount++;
  // Каждые 100 кадров – новое deadly obstacle
  if (frameCount % 100 === 0) {
    spawnObstacle();
  }
  // Каждые 150 кадров – новая платформа
  if (frameCount % 150 === 0) {
    spawnPlatform();
  }
  // Каждые 120 кадров – новая монета
  if (frameCount % 120 === 0) {
    spawnCoin();
  }

  // Двигаем объекты влево
  obstacles.forEach(obs => { obs.x -= obstacleSpeed; });
  platforms.forEach(plat => { plat.x -= obstacleSpeed; });
  coins.forEach(coin => { coin.x -= obstacleSpeed; });

  // Увеличиваем очки (1 очко за кадр)
  localUserData.points++;
  updateTopBar();

  // Проверка столкновения с deadly obstacles (треугольниками)
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

  // Проверка столкновения с монетами (подбор)
  coins = coins.filter(coin => {
    if (
      dinoX < coin.x + coin.width &&
      dinoX + playerWidth > coin.x &&
      dinoY < coin.y + coin.height &&
      dinoY + playerHeight > coin.y
    ) {
      // Подобрана монета
      localUserData.coins = (localUserData.coins || 0) + 1;
      updateTopBar();
      return false; // удалить монету
    }
    return true;
  });

  // Удаляем вышедшие за левую границу объекты
  obstacles = obstacles.filter(obs => obs.x + obs.width > 0);
  platforms = platforms.filter(plat => plat.x + plat.width > 0);
  coins = coins.filter(coin => coin.x + coin.width > 0);
}

function dinoDraw() {
  if (!dinoCtx) return;
  dinoCtx.clearRect(0, 0, canvasWidth, canvasHeight);

  // Рисуем движущийся фон (две копии для плавного цикла)
  dinoCtx.drawImage(bgImg, bgX, 0, canvasWidth, canvasHeight);
  dinoCtx.drawImage(bgImg, bgX + canvasWidth, 0, canvasWidth, canvasHeight);

  // Рисуем платформы (коричневые блоки)
  dinoCtx.fillStyle = '#8B4513';
  platforms.forEach(plat => {
    dinoCtx.fillRect(plat.x, plat.y, plat.width, plat.height);
  });

  // Рисуем deadly obstacles как треугольники
  dinoCtx.fillStyle = 'red';
  obstacles.forEach(obs => {
    dinoCtx.beginPath();
    dinoCtx.moveTo(obs.x, obs.y + obs.height);            // левая нижняя точка
    dinoCtx.lineTo(obs.x + obs.width / 2, obs.y);           // верхняя (середина)
    dinoCtx.lineTo(obs.x + obs.width, obs.y + obs.height);  // правая нижняя точка
    dinoCtx.closePath();
    dinoCtx.fill();
  });

  // Рисуем монеты (с анимацией, если готовы)
  coins.forEach(coin => {
    if (coinAnimReady) {
      dinoCtx.drawImage(coinAnimCanvas, coin.x, coin.y, coin.width, coin.height);
    } else {
      // Фолбэк – желтый круг
      dinoCtx.fillStyle = 'yellow';
      dinoCtx.beginPath();
      dinoCtx.arc(coin.x + coin.width/2, coin.y + coin.height/2, coin.width/2, 0, Math.PI*2);
      dinoCtx.fill();
    }
  });

  // Рисуем игрока (с анимацией, если готов)
  if (playerAnimReady) {
    dinoCtx.drawImage(playerAnimCanvas, dinoX, dinoY, playerWidth, playerHeight);
  } else {
    dinoCtx.fillStyle = '#00FF00';
    dinoCtx.fillRect(dinoX, dinoY, playerWidth, playerHeight);
  }

  // Рисуем землю
  dinoCtx.fillStyle = '#555';
  dinoCtx.fillRect(0, groundY, canvasWidth, 10);
}

function dinoGameLoop() {
  if (!dinoCtx) return; 
  dinoUpdate();
  dinoDraw();
  dinoInterval = requestAnimationFrame(dinoGameLoop);
}

