/* game2.js – Аэрохоккей с ботом
   Правила:
   - Играют игрок (слева) против бота (справа).
   - Игра продолжается до тех пор, пока один из игроков не наберёт 5 голов.
   - Если игрок побеждает, то он получает 200 points.
   - После забитого гола игра переходит в режим рестарта с задержкой 2 секунды.
   - Поле имеет центральную линию, зоны рестарта и выделенные воротные зоны.
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

// Объект клюшки игрока (левый край)
let player = {
  x: 0,
  y: 0,
  radius: 20,
  speed: 7
};

// Объект клюшки бота (правый край)
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
const winReward = 200;    // если игрок побеждает – 200 points

let gameRunning = false;
let inRestart = false;
const restartDelay = 2000; // задержка рестарта в мс

let animationFrameId;

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

  // Сброс позиций объектов
  resetPositions();

  // Сброс счёта
  playerScore = 0;
  botScore = 0;

  // Добавляем обработчики управления игроком (мышь и сенсор)
  game2Canvas.addEventListener("mousemove", playerMouseMoveHandler, false);
  game2Canvas.addEventListener("touchmove", playerTouchMoveHandler, { passive: false });

  gameRunning = true;
  inRestart = false;
  gameLoop();
}

// Сброс позиций: устанавливаем шайбу в центр, а клюшки – в стартовые позиции
function resetPositions() {
  // Шайба в центре
  puck.x = canvasWidth / 2;
  puck.y = canvasHeight / 2;
  // Задаём случайное направление движения (угол от –30 до +30 градусов)
  let angle = (Math.random() * 60 - 30) * Math.PI / 180;
  let direction = Math.random() < 0.5 ? 1 : -1;
  puck.vx = puck.speed * Math.cos(angle) * direction;
  puck.vy = puck.speed * Math.sin(angle);

  // Клюшка игрока – слева
  player.x = canvasWidth * 0.15;
  player.y = canvasHeight / 2;

  // Клюшка бота – справа
  bot.x = canvasWidth * 0.85;
  bot.y = canvasHeight / 2;
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
  
  // Обновляем позицию шайбы
  puck.x += puck.vx;
  puck.y += puck.vy;

  // Отскок от верхней и нижней границ
  if (puck.y - puck.radius <= 0 || puck.y + puck.radius >= canvasHeight) {
    puck.vy = -puck.vy;
    puck.y = puck.y - puck.radius <= 0 ? puck.radius : canvasHeight - puck.radius;
  }

  // Определяем зону ворот (вертикальный диапазон в центре)
  const goalAreaHeight = canvasHeight / 3;
  const goalYStart = (canvasHeight - goalAreaHeight) / 2;
  const goalYEnd = goalYStart + goalAreaHeight;

  // Проверка попадания в левую зону (если шайба выходит за левую границу)
  if (puck.x - puck.radius <= 0) {
    if (puck.y >= goalYStart && puck.y <= goalYEnd) {
      // Гол бота
      botScore++;
      handleGoal('bot');
      return;
    } else {
      // Отскок от левого края
      puck.vx = -puck.vx;
      puck.x = puck.radius;
    }
  }
  // Проверка попадания в правую зону (если шайба выходит за правую границу)
  if (puck.x + puck.radius >= canvasWidth) {
    if (puck.y >= goalYStart && puck.y <= goalYEnd) {
      // Гол игрока
      playerScore++;
      handleGoal('player');
      return;
    } else {
      // Отскок от правого края
      puck.vx = -puck.vx;
      puck.x = canvasWidth - puck.radius;
    }
  }

  // Проверяем столкновения с клюшками
  if (circleCollision(puck, player)) {
    resolveCollision(puck, player);
  }
  if (circleCollision(puck, bot)) {
    resolveCollision(puck, bot);
  }

  // Логика движения бота: простое следование за позицией шайбы по оси Y
  if (puck.y < bot.y) {
    bot.y -= bot.speed;
  } else if (puck.y > bot.y) {
    bot.y += bot.speed;
  }
  // Ограничение перемещения бота по вертикали
  if (bot.y - bot.radius < 0) bot.y = bot.radius;
  if (bot.y + bot.radius > canvasHeight) bot.y = canvasHeight - bot.radius;
}

// Функция проверки столкновения двух кругов (шайбы и клюшки)
function circleCollision(circle1, circle2) {
  let dx = circle1.x - circle2.x;
  let dy = circle1.y - circle2.y;
  let distance = Math.sqrt(dx * dx + dy * dy);
  return distance < (circle1.radius + circle2.radius);
}

// Простое разрешение столкновения: отражаем скорость шайбы относительно нормали столкновения
function resolveCollision(p, m) {
  let dx = p.x - m.x;
  let dy = p.y - m.y;
  let dist = Math.sqrt(dx * dx + dy * dy);
  if (dist === 0) return;
  let nx = dx / dist;
  let ny = dy / dist;
  let dot = puck.vx * nx + puck.vy * ny;
  puck.vx = puck.vx - 2 * dot * nx;
  puck.vy = puck.vy - 2 * dot * ny;
  // Выдвигаем шайбу наружу от клюшки
  let overlap = (p.radius + m.radius) - dist;
  p.x += nx * overlap;
  p.y += ny * overlap;
}

// Отрисовка игрового поля и объектов
function drawGame2() {
  // Очищаем холст
  game2Ctx.clearRect(0, 0, canvasWidth, canvasHeight);

  // Фон поля
  game2Ctx.fillStyle = "#004400"; // тёмно-зелёный
  game2Ctx.fillRect(0, 0, canvasWidth, canvasHeight);

  // Центральная линия
  game2Ctx.strokeStyle = "#FFFFFF";
  game2Ctx.lineWidth = 2;
  game2Ctx.beginPath();
  game2Ctx.moveTo(canvasWidth / 2, 0);
  game2Ctx.lineTo(canvasWidth / 2, canvasHeight);
  game2Ctx.stroke();

  // Визуальное выделение зон ворот (для наглядности)
  const goalAreaHeight = canvasHeight / 3;
  const goalYStart = (canvasHeight - goalAreaHeight) / 2;
  game2Ctx.fillStyle = "rgba(255, 255, 255, 0.2)";
  // Левая зона ворот
  game2Ctx.fillRect(0, goalYStart, 10, goalAreaHeight);
  // Правая зона ворот
  game2Ctx.fillRect(canvasWidth - 10, goalYStart, 10, goalAreaHeight);

  // Отрисовка шайбы
  game2Ctx.beginPath();
  game2Ctx.arc(puck.x, puck.y, puck.radius, 0, Math.PI * 2);
  game2Ctx.fillStyle = "#FF0000";
  game2Ctx.fill();
  game2Ctx.closePath();

  // Отрисовка клюшки игрока
  game2Ctx.beginPath();
  game2Ctx.arc(player.x, player.y, player.radius, 0, Math.PI * 2);
  game2Ctx.fillStyle = "#0000FF";
  game2Ctx.fill();
  game2Ctx.closePath();

  // Отрисовка клюшки бота
  game2Ctx.beginPath();
  game2Ctx.arc(bot.x, bot.y, bot.radius, 0, Math.PI * 2);
  game2Ctx.fillStyle = "#FFFF00";
  game2Ctx.fill();
  game2Ctx.closePath();

  // Вывод счёта на холсте
  game2Ctx.font = "20px Arial";
  game2Ctx.fillStyle = "#FFFFFF";
  game2Ctx.fillText("Player: " + playerScore, 20, 30);
  game2Ctx.fillText("Bot: " + botScore, canvasWidth - 100, 30);
}

// Обработка события гола: останавливаем игру, обновляем счёт и через задержку сбрасываем позиции
function handleGoal(scoredBy) {
  gameRunning = false;
  inRestart = true;
  // Если достигнут конец игры – завершаем
  if (playerScore >= maxScore || botScore >= maxScore) {
    endGame();
    return;
  }
  // Задержка рестарта
  setTimeout(() => {
    resetPositions();
    inRestart = false;
    gameRunning = true;
    gameLoop();
  }, restartDelay);
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

// Обработчик движения мыши: обновляет позицию клюшки игрока (ограничено левой половиной экрана)
function playerMouseMoveHandler(e) {
  let rect = game2Canvas.getBoundingClientRect();
  let mouseX = e.clientX - rect.left;
  let mouseY = e.clientY - rect.top;
  if (mouseX < canvasWidth / 2) {
    player.x = mouseX;
    player.y = mouseY;
  }
}

// Обработчик сенсорного ввода
function playerTouchMoveHandler(e) {
  e.preventDefault();
  let touch = e.touches[0];
  let rect = game2Canvas.getBoundingClientRect();
  let touchX = touch.clientX - rect.left;
  let touchY = touch.clientY - rect.top;
  if (touchX < canvasWidth / 2) {
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
nitGame2;
