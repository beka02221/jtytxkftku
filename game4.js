/* =========================
   game4.js — Breakout (Арканоид)
   Управление:
     - Мышь: движение ракетки по X
     - Тач-события: движение пальцем по экрану (горизонтально)
   При уничтожении кирпичей добавляем очки (localUserData.points).
   При проигрыше или полном прохождении — вызываем showEndGameModal.
========================= */

let game4Interval = null;
let game4Ctx = null;

// Размер полотна (canvas) 400×800 из index.html
const GAME4_WIDTH = 400;
const GAME4_HEIGHT = 800;

// Параметры ракетки
let paddleWidth = 80;
let paddleHeight = 15;
let paddleX = (GAME4_WIDTH - paddleWidth) / 2;
let paddleSpeed = 7;

// Параметры мяча
let ballRadius = 8;
let ballX = GAME4_WIDTH / 2;
let ballY = GAME4_HEIGHT - 50; // над ракеткой
let ballDX = 3; // скорость по X
let ballDY = -3; // скорость по Y (летит вверх)

// Параметры кирпичей
let brickRowCount = 5;
let brickColumnCount = 7;
let brickWidth = 50;
let brickHeight = 20;
let brickPadding = 5;
let brickOffsetTop = 50;
let brickOffsetLeft = 15;

// Массив кирпичей
let bricks = [];

// Флаг для отслеживания касаний
let isTouching = false;
let touchStartX = 0;

function initGame4() {
  const canvas = document.getElementById('game4Canvas');
  game4Ctx = canvas.getContext('2d');

  // Инициализируем кирпичи
  bricks = [];
  for (let c = 0; c < brickColumnCount; c++) {
    bricks[c] = [];
    for (let r = 0; r < brickRowCount; r++) {
      bricks[c][r] = { x: 0, y: 0, destroyed: false };
    }
  }

  // Задаём стартовые позиции
  paddleX = (GAME4_WIDTH - paddleWidth) / 2;
  ballX = GAME4_WIDTH / 2;
  ballY = GAME4_HEIGHT - 50;
  ballDX = 3;
  ballDY = -3;

  // Навешиваем слушатели событий
  window.addEventListener('mousemove', handleGame4MouseMove);
  canvas.addEventListener('touchstart', handleGame4TouchStart, { passive: false });
  canvas.addEventListener('touchmove', handleGame4TouchMove, { passive: false });
  canvas.addEventListener('touchend', handleGame4TouchEnd, { passive: false });

  // Запуск анимационного цикла
  game4Interval = requestAnimationFrame(game4Loop);
}

function resetGame4() {
  // Очищаем анимацию
  if (game4Interval) {
    cancelAnimationFrame(game4Interval);
    game4Interval = null;
  }

  // Убираем слушатели, чтобы не дублировать при повторном запуске
  window.removeEventListener('mousemove', handleGame4MouseMove);
  const canvas = document.getElementById('game4Canvas');
  canvas.removeEventListener('touchstart', handleGame4TouchStart);
  canvas.removeEventListener('touchmove', handleGame4TouchMove);
  canvas.removeEventListener('touchend', handleGame4TouchEnd);

  // Сбрасываем контекст
  game4Ctx = null;
}

// Основной игровой цикл
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

  // Столкновение со стенками слева/справа
  if (ballX + ballRadius > GAME4_WIDTH) {
    ballX = GAME4_WIDTH - ballRadius;
    ballDX = -ballDX;
  } else if (ballX - ballRadius < 0) {
    ballX = ballRadius;
    ballDX = -ballDX;
  }

  // Столкновение с верхом
  if (ballY - ballRadius < 0) {
    ballY = ballRadius;
    ballDY = -ballDY;
  }

  // Столкновение с ракеткой
  if (
    ballY + ballRadius >= GAME4_HEIGHT - paddleHeight &&
    ballX > paddleX &&
    ballX < paddleX + paddleWidth
  ) {
    // Отскок
    ballDY = -ballDY;
    ballY = GAME4_HEIGHT - paddleHeight - ballRadius; 
  }

  // Если мяч улетел вниз — игра закончена
  if (ballY - ballRadius > GAME4_HEIGHT) {
    showEndGameModal('Game Over', `Мяч улетел за пределы! Ваши очки: ${localUserData.points}`);
    resetGame4();
    return;
  }

  // Проверяем столкновение с кирпичами
  for (let c = 0; c < brickColumnCount; c++) {
    for (let r = 0; r < brickRowCount; r++) {
      let b = bricks[c][r];
      if (!b.destroyed) {
        let brickX = (c * (brickWidth + brickPadding)) + brickOffsetLeft;
        let brickY = (r * (brickHeight + brickPadding)) + brickOffsetTop;

        // Координаты кирпича
        b.x = brickX;
        b.y = brickY;

        // Проверка пересечения мяча с кирпичом
        if (
          ballX > brickX &&
          ballX < brickX + brickWidth &&
          ballY > brickY &&
          ballY < brickY + brickHeight
        ) {
          // Отскок
          ballDY = -ballDY;
          b.destroyed = true;

          // Добавляем очки
          localUserData.points += 10;
          updateTopBar(); // обновляем в "шапке"

          // Проверяем, не уничтожены ли все кирпичи
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
  game4Ctx.arc(ballX, ballY, ballRadius, 0, Math.PI*2);
  game4Ctx.fillStyle = '#00FF00';
  game4Ctx.fill();
  game4Ctx.closePath();

  // Рисуем ракетку
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

/* =========================
   Управление мышью
========================= */
function handleGame4MouseMove(e) {
  // Положение курсора в пределах canvas
  // Получаем bounding rect
  const canvas = document.getElementById('game4Canvas');
  const rect = canvas.getBoundingClientRect();
  let mouseX = e.clientX - rect.left;
  
  // Центрируем ракетку по X (попробуем просто "прилипать")
  paddleX = mouseX - paddleWidth / 2;

  // Проверка на границы
  if (paddleX < 0) {
    paddleX = 0;
  } else if (paddleX + paddleWidth > GAME4_WIDTH) {
    paddleX = GAME4_WIDTH - paddleWidth;
  }
}

/* =========================
   Управление тач-событиями
========================= */
function handleGame4TouchStart(e) {
  isTouching = true;
  const touch = e.touches[0];
  const canvas = document.getElementById('game4Canvas');
  const rect = canvas.getBoundingClientRect();
  touchStartX = touch.clientX - rect.left;
}

function handleGame4TouchMove(e) {
  if (!isTouching) return;
  e.preventDefault(); // отключим скролл страницы при движении пальцем

  const touch = e.touches[0];
  const canvas = document.getElementById('game4Canvas');
  const rect = canvas.getBoundingClientRect();

  let touchX = touch.clientX - rect.left;
  // Двигаем ракетку так, чтобы "палец" совпадал с серединой ракетки
  // Или можно двигать пропорционально смещению
  paddleX = touchX - paddleWidth / 2;

  // Проверяем границы
  if (paddleX < 0) {
    paddleX = 0;
  } else if (paddleX + paddleWidth > GAME4_WIDTH) {
    paddleX = GAME4_WIDTH - paddleWidth;
  }
}

function handleGame4TouchEnd(e) {
  isTouching = false;
}
