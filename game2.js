/* 
  game2.js – Игра Аэрохоккей
  Правила:
    • Игра идёт до 5 очков.
    • Если человек выигрывает, ему начисляется 200 points.
    • Бот управляется так, чтобы его поведение было максимально "по-человечески":
         - плавное движение,
         - не мгновенная реакция на позицию шайбы,
         - допуски в точности ударов.
    • Чем резче и увереннее игрок бьёт по шайбе, тем сильнее передаётся импульс (увеличивается скорость шайбы).
    
  Оформление:
    • Неоновый стиль игрового поля.
    
  Управление:
    • Мышь (или тач) – перемещение игровой клюшки игрока (находится в нижней части экрана).
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

// Позиции по Y для игровых элементов (фиксированные)
const HUMAN_Y =  canvasHeight; // будет установлено при инициализации
const BOT_Y = 40;              // верхняя позиция для бота

// Параметры игровых объектов
const PADDLE_RADIUS = 30;
const PUCK_RADIUS = 15;
const FRICTION = 0.99; // замедление шайбы
const MIN_BOT_SPEED = 2; // минимальная скорость движения бота
const MAX_BOT_SPEED = 5; // максимальная скорость движения бота

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
  
  // Устанавливаем фиксированные Y-координаты для ракеток
  const humanY = canvasHeight - 40;
  const botY = 40;
  
  // Инициализация игровых объектов
  humanPaddle = {
    x: canvasWidth / 2,
    y: humanY,
    radius: PADDLE_RADIUS,
    vx: 0,
    vy: 0,
    prevX: canvasWidth / 2
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
  
  // Добавляем обработчики событий
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
  if (puck.x - puck.radius < 0 || puck.x + puck.radius > canvasWidth) {
    puck.vx = -puck.vx;
    // Корректируем позицию, чтобы не "застревала" за стеной
    puck.x = Math.max(puck.radius, Math.min(puck.x, canvasWidth - puck.radius));
  }
  
  // Проверка на гол (цель – если шайба пересекает верхнюю или нижнюю границу)
  if (puck.y - puck.radius < 0) {
    // Гол для человека (бот пропустил)
    humanScore++;
    checkGameEnd();
    resetPositions();
    return;
  }
  if (puck.y + puck.radius > canvasHeight) {
    // Гол для бота
    botScore++;
    checkGameEnd();
    resetPositions();
    return;
  }
  
  // Обработка столкновений шайбы с клюшками (человеческой и бота)
  handlePaddleCollision(humanPaddle, true);
  handlePaddleCollision(botPaddle, false);
  
  // Обновление поведения бота:
  // Бот старается плавно приблизиться к позиции шайбы по оси X с небольшой задержкой и случайной погрешностью
  const targetX = puck.x + (Math.random() * 20 - 10); // добавляем случайный сдвиг
  const dx = targetX - botPaddle.x;
  // Ограничиваем скорость движения бота
  let botSpeed = dx * 0.05;
  botSpeed = Math.max(-MAX_BOT_SPEED, Math.min(botSpeed, MAX_BOT_SPEED));
  botPaddle.x += botSpeed;
  
  // Ограничиваем положение бота по горизонтали
  botPaddle.x = Math.max(botPaddle.radius, Math.min(botPaddle.x, canvasWidth - botPaddle.radius));
}

// Функция обработки столкновения шайбы с клюшкой
// isHuman: true для клюшки игрока, false для бота
function handlePaddleCollision(paddle, isHuman) {
  const dx = puck.x - paddle.x;
  const dy = puck.y - paddle.y;
  const dist = Math.sqrt(dx * dx + dy * dy);
  
  if (dist < puck.radius + paddle.radius) {
    // Простая реакция: отражаем скорость шайбы
    // Нормализуем вектор столкновения
    const nx = dx / dist;
    const ny = dy / dist;
    
    // Отражаем скорость шайбы
    // Если столкновение произошло с клюшкой игрока – учитываем скорость клюшки для усиления удара
    let impact = 1;
    if (isHuman) {
      // Вычисляем скорость движения клюшки (разница между текущей и предыдущей позицией)
      const paddleSpeed = paddle.x - paddle.prevX;
      // Если скорость достаточно высокая, увеличиваем импульс
      if (Math.abs(paddleSpeed) > 5) {
        impact += Math.abs(paddleSpeed) / 20;
      }
    }
    
    // Обновляем скорость шайбы: отражение + небольшой импульс от клюшки
    // Также переносим шайбу за пределы столкновения, чтобы избежать "залипания"
    const speed = Math.sqrt(puck.vx * puck.vx + puck.vy * puck.vy);
    const newSpeed = Math.max(speed, 5) * impact;
    puck.vx = nx * newSpeed;
    puck.vy = ny * newSpeed;
    
    // Немного смещаем позицию шайбы, чтобы избежать повторного срабатывания столкновения
    puck.x = paddle.x + (puck.radius + paddle.radius + 1) * nx;
    puck.y = paddle.y + (puck.radius + paddle.radius + 1) * ny;
  }
  
  // Обновляем предыдущую позицию клюшки (только для игрока)
  if (isHuman) {
    paddle.prevX = paddle.x;
  }
}

// Отрисовка игрового поля в неоновом стиле
function drawGame2() {
  // Очистка холста
  game2Ctx.clearRect(0, 0, canvasWidth, canvasHeight);
  
  // Фон – тёмный, с неоновыми элементами
  game2Ctx.fillStyle = "#000";
  game2Ctx.fillRect(0, 0, canvasWidth, canvasHeight);
  
  // Неоновая центральная линия
  game2Ctx.lineWidth = 2;
  game2Ctx.strokeStyle = "#0ff";
  game2Ctx.setLineDash([10, 10]);
  game2Ctx.beginPath();
  game2Ctx.moveTo(0, canvasHeight / 2);
  game2Ctx.lineTo(canvasWidth, canvasHeight / 2);
  game2Ctx.stroke();
  game2Ctx.setLineDash([]);
  
  // Отрисовка клюшек и шайбы с эффектом неонового свечения
  // Настройка теней для неонового эффекта
  game2Ctx.shadowBlur = 20;
  
  // Бот (верхняя клюшка)
  game2Ctx.shadowColor = "#ff00ff";
  game2Ctx.fillStyle = "#ff00ff";
  game2Ctx.beginPath();
  game2Ctx.arc(botPaddle.x, botPaddle.y, botPaddle.radius, 0, Math.PI * 2);
  game2Ctx.fill();
  game2Ctx.closePath();
  
  // Игрок (нижняя клюшка)
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
  
  // Отображение счёта
  game2Ctx.shadowBlur = 0;
  game2Ctx.font = "16px Arial";
  game2Ctx.fillStyle = "#fff";
  game2Ctx.fillText("Player: " + humanScore, 10, canvasHeight - 10);
  game2Ctx.fillText("Bot: " + botScore, 10, 20);
}

// Обработчик движения мыши для управления клюшкой игрока
function mouseMoveHandler(e) {
  let rect = game2Canvas.getBoundingClientRect();
  let relativeX = e.clientX - rect.left;
  // Ограничиваем движение по горизонтали
  humanPaddle.x = Math.max(humanPaddle.radius, Math.min(relativeX, canvasWidth - humanPaddle.radius));
  
  // При первом движении запускаем игру
  if (!gameStarted) {
    gameStarted = true;
    gameRunning = true;
    // При старте задаём начальное направление шайбы случайным образом
    puck.vx = (Math.random() * 4 - 2);
    puck.vy = -4;
    game2Loop();
  }
}

// Обработчик касания для мобильных устройств
function touchMoveHandler(e) {
  e.preventDefault();
  let touch = e.touches[0];
  let rect = game2Canvas.getBoundingClientRect();
  let relativeX = touch.clientX - rect.left;
  humanPaddle.x = Math.max(humanPaddle.radius, Math.min(relativeX, canvasWidth - humanPaddle.radius));
  
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
  // Сброс шайбы в центр
  puck.x = canvasWidth / 2;
  puck.y = canvasHeight / 2;
  puck.vx = 0;
  puck.vy = 0;
  
  // Сброс позиций клюшек
  humanPaddle.x = canvasWidth / 2;
  humanPaddle.y = canvasHeight - 40;
  humanPaddle.prevX = humanPaddle.x;
  
  botPaddle.x = canvasWidth / 2;
  botPaddle.y = 40;
  
  // При небольшой задержке начинаем новый раунд
  gameStarted = false;
  setTimeout(() => {
    // Если игра всё ещё идёт, задаём начальное движение шайбы
    if (gameRunning) {
      puck.vx = (Math.random() * 4 - 2);
      puck.vy = (Math.random() < 0.5 ? 4 : -4);
      gameStarted = true;
    }
  }, 1000);
}

// Проверка условий завершения игры
function checkGameEnd() {
  if (humanScore >= WINNING_SCORE || botScore >= WINNING_SCORE) {
    gameRunning = false;
    cancelAnimationFrame(animationFrameId);
    // Если человек выигрывает, начисляем ему WIN_POINTS
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
  // Убираем обработчики событий, если требуется (опционально)
  game2Canvas.removeEventListener("mousemove", mouseMoveHandler);
  game2Canvas.removeEventListener("touchmove", touchMoveHandler);
}

// Экспортируем функцию инициализации (вызывается из index.html)
window.initGame2 = initGame2;


