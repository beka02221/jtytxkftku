// Глобальные переменные для canvas и анимации
let ctx;
let animationId;
let isGameRunning = false;

let canvasWidth  = 0;
let canvasHeight = 0;

// Кирби (игрок)
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

// Скорость скроллинга фона и движения врагов/монет
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

// Счёт за забег
let scoreThisRun = 0;

// Фон (side-scrolling)
const bgImage = new Image();
bgImage.src = "https://i.pinimg.com/736x/20/e9/cf/20e9cf219337614640886180cc5d1c34.jpg";
let bgX = 0;

// Отступ при столкновении (чтобы не умирать за «милиметр»)
const collisionMargin = 10;

/* === ИНИЦИАЛИЗАЦИЯ ПРИ ЗАГРУЗКЕ === */
window.addEventListener("load", () => {
  // Предполагается, что элементы loginScreen, usernameInput и т.д. уже существуют в HTML
  const savedUsername = localStorage.getItem("username");
  if (savedUsername) {
    autoLogin(savedUsername);
  } else {
    loginScreen.style.display = "flex";
  }
});

async function autoLogin(username) {
  const userRef = ref(db, `users/${username}`);
  const snapshot = await get(userRef);
  let coinsVal = 0;
  if (snapshot.exists()) {
    coinsVal = snapshot.val().coins || 0;
  }
  displayMainMenu(username, coinsVal);
}

loginButton.addEventListener("click", async () => {
  const username = usernameInput.value.trim();
  if (!username.startsWith("@")) {
    return;
  }
  await loginUser(username);
});

async function loginUser(username) {
  const userRef = ref(db, `users/${username}`);
  const snapshot = await get(userRef);
  let coinsVal = 0;
  if (!snapshot.exists()) {
    await set(userRef, { coins: 0 });
  } else {
    coinsVal = snapshot.val().coins || 0;
  }
  localStorage.setItem("username", username);
  displayMainMenu(username, coinsVal);
}

function displayMainMenu(username, coinsVal) {
  currentUsername = username;
  currentCoins = coinsVal;

  loginScreen.style.display = "none";
  gameContainer.style.display = "none";
  leaderboardContainer.style.display = "none";
  storeContainer.style.display = "none";
  infoContainer.style.display = "none";

  mainMenu.style.display = "block";
  userDisplay.textContent  = `Username: ${username}`;
  coinsDisplay.textContent = `Монет: ${coinsVal}`;
}

/* === КНОПКИ МЕНЮ === */
startGameBtn.addEventListener("click", () => {
  mainMenu.style.display = "none";
  startGame();
});
leaderboardBtn.addEventListener("click", () => {
  mainMenu.style.display = "none";
  leaderboardContainer.style.display = "block";
  loadLeaderboard();
});
storeBtn.addEventListener("click", () => {
  mainMenu.style.display = "none";
  storeContainer.style.display = "block";
});
infoBtn.addEventListener("click", () => {
  mainMenu.style.display = "none";
  infoContainer.style.display = "block";
});

async function loadLeaderboard() {
  leaderboardBody.innerHTML = "";
  const usersRef = ref(db, "users/");
  const snapshot = await get(usersRef);
  if (snapshot.exists()) {
    const data = snapshot.val();
    const usersArray = Object.keys(data).map(key => {
      return { username: key, coins: data[key].coins || 0 };
    });
    usersArray.sort((a, b) => b.coins - a.coins);
    usersArray.forEach(user => {
      const tr = document.createElement("tr");
      const tdName = document.createElement("td");
      const tdCoins = document.createElement("td");
      tdName.textContent = user.username;
      tdCoins.textContent = user.coins;
      tr.appendChild(tdName);
      tr.appendChild(tdCoins);
      leaderboardBody.appendChild(tr);
    });
  }
}
leaderboardBackBtn.addEventListener("click", () => {
  leaderboardContainer.style.display = "none";
  displayMainMenu(currentUsername, currentCoins);
});
storeBackBtn.addEventListener("click", () => {
  storeContainer.style.display = "none";
  displayMainMenu(currentUsername, currentCoins);
});
infoBackBtn.addEventListener("click", () => {
  infoContainer.style.display = "none";
  displayMainMenu(currentUsername, currentCoins);
});

