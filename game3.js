/* game3.js
   "Flappy Bird–like" game:
   - Управление: tap (или SPACE) → прыжок.
   - Вместо труб — 3 типа врагов с разной скоростью и поведением.
   - Игрок собирает монеты (+5 очков за монету).
   - Фон движется, создавая иллюзию полёта.
   - При столкновении игра завершается, показывается итоговое окно и очки записываются в БД.
   
   Глобальные переменные (localUserData, updateTopBar, showEndGameModal) доступны из index.html.
*/

let game3Canvas;
let ctx3;

// Изображения (проверьте, что URL корректны)
let bgImage      = new Image();
let playerImage  = new Image();
let coinImage    = new Image();
let enemyImage1  = new Image(); // enemy type 1
let enemyImage2  = new Image(); // enemy type 2 (движется вверх/вниз)
let enemyImage3  = new Image(); // enemy type 3

// Параметры фона
let bgX = 0;
let bgSpeed = 1.5; // скорость прокрутки фона

// Игровые переменные
let gameLoopId;       // идентификатор requestAnimationFrame
let gameState = "ready"; // "ready" | "play" | "over"

// Параметры игрока
let player = {
  x: 50,
  y: 150,
  w: 50,
  h: 50,
  vy: 0,       // вертикальная скорость
  jumpPower: -5,
  gravity: 0.25
};

// Массив врагов
let enemies = [];
let enemySpawnTimer = 0;

// Массив монет
let coins = [];
let coinSpawnTimer = 0;

// Текущий счет (каждая монета даёт +5 очков)
let currentScore = 0;
let basePoints   = 0; // очки пользователя до начала игры

// Переменные для усложнения игры
let difficultyTimer = 0;
let difficultyLevel = 1; // влияет на скорость врагов и частоту спавна

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

  // Задаем ссылки на изображения
  // Фон – заменил на URL с imgur (при необходимости можно изменить)
  bgImage.src       = "https://i.imgur.com/Z6aO0Rv.gif"; 
  playerImage.src   = "https://media.giphy.com/media/l0MYt5jPR6QX5pnqM/giphy.gif"; 
  coinImage.src     = "https://i.gifer.com/xt.gif";
  enemyImage1.src   = "https://i.gifer.com/XOsa.gif";
  enemyImage2.src   = "https://i.gifer.com/Vp3M.gif";
  enemyImage3.src   = "https://i.gifer.com/iHG.gif";

  // Сброс игровых переменных
  resetVars();
  // Подключаем события ввода (tap / keydown)
  addInputListeners();

  console.log("Game3 initialized");
  // Запускаем игровой цикл
  gameLoopId = requestAnimationFrame(updateGame3);
}

/* Сброс игровых переменных */
function resetVars() {
  bgX = 0;
  gameState = "ready";
  difficultyTimer = 0;
  difficultyLevel = 1;

  player.x = 50;
  player.y = game3Canvas.height / 2 - player.h / 2;
  player.vy = 0;

  enemies = [];
  enemySpawnTimer = 0;

  coins = [];
  coinSpawnTimer = 0;

  // Запоминаем базовый счет (до начала игры)
  basePoints = localUserData.points || 0;
  currentScore = 0;
}

/* Удаление слушателей и остановка игрового цикла */
function resetGame3() {
  removeInputListeners();
  cancelAnimationFrame(gameLoopId);
  console.log("Game3 reset");
}

/* Добавление событий ввода */
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

/* Обработка ввода: при клике/тапе или нажатии пробела */
function onUserInput() {
  if (gameState === "ready") {
    gameState = "play";
    player.vy = player.jumpPower;
  } else if (gameState === "play") {
    player.vy = player.jumpPower;
  }
}

/* Обработка нажатия клавиши (SPACE) */
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

  // Ограничение по верху и низу
  if (player.y < 0) {
    player.y = 0;
    player.vy = 0;
  }
  if (player.y + player.h > game3Canvas.height) {
    player.y = game3Canvas.height - player.h;
    player.vy = 0;
  }
}

