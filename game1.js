/* game1.js - Улучшенный бесконечный уровень в стиле Geometry Dash
 *
 * Геймплей:
 * - 5-минутный таймер (ползунок, заполняется от низа до верха)
 * - В начале игры оверлей "Тап, чтобы старт" с уникальным шрифтом
 * - Прогресс отслеживается по жетонам: 1 монета = 5 прогресс-единиц.
 *   Прогресс отображается в UI и сохраняется в БД только по окончании игры.
 *
 * Оформление:
 * - Земля рисуется черной.
 * - Все объекты (земля, шипы, платформы, монеты, персонаж) располагаются над землей.
 */

let dinoInterval = null;
let dinoCtx = null;

// Флаг, показывающий, что игра ещё не стартовала
let gameStarted = false;

// Таймер игры (5 минут = 300000 мс)
const totalGameTime = 300000;
let gameStartTime = null;

// Базовое разрешение (для расчёта масштабирования)
const baseWidth = 400;
const baseHeight = 600;
let scale = 1; // рассчитывается в initGame1

// Размеры игровых объектов (рассчитываются в initGame1)
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

// Массивы игровых объектов
let obstacles = [];   // шипы
let platforms = [];   // платформы (набор кубов)
let coins = [];       // монеты (каждая монета = 5 прогресс-единиц)
let frameCount = 0;
let obstacleSpeed = 3; // масштабируется в initGame1

// Фон
let bgImg = new Image();
bgImg.crossOrigin = "anonymous";
bgImg.src = "https://img.ixbt.site/live/images/original/31/98/97/2023/08/22/13847b747e.jpg";
let bgX = 0;

// GIF для персонажа
let playerImg = new Image();
playerImg.crossOrigin = "anonymous";
playerImg.src = "https://cdn.masto.host/rigczclub/accounts/avatars/000/000/001/original/7a2c1ce45c8f8d02.gif";

// GIF для монеты
let coinImg = new Image();
coinImg.crossOrigin = "anonymous";
coinImg.src = "https://donatepay.ru/uploads/notification/images/830208_1664005822.gif";

// Текстура для платформ (wall1.jpg, размер 300×300)
let platformImg = new Image();
platformImg.crossOrigin = "anonymous";
platformImg.src = "wall1.jpg";

// --- Оверлеи для анимации и UI ---
// Оверлей для персонажа (GIF, нативная анимация)
let playerOverlay;
// Оверлеи для монет создаются при спавне каждой монеты

// Оверлей для стартового экрана
let startOverlay;
// Таймер-ползунок (vertical slider)
let timerSlider;
// Элемент для отображения прогресса (User Info)
let userProgress;

// Функция для создания оверлей-элементов, если они не существуют
function createOverlayElements() {
  const container = document.getElementById('gameContainer') || document.body;
  // Если нет элемента для стартового экрана, создадим его
  if (!startOverlay) {
    startOverlay = document.createElement("div");
    startOverlay.innerText = "Тап, чтобы старт";
    startOverlay.style.position = "absolute";
    startOverlay.style.top = "50%";
    startOverlay.style.left = "50%";
    startOverlay.style.transform = "translate(-50%, -50%)";
    startOverlay.style.fontFamily = "'Comic Sans MS', cursive, sans-serif"; // пример уникального шрифта
    startOverlay.style.fontSize = "36px";
    startOverlay.style.color = "#ffffff";
    startOverlay.style.textShadow = "2px 2px 4px #000";
    startOverlay.style.pointerEvents = "none";
    startOverlay.style.zIndex = "10";
    container.appendChild(startOverlay);
  }
  // Таймер-ползунок (отображается справа)
  if (!timerSlider) {
    timerSlider = document.createElement("div");
    timerSlider.style.position = "absolute";
    timerSlider.style.right = "10px";
    timerSlider.style.top = "10px";
    timerSlider.style.width = "20px";
    timerSlider.style.height = "0%"; // изначально пустой
    timerSlider.style.backgroundColor = "#f2b826";
    timerSlider.style.zIndex = "10";
    container.appendChild(timerSlider);
  }
  // Элемент для отображения прогресса (User Info)
  if (!userProgress) {
    userProgress = document.createElement("div");
    userProgress.style.position = "absolute";
    userProgress.style.left = "10px";
    userProgress.style.top = "10px";
    userProgress.style.fontFamily = "Arial, sans-serif";
    userProgress.style.fontSize = "24px";
    userProgress.style.color = "#ffffff";
    userProgress.style.zIndex = "10";
    container.appendChild(userProgress);
  }
  updateUserProgress();
}

