/* game3.js
   "Flappy Bird–like" game with 3 different enemy types, coin collection, etc.
   
   Требования:
   1. Функции initGame3() и resetGame3() для инициализации/сброса игры.
   2. Во время игры управляем персонажем «по тапу» (или пробелу).
   3. Есть 3 типа врагов (c разной скоростью/поведением).
   4. Есть монеты: каждая даёт +5 очков. Очки отображаются в реальном времени.
   5. При проигрыше вызывается showEndGameModal(...) + сохраняются очки в localUserData.points.
   6. Фон прокручивается, чтобы создавалась иллюзия полёта вперёд.
   
   Взаимодействие с главным скриптом:
   - Глобальные переменные localUserData, userRef и функции showEndGameModal(), updateTopBar() считаем доступны.
   - После showEndGameModal() пользователь нажимает «Close», что вызывает finishGame() -> closeGameModal() -> resetGame3().
*/

let game3Canvas;
let ctx3;

// Изображения
let bgImage      = new Image();
let playerImage  = new Image();
let coinImage    = new Image();
let enemyImage1  = new Image(); // enemy type 1
let enemyImage2  = new Image(); // enemy type 2 (moves up/down)
let enemyImage3  = new Image(); // enemy type 3

// Параметры фона
let bgX = 0;
let bgSpeed = 1.5; // скорость прокрутки фона

// Игровые переменные
let gameLoopId;       // для requestAnimationFrame
let gameState = "ready"; // "ready" | "play" | "over"

// Позиция и физика игрока
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

// Текущее количество очков и сохранённые очки до старта
let currentScore = 0;
let basePoints   = 0; // то, что было в localUserData.points до старта

// Увеличение сложности со временем
let difficultyTimer = 0;
let difficultyLevel = 1; // влияет на скорость врагов, частоту спавна и т.п.

/* Инициализация: вызывается из главного скрипта при запуске игры */
function initGame3() {
  game3Canvas = document.getElementById("game3Canvas");
  ctx3        = game3Canvas.getContext("2d");
  
  // Загрузим картинки (простейший способ)
  bgImage.src       = "https://i.pinimg.com/736x/20/e9/cf/20e9cf219337614640886180cc5d1c34.jpg"; 
  playerImage.src   = "https://tenor.com/bA9rc.gif"; 
  coinImage.src     = "https://i.gifer.com/xt.gif";
  enemyImage1.src   = "https://i.gifer.com/XOsa.gif";
  enemyImage2.src   = "https://i.gifer.com/Vp3M.gif";
  enemyImage3.src   = "https://i.pinimg.com/originals/4b/4f/a1/4b4fa16fff0d9782b6e53db976f89f78.gif";

  // Начальные настройки
  resetVars();
  // Подключим события ввода
  addInputListeners();

  // Запустим игровой цикл
  gameLoopId = requestAnimationFrame(updateGame3);
}

/* Сброс переменных (но не отмена слушателей). Используем при старте или рестарте. */
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

  // Запоминаем очки, которые были у пользователя до игры
  basePoints = localUserData.points || 0;
  currentScore = 0;
}

/* Удаление (или отключение) событий и остановка rAF
   Вызывается из главного скрипта при закрытии игры (finishGame -> closeGameModal -> resetGame3) */
function resetGame3() {
  removeInputListeners();
  cancelAnimationFrame(gameLoopId);
}

/* Подключаем события (click/touch + keydown) */
function addInputListeners() {
  // Мышь или касание по canvas
  game3Canvas.addEventListener("mousedown", onUserInput);
  game3Canvas.addEventListener("touchstart", onUserInput);

  // Клавиатура
  document.addEventListener("keydown", onKeyDown);
}

/* Отключаем события */
function removeInputListeners() {
  game3Canvas.removeEventListener("mousedown", onUserInput);
  game3Canvas.removeEventListener("touchstart", onUserInput);
  document.removeEventListener("keydown", onKeyDown);
}

/* Обработка пользовательского ввода для «прыжка» */
function onUserInput() {
  if (gameState === "ready") {
    // Начинаем игру и делаем прыжок
    gameState = "play";
    player.vy = player.jumpPower;
  } else if (gameState === "play") {
    // Прыжок
    player.vy = player.jumpPower;
  }
}

/* Клавиатура (пробел = прыжок) */
function onKeyDown(e) {
  if (e.code === "Space") {
    e.preventDefault();
    onUserInput();
  }
}

/* Основной игровой цикл */
function updateGame3() {
  // Обновляем логику
  if (gameState === "play") {
    updatePlayer();
    updateEnemies();
    updateCoins();
    updateDifficulty();
    checkCollisions();
  }

  // Рисуем всё
  drawScene();

  // Следующий кадр
  if (gameState !== "over") {
    gameLoopId = requestAnimationFrame(updateGame3);
  }
}

/* Логика игрока */
function updatePlayer() {
  // Применяем гравитацию
  player.vy += player.gravity;
  player.y += player.vy;

  // Не даём выйти за границы canvas
  if (player.y < 0) {
    player.y = 0;
    player.vy = 0;
  }
  if (player.y + player.h > game3Canvas.height) {
    player.y = game3Canvas.height - player.h;
    player.vy = 0;
  }
}

