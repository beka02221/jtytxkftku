/* 
  game2.js – Игра Аэрохоккей
  Правила:
    • Игра идёт до 5 очков.
    • Если человек выигрывает, ему начисляется 200 points.
    • Бот управляется так, чтобы его поведение было максимально "по-человечески":
         - плавное движение,
         - задержка реакции,
         - допускает небольшие погрешности в ударах.
    • Чем резче и увереннее игрок бьёт по шайбе, тем сильнее передаётся импульс.
    
  Оформление:
    • Неоновый стиль игрового поля.
    • Видимые границы (стены) с вырезами – воротами.
    
  Управление:
    • Мышь или сенсор – перемещение клюшки игрока в нижней половине поля.
*/

let game2Canvas, game2Ctx;
let canvasWidth, canvasHeight;

// Игровые объекты
let humanPaddle, botPaddle, puck;

// Счёт игры
let humanScore = 0, botScore = 0;

// Флаги запуска игры
let gameRunning = false;
let gameStarted = false;
let animationFrameId;

// Константы игры
const WINNING_SCORE = 5;
const WIN_POINTS = 200;

// Параметры игровых объектов
const PADDLE_RADIUS = 30;
const PUCK_RADIUS = 15;
const FRICTION = 0.99; // замедление шайбы
const MIN_BOT_SPEED = 2; // минимальная скорость движения бота
const MAX_BOT_SPEED = 5; // максимальная скорость движения бота

// Параметры стен и ворот
const WALL_THICKNESS = 10;
const GOAL_WIDTH = 100; // ширина выреза в верхней и нижней стенах

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
  
  // Определяем Y-координаты для клюшек:
  // Игрок может перемещаться в нижней половине поля (от canvasHeight/2 до canvasHeight - PADDLE_RADIUS)
  const humanY = canvasHeight - 40;
  // Бот остаётся фиксированным в верхней части
  const botY = 40;
  
  // Инициализация игровых объектов
  humanPaddle = {
    x: canvasWidth / 2,
    y: humanY,
    radius: PADDLE_RADIUS,
    vx: 0,
    vy: 0,
    prevX: canvasWidth / 2,
    prevY: humanY
  };
  
  botPaddle = {
    x: canvasWidth / 2,
    y: botY,
    radius: PADDLE_RADIUS,
    vx: 0,
    vy: 0
  };
  
  puck = {
    x: canvasWidth / 2,
    y: canvasHeight / 2,
    radius: PUCK_RADIUS,
    vx: 0,
    vy: 0
  };
  
  // Сброс счёта
  humanScore = 0;
  botScore = 0;
  
  gameStarted = false;
  gameRunning = false;
  
  // Добавляем обработчики событий для управления клюшкой игрока
  game2Canvas.addEventListener("mousemove", mouseMoveHandler, false);
  game2Canvas.addEventListener("touchmove", touchMoveHandler, { passive: false });
  
  // Отрисовка начального состояния
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
  // Если игра ещё не запущена, просто обновляем позицию клюшки
  if (!gameStarted) {
    return;
  }
  
  // Обновляем позицию шайбы
  puck.x += puck.vx;
  puck.y += puck.vy;
  
  // Применяем небольшое замедление (трение)
  puck.vx *= FRICTION;
  puck.vy *= FRICTION;
  
  // Отскок шайбы от боковых стен
  if (puck.x - puck.radius < WALL_THICKNESS) {
    puck.x = WALL_THICKNESS + puck.radius;
    puck.vx = -puck.vx;
  }
  if (puck.x + puck.radius > canvasWidth - WALL_THICKNESS) {
    puck.x = canvasWidth - WALL_THICKNESS - puck.radius;
    puck.vx = -puck.vx;
  }
  
  // Верхняя стена с воротами
  if (puck.y - puck.radius < WALL_THICKNESS) {
    const goalStart = (canvasWidth - GOAL_WIDTH) / 2;
    const goalEnd = (canvasWidth + GOAL_WIDTH) / 2;
    if (puck.x > goalStart && puck.x < goalEnd) {
      // Гол для игрока
      humanScore++;
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
      // Гол для бота
      botScore++;
      checkGameEnd();
      resetPositions();
      return;
    } else {
      puck.y = canvasHeight - WALL_THICKNESS - puck.radius;
      puck.vy = -puck.vy;
    }
  }
  
  // Обработка столкновений шайбы с клюшками (человеческой и бота)
  handlePaddleCollision(humanPaddle, true);
  handlePaddleCollision(botPaddle, false);
  
  // Обновление поведения бота:
  // Бот плавно стремится к позиции шайбы по оси X с небольшой случайной погрешностью
  const targetX = puck.x + (Math.random() * 20 - 10);
  const dx = targetX - botPaddle.x;
  let botSpeed = dx * 0.05;
  botSpeed = Math.max(-MAX_BOT_SPEED, Math.min(botSpeed, MAX_BOT_SPEED));
  botPaddle.x += botSpeed;
  // Ограничиваем положение бота по горизонтали
  botPaddle.x = Math.max(botPaddle.radius + WALL_THICKNESS, Math.min(botPaddle.x, canvasWidth - botPaddle.radius - WALL_THICKNESS));
}

