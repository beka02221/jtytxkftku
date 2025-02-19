/***********************************************************
 * game2.js — Улучшенная версия "3 в ряд" 
 * с ползунком времени (1 минута) над игрой
 ***********************************************************/

// ----------------------------------------
// 1. Настройки и константы
// ----------------------------------------
const BOARD_SIZE = 8;      // 8x8 клеток
const ICON_TYPES = 5;      // Кол-во видов иконок
const CELL_SIZE  = 50;     // Размер клетки (50px) => canvas 400x400

// Время игры: 1 мин (в мс)
const GAME_DURATION_MS = 60_000;

// Звуки (укажите нужные URL)
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

// ----------------------------------------
// 2. Глобальные переменные игры
// ----------------------------------------
let match3Canvas, match3Ctx;          // canvas и контекст
let isGame2Running     = false;       // флаг, идёт ли игра
let match3Score        = 0;           // очки за текущую игру
let board              = [];          // двумерный массив [r][c] = тип иконки (0..ICON_TYPES-1) или -1 (пустая)
let selectedCell       = null;        // {row, col} для выделенной клетки
let mouseDownCell      = null;        // {row, col} где начался свайп

// Аудио
const swapSound      = new Audio(SWAP_SOUND_URL);
const explosionSound = new Audio(EXPLOSION_SOUND_URL);
const attemptSound   = new Audio(ATTEMPT_SOUND_URL);

// Изображения иконок
let iconImages = [];

// Таймер на 1 минуту
let gameStartTime  = null;   // время, когда началась игра
let elapsedTime    = 0;      // время с начала игры (мс)

// Прогресс-бар (DOM-элементы)
let timeBarContainer = null; 
let timeBar          = null; 

// ----------------------------------------
// 3. Анимационные переменные
// ----------------------------------------
let animating            = false; // если идёт анимация (swap, fade, gravity)
let currentSwapAnimation = null;  // {r1, c1, r2, c2, startTime, duration, reversing}
let fadeAnimations       = [];    // [{r, c, startTime, duration}, ...]
let gravityAnimations    = [];    // [{r, c, startY, endY, startTime, duration, currentOffset}, ...]

// Начальное «Матрица»-падение
let pieceInitialOffsets = []; // [BOARD_SIZE][BOARD_SIZE], отрицательные Y-отступы
let initialFall         = null; // {startTime, duration}


// ----------------------------------------
// 4. Запуск игры (initGame2) и сброс (resetGame2)
// ----------------------------------------
function initGame2() {
  if (isGame2Running) return; // защита от повторного запуска
  isGame2Running = true;
  match3Score    = 0;

  match3Canvas = document.getElementById('match3Canvas');
  match3Ctx    = match3Canvas.getContext('2d');

  // Загружаем изображения (1 раз за сессию)
  if (iconImages.length === 0) {
    ICON_URLS.forEach(url => {
      const img = new Image();
      img.src = url;
      iconImages.push(img);
    });
  }

  // Создаём поле без стартовых совпадений
  generateBoard();

  // Инициализируем "Матрица"-эффект (случайные отрицательные offset)
  pieceInitialOffsets = [];
  for (let r = 0; r < BOARD_SIZE; r++) {
    pieceInitialOffsets[r] = [];
    for (let c = 0; c < BOARD_SIZE; c++) {
      // от -100 до -500
      pieceInitialOffsets[r][c] = -(Math.random() * 400 + 100);
    }
  }
  initialFall = {
    startTime: performance.now(),
    duration: 1000
  };

  // Подключаем обработчики мыши и касаний
  match3Canvas.addEventListener('mousedown', onMouseDown);
  match3Canvas.addEventListener('touchstart', onTouchStart, { passive: false });

  // Создаём прогресс-бар над канвасом (если ещё нет)
  createTimeBarAboveCanvas();

  // Запоминаем время старта
  gameStartTime = performance.now();
  elapsedTime   = 0;

  // Первая отрисовка
  drawBoard();

  // Запуск постоянного кадра (анимации + обновление бара)
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

  // Сбрасываем анимационные переменные
  animating = false;
  currentSwapAnimation = null;
  fadeAnimations       = [];
  gravityAnimations    = [];
  pieceInitialOffsets  = [];
  initialFall          = null;

  // Сбрасываем основные переменные игры
  board         = [];
  match3Score   = 0;
  selectedCell  = null;
  mouseDownCell = null;

  // Прогресс-бар можно скрыть
  if (timeBarContainer) {
    timeBarContainer.style.display = 'none';
  }
}


