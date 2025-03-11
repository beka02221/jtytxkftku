/* =========================
   game4.js — Breakout (Арканоид)
   Управление:
     - Мышь: движение ракетки по X
     - Тач-события: движение пальцем по экрану (горизонтально)
   При уничтожении кирпичей добавляем очки (localUserData.points).
   При проигрыше или полном прохождении — вызываем showEndGameModal.
========================= */
// game4.js – Игра Breakout (обновлённая версия)

// Глобальные переменные для game4
let game4Canvas, game4Ctx;
let ballX, ballY, ballDX, ballDY, ballRadius;
let paddleX, paddleWidth, paddleHeight;
let bricks = [];
let brickRowCount, brickColumnCount, brickWidth, brickHeight, brickPadding, brickOffsetTop, brickOffsetLeft;
let score;
let gameRunning = false;   // Флаг работы игрового цикла
let gameStarted = false;   // Игра стартует по первому движению платформы
let animationFrameId;
const DEATH_LINE_OFFSET = 20; // Дополнительный отступ ниже нижней границы

// Инициализация игры
function initGame4() {
  game4Canvas = document.getElementById('game4Canvas');
  if (!game4Canvas) {
    console.error("Элемент canvas с id 'game4Canvas' не найден.");
    return;
  }
  game4Ctx = game4Canvas.getContext('2d');
 
  // Настройка параметров мяча
  ballRadius = 8;
  
  // Настройка платформы (ракетки)
  paddleWidth = 40;
  paddleHeight = 10;
  paddleX = (game4Canvas.width - paddleWidth) / 2;
  const paddleY = game4Canvas.height - paddleHeight - 10;
  
  // Пока игра не запущена — мяч «прилипает» к платформе
  ballX = paddleX + paddleWidth / 2;
  ballY = paddleY - ballRadius;
  // Скорость мяча
  ballDX = 4;
  ballDY = -4;
  
  // Настройка кирпичиков
  brickRowCount = 5;
  brickColumnCount = 7;
  brickPadding = 10;
  brickOffsetTop = 30;
  brickOffsetLeft = 10;
  brickWidth = (game4Canvas.width - brickOffsetLeft * 2 - (brickColumnCount - 1) * brickPadding) / brickColumnCount;
  brickHeight = 20;
  
  // Создаём массив кирпичиков
  bricks = [];
  for (let c = 0; c < brickColumnCount; c++) {
    bricks[c] = [];
    for (let r = 0; r < brickRowCount; r++) {
      bricks[c][r] = { x: 0, y: 0, status: 1 }; // status 1 – кирпич виден
    }
  }

  // Сброс счёта
  score = 0;

  // Флаги: игра ещё не запущена
  gameStarted = false;
  gameRunning = false;

  // Добавляем обработчики событий для управления платформой
  game4Canvas.addEventListener("mousemove", mouseMoveHandler, false);
  game4Canvas.addEventListener("touchmove", touchMoveHandler, { passive: false });

  // Отрисовываем начальное состояние
  drawGame4();
}

// Основной игровой цикл
function gameLoop() {
  updateGame4();
  drawGame4();
  if (gameRunning) {
    animationFrameId = requestAnimationFrame(gameLoop);
  }
}

// Обновление игрового состояния
function updateGame4() {
  const paddleY = game4Canvas.height - paddleHeight - 10;
  const deathLine = game4Canvas.height + DEATH_LINE_OFFSET;
  
  // Если игра ещё не запущена — мяч держится на платформе
  if (!gameStarted) {
    ballX = paddleX + paddleWidth / 2;
    ballY = paddleY - ballRadius;
    return;
  }

  // Обновляем позицию мяча
  ballX += ballDX;
  ballY += ballDY;

  // Столкновение с боковыми стенками
  if (ballX + ballRadius > game4Canvas.width || ballX - ballRadius < 0) {
    ballDX = -ballDX;
  }
  // Столкновение с верхней стенкой
  if (ballY - ballRadius < 0) {
    ballDY = -ballDY;
  }

  // Отскок от платформы
  if (ballY + ballRadius >= paddleY) {
    if (ballX > paddleX && ballX < paddleX + paddleWidth) {
      ballDY = -ballDY;
      let hitPoint = ballX - (paddleX + paddleWidth / 2);
      ballDX = hitPoint * 0.1;
      // Обновляем позицию, чтобы мяч не застревал в платформе
      ballY = paddleY - ballRadius;
    }
  }

  // Если мяч полностью ушёл ниже линии смерти — проигрыш
  if (ballY - ballRadius > deathLine) {
    gameRunning = false;
    if (typeof userRef !== 'undefined' && typeof localUserData !== 'undefined') {
      userRef.update({ points: localUserData.points });
    }
    showEndGameModal("Game Over", "Your score: " + score);
  }

  // Проверка столкновений с кирпичиками (улучшенная коллизия)
  for (let c = 0; c < brickColumnCount; c++) {
    for (let r = 0; r < brickRowCount; r++) {
      let b = bricks[c][r];
      if (b.status === 1) {
        let brickX = brickOffsetLeft + c * (brickWidth + brickPadding);
        let brickY = brickOffsetTop + r * (brickHeight + brickPadding);
        b.x = brickX;
        b.y = brickY;
        // Проверяем столкновение по всей области мяча
        if (
          ballX + ballRadius > brickX &&
          ballX - ballRadius < brickX + brickWidth &&
          ballY + ballRadius > brickY &&
          ballY - ballRadius < brickY + brickHeight
        ) {
          ballDY = -ballDY;
          if (b.status === 1) {
            b.status = 0;
            score += 10;
            if (typeof localUserData !== 'undefined') {
              localUserData.points += 10;
              updateTopBar();
            }
            // Если все кирпичики сбиты — игрок выигрывает
            if (isAllBricksBroken()) {
              gameRunning = false;
              if (typeof userRef !== 'undefined' && typeof localUserData !== 'undefined') {
                userRef.update({ points: localUserData.points });
              }
              showEndGameModal("You Win!", "Your score: " + score);
            }
          }
        }
      }
    }
  }
}

