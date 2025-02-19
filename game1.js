// ========== Настройка холста ==========
const canvas = document.getElementById("gameCanvas");
const ctx = canvas.getContext("2d");

// Масштаб (для ретро-эффекта, можно менять)
const S = 2;
canvas.width = 400 * S;
canvas.height = 600 * S;
ctx.scale(S, S);

const W = 400, H = 600; // базовые размеры

// ========== Глобальные переменные ==========
let gameStarted = false;
let gameOver = false;
let lastTime = Date.now();
const totalTime = 5 * 60 * 1000; // 5 минут в мс
let timeElapsed = 0; // для таймера

// Прогресс (каждая монета = 5 прогресс-единиц)
let progressUnits = 0;

// Для отображения стартового сообщения используем нестандартный шрифт (его можно подключить через CSS)
const startMessage = "Тап, чтобы старт";

// ========== Игровые параметры ==========
const cell = 40; // базовый размер ячейки (размер куба платформы)
const gravity = 0.98;
const jumpStrength = -14; // базовая сила прыжка (умножается на scale, если нужно)

let score = 0; // можно использовать для очков (не прогресс)
let difficulty = 1;

// ========== Положение земли ==========
const groundY = H * 0.8; // верхняя граница земли (80% от высоты)
const groundHeight = H - groundY; // толщина земли

// ========== Игрок ==========
let player = {
  x: cell * 2,
  y: groundY - cell,
  w: cell,
  h: cell,
  xVel: 4,
  yVel: 0,
  onGround: true,
  dead: false,
  jump() {
    if (this.onGround && !this.dead) {
      this.yVel = jumpStrength;
      this.onGround = false;
    }
  }
};

// ========== Объекты ==========
let platforms = []; // каждая платформа: { x, y, blocks }
let spikes = [];    // каждый шип: { x, size }
let coins = [];     // каждый объект: { x, y, size }

// ========== Ресурсы ==========
const bgImg = new Image();
bgImg.crossOrigin = "anonymous";
bgImg.src = "https://i.pinimg.com/736x/43/32/70/4332709543f30f2788a581ce5653d029.jpg";

const platformImg = new Image();
platformImg.crossOrigin = "anonymous";
platformImg.src = "wall1.jpg"; // изображение размером 300×300

// Для прогресса (монеты) можно использовать обычное изображение
const coinImg = new Image();
coinImg.crossOrigin = "anonymous";
coinImg.src = "https://donatepay.ru/uploads/notification/images/830208_1664005822.gif";

// Для персонажа – используем GIF через стандартное img-элемент (overlay)
const playerOverlay = document.createElement("img");
playerOverlay.src = "https://cdn.masto.host/rigczclub/accounts/avatars/000/000/001/original/7a2c1ce45c8f8d02.gif";
playerOverlay.style.position = "absolute";
playerOverlay.style.width = player.w + "px";
playerOverlay.style.height = player.h + "px";
playerOverlay.style.pointerEvents = "none";
playerOverlay.style.zIndex = "1";
// Добавляем overlay в контейнер холста (убедитесь, что родитель имеет position: relative)
canvas.parentElement.style.position = "relative";
canvas.parentElement.appendChild(playerOverlay);

// ========== Функции генерации объектов ==========
function spawnPlatform() {
  // Генерируем платформу как набор кубов: от 1 до 3 блоков
  const blocks = Math.random() < 0.7 ? 1 : 3;
  // В 70% случаев платформа на земле, в 30% – приподнятая (но не слишком высоко)
  const pY = Math.random() < 0.7 ? groundY - cell : groundY - cell - rand(1, 2) * cell;
  const platform = {
    x: W + rand(0, 3) * cell, // gap
    y: pY,
    blocks: blocks
  };
  platforms.push(platform);
  // Если платформа не перекрывается, добавляем шип (50% шанс) – шипы появляются только вне платформ
  if (Math.random() < 0.5) {
    // Шип размещается на уровне земли
    spikes.push({ x: platform.x + rand(0, blocks * cell), size: cell * 0.75 });
  }
  // Добавляем монету (70% шанс) выше платформы
  if (Math.random() < 0.7) {
    coins.push({ x: platform.x + rand(0, blocks * cell), y: pY - cell, size: 50 });
  }
}

function spawnObjects() {
  // Если последняя платформа далеко от правого края, создаем новую
  if (platforms.length === 0 || (platforms[platforms.length - 1].x + platforms[platforms.length - 1].blocks * cell < W)) {
    spawnPlatform();
  }
}

