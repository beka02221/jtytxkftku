// game4.js
// Игра Breakout (арканоид) с «панк/ретро» дизайном, адаптированная под мобильные устройства.

let g4_canvas, g4_ctx;
let g4_animationFrameId = null;

// Параметры игры
let g4_ballRadius = 8;
let g4_ballX, g4_ballY;        // координаты мяча
let g4_ballSpeedX = 2;
let g4_ballSpeedY = -2;

// Параметры платформы (paddle)
let g4_paddleHeight = 10;
let g4_paddleWidth = 60;
let g4_paddleX; // X-координата левого края платформы

// Параметры кирпичей
let g4_brickRowCount = 5;
let g4_brickColumnCount = 7;
let g4_brickWidth = 40;
let g4_brickHeight = 12;
let g4_brickPadding = 10;
let g4_brickOffsetTop = 30;
let g4_brickOffsetLeft = 20;

// Скорость в пикселях; можно подстроить для комфортной игры на мобильном
const g4_paddleSpeed = 6;

// Данные по кирпичам будут храниться в массиве
let g4_bricks = [];

// Счёт и жизни
let g4_score = 0;
let g4_lives = 3;

// Флаг для паузы, если нужно
// let g4_paused = false;

// Инициализация (вызывается при нажатии "Играть")
function initGame4() {
  g4_canvas = document.getElementById('game4Canvas');
  g4_ctx = g4_canvas.getContext('2d');

  // Для красоты используем чёрный фон + неоновую графику
  g4_ctx.fillStyle = '#000000';
  g4_ctx.fillRect(0, 0, g4_canvas.width, g4_canvas.height);

  // Инициализация положения мяча и платформы
  resetPositions();
  
  // Генерация массива кирпичей
  initBricks();

  // События управления:
  // 1) Мышь (для десктопа)
  document.addEventListener('mousemove', mouseMoveHandler, false);

  // 2) Touch (для мобильных)
  g4_canvas.addEventListener('touchmove', touchMoveHandler, false);

  // Запуск основного цикла
  g4_animationFrameId = requestAnimationFrame(drawGame4);
}

// Сброс игры (вызывается при закрытии модального окна)
function resetGame4() {
  // Остановка анимации
  if (g4_animationFrameId) {
    cancelAnimationFrame(g4_animationFrameId);
    g4_animationFrameId = null;
  }
  // Удаляем слушатели событий
  document.removeEventListener('mousemove', mouseMoveHandler);
  if (g4_canvas) {
    g4_canvas.removeEventListener('touchmove', touchMoveHandler);
  }
  // Очищаем холст
  if (g4_ctx) {
    g4_ctx.clearRect(0, 0, g4_canvas.width, g4_canvas.height);
  }
}

// Начальные координаты мяча и платформы
function resetPositions() {
  g4_ballX = g4_canvas.width / 2;
  g4_ballY = g4_canvas.height - 30;
  g4_paddleX = (g4_canvas.width - g4_paddleWidth) / 2;

  // Можно менять направление мяча при новом раунде
  g4_ballSpeedX = 2;
  g4_ballSpeedY = -2;

  g4_score = 0;
  g4_lives = 3;
}

// Инициализируем кирпичи
function initBricks() {
  g4_bricks = [];
  for (let c = 0; c < g4_brickColumnCount; c++) {
    g4_bricks[c] = [];
    for (let r = 0; r < g4_brickRowCount; r++) {
      // Каждому кирпичу добавляем свойство status=1 (1 = цел, 0 = сбит)
      g4_bricks[c][r] = { x: 0, y: 0, status: 1 };
    }
  }
}

// Обработчик движения мыши (для десктопа)
function mouseMoveHandler(e) {
  const rect = g4_canvas.getBoundingClientRect();
  let relativeX = e.clientX - rect.left;
  if (relativeX > 0 && relativeX < g4_canvas.width) {
    g4_paddleX = relativeX - g4_paddleWidth / 2;
  }
}

// Обработчик тач-событий (для мобильных)
// Перемещаем платформу туда, где «тап» или «перетаскивание»
function touchMoveHandler(e) {
  e.preventDefault();
  const rect = g4_canvas.getBoundingClientRect();
  let touchX = e.touches[0].clientX - rect.left;
  if (touchX > 0 && touchX < g4_canvas.width) {
    g4_paddleX = touchX - g4_paddleWidth / 2;
  }
}

