// =======================
// Game 3 (Side-Scrolling Game)
// =======================

let ctx;
let animationId;
let isGameRunning = false;

let canvasWidth = 0;
let canvasHeight = 0;

// Контейнер для добавления DOM‑элементов игры (например, спрайтов)
let gameContainer;

// Player (Kirby)
const player = {
  x: 100,
  y: 150,
  width: 45,
  height: 45,
  velocityY: 0,
  gravity: 0.3,
  lift: -5,
  alive: true,
  maxFallSpeed: 3,
  el: null
};

// Скорость прокрутки фона и движения объектов
const scrollSpeed = 1.8;

// Враги
let enemies = [];
const enemyGif = "https://i.pinimg.com/originals/4b/4f/a1/4b4fa16fff0d9782b6e53db976f89f78.gif";
const enemyWidth  = 80;
const enemyHeight = 80;
const enemyInterval = 150; // интервал появления врагов (в кадрах)
let enemyTimer = 0;

// Монеты
let coins = [];
const coinSize = 40;
const coinGifURL = "https://donatepay.ru/uploads/notification/images/830208_1664005822.gif";
const coinInterval = 80; // интервал появления монет
let coinTimer = 0;

// Счёт за забег (количество собранных монет)
let scoreThisRun = 0;

// Фон
const bgImage = new Image();
bgImage.src = "https://i.pinimg.com/736x/20/e9/cf/20e9cf219337614640886180cc5d1c34.jpg";
let bgX = 0;

// Запас для проверки столкновений (чтобы не реагировать на мельчайшие пересечения)
const collisionMargin = 10;

/**
 * Инициализирует игру (вызывается из основного скрипта при выборе "Game 3")
 */
function initGame3() {
  // Получаем canvas для Game 3 (он уже присутствует в index.html)
  const canvas = document.getElementById("game3Canvas");
  
  // Определяем контейнер для DOM‑элементов игры (спрайтов врагов, монет, игрока)
  // В нашем index.html контейнером является блок с классом "game-canvas"
  gameContainer = document.querySelector("#gameModalBackdrop .game-canvas");
  // Если позиционирование не задано, делаем контейнер относительным
  if (getComputedStyle(gameContainer).position === "static") {
    gameContainer.style.position = "relative";
  }
  
  ctx = canvas.getContext("2d");
  canvas.style.display = "block";
  resizeCanvas();
  
  // Сброс игровых переменных
  isGameRunning = true;
  player.y = canvasHeight / 2;
  player.velocityY = 0;
  player.alive = true;
  
  enemies = [];
  enemyTimer = 0;
  coins = [];
  coinTimer = 0;
  
  scoreThisRun = 0;
  bgX = 0;
  
  // Создаём или показываем игрока (Kirby)
  if (!player.el) {
    const kirby = document.createElement("img");
    kirby.src = "kirby.gif"; // замените при необходимости на свой спрайт
    kirby.style.position = "absolute";
    kirby.style.width  = player.width + "px";
    kirby.style.height = player.height + "px";
    kirby.style.left   = player.x + "px";
    kirby.style.top    = player.y + "px";
    kirby.style.zIndex = "900";
    gameContainer.appendChild(kirby);
    player.el = kirby;
  } else {
    player.el.style.display = "block";
  }
  
  // Добавляем обработчики ввода (пробел, клик, касание)
  document.addEventListener("keydown", onKeyDown);
  document.addEventListener("mousedown", onClickOrTouch);
  document.addEventListener("touchstart", onClickOrTouch);
  
  animationId = requestAnimationFrame(updateGame);
}

/**
 * При изменении размеров окна корректирует размер canvas
 */
function resizeCanvas() {
  canvasWidth  = window.innerWidth;
  canvasHeight = window.innerHeight;
  const canvas = document.getElementById("game3Canvas");
  canvas.width  = canvasWidth;
  canvas.height = canvasHeight;
}

/**
 * Главный игровой цикл
 */
