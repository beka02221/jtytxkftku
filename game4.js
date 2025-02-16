/* =========================
   game4.js — Breakout (Арканоид)
   Управление:
     - Мышь: движение ракетки по X
     - Тач-события: движение пальцем по экрану (горизонтально)
   При уничтожении кирпичей добавляем очки (localUserData.points).
   При проигрыше или полном прохождении — вызываем showEndGameModal.
========================= */
/* =========================
   game4.js — Breakout (Арканоид)
   Управление:
     - Мышь: движение ракетки по X
     - Тач-события: движение пальцем по экрану (горизонтально)
   Адаптивное масштабирование: канвас подстраивается под размер окна,
   чтобы игра полностью помещалась на экране.
========================= */

let game4Interval = null;
let game4Ctx = null;

let GAME4_WIDTH, GAME4_HEIGHT;

// Параметры ракетки
let paddleWidth, paddleHeight, paddleX;
let paddleSpeed = 7; // если понадобится для расширения логики

// Параметры мяча
let ballRadius;
let ballX, ballY;
let ballDX, ballDY;

// Параметры кирпичей
let brickRowCount = 5;
let brickColumnCount = 7;
let brickPadding = 5;
let brickOffsetTop, brickOffsetLeft;
let brickWidth, brickHeight;

// Массив кирпичей
let bricks = [];

// Флаг для отслеживания касаний
let isTouching = false;
let touchStartX = 0;

function initGame4() {
  const canvas = document.getElementById('game4Canvas');

  // Устанавливаем адаптивный размер канваса (немного меньше окна, чтобы всё было видно)
 canvas.width = window.innerWidth * 0.9;
canvas.height = window.innerHeight * 0.9;

  game4Ctx = canvas.getContext('2d');

  // Настройка параметров ракетки (20% ширины канваса, высота – 2% от высоты, минимум 15px)
  paddleWidth = GAME4_WIDTH * 0.2;
  paddleHeight = GAME4_HEIGHT * 0.02;
  if (paddleHeight < 15) paddleHeight = 15;
  paddleX = (GAME4_WIDTH - paddleWidth) / 2;

  // Настройка параметров мяча (радиус – 2% от ширины, минимум 8px)
  ballRadius = GAME4_WIDTH * 0.02;
  if (ballRadius < 8) ballRadius = 8;
  ballX = GAME4_WIDTH / 2;
  // Мяч стартует чуть выше ракетки
  ballY = GAME4_HEIGHT - paddleHeight - ballRadius - 10;
  ballDX = 3;
  ballDY = -3;

  // Настройка параметров кирпичей
  brickOffsetTop = GAME4_HEIGHT * 0.1; // отступ сверху – 10%
  brickOffsetLeft = GAME4_WIDTH * 0.05; // отступ слева – 5%
  // Вычисляем ширину кирпича так, чтобы они равномерно вписывались в канвас
  brickWidth = (GAME4_WIDTH - 2 * brickOffsetLeft - (brickColumnCount - 1) * brickPadding) / brickColumnCount;
  // Высоту можно задать как 3% от высоты канваса, минимум 20px
  brickHeight = GAME4_HEIGHT * 0.03;
  if (brickHeight < 20) brickHeight = 20;

  // Инициализируем массив кирпичей
  bricks = [];
  for (let c = 0; c < brickColumnCount; c++) {
    bricks[c] = [];
    for (let r = 0; r < brickRowCount; r++) {
      bricks[c][r] = { x: 0, y: 0, destroyed: false };
    }
  }

  // Навешиваем обработчики событий
  window.addEventListener('mousemove', handleGame4MouseMove);
  canvas.addEventListener('touchstart', handleGame4TouchStart, { passive: false });
  canvas.addEventListener('touchmove', handleGame4TouchMove, { passive: false });
  canvas.addEventListener('touchend', handleGame4TouchEnd, { passive: false });

  // Запуск игрового цикла
  game4Interval = requestAnimationFrame(game4Loop);
}

function resetGame4() {
  // Останавливаем анимацию
  if (game4Interval) {
    cancelAnimationFrame(game4Interval);
    game4Interval = null;
  }

  // Убираем обработчики событий
  window.removeEventListener('mousemove', handleGame4MouseMove);
  const canvas = document.getElementById('game4Canvas');
  canvas.removeEventListener('touchstart', handleGame4TouchStart);
  canvas.removeEventListener('touchmove', handleGame4TouchMove);
  canvas.removeEventListener('touchend', handleGame4TouchEnd);

  game4Ctx = null;
}

// Главный игровой цикл
function game4Loop() {
  if (!game4Ctx) return;

  updateGame4();
  drawGame4();

  game4Interval = requestAnimationFrame(game4Loop);
}