// ========== Вспомогательная функция ==========
function rand(min, max) {
  return Math.round(Math.random() * (max - min)) + min;
}

// ========== Отрисовка таймера ==========
function drawTimer() {
  // Таймер отрисовывается как вертикальный ползунок слева вверху (например, 20px шириной)
  const barX = 10, barY = 10, barW = 20, barH = 200;
  ctx.strokeStyle = "#fff";
  ctx.lineWidth = 2;
  ctx.strokeRect(barX, barY, barW, barH);
  // Процент заполнения = timeElapsed / totalTime
  const fillH = Math.min((timeElapsed / totalTime) * barH, barH);
  ctx.fillStyle = "#0f0";
  // Заполняем снизу вверх
  ctx.fillRect(barX, barY + barH - fillH, barW, fillH);
}

// ========== Отрисовка интерфейса ==========
function drawUI() {
  // Отрисовка прогресса (каждая монета = 5 прогресс-единиц)
  ctx.fillStyle = "#fff";
  ctx.font = "bold 20px 'Comic Sans MS', cursive"; // нестандартный шрифт
  ctx.textAlign = "left";
  ctx.fillText("Прогресс: " + progressUnits, 40, 30);
  // Отрисовка таймера
  drawTimer();
}

// ========== Основной цикл ==========
function update(delta) {
  // Если игра не запущена, просто показываем стартовое сообщение
  if (!gameStarted) return;
  if (gameOver) return;

  // Обновляем таймер
  timeElapsed += delta;
  if (timeElapsed >= totalTime) {
    // Время вышло – завершаем игру
    gameOver = true;
    // Здесь можно записать прогресс в базу данных (например, progressUnits)
  }

  // Обновление физики игрока
  player.y += player.yVel;
  player.yVel += gravity;
  if (player.y + player.h >= groundY) {
    // При посадке корректируем положение так, чтобы игрок оказался полностью на блоке
    player.y = groundY - player.h;
    player.yVel = 0;
    player.onGround = true;
  } else {
    player.onGround = false;
  }

  // Если игрок падает ниже земли – игра окончена
  if (player.y > groundY) {
    gameOver = true;
  }

  // Обновление платформ: смещаем их влево
  platforms.forEach(p => {
    p.x -= player.xVel;
  });
  platforms = platforms.filter(p => (p.x + p.blocks * cell > 0));

  // Обновление шипов
  spikes.forEach(s => { s.x -= player.xVel; });
  spikes = spikes.filter(s => s.x + s.size > 0);

  // Обновление монет
  coins.forEach(cn => { cn.x -= player.xVel; });
  coins = coins.filter(cn => cn.x + cn.size > 0);

  // Проверка столкновений: если игрок не успевает запрыгнуть на платформу, он погибает
  platforms.forEach(p => {
    // Если игрок пересекается с верхней частью платформы (и не находится на ней)
    if (player.x + player.w > p.x && player.x < p.x + p.blocks * cell) {
      if (player.y + player.h > p.y && player.y + player.h < p.y + 10) {
        // Корректируем позицию (встаем ровно на платформу)
        player.y = p.y - player.h;
        player.yVel = 0;
        player.onGround = true;
      }
    }
  });

  // Если игрок сталкивается со шипами (проверка по прямоугольнику вокруг шипа)
  spikes.forEach(s => {
    if (
      player.x < s.x + s.size &&
      player.x + player.w > s.x &&
      player.y + player.h > groundY - s.size
    ) {
      gameOver = true;
    }
  });

  // Подбор монет: если игрок пересекается с монетой, увеличиваем прогресс
  coins.forEach((cn, i) => {
    if (
      player.x < cn.x + cn.size &&
      player.x + player.w > cn.x &&
      player.y < cn.y + cn.size &&
      player.y + player.h > cn.y
    ) {
      progressUnits += 5; // 1 монета = 5 единиц прогресса
      // Удаляем монету
      coins.splice(i, 1);
    }
  });

  // Генерация новых объектов
  spawnObjects();
}

