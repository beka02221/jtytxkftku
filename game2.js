/***********************************************************
 * game2.js — Улучшенная версия "3 в ряд" с анимациями, 
 * подсчётом очков и ползунком времени (1 минута)
 ***********************************************************/

// ========== Константы и настройки ==========
const BOARD_SIZE = 8;    // 8x8 клеток
const ICON_TYPES = 5;    // количество видов иконок
const CELL_SIZE = 50;    // размер клетки (для canvas 400x400)

// Время игры (1 минута)
const GAME_DURATION_MS = 60_000; // 60 сек * 1000

// Звуковые эффекты (URL-ы замените на свои)
const SWAP_SOUND_URL      = 'https://example.com/swap.mp3';
const EXPLOSION_SOUND_URL = 'https://example.com/explosion.mp3';
const ATTEMPT_SOUND_URL   = 'https://example.com/attempt.mp3';

// Ссылки на неоновые иконки
const ICON_URLS = [
  'https://img.icons8.com/neon/100/password.png',
  'https://img.icons8.com/neon/100/fingerprint.png',
  'https://img.icons8.com/neon/100/password1.png',
  'https://img.icons8.com/neon/100/warning-shield.png',
  'https://img.icons8.com/neon/100/face-id.png'
];

// ========== Глобальные переменные ==========
let iconImages      = [];             // Массив изображений иконок
const swapSound      = new Audio(SWAP_SOUND_URL);
const explosionSound = new Audio(EXPLOSION_SOUND_URL);
const attemptSound   = new Audio(ATTEMPT_SOUND_URL);

// Canvas и контекст
let match3Canvas, match3Ctx;

// Состояние игры
let isGame2Running = false;
let match3Score    = 0;       // заработанные очки в игре
let board          = [];       // board[r][c]: тип иконки (0..ICON_TYPES-1) или -1 (пустая)
let selectedCell   = null;     // {row, col}
let mouseDownCell  = null;     // для слежения за началом свайпа

// Ползунок времени (1 минута)
let gameStartTime  = null;     // время запуска игры (performance.now())
let elapsedTime    = 0;        // прошедшее время (мс)

// ========== Анимационные переменные ==========
// Флаг анимации — пока идёт анимация, ход нельзя совершать
let animating = false;

// Объект анимации обмена
// { r1, c1, r2, c2, startTime, duration, reversing }
let currentSwapAnimation = null;

// Анимации исчезновения (fade-out)
let fadeAnimations = []; // [{ r, c, startTime, duration } ... ]

// Анимации падения (gravity)
let gravityAnimations = []; // [{ r, c, startY, endY, startTime, duration, currentOffset } ... ]

// Для начальной анимации появления — двумерный массив отступов
let pieceInitialOffsets = []; // [BOARD_SIZE][BOARD_SIZE]
// { startTime, duration }
let initialFall = null;


// ========== Основные функции: запуск, сброс, и т.д. ==========

function initGame2() {
  if (isGame2Running) return;
  isGame2Running = true;
  match3Score = 0;

  match3Canvas = document.getElementById('match3Canvas');
  match3Ctx    = match3Canvas.getContext('2d');

  // Загружаем изображения (только один раз за сессию)
  if (iconImages.length === 0) {
    ICON_URLS.forEach(url => {
      const img = new Image();
      img.src = url;
      iconImages.push(img);
    });
  }

  // Генерируем поле без стартовых совпадений
  generateBoard();

  // Инициализируем массивы для анимации «Матрица»
  pieceInitialOffsets = [];
  for (let r = 0; r < BOARD_SIZE; r++) {
    pieceInitialOffsets[r] = [];
    for (let c = 0; c < BOARD_SIZE; c++) {
      // случайный отрицательный offset (от -100 до -500)
      pieceInitialOffsets[r][c] = -(Math.random() * 400 + 100);
    }
  }
  initialFall = { startTime: performance.now(), duration: 1000 };

  // Подключаем события мыши/касаний
  match3Canvas.addEventListener('mousedown', onMouseDown);
  match3Canvas.addEventListener('touchstart', onTouchStart, { passive: false });

  // Запоминаем время старта (для ползунка 1 мин)
  gameStartTime = performance.now();
  elapsedTime   = 0;

  // Первая отрисовка
  drawBoard();

  // Запуск анимационного цикла
  animating = true;
  requestAnimationFrame(animationLoop);
}