function updateGame4() {
  // Движение мяча
  ballX += ballDX;
  ballY += ballDY;

  // Отскок от боковых стен
  if (ballX + ballRadius > GAME4_WIDTH) {
    ballX = GAME4_WIDTH - ballRadius;
    ballDX = -ballDX;
  } else if (ballX - ballRadius < 0) {
    ballX = ballRadius;
    ballDX = -ballDX;
  }

  // Отскок от верхней стены
  if (ballY - ballRadius < 0) {
    ballY = ballRadius;
    ballDY = -ballDY;
  }

  // Отскок от ракетки
  if (
    ballY + ballRadius >= GAME4_HEIGHT - paddleHeight &&
    ballX > paddleX &&
    ballX < paddleX + paddleWidth
  ) {
    ballDY = -ballDY;
    // Обеспечим, чтобы мяч не "застревал" в ракетке
    ballY = GAME4_HEIGHT - paddleHeight - ballRadius;
  }

  // Если мяч улетел ниже канваса – игра окончена
  if (ballY - ballRadius > GAME4_HEIGHT) {
    showEndGameModal('Game Over', `Мяч улетел за пределы! Ваши очки: ${localUserData.points}`);
    resetGame4();
    return;
  }

  // Проверка столкновений с кирпичами
  for (let c = 0; c < brickColumnCount; c++) {
    for (let r = 0; r < brickRowCount; r++) {
      let b = bricks[c][r];
      if (!b.destroyed) {
        let brickX = (c * (brickWidth + brickPadding)) + brickOffsetLeft;
        let brickY = (r * (brickHeight + brickPadding)) + brickOffsetTop;

        // Сохраняем координаты кирпича
        b.x = brickX;
        b.y = brickY;

        // Проверка пересечения мяча с кирпичом
        if (
          ballX > brickX &&
          ballX < brickX + brickWidth &&
          ballY > brickY &&
          ballY < brickY + brickHeight
        ) {
          ballDY = -ballDY;
          b.destroyed = true;

          // Добавляем очки
          localUserData.points += 10;
          updateTopBar();

          // Если все кирпичи уничтожены – выигрываем
          if (checkAllBricksDestroyed()) {
            showEndGameModal('Победа!', `Вы разбили все кирпичи!\nВаш счёт: ${localUserData.points}`);
            resetGame4();
          }
          break;
        }
      }
    }
  }
}

function drawGame4() {
  if (!game4Ctx) return;
  game4Ctx.clearRect(0, 0, GAME4_WIDTH, GAME4_HEIGHT);

  // Рисуем мяч
  game4Ctx.beginPath();
  game4Ctx.arc(ballX, ballY, ballRadius, 0, Math.PI * 2);
  game4Ctx.fillStyle = '#00FF00';
  game4Ctx.fill();
  game4Ctx.closePath();

  // Рисуем ракетку (платформу)
  game4Ctx.fillStyle = '#0095DD';
  game4Ctx.fillRect(paddleX, GAME4_HEIGHT - paddleHeight, paddleWidth, paddleHeight);

  // Рисуем кирпичи
  for (let c = 0; c < brickColumnCount; c++) {
    for (let r = 0; r < brickRowCount; r++) {
      if (!bricks[c][r].destroyed) {
        let brickX = bricks[c][r].x;
        let brickY = bricks[c][r].y;
        game4Ctx.fillStyle = '#FF0000';
        game4Ctx.fillRect(brickX, brickY, brickWidth, brickHeight);
      }
    }
  }
}

function checkAllBricksDestroyed() {
  for (let c = 0; c < brickColumnCount; c++) {
    for (let r = 0; r < brickRowCount; r++) {
      if (!bricks[c][r].destroyed) {
        return false;
      }
    }
  }
  return true;
}

/* ===== Управление мышью ===== */
function handleGame4MouseMove(e) {
  const canvas = document.getElementById('game4Canvas');
  const rect = canvas.getBoundingClientRect();
  let mouseX = e.clientX - rect.left;
  
  // Центрируем ракетку относительно курсора
  paddleX = mouseX - paddleWidth / 2;
  
  // Ограничиваем движение в пределах канваса
  if (paddleX < 0) paddleX = 0;
  if (paddleX + paddleWidth > GAME4_WIDTH) paddleX = GAME4_WIDTH - paddleWidth;
}

/* ===== Управление тач-событиями ===== */
function handleGame4TouchStart(e) {
  isTouching = true;
  const touch = e.touches[0];
  const canvas = document.getElementById('game4Canvas');
  const rect = canvas.getBoundingClientRect();
  touchStartX = touch.clientX - rect.left;
}

function handleGame4TouchMove(e) {
  if (!isTouching) return;
  e.preventDefault(); // отключаем скролл страницы при движении пальцем
  const touch = e.touches[0];
  const canvas = document.getElementById('game4Canvas');
  const rect = canvas.getBoundingClientRect();
  let touchX = touch.clientX - rect.left;
  
  paddleX = touchX - paddleWidth / 2;
  if (paddleX < 0) paddleX = 0;
  if (paddleX + paddleWidth > GAME4_WIDTH) paddleX = GAME4_WIDTH - paddleWidth;
}

function handleGame4TouchEnd(e) {
  isTouching = false;
}