// ----------------------------------------
// 5. Создание и обновление ползунка времени
// ----------------------------------------
function createTimeBarAboveCanvas() {
  // Если уже создан — просто делаем видимым
  if (timeBarContainer) {
    timeBarContainer.style.display = 'block';
    return;
  }

  // Создаём контейнер
  timeBarContainer = document.createElement('div');
  timeBarContainer.style.width       = match3Canvas.width + 'px'; // 400px
  timeBarContainer.style.height      = '8px';
  timeBarContainer.style.background  = '#555';
  timeBarContainer.style.margin      = '0 auto';
  timeBarContainer.style.position    = 'relative';
  timeBarContainer.style.top         = '0';
  timeBarContainer.style.marginBottom = '10px';

  // Создаём сам ползунок (внутренний div)
  timeBar = document.createElement('div');
  timeBar.style.width      = '0px';
  timeBar.style.height     = '100%';
  timeBar.style.background = '#ff69b4';
  
  timeBarContainer.appendChild(timeBar);

  // Вставляем контейнер перед canvas (выше игры)
  match3Canvas.parentNode.insertBefore(timeBarContainer, match3Canvas);
}

/** Обновляет ширину timeBar в зависимости от elapsedTime. */
function updateTimeBar() {
  const ratio = Math.min(elapsedTime / GAME_DURATION_MS, 1);
  const barWidth = (match3Canvas.width * ratio); // от 0 до 400px
  timeBar.style.width = barWidth + 'px';
}


// ----------------------------------------
// 6. Генерация поля без начальных матчей
// ----------------------------------------
function generateBoard() {
  board = [];
  for (let r = 0; r < BOARD_SIZE; r++) {
    board[r] = [];
    for (let c = 0; c < BOARD_SIZE; c++) {
      let icon = randomIcon();
      // Исключаем стартовые совпадения
      while (c >= 2 && board[r][c-1] === icon && board[r][c-2] === icon) {
        icon = randomIcon();
      }
      while (r >= 2 && board[r-1][c] === icon && board[r-2][c] === icon) {
        icon = randomIcon();
      }
      board[r][c] = icon;
    }
  }
}

function randomIcon() {
  return Math.floor(Math.random() * ICON_TYPES);
}


// ----------------------------------------
// 7. Основной анимационный цикл (animationLoop)
// ----------------------------------------
function animationLoop(currentTime) {
  if (!isGame2Running) return; // Если игра остановлена, прерываем

  // 1) Обновляем elapsedTime (сколько прошло с момента старта)
  elapsedTime = currentTime - gameStartTime;
  // Обновляем ползунок
  updateTimeBar();

  // 2) Проверяем, не вышло ли время (60s)
  if (elapsedTime >= GAME_DURATION_MS) {
    endMatch3Game();
    return;
  }

  // 3) Выполняем логику анимаций (swap, fade, gravity и начальное падение)
  runAnimations(currentTime);

  // 4) Перерисовываем поле
  drawBoard();

  // 5) Заказываем следующий кадр
  requestAnimationFrame(animationLoop);
}


// ----------------------------------------
// 8. Логика анимаций в одном месте
// ----------------------------------------
function runAnimations(currentTime) {
  let stillAnimating = false;

  // A) Начальное падение (Матрица)
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
      initialFall = null;
      // обнуляем offset
      for (let r = 0; r < BOARD_SIZE; r++) {
        for (let c = 0; c < BOARD_SIZE; c++) {
          pieceInitialOffsets[r][c] = 0;
        }
      }
    }
  }

  // B) Анимация обмена (swap)
  if (currentSwapAnimation) {
    const anim = currentSwapAnimation;
    const progress = Math.min((currentTime - anim.startTime) / anim.duration, 1);

    if (progress < 1) {
      stillAnimating = true;
    } else {
      // закончили swap
      if (!anim.reversing) {
        // окончательный обмен
        swapIcons(anim.r1, anim.c1, anim.r2, anim.c2);
        // проверяем, есть ли совпадения
        if (processMatches()) {
          currentSwapAnimation = null;
        } else {
          // если совпадений нет — откатываем
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
        // закончили обратный обмен
        swapIcons(anim.r1, anim.c1, anim.r2, anim.c2);
        currentSwapAnimation = null;
      }
    }
  }

  // C) Анимации исчезновения (fade-out)
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

  // D) Анимации падения (gravity)
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

  // Если все анимации закончились, но могли появиться новые совпадения (каскад)
  if (!stillAnimating && !currentSwapAnimation && fadeAnimations.length === 0 && gravityAnimations.length === 0) {
    // проверяем новые совпадения
    if (processMatches()) {
      // будут новые fadeAnimations / gravityAnimations
    }
  }

  // Признак, что есть анимации, не мешает дальнейшим кадрам — мы всё равно перерисовываем
  animating = stillAnimating;
}