// Функция обработки столкновения шайбы с клюшкой
// isHuman: true для клюшки игрока, false для бота
function handlePaddleCollision(paddle, isHuman) {
  const dx = puck.x - paddle.x;
  const dy = puck.y - paddle.y;
  const dist = Math.sqrt(dx * dx + dy * dy);
  
  if (dist < puck.radius + paddle.radius) {
    // Нормализуем вектор столкновения
    const nx = dx / dist;
    const ny = dy / dist;
    
    // Определяем импульс удара; для игрока учитываем скорость движения клюшки
    let impact = 1;
    if (isHuman) {
      const paddleSpeedX = paddle.x - paddle.prevX;
      const paddleSpeedY = paddle.y - paddle.prevY;
      const paddleSpeed = Math.sqrt(paddleSpeedX * paddleSpeedX + paddleSpeedY * paddleSpeedY);
      if (paddleSpeed > 5) {
        impact += paddleSpeed / 20;
      }
    }
    
    // Рассчитываем новую скорость шайбы
    const speed = Math.sqrt(puck.vx * puck.vx + puck.vy * puck.vy);
    const newSpeed = Math.max(speed, 5) * impact;
    puck.vx = nx * newSpeed;
    puck.vy = ny * newSpeed;
    
    // Смещаем шайбу за пределы столкновения
    puck.x = paddle.x + (puck.radius + paddle.radius + 1) * nx;
    puck.y = paddle.y + (puck.radius + paddle.radius + 1) * ny;
  }
  
  // Обновляем предыдущие координаты клюшки (только для игрока)
  if (isHuman) {
    paddle.prevX = paddle.x;
    paddle.prevY = paddle.y;
  }
}

// Отрисовка игрового поля, включая неоновый фон, границы, ворота, клюшки и шайбу
function drawGame2() {
  // Очистка холста
  game2Ctx.clearRect(0, 0, canvasWidth, canvasHeight);
  
  // Фон – чёрный
  game2Ctx.fillStyle = "#000";
  game2Ctx.fillRect(0, 0, canvasWidth, canvasHeight);
  
  // Отрисовка границ и ворот
  drawBoundaries();
  
  // Настройка неонового свечения
  game2Ctx.shadowBlur = 20;
  
  // Отрисовка клюшки бота (верхняя)
  game2Ctx.shadowColor = "#ff00ff";
  game2Ctx.fillStyle = "#ff00ff";
  game2Ctx.beginPath();
  game2Ctx.arc(botPaddle.x, botPaddle.y, botPaddle.radius, 0, Math.PI * 2);
  game2Ctx.fill();
  game2Ctx.closePath();
  
  // Отрисовка клюшки игрока (нижняя)
  game2Ctx.shadowColor = "#0ff";
  game2Ctx.fillStyle = "#0ff";
  game2Ctx.beginPath();
  game2Ctx.arc(humanPaddle.x, humanPaddle.y, humanPaddle.radius, 0, Math.PI * 2);
  game2Ctx.fill();
  game2Ctx.closePath();
  
  // Отрисовка шайбы
  game2Ctx.shadowColor = "#ffff00";
  game2Ctx.fillStyle = "#ffff00";
  game2Ctx.beginPath();
  game2Ctx.arc(puck.x, puck.y, puck.radius, 0, Math.PI * 2);
  game2Ctx.fill();
  game2Ctx.closePath();
  
  // Сброс теней
  game2Ctx.shadowBlur = 0;
  
  // Отображение счёта
  game2Ctx.font = "16px Arial";
  game2Ctx.fillStyle = "#fff";
  game2Ctx.fillText("Player: " + humanScore, 10, canvasHeight - 20);
  game2Ctx.fillText("Bot: " + botScore, 10, 30);
}