// Функция обновления UI прогресса (1 монета = 5 единиц прогресса)
function updateUserProgress() {
  let progressUnits = (localUserData.coins || 0) * 5; // предполагается, что прогресс хранится в монетах
  if(userProgress) {
    userProgress.innerText = "Прогресс: " + progressUnits;
  }
}

// Функция обновления таймера (ползунка)
function updateTimer() {
  if (!gameStartTime) return;
  let elapsed = Date.now() - gameStartTime;
  let ratio = Math.min(elapsed / totalGameTime, 1); // от 0 до 1
  if(timerSlider) {
    timerSlider.style.height = (ratio * 100) + "%";
  }
}

// Имитация записи прогресса в базу данных (вызывается при окончании игры)
function saveProgressToDB() {
  // Здесь должна быть логика записи в БД.
  console.log("Прогресс (монеты):", localUserData.coins || 0);
}

// Глобальный объект пользователя (для примера)
let localUserData = {
  coins: 0
};

////////////////////////////////////////////////////////////////////////
// Инициализация игры

function initGame1() {
  const canvas = document.getElementById('gameCanvas');
  dinoCtx = canvas.getContext('2d');
  canvas.style.display = 'block';
  // Убедимся, что контейнер холста имеет position: relative
  let container = document.getElementById('gameContainer');
  if (!container) {
    container = document.body;
    container.style.position = "relative";
  }
  
  // Создаем оверлеи (если еще не созданы)
  createOverlayElements();
  
  const canvasWidth = canvas.width;
  const canvasHeight = canvas.height;
  
  // Расчет масштаба относительно базового разрешения
  scale = canvasWidth / baseWidth;
  
  // Размеры игровых объектов с учетом scale
  playerWidth    = 60 * scale;
  playerHeight   = 60 * scale;
  obstacleWidth  = 30 * scale; // шипы
  obstacleHeight = 30 * scale;
  platformBlockSize = 60 * scale; // куб платформы равен размеру игрока
  platformHeight = platformBlockSize;
  coinWidth      = 50 * scale; // увеличенные монеты
  coinHeight     = 50 * scale;
  groundHeight   = 40 * scale; // толще земля
  // Земля расположена на 80% высоты холста
  groundY = canvasHeight * 0.8;
  
  // Начальное положение игрока (на земле)
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
  
  // Создаем overlay для персонажа, если его еще нет
  if (!playerOverlay) {
    playerOverlay = document.createElement("img");
    playerOverlay.src = playerImg.src;
    playerOverlay.style.position = "absolute";
    playerOverlay.style.width = playerWidth + "px";
    playerOverlay.style.height = playerHeight + "px";
    playerOverlay.style.pointerEvents = "none";
    playerOverlay.style.zIndex = "10";
    container.appendChild(playerOverlay);
  } else {
    playerOverlay.style.width = playerWidth + "px";
    playerOverlay.style.height = playerHeight + "px";
  }
  
  // Сбрасываем данные пользователя (прогресс не сохраняется в процессе)
  localUserData.coins = 0;
  updateUserProgress();
  
  // Обнуляем таймер
  gameStartTime = null;
  timerSlider.style.height = "0%";
  
  // Ожидаем старт игры – пока gameStarted = false, игровой цикл не запущен.
  drawStartScreen();
  
  // Добавляем обработчики клика для старта игры
  canvas.addEventListener("click", startGame);
  document.addEventListener("keydown", function(e){
    if(e.code === "Space") startGame();
  });
}

function startGame() {
  if(gameStarted) return;
  gameStarted = true;
  // Скрываем стартовый оверлей
  if(startOverlay) startOverlay.style.display = "none";
  // Устанавливаем время старта
  gameStartTime = Date.now();
  // Убираем обработчик стартового клика (чтобы не срабатывать повторно)
  document.getElementById('gameCanvas').removeEventListener("click", startGame);
  // Запускаем игровой цикл
  dinoInterval = requestAnimationFrame(gameLoop);
}

