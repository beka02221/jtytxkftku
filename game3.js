/* Improved game3.js – "Flappy Bird–like" game (4x slower)
   Features:
   - Control: TAP (or SPACE) makes the player jump.
   - Enemies: Gradual introduction of enemy types (1 → then 2 → then 3), with a gradual increase in simultaneous enemies.
   - Coins: Each coin gives +5 points.
   - Background scrolls to simulate forward motion.
   - On collision or falling to the bottom, a game-over modal is shown and score is saved.
   
   ⚠️ ВАЖНО:
   1. Подключите библиотеку gifler, например, добавив в HTML:
      <script src="https://unpkg.com/gifler@0.1.0/gifler.min.js"></script>
   2. Функции showEndGameModal, updateTopBar и переменная localUserData должны быть определены в вашем проекте.
*/

/* Функция создания анимированного объекта GIF.
   Для каждого GIF создаётся скрытый offscreen canvas, в который gifler
   отрисовывает анимацию.
*/
function createAnimatedGif(url) {
  let offscreenCanvas = document.createElement("canvas");
  // Задаём произвольный размер – gifler обновит его после загрузки GIF
  offscreenCanvas.width = 100;
  offscreenCanvas.height = 100;
  if (typeof gifler !== "undefined") {
    gifler(url).get(function(anim) {
      offscreenCanvas.width = anim.width;
      offscreenCanvas.height = anim.height;
      anim.animateInCanvas(offscreenCanvas);
    });
  } else {
    console.error("gifler library is not loaded. Animated GIFs will not animate.");
    let img = new Image();
    img.src = url;
    img.onload = () => {
      offscreenCanvas.width = img.width;
      offscreenCanvas.height = img.height;
      offscreenCanvas.getContext("2d").drawImage(img, 0, 0);
    };
  }
  return { canvas: offscreenCanvas };
}

let game3Canvas;
let ctx3;

// Фоновое изображение – статичное
let bgImage = new Image();

// Анимированные объекты – создаются через createAnimatedGif()
let playerImage;  
let coinImage;
let enemyImage1;  // Враг типа 1
let enemyImage2;  // Враг типа 2 (с вертикальными колебаниями)
let enemyImage3;  // Враг типа 3

// Параметры фона (игра замедлена в 4 раза)
let bgSpeed = 1.5 / 4; // 0.375 пикселей за кадр
let bgX = 0;

// Игровые переменные
let gameLoopId;            // requestAnimationFrame ID
let gameState = "ready";   // "ready" | "play" | "over"

// Свойства игрока (изменены для более высокого прыжка и быстрого полёта)
let player = {
  x: 50,
  y: 150,
  w: 50,
  h: 50,
  vy: 0,                
  jumpPower: -8,   // Игрок теперь получает сильный импульс вверх
  gravity: 0.5     // Гравитация увеличена – игрок быстрее ускоряется вниз
};

// Массивы врагов и монет
let enemies = [];
let coins = [];

// Таймеры и счётчики
let enemySpawnTimer = 0;
let coinSpawnTimer = 0;
let gameTime = 0;  // Количество кадров с начала игры

// Очки и параметры сложности
let currentScore = 0;             // Очки, набранные за монеты
let basePoints = 0;               // Счёт до начала игры
let difficultyLevel = 1;          // Уровень сложности (растёт постепенно)
let maxEnemyType = 1;             // Допустимые типы врагов

/* Инициализация игры.
   Вызывается из основного скрипта (например, handleStartGame('game3', ...))
*/
function initGame3() {
  game3Canvas = document.getElementById("game3Canvas");
  if (!game3Canvas) {
    console.error("game3Canvas not found!");
    return;
  }
  ctx3 = game3Canvas.getContext("2d");

  // Задаём пути к изображениям
  bgImage.src       = "https://i.pinimg.com/736x/20/e9/cf/20e9cf219337614640886180cc5d1c34.jpg"; 
  playerImage       = createAnimatedGif("spooky-halloween.gif"); 
  coinImage         = createAnimatedGif("https://donatepay.ru/uploads/notification/images/830208_1664005822.gif");
  enemyImage1       = createAnimatedGif("https://i.pinimg.com/originals/4b/4f/a1/4b4fa16fff0d9782b6e53db976f89f78.gif");
  enemyImage2       = createAnimatedGif("https://i.gifer.com/XOsa.gif");
  enemyImage3       = createAnimatedGif("enemyworld.gif");

  resetVars();
  addInputListeners();

  console.log("Game3 initialized");
  gameLoopId = requestAnimationFrame(updateGame3);
}

/* Сброс игровых переменных */
function resetVars() {
  bgX = 0;
  gameState = "ready";
  enemySpawnTimer = 0;
  coinSpawnTimer = 0;
  gameTime = 0;
  difficultyLevel = 1;
  maxEnemyType = 1;

  player.x = 50;
  player.y = game3Canvas.height / 2 - player.h / 2;
  player.vy = 0;

  enemies = [];
  coins = [];

  // Запоминаем базовый счёт (если localUserData.points существует)
  basePoints = localUserData.points || 0;
  currentScore = 0;
}