// Отрисовка игрового поля
function drawGame4() {
  // Очистка холста
  game4Ctx.clearRect(0, 0, game4Canvas.width, game4Canvas.height);
  // Фон
  game4Ctx.fillStyle = "#000";
  game4Ctx.fillRect(0, 0, game4Canvas.width, game4Canvas.height);
  
  // Рисуем кирпичики
  for (let c = 0; c < brickColumnCount; c++) {
    for (let r = 0; r < brickRowCount; r++) {
      if (bricks[c][r].status === 1) {
        let brickX = brickOffsetLeft + c * (brickWidth + brickPadding);
        let brickY = brickOffsetTop + r * (brickHeight + brickPadding);
        bricks[c][r].x = brickX;
        bricks[c][r].y = brickY;
        game4Ctx.fillStyle = "#0095DD";
        game4Ctx.fillRect(brickX, brickY, brickWidth, brickHeight);
      }
    }
  }

  // Рисуем мяч
  game4Ctx.beginPath();
  game4Ctx.arc(ballX, ballY, ballRadius, 0, Math.PI * 2);
  game4Ctx.fillStyle = "#FF4500";
  game4Ctx.fill();
  game4Ctx.closePath();
  
  // Рисуем платформу
  const paddleY = game4Canvas.height - paddleHeight - 10;
  game4Ctx.beginPath();
  game4Ctx.rect(paddleX, paddleY, paddleWidth, paddleHeight);
  game4Ctx.fillStyle = "#0095DD";
  game4Ctx.fill();
  game4Ctx.closePath();
  
  // Отображаем счёт
  game4Ctx.font = "16px Arial";
  game4Ctx.fillStyle = "#FFF";
  game4Ctx.fillText("Score: " + score, 8, 20);
}

// Обработчик движения мыши для управления платформой
function mouseMoveHandler(e) {
  let rect = game4Canvas.getBoundingClientRect();
  let relativeX = e.clientX - rect.left;
  if (relativeX > 0 && relativeX < game4Canvas.width) {
    paddleX = relativeX - paddleWidth / 2;
  }
  // При первом движении запускаем игру
  if (!gameStarted) {
    gameStarted = true;
    gameRunning = true;
    gameLoop();
  }
}

// Обработчик касания для мобильных устройств
function touchMoveHandler(e) {
  e.preventDefault();
  let touch = e.touches[0];
  let rect = game4Canvas.getBoundingClientRect();
  let relativeX = touch.clientX - rect.left;
  if (relativeX > 0 && relativeX < game4Canvas.width) {
    paddleX = relativeX - paddleWidth / 2;
  }
  if (!gameStarted) {
    gameStarted = true;
    gameRunning = true;
    gameLoop();
  }
}

// Проверка, сбиты ли все кирпичики
function isAllBricksBroken() {
  for (let c = 0; c < brickColumnCount; c++) {
    for (let r = 0; r < brickRowCount; r++) {
      if (bricks[c][r].status === 1) {
        return false;
      }
    }
  }
  return true;
}

// Сброс игры (вызывается при завершении игры)
function resetGame4() {
  cancelAnimationFrame(animationFrameId);
  gameRunning = false;
  game4Canvas.removeEventListener("mousemove", mouseMoveHandler);
  game4Canvas.removeEventListener("touchmove", touchMoveHandler);
  if (game4Ctx) {
    game4Ctx.clearRect(0, 0, game4Canvas.width, game4Canvas.height);
  }
}