function resetGame2() {
  isGame2Running = false;

  // Очищаем canvas
  if (match3Ctx) {
    match3Ctx.clearRect(0, 0, match3Canvas.width, match3Canvas.height);
  }

  // Удаляем слушатели
  if (match3Canvas) {
    match3Canvas.removeEventListener('mousedown', onMouseDown);
    match3Canvas.removeEventListener('touchstart', onTouchStart);
  }

  // Сбрасываем все переменные
  board          = [];
  selectedCell   = null;
  mouseDownCell  = null;
  animating      = false;
  currentSwapAnimation = null;
  fadeAnimations = [];
  gravityAnimations = [];
  pieceInitialOffsets = [];
  initialFall    = null;
  match3Score    = 0;
}


// ========== Генерация игрового поля без начальных матчей ==========
function generateBoard() {
  board = [];
  for (let r = 0; r < BOARD_SIZE; r++) {
    board[r] = [];
    for (let c = 0; c < BOARD_SIZE; c++) {
      let icon = randomIcon();
      // Исключаем стартовые "3 в ряд"
      while (c >= 2 && board[r][c - 1] === icon && board[r][c - 2] === icon) {
        icon = randomIcon();
      }
      while (r >= 2 && board[r - 1][c] === icon && board[r - 2][c] === icon) {
        icon = randomIcon();
      }
      board[r][c] = icon;
    }
  }
}

function randomIcon() {
  return Math.floor(Math.random() * ICON_TYPES);
}


// ========== Анимационный цикл ==========
function animationLoop(currentTime) {
  let stillAnimating = false;

  // 1) Проверяем время, обновляем elapsedTime
  elapsedTime = currentTime - gameStartTime;
  if (elapsedTime >= GAME_DURATION_MS) {
    // Время вышло — завершаем
    endMatch3Game();
    return;
  }

  // 2) Начальное падение (Матрица)
  if (initialFall) {
    const progress = Math.min((currentTime - initialFall.startTime) / initialFall.duration, 1);
    for (let r = 0; r < BOARD_SIZE; r++) {
      for (let c = 0; c < BOARD_SIZE; c++) {
        pieceInitialOffsets[r][c] = (1 - progress) * pieceInitialOffsets[r][c];
      }
    }
    if (progress < 1) {
      stillAnimating = true;
    } else {
      // завершаем анимацию
      initialFall = null;
      for (let r = 0; r < BOARD_SIZE; r++) {
        for (let c = 0; c < BOARD_SIZE; c++) {
          pieceInitialOffsets[r][c] = 0;
        }
      }
    }
  }

  // 3) Анимация обмена (swap)
  if (currentSwapAnimation) {
    const anim = currentSwapAnimation;
    const progress = Math.min((currentTime - anim.startTime) / anim.duration, 1);

    if (progress < 1) {
      stillAnimating = true;
    } else {
      // Анимация дошла до конца
      if (!anim.reversing) {
        // Окончательный обмен
        swapIcons(anim.r1, anim.c1, anim.r2, anim.c2);
        // Проверяем совпадения
        if (processMatches()) {
          currentSwapAnimation = null;
        } else {
          // Если нет совпадений — откатываем обмен
          attemptSound.play();
          currentSwapAnimation = {
            r1: anim.r1, c1: anim.c1,
            r2: anim.r2, c2: anim.c2,
            startTime: currentTime,
            duration: anim.duration,
            reversing: true
          };
          stillAnimating = true;
        }
      } else {
        // Закончили обратный обмен
        swapIcons(anim.r1, anim.c1, anim.r2, anim.c2);
        currentSwapAnimation = null;
      }
    }
  }

  // 4) Анимации исчезновения (fade-out)
  for (let i = fadeAnimations.length - 1; i >= 0; i--) {
    const fade = fadeAnimations[i];
    const progress = (currentTime - fade.startTime) / fade.duration;
    if (progress >= 1) {
      // Убираем фигурку
      board[fade.r][fade.c] = -1;
      fadeAnimations.splice(i, 1);
    } else {
      stillAnimating = true;
    }
  }

  // 5) Анимации падения (gravity)
  for (let i = gravityAnimations.length - 1; i >= 0; i--) {
    const grav = gravityAnimations[i];
    const progress = Math.min((currentTime - grav.startTime) / grav.duration, 1);
    grav.currentOffset = (1 - progress) * (grav.startY - grav.endY);
    if (progress < 1) {
      stillAnimating = true;
    } else {
      gravityAnimations.splice(i, 1);
    }
  }

  // Перерисовываем поле
  drawBoard();

  // Если есть незавершённые анимации, продолжаем
  if (stillAnimating) {
    requestAnimationFrame(animationLoop);
  } else {
    animating = false;
    // Каскад: если всё анимировано, проверяем есть ли новые совпадения
    if (!currentSwapAnimation && fadeAnimations.length === 0 && gravityAnimations.length === 0) {
      if (processMatches()) {
        animating = true;
        requestAnimationFrame(animationLoop);
      }
    }
  }
}


