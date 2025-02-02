/* game2.js - Улучшенный "3 в ряд" с фигурками и анимацией падения */

/* ----------------------------------------------------------------
   ПАРАМЕТРЫ И СТРУКТУРЫ ДАННЫХ
   ---------------------------------------------------------------- */
let match3Interval = null;      // requestAnimationFrame
let match3Ctx = null;           // Canvas 2D context
let matchGrid = [];             // Двумерный массив клеток

const gridSize = 8;             // Размер поля 8x8
const cellSize = 50;            // Размер клетки (пиксели)

const FALL_SPEED = 5;           // Скорость падения (px/frame)
const matchColors = ['red', 'green', 'blue', 'yellow', 'purple'];
// Вместо цветов — используем набор "фигур" (5 видов).
// Каждая клетка будет иметь: { shapeIndex, offsetY, falling, ... }

// Таймер 60 секунд:
let matchTimeLeft = 60;
let matchTimerId = null;

// Для анимации перетаскиваний (swap):
let selectedCell = null;        // { x, y } или null
let isSwapping = false;         // Флаг, чтобы не делать двойные действия

// Подсчёт очков в этой игре (можно усложнить)
// Здесь просто +10 очков за каждую удалённую фишку.
let matchScoreThisRound = 0;

/* ----------------------------------------------------------------
   РИСОВАНИЕ ФИГУР
   ---------------------------------------------------------------- */
// Рисуем разные фигурки (звезда, ромб, круг, шестиугольник, треугольник)
function drawShape(ctx, shapeIndex, centerX, centerY, size) {
  switch (shapeIndex) {
    case 0: drawStar(ctx, centerX, centerY, size, 5); break;
    case 1: drawDiamond(ctx, centerX, centerY, size); break;
    case 2: drawCircle(ctx, centerX, centerY, size); break;
    case 3: drawHex(ctx, centerX, centerY, size); break;
    case 4: drawTriangle(ctx, centerX, centerY, size); break;
    default: drawCircle(ctx, centerX, centerY, size); break;
  }
}

// Пример звезды
function drawStar(ctx, cx, cy, radius, spikes) {
  ctx.beginPath();
  const step = Math.PI / spikes;
  let rot = Math.PI / 2 * 3;
  let x = cx, y = cy;

  for (let i = 0; i < spikes; i++) {
    x = cx + Math.cos(rot) * radius;
    y = cy + Math.sin(rot) * radius;
    ctx.lineTo(x, y);
    rot += step;

    x = cx + Math.cos(rot) * (radius / 2);
    y = cy + Math.sin(rot) * (radius / 2);
    ctx.lineTo(x, y);
    rot += step;
  }
  ctx.lineTo(cx, cy - radius);
  ctx.closePath();
  ctx.fill();
}

// Ромб
function drawDiamond(ctx, cx, cy, size) {
  ctx.beginPath();
  ctx.moveTo(cx, cy - size);    // верх
  ctx.lineTo(cx + size, cy);    // правый
  ctx.lineTo(cx, cy + size);    // нижний
  ctx.lineTo(cx - size, cy);    // левый
  ctx.closePath();
  ctx.fill();
}

// Круг
function drawCircle(ctx, cx, cy, radius) {
  ctx.beginPath();
  ctx.arc(cx, cy, radius, 0, 2 * Math.PI);
  ctx.fill();
}

