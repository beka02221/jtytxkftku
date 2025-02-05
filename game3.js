// game3.js

// Глобальные переменные игры
let canvas, ctx;
let bird;
let enemies = [];
let coins = [];
let enemyTimer = 0;
let coinTimer = 0;
let enemyInterval = 2000; // мс, базовый интервал появления врагов
let coinInterval = 3000;  // мс, базовый интервал появления монет
let gameLoopId;
let lastTime;
let gameOver = false;
let gameStarted = false; // Игра начнётся по первому тапу
let startTime;           // Время начала игры (после старта)
let difficultyFactor = 1; // Фактор сложности (растёт с течением времени)

// Фон
let bgImage = new Image();
bgImage.src = "https://i.imgur.com/2s2JtqX.png";  
// Этот фон (пример) должен быть бесшовным и двигаться влево, создавая эффект полёта.
let bgX = 0;
let bgSpeed = 1;

// Ассеты персонажа и врагов/монет (согласно вашим ссылкам)
const ASSETS = {
  bird: "https://tenor.com/bA9rc.gif",
  enemy1: "https://i.gifer.com/XOsa.gif",
  enemy2: "https://i.gifer.com/Vp3M.gif", // будет иметь вертикальное движение
  enemy3: "https://i.gifer.com/iHG.gif",
  coin: "https://i.gifer.com/xt.gif"
};

// Инициализация игры (вызывается из index.html при выборе game3)
function initGame3() {
  canvas = document.getElementById("game3Canvas");
  ctx = canvas.getContext("2d");

  // Инициализируем главный персонаж (птичку)
  bird = {
    x: canvas.width * 0.25,
    y: canvas.height / 2,
    width: 50,
    height: 40,
    velocity: 0,
    gravity: 0.5,
    jumpStrength: -8,
    image: new Image()
  };
  bird.image.src = ASSETS.bird;

  // Сбрасываем врагов и монеты
  enemies = [];
  coins = [];
  enemyTimer = 0;
  coinTimer = 0;
  enemyInterval = 2000;
  coinInterval = 3000;
  bgX = 0;
  difficultyFactor = 1;
  gameOver = false;
  gameStarted = false;

  // Отобразим обучалку и надпись "TAP TO START"
  lastTime = performance.now();
  // Добавляем обработчики ввода
  window.addEventListener("keydown", onStartInput);
  canvas.addEventListener("mousedown", onStartInput);
  canvas.addEventListener("touchstart", onStartInput);

  // Запускаем игровой цикл (в режиме ожидания старта)
  gameLoopId = requestAnimationFrame(gameLoop);
}

// Обработчик первого ввода для старта игры
function onStartInput(e) {
  if (!gameStarted) {
    gameStarted = true;
    startTime = performance.now();
    // После старта переключаем обработчики ввода на игровой (flap) режим
    window.removeEventListener("keydown", onStartInput);
    canvas.removeEventListener("mousedown", onStartInput);
    canvas.removeEventListener("touchstart", onStartInput);
    window.addEventListener("keydown", onKeyDown);
    canvas.addEventListener("mousedown", onMouseDown);
    canvas.addEventListener("touchstart", onTouchStart);
    birdFlap(); // первый "прыжок" для старта
  }
}

// Обработчики для управления птичкой (после старта)
function onKeyDown(e) {
  if (e.code === "Space") {
    birdFlap();
  }
}
function onMouseDown(e) {
  birdFlap();
}
function onTouchStart(e) {
  birdFlap();
}

// Функция подпрыгивания птички
function birdFlap() {
  bird.velocity = bird.jumpStrength;
}

// Игровой цикл
function gameLoop(timestamp) {
  let deltaTime = timestamp - lastTime;
  lastTime = timestamp;

  // Обновляем фон (движение влево)
  bgX -= bgSpeed * difficultyFactor;
  if (bgX <= -canvas.width) {
    bgX = 0;
  }

  // Отрисовка движущегося фона (двойной рисунок для зацикливания)
  drawBackground();

  // Если игра ещё не запущена, выводим обучалку и надпись
  if (!gameStarted) {
    drawStartScreen();
    gameLoopId = requestAnimationFrame(gameLoop);
    return;
  }

  // Обновляем сложность: чем дольше игра, тем быстрее враги и монеты
  let elapsed = timestamp - startTime;
  difficultyFactor = 1 + elapsed / 30000; // каждые 30 секунд сложность увеличивается

  // Физика птички
  bird.velocity += bird.gravity;
  bird.y += bird.velocity;
  if (bird.y < 0) bird.y = 0;
  if (bird.y + bird.height > canvas.height) {
    bird.y = canvas.height - bird.height;
    endGame();
    return;
  }

  // Обновление таймеров появления врагов и монет
  enemyTimer += deltaTime;
  coinTimer += deltaTime;
  if (enemyTimer > enemyInterval / difficultyFactor) {
    spawnEnemy();
    enemyTimer = 0;
    enemyInterval = 1500 + Math.random() * 1000; // случайный интервал
  }
  if (coinTimer > coinInterval / difficultyFactor) {
    spawnCoin();
    coinTimer = 0;
    coinInterval = 2000 + Math.random() * 2000;
  }

  // Обновляем позиции врагов
  for (let i = enemies.length - 1; i >= 0; i--) {
    let enemy = enemies[i];
    enemy.x += enemy.speed * deltaTime / 16 * difficultyFactor;
    // Для врага №2 добавляем вертикальное движение
    if (enemy.type === 2) {
      enemy.y += enemy.vy * deltaTime / 16;
      // Отскок от верхней и нижней границ
      if (enemy.y < 0 || enemy.y + enemy.height > canvas.height) {
        enemy.vy = -enemy.vy;
      }
    }
    if (enemy.x > canvas.width + enemy.width) {
      enemies.splice(i, 1);
    } else if (rectIntersect(bird, enemy)) {
      endGame();
      return;
    }
  }

  // Обновляем позиции монет
  for (let i = coins.length - 1; i >= 0; i--) {
    let coin = coins[i];
    coin.x += coin.speed * deltaTime / 16 * difficultyFactor;
    if (coin.x > canvas.width + coin.width) {
      coins.splice(i, 1);
    } else if (!coin.collected && rectIntersect(bird, coin)) {
      coin.collected = true;
      localUserData.points = (localUserData.points || 0) + 5;
      updateTopBar();
      coins.splice(i, 1);
    }
  }

  // Отрисовка птички
  ctx.drawImage(bird.image, bird.x, bird.y, bird.width, bird.height);

  // Отрисовка врагов
  enemies.forEach(enemy => {
    ctx.drawImage(enemy.image, enemy.x, enemy.y, enemy.width, enemy.height);
  });

  // Отрисовка монет
  coins.forEach(coin => {
    ctx.drawImage(coin.image, coin.x, coin.y, coin.width, coin.height);
  });

  // Отрисовка текущего счёта
  drawScore();

  if (!gameOver) {
    gameLoopId = requestAnimationFrame(gameLoop);
  }
}

