/* 
  game2.js – Игра Аэрохоккей с механикой, аналогичной Glow Hockey
  Правила:
    • Игра идёт до 5 очков.
    • При победе человека начисляется 200 points.
    • Бот свободно перемещается по своей половине, атакует и защищается.
    • После гола шайба появляется у проигравшей команды.
    
  Оформление:
    • Неоновый стиль с токсичным лаймовым оформлением границ.
    • Центровая линия – пунктирная, слегка прозрачная.
    
  Управление:
    • Мышь или сенсор – перемещение клюшки игрока по нижней половине поля.
*/

let game2Canvas, game2Ctx;
let canvasWidth, canvasHeight;

// Игровые объекты
let humanPaddle, botPaddle, puck;

// Счёт игры
let humanScore = 0, botScore = 0;

// Флаги работы игры
let gameRunning = false;
let gameStarted = false;
let animationFrameId;

// Константы игры
const WINNING_SCORE = 5;
const WIN_POINTS = 200;

const PADDLE_RADIUS = 30;
const PUCK_RADIUS = 15;
const FRICTION = 0.99; // замедление шайбы

// Параметры стен и ворот
const WALL_THICKNESS = 10;
const GOAL_WIDTH = 100; // ширина выреза для ворот

// Цвета (токсичный лаймовый для границ и центр. линии)
const BORDER_COLOR = "#CCFF00";
const CENTER_LINE_COLOR = "rgba(204, 255, 0, 0.5)";

// Переменная для хранения информации о том, кто забил последний гол:
// "human" – если игрок забил (бот потерял), "bot" – если бот забил (игрок потерял)
let lastGoalFor = null;

// Инициализация игры
function initGame2() {
  game2Canvas = document.getElementById('match3Canvas');
  if (!game2Canvas) {
    console.error("Элемент canvas с id 'match3Canvas' не найден.");
    return;
  }
  game2Ctx = game2Canvas.getContext('2d');
  canvasWidth = game2Canvas.width;
  canvasHeight = game2Canvas.height;
  
  // Задаём начальные позиции:
  // Игрок – нижняя половина; Бот – верхняя половина.
  const humanY = canvasHeight - 40;
  const botY = 40;
  
  humanPaddle = {
    x: canvasWidth / 2,
    y: humanY,
    radius: PADDLE_RADIUS,
    prevX: canvasWidth / 2,
    prevY: humanY
  };
  
  botPaddle = {
    x: canvasWidth / 2,
    y: botY,
    radius: PADDLE_RADIUS
  };
  
  puck = {
    x: canvasWidth / 2,
    y: canvasHeight / 2,
    radius: PUCK_RADIUS,
    vx: 0,
    vy: 0
  };
  
  humanScore = 0;
  botScore = 0;
  lastGoalFor = null;
  
  gameStarted = false;
  gameRunning = false;
  
  // Обработчики событий
  game2Canvas.addEventListener("mousemove", mouseMoveHandler, false);
  game2Canvas.addEventListener("touchmove", touchMoveHandler, { passive: false });
  
  drawGame2();
}

// Основной игровой цикл
function game2Loop() {
  updateGame2();
  drawGame2();
  if (gameRunning) {
    animationFrameId = requestAnimationFrame(game2Loop);
  }
}