/* Обновление врагов */
function updateEnemies() {
  enemySpawnTimer++;
  let spawnInterval = Math.max(60 - difficultyLevel * 5, 20);
  if (enemySpawnTimer > spawnInterval) {
    spawnEnemy();
    enemySpawnTimer = 0;
  }
  for (let i = 0; i < enemies.length; i++) {
    let en = enemies[i];
    if (en.type === 2) {
      en.y += Math.sin(en.moveAngle) * en.moveRange;
      en.moveAngle += 0.1;
    }
    en.x -= en.speed;
  }
  enemies = enemies.filter(en => en.x + en.w > 0);
}

/* Создание врага (случайный тип 1..3) */
function spawnEnemy() {
  let type = Math.floor(Math.random() * 3) + 1;
  let speed = 3;
  let enemyW = 60;
  let enemyH = 60;
  let enemyY = Math.random() * (game3Canvas.height - enemyH);
  let moveAngle = 0;
  let moveRange = 0.5;
  switch (type) {
    case 1:
      speed = 3 + difficultyLevel * 0.5; 
      break;
    case 2:
      speed = 2 + difficultyLevel * 0.3;
      moveAngle = Math.random() * Math.PI * 2;
      moveRange = 1.0 + difficultyLevel * 0.1;
      break;
    case 3:
      speed = 4 + difficultyLevel * 0.6; 
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
  let spawnInterval = Math.max(90 - difficultyLevel * 3, 30);
  if (coinSpawnTimer > spawnInterval) {
    spawnCoin();
    coinSpawnTimer = 0;
  }
  for (let i = 0; i < coins.length; i++) {
    coins[i].x -= coins[i].speed;
  }
  coins = coins.filter(c => c.x + c.w > 0);
}

/* Создание монеты */
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

/* Увеличение сложности */
function updateDifficulty() {
  difficultyTimer++;
  if (difficultyTimer > 600) {
    difficultyLevel++;
    difficultyTimer = 0;
  }
}

/* Проверка столкновений (игрок-враг, игрок-coin) */
function checkCollisions() {
  // Столкновение с врагами
  for (let en of enemies) {
    if (isColliding(player, en)) {
      onGameOver();
      return;
    }
  }
  // Сбор монет
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

/* Обработка конца игры */
function onGameOver() {
  gameState = "over";
  showEndGameModal("Game Over", `You scored ${currentScore} points!\nCoins collected: ${currentScore / 5}.`);
  cancelAnimationFrame(gameLoopId);
  console.log("Game Over – Score:", currentScore);
}

/* Отрисовка игрового поля */
function drawScene() {
  // Обновляем фон
  bgX -= bgSpeed;
  if (bgX <= -game3Canvas.width) {
    bgX = 0;
  }
  drawBg(bgX, 0);
  drawBg(bgX + game3Canvas.width, 0);

  // Если игра ещё не началась, показываем инструкцию
  if (gameState === "ready") {
    ctx3.fillStyle = "#fff";
    ctx3.font = "14px sans-serif";
    ctx3.fillText("TAP or SPACE to start", game3Canvas.width / 2 - 80, game3Canvas.height / 2);
    ctx3.fillText("Collect coins and avoid enemies!", game3Canvas.width / 2 - 120, game3Canvas.height / 2 + 20);
  }

  // Рисуем игрока
  ctx3.drawImage(playerImage, player.x, player.y, player.w, player.h);

  // Рисуем врагов
  enemies.forEach(en => {
    if (en.type === 1) {
      ctx3.drawImage(enemyImage1, en.x, en.y, en.w, en.h);
    } else if (en.type === 2) {
      ctx3.drawImage(enemyImage2, en.x, en.y, en.w, en.h);
    } else {
      ctx3.drawImage(enemyImage3, en.x, en.y, en.w, en.h);
    }
  });

  // Рисуем монеты
  coins.forEach(c => {
    ctx3.drawImage(coinImage, c.x, c.y, c.w, c.h);
  });

  // Если игра идёт – показываем счет
  if (gameState === "play") {
    ctx3.fillStyle = "#fff";
    ctx3.font = "14px sans-serif";
    ctx3.fillText(`Score: ${currentScore}`, 10, 20);
  }
}

/* Функция отрисовки фона */
function drawBg(x, y) {
  ctx3.drawImage(bgImage, x, y, game3Canvas.width, game3Canvas.height);
}
