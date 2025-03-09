/* game2.js – Вертикальный аэрохоккей с ботом
   Правила:
   - Игрок (в нижней части) против бота (в верхней части).
   - Игра идёт до 5 голов.
   - Если игрок побеждает, он получает 200 points.
   - После каждого гола (или поражения) шайба появляется у игрока и в течение 5 секунд постепенно "проявляется":
       • В начале удары по шайбе дают меньше эффекта,
         а спустя 5 секунд – становятся полностью эффективными.
   - Фон – чёрный, шайба – неоновая (циановая), границы поля – узкие и цвета лайм.
*/

let game2Canvas, game2Ctx;
let canvasWidth, canvasHeight;

// Объект шайбы
let puck = {
  x: 0,
  y: 0,
  radius: 10,
  vx: 0,
  vy: 0,
  speed: 6
};

// Объект клюшки игрока (нижняя часть)
let player = {
  x: 0,
  y: 0,
  radius: 20,
  speed: 7
};

// Объект клюшки бота (верхняя часть)
let bot = {
  x: 0,
  y: 0,
  radius: 20,
  speed: 4
};

// Счёт игры
let playerScore = 0;
let botScore = 0;
const maxScore = 5;       // игра до 5 голов
const winReward = 200;    // бонус при победе игрока

let gameRunning = false;
let animationFrameId;

// Переменная для эффекта появления (spawn) – время начала появления шайбы
let puckSpawnTime = 0;
// spawnDuration – время появления (5 секунд)
const spawnDuration = 5000;

// Инициализация игры
function initGame2() {
  // В index.html для game2 используется canvas с id "match3Canvas"
  game2Canvas = document.getElementById('match3Canvas');
  if (!game2Canvas) {
    console.error("Элемент canvas с id 'match3Canvas' не найден.");
    return;
  }
  game2Ctx = game2Canvas.getContext('2d');
  canvasWidth = game2Canvas.width;
  canvasHeight = game2Canvas.height;

  // Устанавливаем стартовые позиции клюшек:
  // Игрок – в нижней части (центр по горизонтали)
  player.x = canvasWidth / 2;
  player.y = canvasHeight - 50;
  // Бот – в верхней части (центр по горизонтали)
  bot.x = canvasWidth / 2;
  bot.y = 50;

  // Сброс счёта
  playerScore = 0;
  botScore = 0;

  // Сброс позиций и установка времени появления шайбы
  resetPositions();

  // Добавляем обработчики управления игроком (мышь и сенсор)
  game2Canvas.addEventListener("mousemove", playerMouseMoveHandler, false);
  game2Canvas.addEventListener("touchmove", playerTouchMoveHandler, { passive: false });

  gameRunning = true;
  gameLoop();
}

// Сброс позиций: устанавливаем шайбу у игрока (немного над клюшкой) с начальным направлением вверх
function resetPositions() {
  // Шайба появляется у игрока (в нижней части), немного выше клюшки
  puck.x = player.x;
  puck.y = player.y - (player.radius + puck.radius + 5);
  // Задаём начальное направление – преимущественно вверх с небольшим отклонением по горизонтали
  let angle = (Math.random() * 40 - 20) * Math.PI / 180; // от -20 до +20 градусов
  puck.vx = puck.speed * Math.sin(angle);
  puck.vy = -puck.speed * Math.cos(angle); // вверх

  // Фиксируем время появления для расчёта эффекта spawn
  puckSpawnTime = Date.now();
}

// Основной игровой цикл
function gameLoop() {
  if (gameRunning) {
    updateGame2();
    drawGame2();
    animationFrameId = requestAnimationFrame(gameLoop);
  }
}