// ========== Отрисовка доски + ползунок времени ==========
function drawBoard() {
  match3Ctx.clearRect(0, 0, match3Canvas.width, match3Canvas.height);

  // Фон
  match3Ctx.fillStyle = '#000000';
  match3Ctx.fillRect(0, 0, match3Canvas.width, match3Canvas.height);

  // Рисуем "ползунок" времени сверху (от 0 до GAME_DURATION_MS)
  const barHeight = 6;
  const barMargin = 4;
  const totalWidth = match3Canvas.width - barMargin * 2;
  const ratio = Math.min(elapsedTime / GAME_DURATION_MS, 1);
  // Полный фон (серый)
  match3Ctx.fillStyle = '#666';
  match3Ctx.fillRect(barMargin, barMargin, totalWidth, barHeight);
  // Заполненная часть (розовая)
  match3Ctx.fillStyle = '#ff69b4';
  match3Ctx.fillRect(barMargin, barMargin, totalWidth * ratio, barHeight);

  // Сетка
  match3Ctx.strokeStyle = '#00FF00';
  for (let r = 0; r <= BOARD_SIZE; r++) {
    match3Ctx.beginPath();
    match3Ctx.moveTo(0, r * CELL_SIZE);
    match3Ctx.lineTo(BOARD_SIZE * CELL_SIZE, r * CELL_SIZE);
    match3Ctx.stroke();
  }
  for (let c = 0; c <= BOARD_SIZE; c++) {
    match3Ctx.beginPath();
    match3Ctx.moveTo(c * CELL_SIZE, 0);
    match3Ctx.lineTo(c * CELL_SIZE, BOARD_SIZE * CELL_SIZE);
    match3Ctx.stroke();
  }

  // Рисуем фигурки
  for (let r = 0; r < BOARD_SIZE; r++) {
    for (let c = 0; c < BOARD_SIZE; c++) {
      const type = board[r][c];
      if (type < 0) continue; // клетка пуста

      // Выделение выбранной клетки
      if (selectedCell && selectedCell.row === r && selectedCell.col === c) {
        match3Ctx.fillStyle = 'rgba(255, 0, 0, 0.3)';
        match3Ctx.fillRect(c * CELL_SIZE, r * CELL_SIZE, CELL_SIZE, CELL_SIZE);
      }

      // Дополнительный сдвиг по Y (анимации)
      let offsetY = 0;

      // Начальный «Матрица»-эффект
      if (pieceInitialOffsets[r] && typeof pieceInitialOffsets[r][c] === 'number') {
        offsetY += pieceInitialOffsets[r][c];
      }

      // Гравитация
      const grav = gravityAnimations.find(g => g.r === r && g.c === c);
      if (grav) {
        offsetY += grav.currentOffset || 0;
      }

      // Обмен (swap)
      let drawX = c * CELL_SIZE;
      let drawY = r * CELL_SIZE + offsetY;
      if (currentSwapAnimation) {
        const anim = currentSwapAnimation;
        const progress = Math.min((performance.now() - anim.startTime) / anim.duration, 1);
        if ((anim.r1 === r && anim.c1 === c) || (anim.r2 === r && anim.c2 === c)) {
          let dr = anim.r2 - anim.r1;
          let dc = anim.c2 - anim.c1;
          const sign = anim.reversing ? (1 - progress) : progress;

          if (anim.r1 === r && anim.c1 === c) {
            drawX = anim.c1 * CELL_SIZE + dc * CELL_SIZE * sign;
            drawY = anim.r1 * CELL_SIZE + dr * CELL_SIZE * sign + offsetY;
          } else {
            drawX = anim.c2 * CELL_SIZE - dc * CELL_SIZE * sign;
            drawY = anim.r2 * CELL_SIZE - dr * CELL_SIZE * sign + offsetY;
          }
        }
      }

      // Прозрачность (fade-out)
      let alpha = 1;
      const fade = fadeAnimations.find(f => f.r === r && f.c === c);
      if (fade) {
        const fprogress = (performance.now() - fade.startTime) / fade.duration;
        alpha = Math.max(1 - fprogress, 0);
      }

      match3Ctx.globalAlpha = alpha;
      const img = iconImages[type];
      if (img) {
        match3Ctx.drawImage(img, drawX, drawY, CELL_SIZE, CELL_SIZE);
      }
      match3Ctx.globalAlpha = 1;
    }
  }
}