function updateGame() {
  if (!isGameRunning) return;
  ctx.clearRect(0, 0, canvasWidth, canvasHeight);
  
  // Рисуем фон
  drawScrollingBackground();
  
  // Создаём врагов через определённый интервал
  enemyTimer++;
  if (enemyTimer > enemyInterval) {
    createEnemy();
    enemyTimer = 0;
  }
  // Обновляем позицию врагов и проверяем столкновения
  for (let i = 0; i < enemies.length; i++) {
    const e = enemies[i];
    e.x -= scrollSpeed;
    e.el.style.left = e.x + "px";
    e.el.style.top  = e.y + "px";
    if (checkCollision(player, e)) {
      gameOver();
    }
  }
  // Удаляем врагов, ушедших за левый край
  enemies = enemies.filter(e => {
    if (e.x + e.width < 0) {
      if (e.el && e.el.parentNode) {
        e.el.parentNode.removeChild(e.el);
      }
      return false;
    }
    return true;
  });
  
  // Создаём монеты через заданный интервал
  coinTimer++;
  if (coinTimer > coinInterval) {
    createCoin();
    coinTimer = 0;
  }
  // Обновляем монеты и проверяем сбор
  for (let i = 0; i < coins.length; i++) {
    const c = coins[i];
    c.x -= scrollSpeed;
    c.el.style.left = c.x + "px";
    c.el.style.top  = c.y + "px";
    if (checkCollision(player, c)) {
      scoreThisRun++;
      c.collected = true;
    }
  }
  coins = coins.filter(c => {
    if (c.collected || (c.x + c.size < 0)) {
      if (c.el && c.el.parentNode) {
        c.el.parentNode.removeChild(c.el);
      }
      return false;
    }
    return true;
  });
  
  // Обновляем позицию игрока (Kirby)
  updatePlayer();
  
  // Отображаем счёт (количество собранных монет) на canvas
  ctx.fillStyle = "white";
  ctx.font = "24px Arial";
  ctx.fillText(`Coins this run: ${scoreThisRun}`, 20, 40);
  
  if (player.alive) {
    animationId = requestAnimationFrame(updateGame);
  }
}

/**
 * Функция для прорисовки прокручивающегося фона
 */
function drawScrollingBackground() {
  bgX -= 1;
  if (bgX <= -canvasWidth) {
    bgX = 0;
  }
  ctx.drawImage(bgImage, bgX, 0, canvasWidth, canvasHeight);
  ctx.drawImage(bgImage, bgX + canvasWidth, 0, canvasWidth, canvasHeight);
}

/**
 * Создаёт врага и добавляет его в массив enemies
 */
function createEnemy() {
  const randY = Math.random() * (canvasHeight - enemyHeight - 20) + 10;
  const enemyEl = document.createElement("img");
  enemyEl.src = enemyGif;
  enemyEl.style.position = "absolute";
  enemyEl.style.width  = enemyWidth  + "px";
  enemyEl.style.height = enemyHeight + "px";
  enemyEl.style.left   = canvasWidth + "px";
  enemyEl.style.top    = randY + "px";
  enemyEl.style.zIndex = "850";
  gameContainer.appendChild(enemyEl);
  
  enemies.push({
    x: canvasWidth,
    y: randY,
    width: enemyWidth,
    height: enemyHeight,
    el: enemyEl
  });
}

/**
 * Создаёт монету и добавляет её в массив coins
 */
function createCoin() {
  const randY = Math.random() * (canvasHeight - coinSize - 20) + 10;
  const coinEl = document.createElement("img");
  coinEl.src = coinGifURL;
  coinEl.style.position = "absolute";
  coinEl.style.width  = coinSize + "px";
  coinEl.style.height = coinSize + "px";
  coinEl.style.left   = canvasWidth + "px";
  coinEl.style.top    = randY + "px";
  coinEl.style.zIndex = "800";
  gameContainer.appendChild(coinEl);
  
  coins.push({
    x: canvasWidth,
    y: randY,
    size: coinSize,
    collected: false,
    el: coinEl
  });
}

/**
 * Обновляет положение игрока (Kirby) с учётом гравитации и прыжка
 */
function updatePlayer() {
  player.velocityY += player.gravity;
  if (player.velocityY > player.maxFallSpeed) {
    player.velocityY = player.maxFallSpeed;
  }
  player.y += player.velocityY;
  
  if (player.y < 0) {
    player.y = 0;
    player.velocityY = 0;
  }
  // Если игрок опускается ниже нижнего края, завершаем игру
  if (player.y + player.height > canvasHeight) {
    gameOver();
  }
  player.el.style.left = player.x + "px";
  player.el.style.top  = player.y + "px";
}