function drawStartScreen() {
  // Показываем стартовый оверлей
  if(startOverlay) {
    startOverlay.style.display = "block";
    startOverlay.innerText = "Тап, чтобы старт";
  }
}

////////////////////////////////////////////////////////////////////////
// Игровой цикл

function gameLoop() {
  updateGame();
  drawGame();
  updateTimer();
  updateUserProgress();
  if(gameStarted) {
    dinoInterval = requestAnimationFrame(gameLoop);
  }
}

function updateGame() {
  const canvasWidth = dinoCtx.canvas.width;
  
  // Обновляем фон (движется влево)
  bgX -= obstacleSpeed / 2;
  if(bgX <= -canvasWidth) bgX = 0;
  
  // Физика игрока
  dinoY += velocityY;
  velocityY += gravity * scale;
  if(dinoY >= groundY - playerHeight) {
    dinoY = groundY - playerHeight;
    velocityY = 0;
    isJumping = false;
  }
  
  // Проверка столкновения с платформами
  platforms.forEach(plat => {
    if(dinoX + playerWidth > plat.x && dinoX < plat.x + plat.blocks * platformBlockSize) {
      if(dinoY + playerHeight >= plat.y && dinoY + playerHeight - velocityY < plat.y) {
        dinoY = plat.y - playerHeight;
        velocityY = 0;
        isJumping = false;
      }
    }
  });
  
  frameCount++;
  // Генерация новых объектов
  if(frameCount % 100 === 0) spawnObstacle();
  if(frameCount % 150 === 0) spawnPlatform();
  if(frameCount % 120 === 0) spawnCoin();
  
  // Смещение объектов влево (имитация движения)
  obstacles.forEach(obs => { obs.x -= obstacleSpeed; });
  platforms.forEach(plat => { plat.x -= obstacleSpeed; });
  coins.forEach(coin => { coin.x -= obstacleSpeed; });
  
  // Обновление прогресса: каждая монета = 5 единиц
  // (при подборе монеты, монета удаляется и localUserData.coins увеличивается)
  
  // Проверка столкновения игрока с шипами (простейшая проверка)
  obstacles.forEach(obs => {
    if(dinoX < obs.x + obs.width &&
       dinoX + playerWidth > obs.x &&
       dinoY + playerHeight > obs.y) {
         // Если игрок сталкивается – игра заканчивается
         endGame();
       }
  });
  
  // Проверка подбора монет (прямоугольное пересечение)
  for(let i = 0; i < coins.length; i++){
    let coin = coins[i];
    if(dinoX < coin.x + coin.size &&
       dinoX + playerWidth > coin.x &&
       dinoY < coin.y + coin.size &&
       dinoY + playerHeight > coin.y) {
         localUserData.coins++;
         coins.splice(i, 1);
         i--;
       }
  }
  
  // Удаляем вышедшие за левую границу объекты
  obstacles = obstacles.filter(obs => obs.x + obs.width > 0);
  platforms = platforms.filter(plat => plat.x + plat.blocks * platformBlockSize > 0);
  coins = coins.filter(coin => coin.x + coin.size > 0);
  
  // Обновляем позицию оверлея персонажа
  if(playerOverlay){
    playerOverlay.style.left = dinoX + "px";
    playerOverlay.style.top = dinoY + "px";
  }
}