// Функция отрисовки движущегося фона
function drawBackground() {
  // Рисуем два изображения фона для создания эффекта зацикливания
  ctx.drawImage(bgImage, bgX, 0, canvas.width, canvas.height);
  ctx.drawImage(bgImage, bgX + canvas.width, 0, canvas.width, canvas.height);
}

// Функция отрисовки стартового экрана (обучалка + надпись)
function drawStartScreen() {
  ctx.fillStyle = "rgba(0,0,0,0.5)";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = "#00FF00";
  ctx.font = "24px 'Press Start 2P'";
  ctx.textAlign = "center";
  ctx.fillText("TAP TO START", canvas.width / 2, canvas.height / 2 - 20);
  ctx.font = "16px 'Press Start 2P'";
  ctx.fillText("Tap to flap, avoid enemies", canvas.width / 2, canvas.height / 2 + 10);
  ctx.fillText("and collect coins. The longer you survive,", canvas.width / 2, canvas.height / 2 + 30);
  ctx.fillText("the harder it gets!", canvas.width / 2, canvas.height / 2 + 50);
}

// Функция отрисовки текущего счёта на canvas
function drawScore() {
  ctx.fillStyle = "#00FF00";
  ctx.font = "20px 'Press Start 2P'";
  ctx.textAlign = "left";
  ctx.fillText("Score: " + (localUserData.points || 0), 10, 30);
}

// Функция создания врага
function spawnEnemy() {
  // Определяем тип врага случайным образом: 1, 2 или 3
  let type = Math.floor(Math.random() * 3) + 1;
  let img = new Image();
  if (type === 1) {
    img.src = ASSETS.enemy1;
  } else if (type === 2) {
    img.src = ASSETS.enemy2;
  } else {
    img.src = ASSETS.enemy3;
  }
  let enemy = {
    x: -50,
    y: Math.random() * (canvas.height - 50),
    width: 50,
    height: 50,
    speed: 2 + Math.random() * 3,
    image: img,
    type: type
  };
  // Для врага типа 2 добавляем вертикальное движение
  if (type === 2) {
    enemy.vy = 1.5 + Math.random() * 2; // вертикальная скорость
  }
  enemies.push(enemy);
}

// Функция создания монеты
function spawnCoin() {
  let coin = {
    x: -30,
    y: Math.random() * (canvas.height - 30),
    width: 30,
    height: 30,
    speed: 2 + Math.random() * 2,
    image: new Image(),
    collected: false
  };
  coin.image.src = ASSETS.coin;
  coins.push(coin);
}

// Функция проверки пересечения прямоугольников (коллизии)
function rectIntersect(a, b) {
  return a.x < b.x + b.width &&
         a.x + a.width > b.x &&
         a.y < b.y + b.height &&
         a.y + a.height > b.y;
}

// Функция завершения игры
function endGame() {
  gameOver = true;
  cancelAnimationFrame(gameLoopId);
  // Убираем обработчики ввода
  window.removeEventListener("keydown", onKeyDown);
  canvas.removeEventListener("mousedown", onMouseDown);
  canvas.removeEventListener("touchstart", onTouchStart);
  // Вызов глобального окна с итогами (функция showEndGameModal определена в index.html)
  showEndGameModal("Game Over", "Your score: " + (localUserData.points || 0));
}

// Функция сброса игры (вызывается из index.html после завершения игры)
function resetGame3() {
  cancelAnimationFrame(gameLoopId);
  window.removeEventListener("keydown", onKeyDown);
  canvas.removeEventListener("mousedown", onMouseDown);
  canvas.removeEventListener("touchstart", onTouchStart);
  enemies = [];
  coins = [];
  gameOver = false;
}