// ========== Управление (мышь/сенсор) + свайп ==========
function onMouseDown(evt) {
  if (!isGame2Running || animating) return;
  const rect = match3Canvas.getBoundingClientRect();
  const x = evt.clientX - rect.left;
  const y = evt.clientY - rect.top;
  const col = Math.floor(x / CELL_SIZE);
  const row = Math.floor(y / CELL_SIZE);

  mouseDownCell = { row, col };
  selectedCell  = { row, col };

  document.addEventListener('mousemove', onMouseMove);
  document.addEventListener('mouseup', onMouseUp);

  drawBoard();
}

function onMouseMove(evt) {
  if (!mouseDownCell) return;
  const rect = match3Canvas.getBoundingClientRect();
  const x = evt.clientX - rect.left;
  const y = evt.clientY - rect.top;

  const dx = x - (mouseDownCell.col * CELL_SIZE + CELL_SIZE / 2);
  const dy = y - (mouseDownCell.row * CELL_SIZE + CELL_SIZE / 2);

  if (Math.abs(dx) > CELL_SIZE / 2 || Math.abs(dy) > CELL_SIZE / 2) {
    let targetRow = mouseDownCell.row;
    let targetCol = mouseDownCell.col;

    if (Math.abs(dx) > Math.abs(dy)) {
      targetCol += (dx > 0 ? 1 : -1);
    } else {
      targetRow += (dy > 0 ? 1 : -1);
    }

    // Проверяем, не вышли ли за границы
    if (targetRow >= 0 && targetRow < BOARD_SIZE && targetCol >= 0 && targetCol < BOARD_SIZE) {
      if (isNeighbor(mouseDownCell.row, mouseDownCell.col, targetRow, targetCol)) {
        trySwap(mouseDownCell.row, mouseDownCell.col, targetRow, targetCol);
      }
    }

    mouseDownCell = null;
    selectedCell  = null;
    drawBoard();

    document.removeEventListener('mousemove', onMouseMove);
    document.removeEventListener('mouseup', onMouseUp);
  }
}