// ----------------------------------------
// 9. Отрисовка игрового поля (drawBoard)
// ----------------------------------------
function drawBoard() {
  match3Ctx.clearRect(0, 0, match3Canvas.width, match3Canvas.height);

  // Фон
  match3Ctx.fillStyle = '#000000';
  match3Ctx.fillRect(0, 0, match3Canvas.width, match3Canvas.height);

  // Сетка (необязательно, но красиво)
  match3Ctx.strokeStyle = '#2525256f';
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
      if (type < 0) continue; // пусто

      // Подсветка выбранной клетки
      if (selectedCell && selectedCell.row === r && selectedCell.col === c) {
        match3Ctx.fillStyle = 'rgba(255,0,0,0.3)';
        match3Ctx.fillRect(c * CELL_SIZE, r * CELL_SIZE, CELL_SIZE, CELL_SIZE);
      }

      // Сдвиг по Y (начальный offset + gravity)
      let offsetY = 0;
      if (pieceInitialOffsets[r] && typeof pieceInitialOffsets[r][c] === 'number') {
        offsetY += pieceInitialOffsets[r][c];
      }
      const gravAnim = gravityAnimations.find(g => g.r === r && g.c === c);
      if (gravAnim) {
        offsetY += gravAnim.currentOffset || 0;
      }

      // Если участвует в swap
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
            // клетка 1
            drawX = anim.c1 * CELL_SIZE + dc * CELL_SIZE * sign;
            drawY = anim.r1 * CELL_SIZE + dr * CELL_SIZE * sign + offsetY;
          } else {
            // клетка 2
            drawX = anim.c2 * CELL_SIZE - dc * CELL_SIZE * sign;
            drawY = anim.r2 * CELL_SIZE - dr * CELL_SIZE * sign + offsetY;
          }
        }
      }

      // Прозрачность (fade-out)
      let alpha = 1;
      const fade = fadeAnimations.find(f => f.r === r && f.c === c);
      if (fade) {
        const p = (performance.now() - fade.startTime) / fade.duration;
        alpha = Math.max(1 - p, 0);
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


// ----------------------------------------
// 10. Управление (мышь, сенсор) + свайпы
// ----------------------------------------
function onMouseDown(evt) {
  if (!isGame2Running || animating) return;
  const rect = match3Canvas.getBoundingClientRect();
  const x    = evt.clientX - rect.left;
  const y    = evt.clientY - rect.top;
  const col  = Math.floor(x / CELL_SIZE);
  const row  = Math.floor(y / CELL_SIZE);

  mouseDownCell = { row, col };
  selectedCell  = { row, col };

  document.addEventListener('mousemove', onMouseMove);
  document.addEventListener('mouseup',   onMouseUp);

  drawBoard();
}

function onMouseMove(evt) {
  if (!mouseDownCell) return;
  const rect = match3Canvas.getBoundingClientRect();
  const x    = evt.clientX - rect.left;
  const y    = evt.clientY - rect.top;

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
    if (targetRow >= 0 && targetRow < BOARD_SIZE &&
        targetCol >= 0 && targetCol < BOARD_SIZE) {
      if (isNeighbor(mouseDownCell.row, mouseDownCell.col, targetRow, targetCol)) {
        trySwap(mouseDownCell.row, mouseDownCell.col, targetRow, targetCol);
      }
    }

    mouseDownCell = null;
    selectedCell  = null;
    drawBoard();

    document.removeEventListener('mousemove', onMouseMove);
    document.removeEventListener('mouseup',   onMouseUp);
  }
}