/* === СТАРТ ИГРЫ === */
function startGame() {
  gameContainer.style.display = "block";
  ctx = gameCanvas.getContext("2d");
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

  // Создание (или показ) Кирби
  if (!player.el) {
    const kirby = document.createElement("img");
    kirby.src = "kirby.gif";
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

  document.addEventListener("keydown", onKeyDown);
  document.addEventListener("mousedown", onClickOrTouch);
  document.addEventListener("touchstart", onClickOrTouch);

  animationId = requestAnimationFrame(updateGame);
}

/* АДАПТАЦИЯ CANVAS */
window.addEventListener("resize", () => {
  if (isGameRunning) {
    resizeCanvas();
  }
});
function resizeCanvas() {
  canvasWidth  = window.innerWidth;
  canvasHeight = window.innerHeight;
  gameCanvas.width  = canvasWidth;
  gameCanvas.height = canvasHeight;
}

/* ГЛАВНЫЙ ЦИКЛ ИГРЫ */
function updateGame() {
  if (!isGameRunning) return;
  ctx.clearRect(0, 0, canvasWidth, canvasHeight);

  // Фон
  drawScrollingBackground();

  // Генерация врагов
  enemyTimer++;
  if (enemyTimer > enemyInterval) {
    createEnemy();
    enemyTimer = 0;
  }
  // Обновление врагов
  for (let i = 0; i < enemies.length; i++) {
    const e = enemies[i];
    e.x -= scrollSpeed;
    e.el.style.left = e.x + "px";
    e.el.style.top  = e.y + "px";
    if (checkCollision(player, e)) {
      gameOver();
    }
  }
  enemies = enemies.filter(e => {
    if (e.x + e.width < 0) {
      gameContainer.removeChild(e.el);
      return false;
    }
    return true;
  });

  // Генерация монет
  coinTimer++;
  if (coinTimer > coinInterval) {
    createCoin();
    coinTimer = 0;
  }
  // Обновление монет
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
      gameContainer.removeChild(c.el);
      return false;
    }
    return true;
  });

  // Обновление позиции Кирби
  updatePlayer();

  // Отображение счёта
  ctx.fillStyle = "white";
  ctx.font = "24px Arial";
  ctx.fillText(`Монет за забег: ${scoreThisRun}`, 20, 40);

  if (player.alive) {
    animationId = requestAnimationFrame(updateGame);
  }
}

/* ФУНКЦИЯ СКРОЛЛА ФОНА */
function drawScrollingBackground() {
  bgX -= 1;
  if (bgX <= -canvasWidth) {
    bgX = 0;
  }
  ctx.drawImage(bgImage, bgX, 0, canvasWidth, canvasHeight);
  ctx.drawImage(bgImage, bgX + canvasWidth, 0, canvasWidth, canvasHeight);
}

/* СОЗДАНИЕ ВРАГА */
function createEnemy() {
  const randY = Math.random() * (canvasHeight - enemyHeight - 20) + 10;
  const enemyEl = document.createElement("img");
  enemyEl.src = enemyGif;
  enemyEl.style.position = "absolute";
  enemyEl.style.width  = enemyWidth + "px";
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

/* СОЗДАНИЕ МОНЕТЫ */
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

/* ОБНОВЛЕНИЕ ПОЛЁТА КИРБИ */
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
  if (player.y + player.height > canvasHeight) {
    gameOver();
  }
  player.el.style.left = player.x + "px";
  player.el.style.top  = player.y + "px";
}

/* УПРАВЛЕНИЕ (ПРЫЖОК) */
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

/* ПРОВЕРКА СТОЛКНОВЕНИЯ (с отступом) */
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

/* GAME OVER */
function gameOver() {
  player.alive = false;
  cancelAnimationFrame(animationId);
  document.removeEventListener("keydown", onKeyDown);
  document.removeEventListener("mousedown", onClickOrTouch);
  document.removeEventListener("touchstart", onClickOrTouch);
  isGameRunning = false;

  currentCoins += scoreThisRun;
  updateCoinsInDB();

  endGameAndReturn();
}

/* ВЫХОД ИЗ ИГРЫ */
function endGameAndReturn() {
  if (isGameRunning) {
    cancelAnimationFrame(animationId);
    document.removeEventListener("keydown", onKeyDown);
    document.removeEventListener("mousedown", onClickOrTouch);
    document.removeEventListener("touchstart", onClickOrTouch);
    isGameRunning = false;

    currentCoins += scoreThisRun;
    updateCoinsInDB();
  }
  if (player.el) {
    player.el.style.display = "none";
  }
  for (const e of enemies) {
    if (e.el) gameContainer.removeChild(e.el);
  }
  enemies = [];
  for (const c of coins) {
    if (c.el) gameContainer.removeChild(c.el);
  }
  coins = [];

  gameContainer.style.display = "none";
  displayMainMenu(currentUsername, currentCoins);
}

/* СОХРАНЕНИЕ МОНЕТ В FIREBASE */
async function updateCoinsInDB() {
  if (!currentUsername) return;
  const userRef = ref(db, `users/${currentUsername}`);
  await update(userRef, { coins: currentCoins });
  coinsDisplay.textContent = `Монет: ${currentCoins}`;
}