function onMouseUp() {
  mouseDownCell = null;
  selectedCell  = null;
  document.removeEventListener('mousemove', onMouseMove);
  document.removeEventListener('mouseup', onMouseUp);
  drawBoard();
}


// Сенсорное управление
function onTouchStart(evt) {
  if (!isGame2Running || animating) return;
  evt.preventDefault();

  const rect  = match3Canvas.getBoundingClientRect();
  const touch = evt.touches[0];
  const x     = touch.clientX - rect.left;
  const y     = touch.clientY - rect.top;
  const col   = Math.floor(x / CELL_SIZE);
  const row   = Math.floor(y / CELL_SIZE);

  mouseDownCell = { row, col };
  selectedCell  = { row, col };

  drawBoard();

  document.addEventListener('touchmove', onTouchMove, { passive: false });
  document.addEventListener('touchend', onTouchEnd);
}

function onTouchMove(evt) {
  if (!mouseDownCell) return;
  evt.preventDefault();

  const rect  = match3Canvas.getBoundingClientRect();
  const touch = evt.touches[0];
  const x     = touch.clientX - rect.left;
  const y     = touch.clientY - rect.top;

  const dx = x - (mouseDownCell.col * CELL_SIZE + CELL_SIZE / 2);
  const dy = y - (mouseDownCell.row * CELL_SIZE + CELL_SIZE / 2);

  if (Math.abs(dx) > CELL_SIZE / 2 || Math.abs(dy) > CELL_SIZE / 2) {
    let targetRow = mouseDownCell.row;
    let targetCol = mouseDownCell.col;

    if (Math.abs(dx) > Math.abs(dy)) {
      targetCol += (dx > 0 ? 1 : -1);
    } else {
      targetRow += (dy > 0 ? 1 : -1);
    }

    // Проверяем границы
    if (targetRow >= 0 && targetRow < BOARD_SIZE && targetCol >= 0 && targetCol < BOARD_SIZE) {
      if (isNeighbor(mouseDownCell.row, mouseDownCell.col, targetRow, targetCol)) {
        trySwap(mouseDownCell.row, mouseDownCell.col, targetRow, targetCol);
      }
    }

    mouseDownCell = null;
    selectedCell  = null;
    drawBoard();

    document.removeEventListener('touchmove', onTouchMove);
    document.removeEventListener('touchend', onTouchEnd);
  }
}

function onTouchEnd() {
  mouseDownCell = null;
  selectedCell  = null;
  document.removeEventListener('touchmove', onTouchMove);
  document.removeEventListener('touchend', onTouchEnd);
  drawBoard();
}


// Проверка соседства
function isNeighbor(r1, c1, r2, c2) {
  return (Math.abs(r1 - r2) === 1 && c1 === c2) ||
         (Math.abs(c1 - c2) === 1 && r1 === r2);
}


// Попытка обмена (с анимацией)
function trySwap(r1, c1, r2, c2) {
  if (animating) return;
  // Звук
  swapSound.play();

  currentSwapAnimation = {
    r1, c1,
    r2, c2,
    startTime: performance.now(),
    duration: 200,
    reversing: false
  };
  animating = true;
  requestAnimationFrame(animationLoop);
}

function swapIcons(r1, c1, r2, c2) {
  let temp = board[r1][c1];
  board[r1][c1] = board[r2][c2];
  board[r2][c2] = temp;
}


// ========== Обработка совпадений ==========