// Обновление игрового состояния
function updateGame2() {
  if (!gameStarted) return;
  
  // Обновляем позицию шайбы
  puck.x += puck.vx;
  puck.y += puck.vy;
  
  // Применяем трение
  puck.vx *= FRICTION;
  puck.vy *= FRICTION;
  
  // Отскок от боковых стен
  if (puck.x - puck.radius < WALL_THICKNESS) {
    puck.x = WALL_THICKNESS + puck.radius;
    puck.vx = -puck.vx;
  }
  if (puck.x + puck.radius > canvasWidth - WALL_THICKNESS) {
    puck.x = canvasWidth - WALL_THICKNESS - puck.radius;
    puck.vx = -puck.vx;
  }
  
  // Верхняя стена с воротами (если шайба проходит через вырез, засчитывается гол)
  if (puck.y - puck.radius < WALL_THICKNESS) {
    const goalStart = (canvasWidth - GOAL_WIDTH) / 2;
    const goalEnd = (canvasWidth + GOAL_WIDTH) / 2;
    if (puck.x > goalStart && puck.x < goalEnd) {
      // Гол для игрока (бот проиграл)
      humanScore++;
      lastGoalFor = "bot";
      checkGameEnd();
      resetPositions();
      return;
    } else {
      puck.y = WALL_THICKNESS + puck.radius;
      puck.vy = -puck.vy;
    }
  }
  
  // Нижняя стена с воротами
  if (puck.y + puck.radius > canvasHeight - WALL_THICKNESS) {
    const goalStart = (canvasWidth - GOAL_WIDTH) / 2;
    const goalEnd = (canvasWidth + GOAL_WIDTH) / 2;
    if (puck.x > goalStart && puck.x < goalEnd) {
      // Гол для бота (игрок проиграл)
      botScore++;
      lastGoalFor = "human";
      checkGameEnd();
      resetPositions();
      return;
    } else {
      puck.y = canvasHeight - WALL_THICKNESS - puck.radius;
      puck.vy = -puck.vy;
    }
  }
  
  // Столкновения шайбы с клюшками
  handlePaddleCollision(humanPaddle, true);
  handlePaddleCollision(botPaddle, false);
  
  // Логика движения бота (движется по всей своей половине)
  const minBotY = WALL_THICKNESS + botPaddle.radius;
  const maxBotY = canvasHeight / 2 - botPaddle.radius;
  
  // Если шайба находится в верхней половине, бот атакует, иначе возвращается в центр
  let targetX, targetY;
  if (puck.y < canvasHeight / 2) {
    // Добавляем случайное отклонение для "человеческого" поведения
    targetX = puck.x + (Math.random() * 20 - 10);
    targetY = puck.y + (Math.random() * 20 - 10);
  } else {
    // Центр верхней половины
    targetX = canvasWidth / 2;
    targetY = (minBotY + maxBotY) / 2;
  }
  
  // Обновление позиции бота с ограничением по скорости
  let dx = targetX - botPaddle.x;
  let dy = targetY - botPaddle.y;
  const speedFactor = 0.07;
  botPaddle.x += Math.max(-MAX_BOT_SPEED, Math.min(dx * speedFactor, MAX_BOT_SPEED));
  botPaddle.y += Math.max(-MAX_BOT_SPEED, Math.min(dy * speedFactor, MAX_BOT_SPEED));
  
  // Ограничиваем позицию бота в его половине
  botPaddle.x = Math.max(botPaddle.radius + WALL_THICKNESS, Math.min(botPaddle.x, canvasWidth - botPaddle.radius - WALL_THICKNESS));
  botPaddle.y = Math.max(minBotY, Math.min(botPaddle.y, maxBotY));
}

// Обработка столкновения шайбы с клюшкой
// isHuman: true для игрока, false для бота
function handlePaddleCollision(paddle, isHuman) {
  const dx = puck.x - paddle.x;
  const dy = puck.y - paddle.y;
  const dist = Math.sqrt(dx * dx + dy * dy);
  
  if (dist < puck.radius + paddle.radius) {
    const nx = dx / dist;
    const ny = dy / dist;
    
    let impact = 1;
    if (isHuman) {
      const paddleSpeedX = paddle.x - paddle.prevX;
      const paddleSpeedY = paddle.y - paddle.prevY;
      const paddleSpeed = Math.sqrt(paddleSpeedX * paddleSpeedX + paddleSpeedY * paddleSpeedY);
      if (paddleSpeed > 5) {
        impact += paddleSpeed / 20;
      }
    }
    
    const speed = Math.sqrt(puck.vx * puck.vx + puck.vy * puck.vy);
    const newSpeed = Math.max(speed, 5) * impact;
    puck.vx = nx * newSpeed;
    puck.vy = ny * newSpeed;
    
    // Смещаем шайбу, чтобы избежать повторного столкновения
    puck.x = paddle.x + (puck.radius + paddle.radius + 1) * nx;
    puck.y = paddle.y + (puck.radius + paddle.radius + 1) * ny;
  }
  
  if (isHuman) {
    paddle.prevX = paddle.x;
    paddle.prevY = paddle.y;
  }
}