// Обновление игрового состояния
function updateGame2() {
  if (!gameRunning) return;
  
  // Вычисляем эффект появления (от 0.5 до 1 за spawnDuration)
  let elapsed = Date.now() - puckSpawnTime;
  let collisionFactor = elapsed < spawnDuration ? (0.5 + 0.5 * (elapsed / spawnDuration)) : 1.0;

  // Обновляем позицию шайбы
  puck.x += puck.vx;
  puck.y += puck.vy;

  // Отскок от боковых стен – остаётся как есть
  if (puck.x - puck.radius <= 0 || puck.x + puck.radius >= canvasWidth) {
    puck.vx = -puck.vx;
    if (puck.x - puck.radius <= 0) {
      puck.x = puck.radius;
    } else {
      puck.x = canvasWidth - puck.radius;
    }
  }

  // Определяем горизонтальную зону ворот (центр поля, ширина = 1/3 экрана)
  const goalZoneWidth = canvasWidth / 3;
  const goalXStart = (canvasWidth - goalZoneWidth) / 2;
  const goalXEnd = goalXStart + goalZoneWidth;

  // Проверка попадания в верхнюю границу (если шайба уходит за верх, это гол игрока)
  if (puck.y - puck.radius <= 0) {
    if (puck.x >= goalXStart && puck.x <= goalXEnd) {
      // Гол игрока
      playerScore++;
      handleGoal('player');
      return;
    } else {
      // Отскок от верхней границы
      puck.vy = -puck.vy;
      puck.y = puck.radius;
    }
  }
  // Проверка попадания в нижнюю границу (если шайба уходит за низ, это гол бота)
  if (puck.y + puck.radius >= canvasHeight) {
    if (puck.x >= goalXStart && puck.x <= goalXEnd) {
      // Гол бота
      botScore++;
      handleGoal('bot');
      return;
    } else {
      // Отскок от нижней границы
      puck.vy = -puck.vy;
      puck.y = canvasHeight - puck.radius;
    }
  }

  // Проверяем столкновения с клюшками (с учётом эффекта spawn)
  if (circleCollision(puck, player)) {
    resolveCollision(puck, player, collisionFactor);
  }
  if (circleCollision(puck, bot)) {
    resolveCollision(puck, bot, collisionFactor);
  }

  // Логика движения бота: простой алгоритм – бот перемещается по оси X, стремясь к положению шайбы,
  // но ограничен верхней частью экрана (только движение по горизонтали)
  if (puck.x < bot.x) {
    bot.x -= bot.speed;
  } else if (puck.x > bot.x) {
    bot.x += bot.speed;
  }
  // Ограничение перемещения бота по горизонтали
  if (bot.x - bot.radius < 0) bot.x = bot.radius;
  if (bot.x + bot.radius > canvasWidth) bot.x = canvasWidth - bot.radius;
}

// Функция проверки столкновения двух кругов (шайбы и клюшки)
function circleCollision(c1, c2) {
  let dx = c1.x - c2.x;
  let dy = c1.y - c2.y;
  let distance = Math.sqrt(dx * dx + dy * dy);
  return distance < (c1.radius + c2.radius);
}

// Разрешение столкновения с учётом коэффициента эффективности (collisionFactor)
function resolveCollision(p, m, collisionFactor) {
  let dx = p.x - m.x;
  let dy = p.y - m.y;
  let dist = Math.sqrt(dx * dx + dy * dy);
  if (dist === 0) return;
  let nx = dx / dist;
  let ny = dy / dist;
  let dot = p.vx * nx + p.vy * ny;
  // Изменение скорости умножаем на collisionFactor (в spawn фазе – менее эффективно)
  p.vx = p.vx - 2 * dot * nx * collisionFactor;
  p.vy = p.vy - 2 * dot * ny * collisionFactor;
  // Выдвигаем шайбу наружу от клюшки
  let overlap = (p.radius + m.radius) - dist;
  p.x += nx * overlap;
  p.y += ny * overlap;
}