/* Логика врагов */
function updateEnemies() {
  // Увеличиваем таймер спавна
  enemySpawnTimer++;
  // Чем выше уровень сложности, тем чаще (или быстрее) появляются враги
  let spawnInterval = Math.max(60 - difficultyLevel * 5, 20); // минимум 20 кадров
  
  if (enemySpawnTimer > spawnInterval) {
    spawnEnemy();
    enemySpawnTimer = 0;
  }
  
  // Движение врагов
  for (let i = 0; i < enemies.length; i++) {
    let en = enemies[i];
    // Если это второй тип — пусть двигается слегка вверх-вниз (синус или простая логика)
    if (en.type === 2) {
      en.y += Math.sin(en.moveAngle) * en.moveRange;
      en.moveAngle += 0.1; // скорость колебания
    }
    en.x -= en.speed;
  }
  
  // Убираем врагов, которые вышли за левый край
  enemies = enemies.filter(en => en.x + en.w > 0);
}

/* Спавн врага: выбираем тип случайно (1, 2 или 3) */
function spawnEnemy() {
  let type = Math.floor(Math.random() * 3) + 1; // 1..3

  let speed      = 3;   // базовая
  let enemyW     = 60; 
  let enemyH     = 60; 
  let enemyY     = Math.random() * (game3Canvas.height - enemyH);
  let moveAngle  = 0;   // для типа 2
  let moveRange  = 0.5; // амплитуда колебаний

  switch (type) {
    case 1:
      speed = 3 + difficultyLevel * 0.5; 
      break;
    case 2:
      speed = 2 + difficultyLevel * 0.3;
      moveAngle = Math.random() * Math.PI * 2;
      moveRange = 1.0 + difficultyLevel * 0.1; // чуть сильнее колебания на высоких уровнях
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

/* Логика монет */
function updateCoins() {
  coinSpawnTimer++;
  let spawnInterval = Math.max(90 - difficultyLevel * 3, 30);

  if (coinSpawnTimer > spawnInterval) {
    spawnCoin();
    coinSpawnTimer = 0;
  }

  // Движение монет (двигаются влево)
  for (let i = 0; i < coins.length; i++) {
    coins[i].x -= coins[i].speed;
  }

  // Убираем монеты, которые вышли за левый край
  coins = coins.filter(c => c.x + c.w > 0);
}

/* Спавн монеты (random Y) */
function spawnCoin() {
  let cW = 30, cH = 30;
  let yPos = Math.random() * (game3Canvas.height - cH);

  coins.push({
    x: game3Canvas.width + 10,
    y: yPos,
    w: cW,
    h: cH,
    speed: 3, // скорость полёта монет
  });
}

/* Увеличение сложности со временем */
function updateDifficulty() {
  difficultyTimer++;
  if (difficultyTimer > 600) {
    difficultyLevel++;
    difficultyTimer = 0;
  }
}

/* Проверка столкновений (игрок-враг, игрок-монета) */
function checkCollisions() {
  // Столкновение с врагами
  for (let en of enemies) {
    if (isColliding(player, en)) {
      // Game Over
      onGameOver();
      return;
    }
  }
  // Сбор монет
  for (let i = 0; i < coins.length; i++) {
    let c = coins[i];
    if (isColliding(player, c)) {
      // Удаляем монету из массива
      coins.splice(i, 1);
      i--;
      // +5 очков
      currentScore += 5;
      // Обновляем localUserData.points на лету, чтобы пользователь видел в header
      localUserData.points = basePoints + currentScore;
      if (typeof updateTopBar === "function") {
        updateTopBar();
      }
    }
  }
}

/* Проверка AABB-столкновения */
function isColliding(a, b) {
  return !(
    a.x + a.w < b.x        ||
    a.x > b.x + b.w        ||
    a.y + a.h < b.y        ||
    a.y > b.y + b.h
  );
}

/* Игра окончена */
function onGameOver() {
  gameState = "over";
  // Добавляем финальные очки к пользователю (уже учтено в localUserData.points)
  // Вызываем глобальную модалку
  showEndGameModal("Game Over", `You scored ${currentScore} points!\nCoins collected: ${currentScore/5}.`);
  // Останавливаем рендер
  cancelAnimationFrame(gameLoopId);
}

/* Отрисовка сцены */
function drawScene() {
  // Сдвигаем фон для анимации
  bgX -= bgSpeed;
  if (bgX <= -game3Canvas.width) {
    bgX = 0;
  }
  
  // Рисуем два куска фона, чтобы зациклить
  drawBg(bgX, 0);
  drawBg(bgX + game3Canvas.width, 0);

  // Если игра не началась, покажем "Tap to start"
  if (gameState === "ready") {
    ctx3.fillStyle = "#fff";
    ctx3.font = "14px sans-serif";
    ctx3.fillText("TAP or SPACE to start", game3Canvas.width/2 - 80, game3Canvas.height/2);
    ctx3.fillText("Collect coins and avoid enemies!", game3Canvas.width/2 - 120, game3Canvas.height/2 + 20);
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

  // Если идёт игра, показываем текущие очки (в углу)
  if (gameState === "play") {
    ctx3.fillStyle = "#fff";
    ctx3.font = "14px sans-serif";
    ctx3.fillText(`Score: ${currentScore}`, 10, 20);
  }
}

/* Вспомогательная функция для рисования фона */
function drawBg(x, y) {
  ctx3.drawImage(bgImage, x, y, game3Canvas.width, game3Canvas.height);
}