// Отрисовка игрового поля
function drawGame2() {
  // Очистка холста
  game2Ctx.clearRect(0, 0, canvasWidth, canvasHeight);
  
  // Фон – черный
  game2Ctx.fillStyle = "#000";
  game2Ctx.fillRect(0, 0, canvasWidth, canvasHeight);
  
  // Границы и ворота
  drawBoundaries();
  
  // Центровая линия (пунктирная, прозрачная)
  game2Ctx.lineWidth = 2;
  game2Ctx.strokeStyle = CENTER_LINE_COLOR;
  game2Ctx.setLineDash([10, 10]);
  game2Ctx.beginPath();
  game2Ctx.moveTo(0, canvasHeight / 2);
  game2Ctx.lineTo(canvasWidth, canvasHeight / 2);
  game2Ctx.stroke();
  game2Ctx.setLineDash([]);
  
  // Настройка неонового свечения
  game2Ctx.shadowBlur = 20;
  
  // Бот – верхняя клюшка
  game2Ctx.shadowColor = "#ff00ff";
  game2Ctx.fillStyle = "#ff00ff";
  game2Ctx.beginPath();
  game2Ctx.arc(botPaddle.x, botPaddle.y, botPaddle.radius, 0, Math.PI * 2);
  game2Ctx.fill();
  game2Ctx.closePath();
  
  // Игрок – нижняя клюшка
  game2Ctx.shadowColor = "#0ff";
  game2Ctx.fillStyle = "#0ff";
  game2Ctx.beginPath();
  game2Ctx.arc(humanPaddle.x, humanPaddle.y, humanPaddle.radius, 0, Math.PI * 2);
  game2Ctx.fill();
  game2Ctx.closePath();
  
  // Шайба
  game2Ctx.shadowColor = "#ffff00";
  game2Ctx.fillStyle = "#ffff00";
  game2Ctx.beginPath();
  game2Ctx.arc(puck.x, puck.y, puck.radius, 0, Math.PI * 2);
  game2Ctx.fill();
  game2Ctx.closePath();
  
  game2Ctx.shadowBlur = 0;
  
  // Счёт
  game2Ctx.font = "16px Arial";
  game2Ctx.fillStyle = "#fff";
  game2Ctx.fillText("Player: " + humanScore, 10, canvasHeight - 20);
  game2Ctx.fillText("Bot: " + botScore, 10, 30);
}

// Функция отрисовки границ и ворот
function drawBoundaries() {
  game2Ctx.fillStyle = BORDER_COLOR;
  
  // Левая и правая стены
  game2Ctx.fillRect(0, 0, WALL_THICKNESS, canvasHeight);
  game2Ctx.fillRect(canvasWidth - WALL_THICKNESS, 0, WALL_THICKNESS, canvasHeight);
  
  // Верхняя стена с воротами
  const topGoalStart = (canvasWidth - GOAL_WIDTH) / 2;
  game2Ctx.fillRect(0, 0, topGoalStart, WALL_THICKNESS);
  game2Ctx.fillRect(topGoalStart + GOAL_WIDTH, 0, topGoalStart, WALL_THICKNESS);
  
  // Нижняя стена с воротами
  const bottomGoalStart = (canvasWidth - GOAL_WIDTH) / 2;
  game2Ctx.fillRect(0, canvasHeight - WALL_THICKNESS, bottomGoalStart, WALL_THICKNESS);
  game2Ctx.fillRect(bottomGoalStart + GOAL_WIDTH, canvasHeight - WALL_THICKNESS, bottomGoalStart, WALL_THICKNESS);
  
  // Опционально: обводка ворот
  game2Ctx.strokeStyle = CENTER_LINE_COLOR;
  game2Ctx.lineWidth = 2;
  game2Ctx.strokeRect(topGoalStart, 0, GOAL_WIDTH, WALL_THICKNESS);
  game2Ctx.strokeRect(bottomGoalStart, canvasHeight - WALL_THICKNESS, GOAL_WIDTH, WALL_THICKNESS);
}

