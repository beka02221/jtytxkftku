/* =========================
   game4.js — Breakout (Арканоид)
   Управление:
     - Мышь: движение ракетки по X
     - Тач-события: движение пальцем по экрану (горизонтально)
   При уничтожении кирпичей добавляем очки (localUserData.points).
   При проигрыше или полном прохождении — вызываем showEndGameModal.
========================= */
// game4.js – Игра Breakout

// Глобальные переменные для game4
let game4Canvas, game4Ctx;
let ballX, ballY, ballDX, ballDY, ballRadius;
let paddleX, paddleWidth, paddleHeight;
let bricks = [];
let brickRowCount, brickColumnCount, brickWidth, brickHeight, brickPadding, brickOffsetTop, brickOffsetLeft;
let score, lives;
let gameRunning = false;
let animationFrameId;

// Инициализация игры
function initGame4() {
  gameRunning = true;
  game4Canvas = document.getElementById('game4Canvas');
  game4Ctx = game4Canvas.getContext('2d');

  // Настройка мяча
  ballRadius = 8;
  ballX = game4Canvas.width / 2;
  ballY = game4Canvas.height - 50;
  ballDX = 3;
  ballDY = -3;

  // Настройка платформы (ракетки)
  paddleWidth = 80;
  paddleHeight = 10;
  paddleX = (game4Canvas.width - paddleWidth) / 2;

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

  // Сброс счёта и жизней
  score = 0;
  lives = 3;

  // Добавляем обработчики событий для управления платформой
  game4Canvas.addEventListener("mousemove", mouseMoveHandler, false);
  game4Canvas.addEventListener("touchmove", touchMoveHandler, { passive: false });

  // Запускаем игровой цикл
  gameLoop();
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
  // Обновляем позицию мяча
  ballX += ballDX;
  ballY += ballDY;

  // Проверка столкновения с боковыми стенками
  if (ballX + ballDX > game4Canvas.width - ballRadius || ballX + ballDX < ballRadius) {
    ballDX = -ballDX;
  }
  // Столкновение с верхней стеной
  if (ballY + ballDY < ballRadius) {
    ballDY = -ballDY;
  }
  // Проверка достижения нижней границы (платформа)
  else if (ballY + ballDY > game4Canvas.height - ballRadius) {
    if (ballX > paddleX && ballX < paddleX + paddleWidth) {
      // Отскок от платформы; можно немного изменить угол в зависимости от точки удара
      ballDY = -ballDY;
      let hitPoint = ballX - (paddleX + paddleWidth / 2);
      ballDX = hitPoint * 0.1; // корректировка угла
    } else {
      // Промах – теряем жизнь
      lives--;
      if (!lives) {
        // Игра окончена
        gameRunning = false;
        // Начисляем заработанные очки и обновляем баланс пользователя
        localUserData.points += score;
        updateTopBar();
        showEndGameModal("Game Over", "Your score: " + score);
      } else {
        // Сброс позиций мяча и платформы
        ballX = game4Canvas.width / 2;
        ballY = game4Canvas.height - 50;
        ballDX = 3;
        ballDY = -3;
        paddleX = (game4Canvas.width - paddleWidth) / 2;
      }
    }
  }

  // Проверка столкновений с кирпичиками
  for (let c = 0; c < brickColumnCount; c++) {
    for (let r = 0; r < brickRowCount; r++) {
      let b = bricks[c][r];
      if (b.status === 1) {
        let brickX = brickOffsetLeft + c * (brickWidth + brickPadding);
        let brickY = brickOffsetTop + r * (brickHeight + brickPadding);
        b.x = brickX;
        b.y = brickY;
        // Если мяч попал в кирпич – отражаем мяч и скрываем кирпич
        if (ballX > brickX && ballX < brickX + brickWidth && ballY - ballRadius > brickY && ballY - ballRadius < brickY + brickHeight) {
          ballDY = -ballDY;
          b.status = 0;
          score += 10;
          // Если все кирпичики сбиты – игрок выигрывает
          if (isAllBricksBroken()) {
            gameRunning = false;
            localUserData.points += score;
            updateTopBar();
            showEndGameModal("You Win!", "Your score: " + score);
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
  game4Ctx.beginPath();
  game4Ctx.rect(paddleX, game4Canvas.height - paddleHeight - 10, paddleWidth, paddleHeight);
  game4Ctx.fillStyle = "#0095DD";
  game4Ctx.fill();
  game4Ctx.closePath();

  // Отображаем счёт и жизни
  game4Ctx.font = "16px Arial";
  game4Ctx.fillStyle = "#FFF";
  game4Ctx.fillText("Score: " + score, 8, 20);
  game4Ctx.fillText("Lives: " + lives, game4Canvas.width - 65, 20);
}

// Обработчик движения мыши для управления платформой
function mouseMoveHandler(e) {
  let relativeX = e.clientX - game4Canvas.getBoundingClientRect().left;
  if (relativeX > 0 && relativeX < game4Canvas.width) {
    paddleX = relativeX - paddleWidth / 2;
  }
}

// Обработчик касания для мобильных устройств
function touchMoveHandler(e) {
  e.preventDefault();
  let touch = e.touches[0];
  let relativeX = touch.clientX - game4Canvas.getBoundingClientRect().left;
  if (relativeX > 0 && relativeX < game4Canvas.width) {
    paddleX = relativeX - paddleWidth / 2;
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
  if (game4Canvas) {
    game4Canvas.removeEventListener("mousemove", mouseMoveHandler);
    game4Canvas.removeEventListener("touchmove", touchMoveHandler);
  }
  if (game4Ctx) {
    game4Ctx.clearRect(0, 0, game4Canvas.width, game4Canvas.height);
  }
}
