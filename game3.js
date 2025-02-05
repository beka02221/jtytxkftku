// game3.js

// Глобальные переменные внутри игры
let canvas, ctx;
let gameState;           // "waiting", "playing", "gameover"
let player;
let enemies = [];
let coins = [];
let background1, background2;
let score = 0;
let difficulty = 1;
let totalTime = 0;       // общее время игры (мс)
let lastEnemySpawn = 0;
let lastCoinSpawn = 0;
let lastTime = 0;
let animationFrameId;
let backgroundSpeed = 1; // скорость прокрутки фона
const gravity = 0.5;     // гравитация
const flapImpulse = -8;  // импульс при тапе

// Объект с изображениями
let images = {
  player: new Image(),
  enemy1: new Image(),
  enemy2: new Image(),
  enemy3: new Image(),
  coin: new Image(),
  background: new Image()
};

// Функция инициализации игры (вызывается из основного скрипта)
function initGame3() {
  canvas = document.getElementById("game3Canvas");
  ctx = canvas.getContext("2d");

  // Устанавливаем исходные значения игровых переменных
  gameState = "waiting";
  score = 0;
  totalTime = 0;
  difficulty = 1;
  lastEnemySpawn = 0;
  lastCoinSpawn = 0;
  lastTime = 0;
  enemies = [];
  coins = [];

  // Создаём игрока (главный персонаж)
  player = {
    x: 50,
    y: canvas.height / 2 - 25,
    width: 50,
    height: 50,
    velocity: 0
  };

  // Фон: два изображения для непрерывной прокрутки
  background1 = { x: 0, y: 0, width: canvas.width, height: canvas.height };
  background2 = { x: canvas.width, y: 0, width: canvas.width, height: canvas.height };

  // Загружаем ассеты
  images.player.src   = "https://tenor.com/bA9rc.gif";
  images.enemy1.src   = "https://i.gifer.com/XOsa.gif";
  images.enemy2.src   = "https://i.gifer.com/Vp3M.gif";
  images.enemy3.src   = "https://i.gifer.com/iHG.gif";
  images.coin.src     = "https://i.gifer.com/xt.gif";
  images.background.src = "https://i.gifer.com/7Fdd.gif";

  // Добавляем обработчики событий для управления (тап для старта и для "подпрыгивания")
  canvas.addEventListener("mousedown", onCanvasClick);
  canvas.addEventListener("touchstart", onCanvasClick);

  // Отрисовываем начальный экран ожидания
  draw();
}

// Обработчик клика/тапа по канвасу
function onCanvasClick(e) {
  e.preventDefault();
  if (gameState === "waiting") {
    // При первом тапе начинаем игру
    gameState = "playing";
    lastTime = 0; // сброс времени для цикла
    animationFrameId = requestAnimationFrame(loop);
  }
  if (gameState === "playing") {
    // При каждом тапе игрок "подпрыгивает"
    player.velocity = flapImpulse;
  }
}

// Главный игровой цикл
function loop(timestamp) {
  if (!lastTime) lastTime = timestamp;
  let dt = timestamp - lastTime;
  lastTime = timestamp;

  update(dt);
  draw();

  if (gameState !== "gameover") {
    animationFrameId = requestAnimationFrame(loop);
  }
}

// Обновление игровых объектов
function update(dt) {
  totalTime += dt;
  // Увеличиваем сложность со временем (например, каждые 10 сек сложность растёт)
  difficulty = 1 + totalTime / 10000;

  // Обновляем позицию игрока под действием гравитации
  player.velocity += gravity;
  player.y += player.velocity;

  // Если игрок вышел за пределы экрана – игра окончена
  if (player.y < 0 || player.y + player.height > canvas.height) {
    gameOver();
  }

  // Обновляем фон (горизонтальная прокрутка)
  background1.x -= backgroundSpeed;
  background2.x -= backgroundSpeed;
  if (background1.x <= -canvas.width) {
    background1.x = background2.x + canvas.width;
  }
  if (background2.x <= -canvas.width) {
    background2.x = background1.x + canvas.width;
  }

  // Если прошло достаточно времени – создаём нового врага
  if (totalTime - lastEnemySpawn > enemySpawnInterval()) {
    spawnEnemy();
    lastEnemySpawn = totalTime;
  }

  // Если прошло достаточно времени – создаём монету
  if (totalTime - lastCoinSpawn > coinSpawnInterval()) {
    spawnCoin();
    lastCoinSpawn = totalTime;
  }

  // Обновляем позицию врагов
  for (let i = enemies.length - 1; i >= 0; i--) {
    enemies[i].x -= enemies[i].speed;
    // Если враг вышел за левую границу – удаляем его
    if (enemies[i].x + enemies[i].width < 0) {
      enemies.splice(i, 1);
    } else if (isColliding(player, enemies[i])) {
      // Столкновение с врагом – конец игры
      gameOver();
    }
  }

  // Обновляем монеты
  for (let i = coins.length - 1; i >= 0; i--) {
    coins[i].x -= coins[i].speed;
    if (coins[i].x + coins[i].width < 0) {
      coins.splice(i, 1);
    } else if (isColliding(player, coins[i])) {
      // При сборе монеты прибавляем 5 очков
      score += 5;
      coins.splice(i, 1);
    }
  }
}