// Обработчик движения мыши для игрока (2D)
function mouseMoveHandler(e) {
  let rect = game2Canvas.getBoundingClientRect();
  let relativeX = e.clientX - rect.left;
  let relativeY = e.clientY - rect.top;
  
  // Ограничение по X
  humanPaddle.x = Math.max(humanPaddle.radius + WALL_THICKNESS, Math.min(relativeX, canvasWidth - humanPaddle.radius - WALL_THICKNESS));
  // Ограничение по Y: игрок двигается только в нижней половине
  const minY = canvasHeight / 2 + humanPaddle.radius;
  const maxY = canvasHeight - humanPaddle.radius - WALL_THICKNESS;
  humanPaddle.y = Math.max(minY, Math.min(relativeY, maxY));
  
  if (!gameStarted) {
    gameStarted = true;
    gameRunning = true;
    // При запуске задаём начальное направление шайбы
    puck.vx = (Math.random() * 4 - 2);
    puck.vy = -4;
    game2Loop();
  }
}

// Обработчик касания для мобильных устройств (аналогично)
function touchMoveHandler(e) {
  e.preventDefault();
  let touch = e.touches[0];
  let rect = game2Canvas.getBoundingClientRect();
  let relativeX = touch.clientX - rect.left;
  let relativeY = touch.clientY - rect.top;
  
  humanPaddle.x = Math.max(humanPaddle.radius + WALL_THICKNESS, Math.min(relativeX, canvasWidth - humanPaddle.radius - WALL_THICKNESS));
  const minY = canvasHeight / 2 + humanPaddle.radius;
  const maxY = canvasHeight - humanPaddle.radius - WALL_THICKNESS;
  humanPaddle.y = Math.max(minY, Math.min(relativeY, maxY));
  
  if (!gameStarted) {
    gameStarted = true;
    gameRunning = true;
    puck.vx = (Math.random() * 4 - 2);
    puck.vy = -4;
    game2Loop();
  }
}

// Сброс позиций после гола с учётом того, кто потерял очко
function resetPositions() {
  // Если игрок проиграл (bot забил), разместим шайбу в нижней половине (на стороне игрока)
  if (lastGoalFor === "human") {
    puck.x = humanPaddle.x;
    puck.y = canvasHeight - humanPaddle.radius - WALL_THICKNESS - 5;
  } else if (lastGoalFor === "bot") {
    // Если бот проиграл, разместим шайбу в верхней половине (на стороне бота)
    puck.x = botPaddle.x;
    puck.y = botPaddle.radius + WALL_THICKNESS + 5;
  } else {
    // Если по какой-то причине не задано, размещаем в центре
    puck.x = canvasWidth / 2;
    puck.y = canvasHeight / 2;
  }
  puck.vx = 0;
  puck.vy = 0;
  
  // Сброс позиций клюшек
  humanPaddle.x = canvasWidth / 2;
  humanPaddle.y = canvasHeight - 40;
  humanPaddle.prevX = humanPaddle.x;
  humanPaddle.prevY = humanPaddle.y;
  
  botPaddle.x = canvasWidth / 2;
  botPaddle.y = 40;
  
  gameStarted = false;
  setTimeout(() => {
    if (gameRunning) {
      puck.vx = (Math.random() * 4 - 2);
      // Обычно после гола направление шайбы меняется в сторону команды, получившей владение
      puck.vy = (lastGoalFor === "human" ? -4 : 4);
      gameStarted = true;
    }
  }, 1000);
}

// Проверка завершения игры
function checkGameEnd() {
  if (humanScore >= WINNING_SCORE || botScore >= WINNING_SCORE) {
    gameRunning = false;
    cancelAnimationFrame(animationFrameId);
    if (humanScore > botScore) {
      if (typeof localUserData !== 'undefined' && typeof userRef !== 'undefined') {
        localUserData.points += WIN_POINTS;
        userRef.update({ points: localUserData.points });
      }
      showEndGameModal("You Win!", "Your score: " + humanScore);
    } else {
      showEndGameModal("Game Over", "Your score: " + humanScore);
    }
  }
}

// Функция сброса игры (для вызова извне)
function resetGame2() {
  cancelAnimationFrame(animationFrameId);
  gameRunning = false;
  gameStarted = false;
  game2Ctx.clearRect(0, 0, canvasWidth, canvasHeight);
  game2Canvas.removeEventListener("mousemove", mouseMoveHandler);
  game2Canvas.removeEventListener("touchmove", touchMoveHandler);
}

window.initGame2 = initGame2;