/* Отключение событий и остановка игрового цикла */
function resetGame3() {
  removeInputListeners();
  cancelAnimationFrame(gameLoopId);
  console.log("Game3 reset");
}

/* Подключение событий ввода (mousedown/touchstart и keydown) */
function addInputListeners() {
  game3Canvas.addEventListener("mousedown", onUserInput);
  game3Canvas.addEventListener("touchstart", onUserInput);
  document.addEventListener("keydown", onKeyDown);
}

/* Удаление событий ввода */
function removeInputListeners() {
  game3Canvas.removeEventListener("mousedown", onUserInput);
  game3Canvas.removeEventListener("touchstart", onUserInput);
  document.removeEventListener("keydown", onKeyDown);
}

/* Обработка ввода: tap или нажатие SPACE */
function onUserInput() {
  if (gameState === "ready") {
    gameState = "play";
    player.vy = player.jumpPower;
  } else if (gameState === "play") {
    player.vy = player.jumpPower;
  }
}

/* Обработка нажатия клавиши SPACE */
function onKeyDown(e) {
  if (e.code === "Space") {
    e.preventDefault();
    onUserInput();
  }
}

/* Основной игровой цикл */
function updateGame3() {
  if (gameState === "play") {
    updatePlayer();
    updateEnemies();
    updateCoins();
    updateDifficulty();
    checkCollisions();
    gameTime++;
  }
  drawScene();

  if (gameState !== "over") {
    gameLoopId = requestAnimationFrame(updateGame3);
  }
}

/* Обновление позиции игрока */
function updatePlayer() {
  player.vy += player.gravity;
  player.y += player.vy;

  // Ограничение движения по верхней границе
  if (player.y < 0) {
    player.y = 0;
    player.vy = 0;
  }
  // Если игрок упал до нижней границы, игра завершается
  if (player.y + player.h >= game3Canvas.height) {
    onGameOver();
  }
}

/* Обновление врагов с постепенным усложнением */
function updateEnemies() {
  enemySpawnTimer++;
  // Интервал спавна врагов замедлен в 4 раза
  let spawnInterval = Math.max((60 - difficultyLevel * 2) * 4, 30 * 4); // минимум 120 кадров
  
  // Максимальное число врагов: каждые 600 кадров (~10 сек) +1 враг
  let maxEnemiesAllowed = Math.floor(gameTime / 600) + 1;
  
  if (enemySpawnTimer > spawnInterval && enemies.length < maxEnemiesAllowed) {
    spawnEnemy();
    enemySpawnTimer = 0;
  }
  enemies.forEach(en => {
    // Для врагов типа 2 – вертикальное колебание
    if (en.type === 2) {
      en.y += Math.sin(en.moveAngle) * en.moveRange;
      en.moveAngle += 0.1;
    }
    en.x -= en.speed;
  });
  enemies = enemies.filter(en => en.x + en.w > 0);
}

/* Спавн врага.
   Случайный тип от 1 до maxEnemyType.
*/
function spawnEnemy() {
  let type = Math.floor(Math.random() * maxEnemyType) + 1;
  let speed, enemyW, enemyH, enemyY, moveAngle, moveRange;
  enemyW = 60;
  enemyH = 60;
  enemyY = Math.random() * (game3Canvas.height - enemyH);
  moveAngle = 0;
  moveRange = 0.5;

  switch (type) {
    case 1:
      speed = (3 + difficultyLevel * 0.3) / 4;
      break;
    case 2:
      speed = (2.5 + difficultyLevel * 0.25) / 4;
      moveAngle = Math.random() * Math.PI * 2;
      moveRange = 1.0 + difficultyLevel * 0.1;
      break;
    case 3:
      speed = (4 + difficultyLevel * 0.4) / 4;
      break;
  }
  enemies.push({
    type: type,
    x: game3Canvas.width + 50,
    y: enemyY,
    w: enemyW,
    h: enemyH,
    speed: speed,
    moveAngle: moveAngle,
    moveRange: moveRange
  });
}

/* Обновление монет */
function updateCoins() {
  coinSpawnTimer++;
  // Интервал спавна монет замедлен: умножаем на 4
  let spawnInterval = Math.max((90 - difficultyLevel * 2) * 4, 40 * 4); // минимум 160 кадров
  if (coinSpawnTimer > spawnInterval) {
    spawnCoin();
    coinSpawnTimer = 0;
  }
  coins.forEach(c => {
    c.x -= c.speed;
  });
  coins = coins.filter(c => c.x + c.w > 0);
}