// Отрисовка игрового поля и объектов
function drawGame2() {
  // Очищаем холст и заливаем фон чёрным
  game2Ctx.clearRect(0, 0, canvasWidth, canvasHeight);
  game2Ctx.fillStyle = "#000000";
  game2Ctx.fillRect(0, 0, canvasWidth, canvasHeight);

  // Рисуем границы игрового поля (цвет лайм, не слишком широкие)
  game2Ctx.strokeStyle = "#00FF00";
  game2Ctx.lineWidth = 4;
  game2Ctx.strokeRect(0, 0, canvasWidth, canvasHeight);

  // Определяем горизонтальную зону ворот
  const goalZoneWidth = canvasWidth / 3;
  const goalXStart = (canvasWidth - goalZoneWidth) / 2;
  // Для наглядности закрашиваем зоны ворот (с небольшой прозрачностью)
  game2Ctx.fillStyle = "rgba(0,255,0,0.2)";
  // Верхняя зона ворот (для игрока)
  game2Ctx.fillRect(goalXStart, 0, goalZoneWidth, 10);
  // Нижняя зона ворот (для бота)
  game2Ctx.fillRect(goalXStart, canvasHeight - 10, goalZoneWidth, 10);

  // Вычисляем эффект появления для шайбы
  let elapsed = Date.now() - puckSpawnTime;
  let spawnAlpha = elapsed < spawnDuration ? (0.5 + 0.5 * (elapsed / spawnDuration)) : 1.0;

  // Рисуем шайбу (неоновый оттенок, например неоновый циан)
  game2Ctx.save();
  game2Ctx.globalAlpha = spawnAlpha;
  game2Ctx.beginPath();
  game2Ctx.arc(puck.x, puck.y, puck.radius, 0, Math.PI * 2);
  game2Ctx.fillStyle = "#0FF"; // неоновый циан
  game2Ctx.fill();
  game2Ctx.closePath();
  game2Ctx.restore();

  // Рисуем клюшку игрока (например, синий)
  game2Ctx.beginPath();
  game2Ctx.arc(player.x, player.y, player.radius, 0, Math.PI * 2);
  game2Ctx.fillStyle = "#0000FF";
  game2Ctx.fill();
  game2Ctx.closePath();

  // Рисуем клюшку бота (например, оранжевый)
  game2Ctx.beginPath();
  game2Ctx.arc(bot.x, bot.y, bot.radius, 0, Math.PI * 2);
  game2Ctx.fillStyle = "#FFA500";
  game2Ctx.fill();
  game2Ctx.closePath();

  // Выводим счёт на холсте (по центру верхней и нижней частей)
  game2Ctx.font = "20px Arial";
  game2Ctx.fillStyle = "#FFFFFF";
  game2Ctx.fillText("Player: " + playerScore, canvasWidth / 2 - 60, canvasHeight - 20);
  game2Ctx.fillText("Bot: " + botScore, canvasWidth / 2 - 40, 30);
}

// Обработка события гола: обновляем счёт и сбрасываем позиции (без зависания)
function handleGoal(scoredBy) {
  // Если игра закончена, вызываем завершение игры
  if (playerScore >= maxScore || botScore >= maxScore) {
    endGame();
    return;
  }
  // Сброс позиций и установка эффекта появления
  resetPositions();
}

// Завершение игры: остановка игрового цикла, удаление обработчиков и показ результата
function endGame() {
  cancelAnimationFrame(animationFrameId);
  game2Canvas.removeEventListener("mousemove", playerMouseMoveHandler);
  game2Canvas.removeEventListener("touchmove", playerTouchMoveHandler);

  // Если игрок победил – начисляем бонусные очки
  if (playerScore > botScore) {
    if (typeof userRef !== 'undefined' && typeof localUserData !== 'undefined') {
      localUserData.points += winReward;
      userRef.update({ points: localUserData.points });
    }
    showEndGameModal("You Win!", "Score: " + playerScore + " - " + botScore + "\nYou've earned " + winReward + " points!");
  } else {
    showEndGameModal("You Lose", "Score: " + playerScore + " - " + botScore);
  }
}

// Обработчик движения мыши: игрок может управлять своей клюшкой только в нижней половине экрана
function playerMouseMoveHandler(e) {
  let rect = game2Canvas.getBoundingClientRect();
  let mouseX = e.clientX - rect.left;
  let mouseY = e.clientY - rect.top;
  if (mouseY >= canvasHeight / 2) {
    player.x = mouseX;
    player.y = mouseY;
  }
}

// Обработчик сенсорного ввода (аналогично)
function playerTouchMoveHandler(e) {
  e.preventDefault();
  let touch = e.touches[0];
  let rect = game2Canvas.getBoundingClientRect();
  let touchX = touch.clientX - rect.left;
  let touchY = touch.clientY - rect.top;
  if (touchY >= canvasHeight / 2) {
    player.x = touchX;
    player.y = touchY;
  }
}

// Функция сброса игры (вызывается при закрытии игры)
function resetGame2() {
  cancelAnimationFrame(animationFrameId);
  game2Canvas.removeEventListener("mousemove", playerMouseMoveHandler);
  game2Canvas.removeEventListener("touchmove", playerTouchMoveHandler);
  if (game2Ctx) {
    game2Ctx.clearRect(0, 0, canvasWidth, canvasHeight);
  }
}