// Функция, возвращающая интервал появления врагов (в мс)
function enemySpawnInterval() {
  return 2000 / difficulty; // чем выше сложность, тем быстрее появляются враги
}

// Функция, возвращающая интервал появления монет (в мс)
function coinSpawnInterval() {
  return 1500 / difficulty;
}

// Создание нового врага
function spawnEnemy() {
  let type = Math.floor(Math.random() * 3) + 1; // 1, 2 или 3
  let enemy = {};
  enemy.type = type;
  enemy.width = 50;
  enemy.height = 50;
  enemy.x = canvas.width;
  enemy.y = Math.random() * (canvas.height - enemy.height);
  // Задаём скорость и изображение в зависимости от типа
  if (type === 1) {
    enemy.speed = 3 * difficulty;
    enemy.img = images.enemy1;
  } else if (type === 2) {
    enemy.speed = 2.5 * difficulty;
    enemy.img = images.enemy2;
  } else if (type === 3) {
    enemy.speed = 4 * difficulty;
    enemy.img = images.enemy3;
  }
  enemies.push(enemy);
}

// Создание монеты
function spawnCoin() {
  let coin = {};
  coin.width = 30;
  coin.height = 30;
  coin.x = canvas.width;
  coin.y = Math.random() * (canvas.height - coin.height);
  coin.speed = 3 * difficulty;
  coin.img = images.coin;
  coins.push(coin);
}

// Простейшая проверка столкновения (AABB)
function isColliding(a, b) {
  return !(a.x > b.x + b.width ||
           a.x + a.width < b.x ||
           a.y > b.y + b.height ||
           a.y + a.height < b.y);
}

// Отрисовка игры
function draw() {
  // Очищаем холст
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  // Рисуем фон (две копии для эффекта бесшовной прокрутки)
  ctx.drawImage(images.background, background1.x, background1.y, background1.width, background1.height);
  ctx.drawImage(images.background, background2.x, background2.y, background2.width, background2.height);

  // Рисуем игрока
  ctx.drawImage(images.player, player.x, player.y, player.width, player.height);

  // Рисуем всех врагов
  enemies.forEach(function(enemy) {
    ctx.drawImage(enemy.img, enemy.x, enemy.y, enemy.width, enemy.height);
  });

  // Рисуем все монеты
  coins.forEach(function(coin) {
    ctx.drawImage(coin.img, coin.x, coin.y, coin.width, coin.height);
  });

  // Рисуем текущий счёт
  ctx.fillStyle = "#00FF00";
  ctx.font = "20px 'Press Start 2P'";
  ctx.fillText("Score: " + score, 10, 30);

  // Если игра не началась – отображаем инструктаж
  if (gameState === "waiting") {
    ctx.fillStyle = "rgba(0,0,0,0.5)";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = "#00FF00";
    ctx.font = "24px 'Press Start 2P'";
    ctx.textAlign = "center";
    ctx.fillText("Tap to Start", canvas.width / 2, canvas.height / 2 - 20);
    ctx.font = "16px 'Press Start 2P'";
    ctx.fillText("Tap to flap", canvas.width / 2, canvas.height / 2 + 10);
    ctx.fillText("Avoid enemies & collect coins", canvas.width / 2, canvas.height / 2 + 30);
    ctx.textAlign = "start";
  }

  // Если игра окончена, можно (дополнительно) отобразить надпись Game Over
  if (gameState === "gameover") {
    ctx.fillStyle = "rgba(0,0,0,0.5)";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = "#FF0000";
    ctx.font = "30px 'Press Start 2P'";
    ctx.textAlign = "center";
    ctx.fillText("Game Over", canvas.width / 2, canvas.height / 2);
    ctx.textAlign = "start";
  }
}

// Завершение игры: останавливаем цикл, обновляем глобальные очки и показываем модальное окно
function gameOver() {
  gameState = "gameover";
  cancelAnimationFrame(animationFrameId);
  // Обновляем глобальное значение очков (для записи в базу данных)
  if (typeof updateTopBar === "function") {
    localUserData.points = score;
    updateTopBar();
  }
  // Вызываем глобальное окно с итогами (функция определена в основном HTML)
  if (typeof showEndGameModal === "function") {
    showEndGameModal("Game Over", "Your Score: " + score);
  }
}

// Функция сброса игры (вызывается из основного скрипта)
function resetGame3() {
  cancelAnimationFrame(animationFrameId);
  if (canvas) {
    canvas.removeEventListener("mousedown", onCanvasClick);
    canvas.removeEventListener("touchstart", onCanvasClick);
  }
  // Сбрасываем переменные
  canvas = null;
  ctx = null;
  gameState = null;
  player = null;
  enemies = [];
  coins = [];
  score = 0;
  totalTime = 0;
  difficulty = 1;
  lastEnemySpawn = 0;
  lastCoinSpawn = 0;
  animationFrameId = null;
}