// Поиск всех "3+ в ряд" (горизонтали и вертикали)
function findMatches() {
  let groups = [];

  // Горизонтали
  for (let r = 0; r < BOARD_SIZE; r++) {
    let c = 0;
    while (c < BOARD_SIZE) {
      let t = board[r][c];
      if (t < 0) {
        c++;
        continue;
      }
      let start = c;
      while (c < BOARD_SIZE && board[r][c] === t) {
        c++;
      }
      let length = c - start;
      if (length >= 3) {
        groups.push({
          cells: Array.from({ length }, (_, i) => ({ r, c: start + i })),
          orientation: 'horizontal'
        });
      }
    }
  }

  // Вертикали
  for (let c = 0; c < BOARD_SIZE; c++) {
    let r = 0;
    while (r < BOARD_SIZE) {
      let t = board[r][c];
      if (t < 0) {
        r++;
        continue;
      }
      let start = r;
      while (r < BOARD_SIZE && board[r][c] === t) {
        r++;
      }
      let length = r - start;
      if (length >= 3) {
        groups.push({
          cells: Array.from({ length }, (_, i) => ({ r: start + i, c })),
          orientation: 'vertical'
        });
      }
    }
  }

  return groups;
}

// Обработка найденных групп: начислить очки, анимировать исчезновение, потом падение
function processMatches() {
  const groups = findMatches();
  if (groups.length === 0) return false;

  // Начисляем очки: за каждую группу по (groupLength * 5) — или любая своя логика
  groups.forEach(g => {
    match3Score += g.cells.length * 5;
  });

  // Обновляем счёт в шапке
  updateScoreDisplay();

  // Собираем все ячейки для fade
  const uniqueCells = {};
  groups.forEach(g => {
    g.cells.forEach(cell => {
      uniqueCells[`${cell.r},${cell.c}`] = cell;
    });
  });

  const cellsToFade = Object.values(uniqueCells);
  cellsToFade.forEach(cell => {
    fadeAnimations.push({
      r: cell.r,
      c: cell.c,
      startTime: performance.now(),
      duration: 200
    });
  });

  // Звук
  explosionSound.play();

  // После исчезновения (спустя ~200 мс) запускаем падение
  setTimeout(() => {
    animateGravity();
  }, 210);

  animating = true;
  requestAnimationFrame(animationLoop);
  return true;
}


// ========== Анимация «падения» ==========
function animateGravity() {
  // Для каждой колонки двигаем фигурки вниз, заполняя -1
  for (let c = 0; c < BOARD_SIZE; c++) {
    // идём снизу вверх
    for (let r = BOARD_SIZE - 1; r >= 0; r--) {
      if (board[r][c] === -1) {
        // ищем ближайшую непустую сверху
        for (let rr = r - 1; rr >= 0; rr--) {
          if (board[rr][c] !== -1) {
            // Анимируем падение из (rr,c) в (r,c)
            gravityAnimations.push({
              r: r, c: c,
              startY: (rr - r) * CELL_SIZE,
              endY: 0,
              startTime: performance.now(),
              duration: 200
            });
            board[r][c] = board[rr][c];
            board[rr][c] = -1;
            break;
          }
        }
      }
    }
  }

  // Заполняем пустые сверху новыми фигурками
  for (let c = 0; c < BOARD_SIZE; c++) {
    for (let r = 0; r < BOARD_SIZE; r++) {
      if (board[r][c] === -1) {
        board[r][c] = randomIcon();
        gravityAnimations.push({
          r: r, c: c,
          startY: -CELL_SIZE * (Math.random() * 2 + 1),
          endY: 0,
          startTime: performance.now(),
          duration: 300
        });
      }
    }
  }

  animating = true;
  requestAnimationFrame(animationLoop);
}


// ========== Завершение игры ==========
function endMatch3Game() {
  // Останавливаем анимации
  animating = false;
  // При окончании игры добавляем заработанные очки к localUserData.points
  localUserData.points += match3Score;
  updateScoreDisplay();

  showEndGameModal('Время вышло!', `Вы заработали ${match3Score} очков!`);
}


// ========== Обновление счёта в шапке (общий баланс) ==========
function updateScoreDisplay() {
  // match3Score — очки за текущую игру; прибавляем к общему
  document.getElementById('pointCount').textContent = 
    (localUserData.points).toString();
}