// Основной цикл отрисовки
function drawGame4() {
  g4_ctx.clearRect(0, 0, g4_canvas.width, g4_canvas.height);
  
  // Фон
  g4_ctx.fillStyle = '#000000';
  g4_ctx.fillRect(0, 0, g4_canvas.width, g4_canvas.height);

  drawBricks();
  drawBall();
  drawPaddle();
  drawScore();
  drawLives();

  collisionDetection();

  // Движение мяча
  g4_ballX += g4_ballSpeedX;
  g4_ballY += g4_ballSpeedY;

  // Столкновение со стенами
  // Слева/справа
  if (g4_ballX + g4_ballSpeedX < g4_ballRadius || g4_ballX + g4_ballSpeedX > g4_canvas.width - g4_ballRadius) {
    g4_ballSpeedX = -g4_ballSpeedX;
  }
  // Сверху
  if (g4_ballY + g4_ballSpeedY < g4_ballRadius) {
    g4_ballSpeedY = -g4_ballSpeedY;
  } 
  // Снизу — теряем жизнь
  else if (g4_ballY + g4_ballSpeedY > g4_canvas.height - g4_ballRadius) {
    // Проверяем, коснулись ли платформы
    if (
      g4_ballX > g4_paddleX && 
      g4_ballX < g4_paddleX + g4_paddleWidth
    ) {
      // Отскакиваем
      g4_ballSpeedY = -g4_ballSpeedY;
    } else {
      g4_lives--;
      if (!g4_lives) {
        // Проигрыш
        showEndGameModal('Game Over', 'Try again!');
        return; 
      } else {
        // Сбрасываем только мяч и платформу
        g4_ballX = g4_canvas.width / 2;
        g4_ballY = g4_canvas.height - 30;
        g4_ballSpeedX = 2;
        g4_ballSpeedY = -2;
        g4_paddleX = (g4_canvas.width - g4_paddleWidth) / 2;
      }
    }
  }

  // Движение платформы ограничиваем границами холста
  if (g4_paddleX < 0) {
    g4_paddleX = 0;
  } else if (g4_paddleX + g4_paddleWidth > g4_canvas.width) {
    g4_paddleX = g4_canvas.width - g4_paddleWidth;
  }

  // Запрашиваем следующий кадр
  g4_animationFrameId = requestAnimationFrame(drawGame4);
}

// Отрисовка мяча
function drawBall() {
  g4_ctx.beginPath();
  g4_ctx.arc(g4_ballX, g4_ballY, g4_ballRadius, 0, Math.PI * 2);
  g4_ctx.fillStyle = '#00FFFF'; // неоновый «киберпанк» цвет
  g4_ctx.fill();
  g4_ctx.closePath();
}

// Отрисовка платформы
function drawPaddle() {
  g4_ctx.beginPath();
  g4_ctx.rect(g4_paddleX, g4_canvas.height - g4_paddleHeight - 5, g4_paddleWidth, g4_paddleHeight);
  g4_ctx.fillStyle = '#FF00FF'; // ярко-розовый для «ретро-панк» стиля
  g4_ctx.fill();
  g4_ctx.closePath();
}

// Отрисовка кирпичей
function drawBricks() {
  for (let c = 0; c < g4_brickColumnCount; c++) {
    for (let r = 0; r < g4_brickRowCount; r++) {
      if (g4_bricks[c][r].status === 1) {
        let brickX = (c * (g4_brickWidth + g4_brickPadding)) + g4_brickOffsetLeft;
        let brickY = (r * (g4_brickHeight + g4_brickPadding)) + g4_brickOffsetTop;
        g4_bricks[c][r].x = brickX;
        g4_bricks[c][r].y = brickY;

        g4_ctx.beginPath();
        g4_ctx.rect(brickX, brickY, g4_brickWidth, g4_brickHeight);
        // Пёстрые цвета — создаём «неоновую» палитру
        g4_ctx.fillStyle = (r % 2 === 0) ? '#00FF00' : '#FFFF00';
        g4_ctx.fill();
        g4_ctx.closePath();
      }
    }
  }
}

// Проверка столкновений мяча с кирпичами
function collisionDetection() {
  for (let c = 0; c < g4_brickColumnCount; c++) {
    for (let r = 0; r < g4_brickRowCount; r++) {
      let b = g4_bricks[c][r];
      if (b.status === 1) {
        if (
          g4_ballX > b.x &&
          g4_ballX < b.x + g4_brickWidth &&
          g4_ballY > b.y &&
          g4_ballY < b.y + g4_brickHeight
        ) {
          g4_ballSpeedY = -g4_ballSpeedY;
          b.status = 0;
          g4_score++;
          // Проверяем, сбиты ли все кирпичи
          if (g4_score === g4_brickRowCount * g4_brickColumnCount) {
            // Победа!
            showEndGameModal('You Win!', 'Congratulations!');
          }
        }
      }
    }
  }
}

// Отрисовка счёта (score)
function drawScore() {
  g4_ctx.font = "14px 'Press Start 2P', sans-serif";
  g4_ctx.fillStyle = "#FFFFFF";
  g4_ctx.fillText("SCORE: " + g4_score, 10, 20);
}

// Отрисовка жизней
function drawLives() {
  g4_ctx.font = "14px 'Press Start 2P', sans-serif";
  g4_ctx.fillStyle = "#FFFFFF";
  g4_ctx.fillText("LIVES: " + g4_lives, g4_canvas.width - 120, 20);
}