function draw() {
  // Очистка холста
  ctx.clearRect(0, 0, W, H);

  // Отрисовка фона (до земли)
  if (bgImg.complete) {
    ctx.drawImage(bgImg, 0, 0, W, groundY);
  } else {
    ctx.fillStyle = "#5785f6";
    ctx.fillRect(0, 0, W, groundY);
  }

  // Отрисовка земли (черная)
  ctx.fillStyle = "black";
  ctx.fillRect(0, groundY, W, groundHeight);

  // Отрисовка платформ (каждый куб с текстурой и черной обводкой)
  platforms.forEach(p => {
    for (let i = 0; i < p.blocks; i++) {
      let cubeX = p.x + i * cell;
      if (platformImg.complete) {
        ctx.drawImage(platformImg, 0, 0, 300, 300, cubeX, p.y, cell, cell);
      } else {
        ctx.fillStyle = "#8B4513";
        ctx.fillRect(cubeX, p.y, cell, cell);
      }
      // Черная обводка
      ctx.strokeStyle = "black";
      ctx.lineWidth = 2;
      ctx.strokeRect(cubeX, p.y, cell, cell);
    }
  });

  // Отрисовка шипов (черные треугольники)
  spikes.forEach(s => {
    ctx.fillStyle = "black";
    ctx.beginPath();
    // Треугольник: вершина наверху, основание по земле
    ctx.moveTo(s.x, groundY - s.size);
    ctx.lineTo(s.x + s.size / 2, groundY);
    ctx.lineTo(s.x - s.size / 2, groundY);
    ctx.closePath();
    ctx.fill();
  });

  // Отрисовка монет (как желтые круги – можно заменить на изображение)
  coins.forEach(cn => {
    ctx.fillStyle = "yellow";
    ctx.beginPath();
    ctx.arc(cn.x + cn.size/2, cn.y + cn.size/2, cn.size/2, 0, Math.PI * 2);
    ctx.fill();
  });

  // Отрисовка игрока – мы не рисуем его на холсте, т.к. он представлен overlay-элементом
  // Однако для отладки можно отрисовать прямоугольник (если нужно)
  // ctx.fillStyle = "#f2b826";
  // ctx.fillRect(player.x, player.y, player.w, player.h);

  // Отрисовка UI: прогресс и таймер
  drawUI();

  // Если игра еще не запущена, отрисовываем стартовое сообщение поверх
  if (!gameStarted) {
    ctx.fillStyle = "#fff";
    ctx.font = "bold 30px 'Comic Sans MS', cursive";
    ctx.textAlign = "center";
    ctx.fillText(startMessage, W / 2, H / 2);
  }

  // Если игра окончена, отрисовываем сообщение о завершении
  if (gameOver) {
    ctx.fillStyle = "#f00";
    ctx.font = "bold 40px 'Comic Sans MS', cursive";
    ctx.textAlign = "center";
    ctx.fillText("Игра окончена!", W / 2, H / 2 - 40);
    ctx.fillText("Прогресс: " + progressUnits, W / 2, H / 2 + 10);
  }
}

// ========== Основной цикл ==========
let prevTime = Date.now();
function gameLoop() {
  let now = Date.now();
  let delta = now - prevTime;
  prevTime = now;
  
  if (gameStarted && !gameOver) {
    update(delta);
  }
  draw();
  
  // Обновляем позицию overlay персонажа
  playerOverlay.style.left = player.x + "px";
  playerOverlay.style.top = player.y + "px";
  
  requestAnimationFrame(gameLoop);
}

// ========== Обработчики ввода ==========
canvas.addEventListener("click", function() {
  if (!gameStarted) {
    gameStarted = true;
  } else if (!gameOver) {
    player.jump();
  }
});

document.addEventListener("keydown", function(e) {
  if (e.code === "Space") {
    if (!gameStarted) {
      gameStarted = true;
    } else if (!gameOver) {
      player.jump();
    }
  }
});

// ========== Сброс игры ==========
function resetGame() {
  score = 0;
  frame = 0;
  difficulty = 1;
  progressUnits = 0;
  timeElapsed = 0;
  player.x = cell * 2;
  player.y = groundY - cell;
  player.xVel = 4;
  player.yVel = 0;
  player.dead = false;
  player.onGround = true;
  platforms = [];
  spikes = [];
  coins = [];
  // Создаем начальную платформу, чтобы игрок сразу стоял на чем-то
  platforms.push({x: -1, y: groundY - cell, blocks: 10});
  gameOver = false;
  gameStarted = false;
}
  
// Для демонстрации сброс можно привязать кнопку (например, в UI)
// document.getElementById("resetBtn").addEventListener("click", resetGame);

resetGame();
gameLoop();