function onMouseUp() {
  mouseDownCell = null;
  selectedCell  = null;
  document.removeEventListener('mousemove', onMouseMove);
  document.removeEventListener('mouseup',   onMouseUp);
  drawBoard();
}

// Сенсор
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
  document.addEventListener('touchend',  onTouchEnd);
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
    if (targetRow >= 0 && targetRow < BOARD_SIZE &&
        targetCol >= 0 && targetCol < BOARD_SIZE) {
      if (isNeighbor(mouseDownCell.row, mouseDownCell.col, targetRow, targetCol)) {
        trySwap(mouseDownCell.row, mouseDownCell.col, targetRow, targetCol);
      }
    }

    mouseDownCell = null;
    selectedCell  = null;
    drawBoard();

    document.removeEventListener('touchmove', onTouchMove);
    document.removeEventListener('touchend',  onTouchEnd);
  }
}

function onTouchEnd() {
  mouseDownCell = null;
  selectedCell  = null;
  document.removeEventListener('touchmove', onTouchMove);
  document.removeEventListener('touchend',  onTouchEnd);
  drawBoard();
}

// Проверка соседей (вертикально/горизонтально)
function isNeighbor(r1, c1, r2, c2) {
  return (
    (Math.abs(r1 - r2) === 1 && c1 === c2) ||
    (Math.abs(c1 - c2) === 1 && r1 === r2)
  );
}

function trySwap(r1, c1, r2, c2) {
  if (animating) return;
  swapSound.play();

  currentSwapAnimation = {
    r1, c1,
    r2, c2,
    startTime: performance.now(),
    duration: 200,
    reversing: false
  };
  animating = true;
}


// ----------------------------------------
// 11. Поиск и обработка совпадений
// ----------------------------------------
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

function processMatches() {
  const groups = findMatches();
  if (groups.length === 0) return false;

  // Начисляем очки: например, groupSize * 5 за каждую группу
  groups.forEach(g => {
    match3Score += g.cells.length * 5;
  });
  updateScoreDisplay();

  // Собираем все клетки, которые исчезнут
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

  explosionSound.play();

  // По окончании fade (200 мс) — гравитация
  setTimeout(() => {
    animateGravity();
  }, 210);

  return true;
}


// ----------------------------------------
// 12. Гравитация (фигуры падают, сверху появляются новые)
// ----------------------------------------
function animateGravity() {
  // Для каждой колонки сдвигаем вниз
  for (let c = 0; c < BOARD_SIZE; c++) {
    for (let r = BOARD_SIZE - 1; r >= 0; r--) {
      if (board[r][c] === -1) {
        // Ищем выше непустую
        for (let rr = r - 1; rr >= 0; rr--) {
          if (board[rr][c] !== -1) {
            gravityAnimations.push({
              r, c,
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

  // Заполняем оставшиеся пустоты
  for (let c = 0; c < BOARD_SIZE; c++) {
    for (let r = 0; r < BOARD_SIZE; r++) {
      if (board[r][c] === -1) {
        board[r][c] = randomIcon();
        gravityAnimations.push({
          r, c,
          startY: -CELL_SIZE * (Math.random() * 2 + 1),
          endY: 0,
          startTime: performance.now(),
          duration: 300
        });
      }
    }
  }

  animating = true;
}


// ----------------------------------------
// 13. Завершение игры
// ----------------------------------------
function endMatch3Game() {
  if (!isGame2Running) return;
  isGame2Running = false;

  // Добавляем заработанные очки к общим и выводим
  localUserData.points += match3Score;
  updateScoreDisplay();

  showEndGameModal('Время вышло!', `Вы заработали ${match3Score} очков!`);

  // Скрываем ползунок
  if (timeBarContainer) {
    timeBarContainer.style.display = 'none';
  }
}


// ----------------------------------------
// 14. Обновление счёта (в шапке) 
// ----------------------------------------
function updateScoreDisplay() {
  // match3Score + localUserData.points
  // Но если у вас нужно только итоговое значение, можно просто:
  document.getElementById('pointCount').textContent = 
    (localUserData.points).toString();
}