// Шестиугольник
function drawHex(ctx, cx, cy, radius) {
  ctx.beginPath();
  for (let i = 0; i < 6; i++) {
    const angle = (Math.PI / 3) * i;
    const x = cx + Math.cos(angle) * radius;
    const y = cy + Math.sin(angle) * radius;
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.closePath();
  ctx.fill();
}

// Треугольник
function drawTriangle(ctx, cx, cy, size) {
  ctx.beginPath();
  ctx.moveTo(cx, cy - size);
  ctx.lineTo(cx + size, cy + size);
  ctx.lineTo(cx - size, cy + size);
  ctx.closePath();
  ctx.fill();
}

/* ----------------------------------------------------------------
   ИНИЦИАЛИЗАЦИЯ (ВЫЗЫВАЕТСЯ С ИЗ INDEX.HTML)
   ---------------------------------------------------------------- */
function initGame2() {
  const canvas = document.getElementById('match3Canvas');
  match3Ctx = canvas.getContext('2d');

  // Очистим сетку
  matchGrid = [];
  for (let y = 0; y < gridSize; y++) {
    matchGrid[y] = [];
    for (let x = 0; x < gridSize; x++) {
      matchGrid[y][x] = spawnCell();
    }
  }

  // Удалим любые стартовые совпадения (чтобы игрок начинал без "авто-матча")
  removeAllMatches();

  // Таймер 60 сек
  matchTimeLeft = 60;
  matchScoreThisRound = 0;
  matchTimerId = setInterval(() => {
    matchTimeLeft--;
    if (matchTimeLeft <= 0) {
      endMatch3(); // Время вышло
    }
  }, 1000);

  // Подключаем обработчик кликов (для выбора и swap)
  canvas.addEventListener('mousedown', onCanvasClick);

  // Запускаем петлю
  match3Interval = requestAnimationFrame(match3Loop);
}

/* Генерация новой клетки */
function spawnCell() {
  const shapeIndex = Math.floor(Math.random() * 5); // 0..4
  return {
    shapeIndex,
    offsetY: -Math.random() * 200, // рандомный "старт" сверху (для анимации падения)
    falling: true
  };
}

/* ----------------------------------------------------------------
   ЗАВЕРШЕНИЕ ИГРЫ (ВЫЗЫВАЕТСЯ, КОГДА ТАЙМЕР ИСТЁК)
   ---------------------------------------------------------------- */
function endMatch3() {
  clearInterval(matchTimerId);
  matchTimerId = null;

  if (match3Interval) {
    cancelAnimationFrame(match3Interval);
    match3Interval = null;
  }

  // Добавим очки в localUserData
  // Простой пример: + matchScoreThisRound
  localUserData.points += matchScoreThisRound;
  updateTopBar(); 

  showEndGameModal(
    'Время вышло!',
    `Вы набрали ${matchScoreThisRound} очков за 1 минуту!\nОбщие очки: ${localUserData.points}`
  );

  // Сброс
  resetGame2();
}

function resetGame2() {
  if (match3Interval) {
    cancelAnimationFrame(match3Interval);
    match3Interval = null;
  }
  if (matchTimerId) {
    clearInterval(matchTimerId);
    matchTimerId = null;
  }
  const canvas = document.getElementById('match3Canvas');
  canvas.removeEventListener('mousedown', onCanvasClick);

  match3Ctx = null;
  matchGrid = [];
  selectedCell = null;
  isSwapping = false;
  matchTimeLeft = 0;
}

/* ----------------------------------------------------------------
   ОСНОВНОЙ ЦИКЛ (DRAW / UPDATE)
   ---------------------------------------------------------------- */
function match3Loop() {
  if (!match3Ctx) return;

  // 1) Обновление падения фишек
  updateFalling();

  // 2) Отрисовка
  drawGrid();

  // 3) Продолжаем
  match3Interval = requestAnimationFrame(match3Loop);
}

/* ----------------------------------------------------------------
   ОБРАБОТКА КЛИКОВ (SWAP)
   ---------------------------------------------------------------- */
function onCanvasClick(e) {
  if (isSwapping) return; // пока идёт анимация swap, игнорируем

  const canvas = e.target;
  const rect = canvas.getBoundingClientRect();
  const mouseX = e.clientX - rect.left;
  const mouseY = e.clientY - rect.top;

  const xIndex = Math.floor(mouseX / cellSize);
  const yIndex = Math.floor(mouseY / cellSize);

  // Проверка границ
  if (xIndex < 0 || xIndex >= gridSize || yIndex < 0 || yIndex >= gridSize) return;

  if (!selectedCell) {
    // Выбираем первую клетку
    selectedCell = { x: xIndex, y: yIndex };
  } else {
    // У нас уже была одна клетка выбрана
    // Проверим, соседняя ли это клетка
    const dx = Math.abs(xIndex - selectedCell.x);
    const dy = Math.abs(yIndex - selectedCell.y);

    if ((dx === 1 && dy === 0) || (dx === 0 && dy === 1)) {
      // Соседние, можно свапать
      swapCells(selectedCell.x, selectedCell.y, xIndex, yIndex);
    }
    // Снимаем выделение
    selectedCell = null;
  }
}

function swapCells(x1, y1, x2, y2) {
  // Помечаем флаг
  isSwapping = true;

  // Меняем shapeIndex
  const temp = matchGrid[y1][x1];
  matchGrid[y1][x1] = matchGrid[y2][x2];
  matchGrid[y2][x2] = temp;

  // Проверяем, есть ли матчи
  const matched = findAllMatches();
  if (matched.length > 0) {
    // Удаляем совпадения
    removeMatches(matched);

    // Завершаем swap (после удаления)
    setTimeout(() => {
      isSwapping = false;
    }, 300);
  } else {
    // Если нет матчей, надо вернуть всё назад
    setTimeout(() => {
      const temp2 = matchGrid[y1][x1];
      matchGrid[y1][x1] = matchGrid[y2][x2];
      matchGrid[y2][x2] = temp2;
      isSwapping = false;
    }, 300);
  }
}

/* ----------------------------------------------------------------
   ПОИСК И УДАЛЕНИЕ "3+ в ряд"
   ---------------------------------------------------------------- */
function findAllMatches() {
  const matched = [];
  // Горизонтали
  for (let y = 0; y < gridSize; y++) {
    for (let x = 0; x < gridSize - 2; x++) {
      const s1 = matchGrid[y][x].shapeIndex;
      const s2 = matchGrid[y][x+1].shapeIndex;
      const s3 = matchGrid[y][x+2].shapeIndex;
      if (s1 === s2 && s2 === s3 && s1 !== undefined) {
        matched.push({ x, y });
        matched.push({ x: x+1, y });
        matched.push({ x: x+2, y });
      }
    }
  }
  // Вертикали
  for (let x = 0; x < gridSize; x++) {
    for (let y = 0; y < gridSize - 2; y++) {
      const s1 = matchGrid[y][x].shapeIndex;
      const s2 = matchGrid[y+1][x].shapeIndex;
      const s3 = matchGrid[y+2][x].shapeIndex;
      if (s1 === s2 && s2 === s3 && s1 !== undefined) {
        matched.push({ x, y });
        matched.push({ x, y: y+1 });
        matched.push({ x, y: y+2 });
      }
    }
  }
  // Убираем дубли (если одна и та же клетка в нескольких матчах)
  const unique = [];
  const used = {};
  matched.forEach(cell => {
    const key = cell.x + '_' + cell.y;
    if (!used[key]) {
      used[key] = true;
      unique.push(cell);
    }
  });
  return unique;
}

function removeMatches(matchedCells) {
  // За каждую удалённую фигуру +10 очков
  matchScoreThisRound += matchedCells.length * 10;

  // Удаляем
  matchedCells.forEach(cell => {
    const { x, y } = cell;
    matchGrid[y][x].shapeIndex = -1; // "Пусто"
  });
  // После удаления запускаем "падение"
  applyGravity();
}

// Удаляем все матчи в цикле, пока они есть
function removeAllMatches() {
  let again = true;
  while (again) {
    const matchList = findAllMatches();
    if (matchList.length > 0) {
      removeMatches(matchList);
    } else {
      again = false;
    }
  }
}

/* ----------------------------------------------------------------
   ПРИМЕНИТЬ ГРАВИТАЦИЮ (фигуры "падают" вниз)
   ---------------------------------------------------------------- */
function applyGravity() {
  for (let x = 0; x < gridSize; x++) {
    // Идём снизу вверх и смотрим, есть ли "пустые" клетки
    for (let y = gridSize - 1; y >= 0; y--) {
      if (matchGrid[y][x].shapeIndex === -1) {
        // Нужно подняться выше и найти первую заполненную
        for (let ny = y - 1; ny >= 0; ny--) {
          if (matchGrid[ny][x].shapeIndex !== -1) {
            // swap
            matchGrid[y][x].shapeIndex = matchGrid[ny][x].shapeIndex;
            matchGrid[y][x].offsetY = matchGrid[y][x].offsetY; // оставим как есть
            matchGrid[y][x].falling = true;

            matchGrid[ny][x].shapeIndex = -1;
            break;
          }
        }
      }
    }
  }
  // Теперь заполним верх пустоты новыми
  for (let y = 0; y < gridSize; y++) {
    for (let x = 0; x < gridSize; x++) {
      if (matchGrid[y][x].shapeIndex === -1) {
        matchGrid[y][x] = spawnCell(); 
      }
    }
  }

  // Удалим матчи, если что-то ещё совпало
  setTimeout(() => {
    const matchList = findAllMatches();
    if (matchList.length > 0) {
      removeMatches(matchList);
    }
  }, 300);
}

/* ----------------------------------------------------------------
   ОБНОВЛЯЕМ АНИМАЦИЮ ПАДЕНИЯ
   ---------------------------------------------------------------- */
function updateFalling() {
  for (let y = 0; y < gridSize; y++) {
    for (let x = 0; x < gridSize; x++) {
      const cell = matchGrid[y][x];
      // Если у нас offsetY < 0, значит фишка "летит" вниз
      // В нашем примере реальная позиция клетки: (y * cellSize).
      const targetY = y * cellSize;
      if (cell.falling) {
        // Двигаем offsetY вниз
        cell.offsetY += FALL_SPEED;
        if (cell.offsetY >= targetY) {
          cell.offsetY = targetY;
          cell.falling = false;
        }
      }
    }
  }
}

/* ----------------------------------------------------------------
   ОТРИСОВКА
   ---------------------------------------------------------------- */
function drawGrid() {
  match3Ctx.clearRect(0, 0, gridSize * cellSize, gridSize * cellSize);

  for (let y = 0; y < gridSize; y++) {
    for (let x = 0; x < gridSize; x++) {
      const cell = matchGrid[y][x];
      const sx = x * cellSize + cellSize / 2;
      // Позиция с учётом offsetY
      const sy = (y * cellSize + cellSize / 2) - (cellSize * y) + cell.offsetY;

      // Если shapeIndex == -1, значит пусто (в процессе удаления) — не рисуем
      if (cell.shapeIndex >= 0) {
        match3Ctx.fillStyle = matchColors[cell.shapeIndex % matchColors.length];
        drawShape(match3Ctx, cell.shapeIndex, sx, sy, cellSize / 4);
      }
      // Рисуем рамку клетки
      match3Ctx.strokeStyle = '#333';
      match3Ctx.strokeRect(x * cellSize, y * cellSize, cellSize, cellSize);
    }
  }
}

