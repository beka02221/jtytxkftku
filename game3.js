
/* Improved game3.js – "Flappy Bird–like" game with gradual difficulty and enemy introduction.
   Features:
   - Control: TAP (or SPACE) makes the player jump.
   - Instead of pipes, there are enemies (up to 3 types) with different speeds and behaviors.
   - The player collects coins (each coin gives +5 points).
   - The background scrolls to simulate forward flight.
   - On collision, the game ends, a results modal is shown, and the score is saved to the database.
   
   Global variables (localUserData, updateTopBar, showEndGameModal) are expected to be defined in index.html.
*/

let game3Canvas;
let ctx3;

// Images – (Проверьте URL, замените при необходимости)
let bgImage      = new Image();
let playerImage  = new Image();
let coinImage    = new Image();
let enemyImage1  = new Image(); // Enemy type 1
let enemyImage2  = new Image(); // Enemy type 2 (oscillates vertically)
let enemyImage3  = new Image(); // Enemy type 3

// Background parameters
let bgX = 0;
let bgSpeed = 1.5; // Скорость прокрутки фона

// Game state variables
let gameLoopId;            // Идентификатор requestAnimationFrame
let gameState = "ready";   // "ready" | "play" | "over"

// Player properties
let player = {
  x: 50,
  y: 150,
  w: 50,
  h: 50,
  vy: 0,            // Вертикальная скорость
  jumpPower: -5,    // Сила прыжка (отрицательная, т.к. вверх)
  gravity: 0.25     // Гравитация
};

// Arrays for enemies and coins
let enemies = [];
let coins = [];

// Timers and counters
let enemySpawnTimer = 0;
let coinSpawnTimer = 0;
let gameTime = 0;  // Количество кадров с начала игры

// Score and difficulty variables
let currentScore = 0;             // Счёт, набранный за монеты
let basePoints = 0;               // Очки пользователя до начала игры
let difficultyLevel = 1;          // Уровень сложности (растёт постепенно)
let maxEnemyType = 1;             // На начальном этапе разрешены только враги типа 1

/* Инициализация игры.
   Вызывается из main-скрипта (handleStartGame('game3', ...))
*/
function initGame3() {
  game3Canvas = document.getElementById("game3Canvas");
  if (!game3Canvas) {
    console.error("game3Canvas not found!");
    return;
  }
  ctx3 = game3Canvas.getContext("2d");

  // Задаем ссылки на изображения (при необходимости замените URL)
  bgImage.src       = "https://i.pinimg.com/736x/20/e9/cf/20e9cf219337614640886180cc5d1c34.jpg"; 
  playerImage.src   = "spooky-halloween.gif"; 
  coinImage.src     = "https://donatepay.ru/uploads/notification/images/830208_1664005822.gif";
  enemyImage1.src   = "https://i.gifer.com/XOsa.gif";
  enemyImage2.src   = "https://i.gifer.com/Vp3M.gif";
  enemyImage3.src   = "https://i.pinimg.com/originals/4b/4f/a1/4b4fa16fff0d9782b6e53db976f89f78.gif";

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

  // Запоминаем базовый счет пользователя до начала игры
  basePoints = localUserData.points || 0;
  currentScore = 0;
}

/* Отключение событий и остановка игрового цикла */
function resetGame3() {
  removeInputListeners();
  cancelAnimationFrame(gameLoopId);
  console.log("Game3 reset");
}

/* Подключение событий ввода (тап/клик и клавиша SPACE) */
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

/* Обработка ввода: по клику/тапу или при нажатии SPACE */
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

  // Ограничиваем движение игрока по вертикали
  if (player.y < 0) {
    player.y = 0;
    player.vy = 0;
  }
  if (player.y + player.h > game3Canvas.height) {
    player.y = game3Canvas.height - player.h;
    player.vy = 0;
  }
}

/* Обновление врагов с постепенным увеличением сложности */
function updateEnemies() {
  enemySpawnTimer++;
  // Интервал спавна врагов постепенно сокращается (но не ниже 30 кадров)
  let spawnInterval = Math.max(60 - difficultyLevel * 2, 30);
  if (enemySpawnTimer > spawnInterval) {
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
   Тип врага выбирается случайно от 1 до maxEnemyType (максимум разрешенных типов, зависящий от сложности).
*/
function spawnEnemy() {
  let type = Math.floor(Math.random() * maxEnemyType) + 1;
  let speed = 3;
  let enemyW = 60;
  let enemyH = 60;
  let enemyY = Math.random() * (game3Canvas.height - enemyH);
  let moveAngle = 0;
  let moveRange = 0.5;
  switch (type) {
    case 1:
      speed = 3 + difficultyLevel * 0.3;
      break;
    case 2:
      speed = 2.5 + difficultyLevel * 0.25;
      moveAngle = Math.random() * Math.PI * 2;
      moveRange = 1.0 + difficultyLevel * 0.1;
      break;
    case 3:
      speed = 4 + difficultyLevel * 0.4;
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
  // Интервал спавна монет постепенно сокращается, но не ниже 40 кадров
  let spawnInterval = Math.max(90 - difficultyLevel * 2, 40);
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
    speed: 3
  });
}

/* Постепенное увеличение сложности.
   - Каждые 600 кадров (~10 секунд при 60fps) увеличивается уровень сложности.
   - При повышении сложности уменьшается интервал спавна врагов/монет и увеличивается скорость.
   - Появление новых типов врагов: до уровня 3 – только тип 1, до уровня 6 – типы 1 и 2, затем – все 3 типа.
*/
function updateDifficulty() {
  if (gameTime % 600 === 0) {
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
   - Если игрок сталкивается с врагом, игра заканчивается.
   - Если игрок касается монеты – монета исчезает, а игрок получает +5 очков.
*/
function checkCollisions() {
  // Проверка столкновения с врагами
  for (let en of enemies) {
    if (isColliding(player, en)) {
      onGameOver();
      return;
    }
  }
  // Проверка столкновения с монетами
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

/* Обработка конца игры.
   При столкновении с врагом игра переводится в состояние "over",
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
  // Отрисовка прокручивающегося фона
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

  // Отрисовка игрока
  ctx3.drawImage(playerImage, player.x, player.y, player.w, player.h);

  // Отрисовка врагов
  enemies.forEach(en => {
    if (en.type === 1) {
      ctx3.drawImage(enemyImage1, en.x, en.y, en.w, en.h);
    } else if (en.type === 2) {
      ctx3.drawImage(enemyImage2, en.x, en.y, en.w, en.h);
    } else {
      ctx3.drawImage(enemyImage3, en.x, en.y, en.w, en.h);
    }
  });

  // Отрисовка монет
  coins.forEach(c => {
    ctx3.drawImage(coinImage, c.x, c.y, c.w, c.h);
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