// Функция отрисовки границ и ворот
function drawBoundaries() {
  game2Ctx.fillStyle = "#fff";
  
  // Левая стена
  game2Ctx.fillRect(0, 0, WALL_THICKNESS, canvasHeight);
  // Правая стена
  game2Ctx.fillRect(canvasWidth - WALL_THICKNESS, 0, WALL_THICKNESS, canvasHeight);
  
  // Верхняя стена (с вырезом для ворот)
  const topGoalStart = (canvasWidth - GOAL_WIDTH) / 2;
  // Левая часть верхней стены
  game2Ctx.fillRect(0, 0, topGoalStart, WALL_THICKNESS);
  // Правая часть верхней стены
  game2Ctx.fillRect(topGoalStart + GOAL_WIDTH, 0, topGoalStart, WALL_THICKNESS);
  
  // Нижняя стена (с вырезом для ворот)
  const bottomGoalStart = (canvasWidth - GOAL_WIDTH) / 2;
  game2Ctx.fillRect(0, canvasHeight - WALL_THICKNESS, bottomGoalStart, WALL_THICKNESS);
  game2Ctx.fillRect(bottomGoalStart + GOAL_WIDTH, canvasHeight - WALL_THICKNESS, bottomGoalStart, WALL_THICKNESS);
  
  // Опционально: обводка ворот
  game2Ctx.strokeStyle = "#ff0";
  game2Ctx.lineWidth = 2;
  game2Ctx.strokeRect(topGoalStart, 0, GOAL_WIDTH, WALL_THICKNESS);
  game2Ctx.strokeRect(bottomGoalStart, canvasHeight - WALL_THICKNESS, GOAL_WIDTH, WALL_THICKNESS);
}

// Обработчик движения мыши для управления клюшкой игрока (2D)
function mouseMoveHandler(e) {
  let rect = game2Canvas.getBoundingClientRect();
  let relativeX = e.clientX - rect.left;
  let relativeY = e.clientY - rect.top;
  
  // Ограничиваем движение по X
  humanPaddle.x = Math.max(humanPaddle.radius + WALL_THICKNESS, Math.min(relativeX, canvasWidth - humanPaddle.radius - WALL_THICKNESS));
  // Ограничиваем движение по Y только в нижней половине поля
  const minY = canvasHeight / 2 + humanPaddle.radius;
  const maxY = canvasHeight - humanPaddle.radius - WALL_THICKNESS;
  humanPaddle.y = Math.max(minY, Math.min(relativeY, maxY));
  
  // При первом движении запускаем игру
  if (!gameStarted) {
    gameStarted = true;
    gameRunning = true;
    // При старте задаём случайное начальное направление для шайбы
    puck.vx = (Math.random() * 4 - 2);
    puck.vy = -4;
    game2Loop();
  }
}

// Обработчик касания для мобильных устройств (аналогично мыши)
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

// Сброс позиций шайбы и клюшек после гола
function resetPositions() {
  puck.x = canvasWidth / 2;
  puck.y = canvasHeight / 2;
  puck.vx = 0;
  puck.vy = 0;
  
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
      // Направление выбирается случайно: вверх или вниз (но обычно для нового раунда – вверх)
      puck.vy = -4;
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

// Функция сброса игры (вызывается извне при завершении игры)
function resetGame2() {
  cancelAnimationFrame(animationFrameId);
  gameRunning = false;
  gameStarted = false;
  game2Ctx.clearRect(0, 0, canvasWidth, canvasHeight);
  game2Canvas.removeEventListener("mousemove", mouseMoveHandler);
  game2Canvas.removeEventListener("touchmove", touchMoveHandler);
}

// Экспорт функции инициализации (вызывается из index.html)
window.initGame2 = initGame2;