function drawGame() {
  const canvasWidth = dinoCtx.canvas.width;
  const canvasHeight = dinoCtx.canvas.height;
  dinoCtx.clearRect(0, 0, canvasWidth, canvasHeight);
  
  // Отрисовка фона (до уровня земли)
  if(bgImg.complete) {
    dinoCtx.drawImage(bgImg, bgX, 0, canvasWidth, groundY);
    dinoCtx.drawImage(bgImg, bgX + canvasWidth, 0, canvasWidth, groundY);
  } else {
    dinoCtx.fillStyle = "#0c48db";
    dinoCtx.fillRect(0, 0, canvasWidth, groundY);
  }
  
  // Отрисовка платформ: для каждого куба платформы отрисовываем текстуру или заливку
  platforms.forEach(plat => {
    for(let j = 0; j < plat.blocks; j++){
      let cubeX = plat.x + j * platformBlockSize;
      if(platformImg.complete){
        dinoCtx.drawImage(platformImg, 0, 0, 300, 300, cubeX, plat.y, platformBlockSize, platformHeight);
      } else {
        dinoCtx.fillStyle = "#8B4513";
        dinoCtx.fillRect(cubeX, plat.y, platformBlockSize, platformHeight);
      }
    }
  });
  
  // Отрисовка шипов как черных треугольников
  dinoCtx.fillStyle = "black";
  obstacles.forEach(obs => {
    dinoCtx.beginPath();
    dinoCtx.moveTo(obs.x, obs.y + obs.height);
    dinoCtx.lineTo(obs.x + obs.width/2, obs.y);
    dinoCtx.lineTo(obs.x + obs.width, obs.y + obs.height);
    dinoCtx.closePath();
    dinoCtx.fill();
  });
  
  // Отрисовка земли (черная)
  dinoCtx.fillStyle = "black";
  dinoCtx.fillRect(0, groundY, canvasWidth, groundHeight);
  
  // Игрок отрисовывается не на canvas, а через overlay (playerOverlay)
  
  // Отрисовка прогресса (счет) – выводим количество очков (можно дополнительно стилизовать)
  dinoCtx.fillStyle = "#f1f1f1";
  dinoCtx.font = "bold 40px Arial";
  dinoCtx.textAlign = "center";
  dinoCtx.fillText(score, canvasWidth/2, cell * 1.5);
}

function endGame() {
  gameStarted = false;
  saveProgressToDB();
  // Можно показать модальное окно с результатом
  alert("Игра окончена. Прогресс: " + ((localUserData.coins || 0) * 5));
  // Перезапуск игры (для примера)
  resetGame();
  initGame1();
}

// Функция сброса игры (без сохранения прогресса в процессе)
function resetGame() {
  score = 0;
  frame = 0;
  difficulty = 1;
  player.x = cell * 2;
  player.y = groundY - cell;
  player.xVel = 4;
  player.yVel = 0;
  player.dead = false;
  platforms = [];
  obstacles = [];
  coins.forEach(coin => {
    if(coin.overlay && coin.overlay.parentElement){
      coin.overlay.parentElement.removeChild(coin.overlay);
    }
  });
  coins = [];
  // Создаем стартовую платформу, чтобы игрок сразу стоял на чем-то
  platforms.push({x: -1, y: groundY - cell, blocks: 10, w: W + 2, h: cell});
}

// Объекты генерации:
// Шипы, платформы и монеты генерируются при нехватке объектов справа
function spawnObstacle() {
  let spawnX = W;
  // Добавляем шип, если нет платформы в этой области
  let overlap = platforms.some(plat => (plat.x < spawnX + obstacleWidth && plat.x + plat.blocks * platformBlockSize > spawnX));
  if(!overlap) {
    obstacles.push({x: spawnX, y: groundY - obstacleHeight, width: obstacleWidth, height: obstacleHeight});
  }
}

function spawnPlatform() {
  let blocksCount = rand(1, 3);
  let gap = rand(0, 3) * cell;
  // 70% платформ на земле, 30% немного приподнятых (до 3 клеток)
  let pY = (Math.random() < 0.7) ? groundY - cell : groundY - cell - rand(1,3) * cell;
  platforms.push({x: W + gap, y: pY, blocks: blocksCount});
  
  // С вероятностью 50% генерируем шип
  if(Math.random() < 0.5) {
    spikes.push({x: W + gap + rand(0, blocksCount * cell), size: 30});
  }
  
  // С вероятностью 70% генерируем монету над платформой
  if(Math.random() < 0.7) {
    coins.push({x: W + gap + rand(0, blocksCount * cell), y: pY - cell, size: 50});
  }
}

// Запуск
resetGame();
initGame1();
render = gameLoop; // устанавливаем render как gameLoop для совместимости с requestAnimationFrame