/**
 * Обработчики ввода (пробел, клик, касание)
 */
function onKeyDown(e) {
  if (e.code === "Space") {
    flap();
  }
}
function onClickOrTouch() {
  flap();
}
function flap() {
  player.velocityY = player.lift;
}

/**
 * Проверяет столкновение объекта игрока с переданным объектом (врагом или монетой)
 */
function checkCollision(pl, obj) {
  const pr = {
    x: pl.x + collisionMargin,
    y: pl.y + collisionMargin,
    width: pl.width - collisionMargin * 2,
    height: pl.height - collisionMargin * 2
  };
  const ow = (obj.width || obj.size) - collisionMargin * 2;
  const oh = (obj.height || obj.size) - collisionMargin * 2;
  const or = {
    x: obj.x + collisionMargin,
    y: obj.y + collisionMargin,
    width: ow > 0 ? ow : 0,
    height: oh > 0 ? oh : 0
  };
  
  return !(
    or.x > pr.x + pr.width ||
    or.x + or.width < pr.x ||
    or.y > pr.y + pr.height ||
    or.y + or.height < pr.y
  );
}

/**
 * Завершение игры: останавливает игровой цикл, убирает обработчики ввода,
 * добавляет собранные монеты к общему количеству игрока и вызывает переход к
 * завершающему окну (вызовется функция finishGame() из основного скрипта).
 */
function gameOver() {
  player.alive = false;
  cancelAnimationFrame(animationId);
  document.removeEventListener("keydown", onKeyDown);
  document.removeEventListener("mousedown", onClickOrTouch);
  document.removeEventListener("touchstart", onClickOrTouch);
  isGameRunning = false;
  
  // Добавляем заработанные монеты к общему количеству.
  // Глобальные переменные localUserData и userRef определены в основном скрипте index.html
  if (typeof localUserData !== 'undefined' && typeof userRef !== 'undefined') {
    localUserData.coins = (localUserData.coins || 0) + scoreThisRun;
    userRef.update({ coins: localUserData.coins });
  }
  
  endGameAndReturn();
}

/**
 * Завершает игру: удаляет все объекты (врагов, монеты, игрока) из DOM и скрывает canvas.
 * (Функция вызывается при окончании игры, а основной скрипт затем закрывает модальное окно игры.)
 */
function endGameAndReturn() {
  if (isGameRunning) {
    cancelAnimationFrame(animationId);
    document.removeEventListener("keydown", onKeyDown);
    document.removeEventListener("mousedown", onClickOrTouch);
    document.removeEventListener("touchstart", onClickOrTouch);
    isGameRunning = false;
    if (typeof localUserData !== 'undefined' && typeof userRef !== 'undefined') {
      localUserData.coins = (localUserData.coins || 0) + scoreThisRun;
      userRef.update({ coins: localUserData.coins });
    }
  }
  
  if (player.el) {
    player.el.style.display = "none";
  }
  enemies.forEach(e => {
    if (e.el && e.el.parentNode) {
      e.el.parentNode.removeChild(e.el);
    }
  });
  enemies = [];
  coins.forEach(c => {
    if (c.el && c.el.parentNode) {
      c.el.parentNode.removeChild(c.el);
    }
  });
  coins = [];
  
  // Скрываем canvas (основной скрипт закроет окно игры)
  const canvas = document.getElementById("game3Canvas");
  canvas.style.display = "none";
}

/**
 * Функция для сброса игры (вызывается из основного скрипта при закрытии игрового окна)
 */
function resetGame3() {
  cancelAnimationFrame(animationId);
  document.removeEventListener("keydown", onKeyDown);
  document.removeEventListener("mousedown", onClickOrTouch);
  document.removeEventListener("touchstart", onClickOrTouch);
  isGameRunning = false;
  
  if (player.el) {
    player.el.style.display = "none";
  }
  enemies.forEach(e => {
    if (e.el && e.el.parentNode) {
      e.el.parentNode.removeChild(e.el);
    }
  });
  enemies = [];
  coins.forEach(c => {
    if (c.el && c.el.parentNode) {
      c.el.parentNode.removeChild(c.el);
    }
  });
  coins = [];
  
  const canvas = document.getElementById("game3Canvas");
  canvas.style.display = "none";
}