/* Спавн монеты */
function spawnCoin() {
  let cW = 30, cH = 30;
  let yPos = Math.random() * (game3Canvas.height - cH);
  coins.push({
    x: game3Canvas.width + 10,
    y: yPos,
    w: cW,
    h: cH,
    speed: 3 / 4
  });
}

/* Постепенное увеличение сложности:
   - Каждые 2400 кадров (~40 секунд при 60fps в замедленном режиме) увеличивается уровень сложности.
   - При повышении сложности интервалы спавна врагов/монет уменьшаются, а скорость увеличивается.
   - maxEnemyType: до уровня 3 – только тип 1, до уровня 6 – типы 1 и 2, затем – все 3 типа.
*/
function updateDifficulty() {
  if (gameTime % 2400 === 0 && gameTime !== 0) {
    difficultyLevel++;
    console.log("Difficulty increased to", difficultyLevel);
  }
  if (difficultyLevel < 3) {
    maxEnemyType = 1;
  } else if (difficultyLevel < 6) {
    maxEnemyType = 2;
  } else {
    maxEnemyType = 3;
  }
}

/* Проверка столкновений:
   - Столкновение с врагом завершает игру.
   - Столкновение с монетой увеличивает счёт.
   Для врагов используется уменьшённая зона столкновения у игрока.
*/
function checkCollisions() {
  for (let en of enemies) {
    if (isPlayerCollidingWithEnemy(player, en)) {
      onGameOver();
      return;
    }
  }
  for (let i = 0; i < coins.length; i++) {
    let c = coins[i];
    if (isColliding(player, c)) {
      coins.splice(i, 1);
      i--;
      currentScore += 5;
      localUserData.points = basePoints + currentScore;
      if (typeof updateTopBar === "function") {
        updateTopBar();
      }
    }
  }
}

/* Простая AABB-проверка столкновения */
function isColliding(a, b) {
  return !(
    a.x + a.w < b.x ||
    a.x > b.x + b.w ||
    a.y + a.h < b.y ||
    a.y > b.y + b.h
  );
}

/* Проверка столкновения игрока с врагом с уменьшенной зоной */
function isPlayerCollidingWithEnemy(player, enemy) {
  const margin = 10;
  const pLeft   = player.x + margin;
  const pRight  = player.x + player.w - margin;
  const pTop    = player.y + margin;
  const pBottom = player.y + player.h - margin;
  
  return !(pRight < enemy.x ||
           pLeft > enemy.x + enemy.w ||
           pBottom < enemy.y ||
           pTop > enemy.y + enemy.h);
}

/* Обработка конца игры.
   При столкновении с врагом или падении до низа игра переводится в состояние "over",
   показывается модальное окно с итоговым счётом,
   и игровой цикл останавливается.
*/
function onGameOver() {
  gameState = "over";
  showEndGameModal("Game Over", `You scored ${currentScore} points!\nCoins collected: ${currentScore / 5}.`);
  cancelAnimationFrame(gameLoopId);
  console.log("Game Over – Score:", currentScore);
}

/* Отрисовка игрового поля */
function drawScene() {
  // Прокручивающийся фон
  bgX -= bgSpeed;
  if (bgX <= -game3Canvas.width) {
    bgX = 0;
  }
  drawBg(bgX, 0);
  drawBg(bgX + game3Canvas.width, 0);

  // Если игра ещё не началась – показываем инструкции
  if (gameState === "ready") {
    ctx3.fillStyle = "#fff";
    ctx3.font = "16px sans-serif";
    ctx3.textAlign = "center";
    ctx3.fillText("TAP or PRESS SPACE to start", game3Canvas.width / 2, game3Canvas.height / 2 - 20);
    ctx3.fillText("Collect coins, avoid enemies!", game3Canvas.width / 2, game3Canvas.height / 2 + 10);
  }

  // Отрисовка игрока (анимированный canvas)
  ctx3.drawImage(playerImage.canvas, player.x, player.y, player.w, player.h);

  // Отрисовка врагов
  enemies.forEach(en => {
    if (en.type === 1) {
      ctx3.drawImage(enemyImage1.canvas, en.x, en.y, en.w, en.h);
    } else if (en.type === 2) {
      ctx3.drawImage(enemyImage2.canvas, en.x, en.y, en.w, en.h);
    } else {
      ctx3.drawImage(enemyImage3.canvas, en.x, en.y, en.w, en.h);
    }
  });

  // Отрисовка монет
  coins.forEach(c => {
    ctx3.drawImage(coinImage.canvas, c.x, c.y, c.w, c.h);
  });

  // Если игра идёт, показываем текущий счёт
  if (gameState === "play") {
    ctx3.fillStyle = "#fff";
    ctx3.font = "16px sans-serif";
    ctx3.textAlign = "left";
    ctx3.fillText(`Score: ${currentScore}`, 10, 30);
  }
}

/* Функция отрисовки фона */
function drawBg(x, y) {
  ctx3.drawImage(bgImage, x, y, game3Canvas.width, game3Canvas.height);
}

