/***********************************************************
 * game2.js — «3 в ряд» (match-3) в неоново-хакерском стиле
 *
 * 1. Общая механика (ПК/мобильные устройства):
 *    --------------------------------------------------------
 *    - ПК: Управление мышью. Игрок кликает на элемент (иконку),
 *      затем перетаскивает курсор к соседней ячейке (вверх/вниз/
 *      влево/вправо) и отпускает, совершая обмен.
 *
 *    - Мобильные устройства: Сенсорное управление (свайпы).
 *      Игрок тапает по элементу, удерживает палец и перемещает
 *      его к соседней ячейке. Если та находится рядом, выполняется
 *      SWAP. При этом ячейка при выборе подсвечивается красным
 *      (эффект «неоновой» заливки).
 *
 * 2. Основная цель:
 *    --------------------------------------------------------
 *    - Составлять ряды из трёх и более одинаковых элементов
 *      (горизонтально или вертикально). Они взрываются и дают
 *      очки (10 очков за каждую удалённую иконку).
 *    - После взрыва элементы сверху плавно падают вниз,
 *      а сверху появляются новые иконки. Возможны каскадные
 *      совпадения (цепные реакции).
 *
 * 3. Механика SWAP:
 *    --------------------------------------------------------
 *    - Если после обмена нет совпадений, происходит «короткая»
 *      анимация возврата (элементы возвращаются на исходные
 *      позиции).
 *    - Если обмен приводит к совпадению, взрывы + падение,
 *      начисление очков.
 *
 * 4. Анимации:
 *    --------------------------------------------------------
 *    - Плавное появление (падение) элементов при старте и
 *      при заполнении после взрыва.
 *    - «Взрыв» (увеличение + мерцание) при удалении.
 *    - Плавное перемещение при SWAP и анимация возврата,
 *      если SWAP неудачный.
 *
 ***********************************************************/

const BOARD_ROWS = 8;
const BOARD_COLS = 8;
const CELL_SIZE  = 50;  // При canvas 400x400 получается 8*50 = 400
const ICON_TYPES = 5;

// Ссылки на неоновые иконки
const ICON_URLS = [
  'https://img.icons8.com/neon/100/password.png',
  'https://img.icons8.com/neon/100/fingerprint.png',
  'https://img.icons8.com/neon/100/password1.png',
  'https://img.icons8.com/neon/100/warning-shield.png',
  'https://img.icons8.com/neon/100/face-id.png'
];

// Длительности и скорости анимаций
const EXPLOSION_DURATION = 300;  // мс
const FALL_SPEED         = 300;  // px/сек (анимация падения)
const SWAP_DURATION      = 200;  // мс (анимация SWAP)
const GAME_TIME          = 60;   // секунд на игру

let match3Canvas, match3Ctx;
let iconImages = [];

// Глобальные флаги
let isGame2Running = false;
let match3TimerId  = null;

// Таймер в шапке
let timeSpan  = null;  
let timeLeft  = GAME_TIME;
let match3Score = 0;

// Структура одной ячейки board[r][c]:
// {
//   type: <0..ICON_TYPES-1> или -1 (пустая),
//   x, y: текущие пиксельные координаты (для анимации),
//   explosionTime: когда начался взрыв (null, если нет),
// }

// Основной массив
let board = [];

// Текущая выбранная ячейка для клика/тапа
let match3Selected = null; // {row, col}

// Информация об анимации SWAP (при перетаскивании)
// Если swapAnimation != null, значит идёт процесс обмена двух ячеек.
let swapAnimation = null;
// Структура swapAnimation:
// {
//   r1, c1, r2, c2,
//   startTime, duration, // в мс
//   revert: bool,
//   completed: bool,
//   fromCellStartX, fromCellStartY,
//   toCellStartX, toCellStartY
// }

/***********************************************************
 * initGame2() — запуск игры
 ***********************************************************/
function initGame2() {
  if (isGame2Running) return;
  isGame2Running = true;

  match3Score = 0;
  timeLeft    = GAME_TIME;

  match3Canvas = document.getElementById('match3Canvas');
  match3Ctx    = match3Canvas.getContext('2d');

  // Загрузка иконок (только один раз)
  if (iconImages.length === 0) {
    ICON_URLS.forEach(url => {
      const img = new Image();
      img.src = url;
      iconImages.push(img);
    });
  }

  // Добавляем метку времени в шапку
  timeSpan = document.createElement('span');
  timeSpan.style.color       = '#00FF00';
  timeSpan.style.marginLeft  = '10px';
  timeSpan.textContent       = `Время: ${timeLeft}s`;
  const balancesDiv = document.querySelector('.balances');
  if (balancesDiv) {
    balancesDiv.appendChild(timeSpan);
  }

  // Генерация поля
  generateBoard();

  // Удаляем стартовые совпадения (чтобы не было уже готовых линий)
  removeAllMatchesCascade();

  // События мыши / касаний
  match3Canvas.addEventListener('mousedown', onMouseDown);
  match3Canvas.addEventListener('touchstart', onTouchStart, {passive: false});

  // Таймер на секунды
  match3TimerId = setInterval(() => {
    timeLeft--;
    if (timeLeft < 0) {
      endMatch3Game();
    } else {
      if (timeSpan) {
        timeSpan.textContent = `Время: ${timeLeft}s`;
      }
    }
  }, 1000);

  // Запуск анимации
  lastTimestamp = performance.now();
  requestAnimationFrame(animationLoop);
}

/***********************************************************
 * resetGame2() — сброс игры (при выходе)
 ***********************************************************/
function resetGame2() {
  if (match3TimerId) {
    clearInterval(match3TimerId);
    match3TimerId = null;
  }
  isGame2Running = false;

  // Удаляем timeSpan
  if (timeSpan && timeSpan.parentNode) {
    timeSpan.parentNode.removeChild(timeSpan);
  }
  timeSpan = null;

  // Снимаем события
  if (match3Canvas) {
    match3Canvas.removeEventListener('mousedown', onMouseDown);
    match3Canvas.removeEventListener('touchstart', onTouchStart);
  }

  // Очищаем canvas и массив
  if (match3Ctx) {
    match3Ctx.clearRect(0, 0, match3Canvas.width, match3Canvas.height);
  }
  board = [];
  match3Selected = null;
  swapAnimation   = null;
}

// ------------------------------------------------------------
// Доп. переменные для анимационного цикла
let lastTimestamp = 0;

// Главный цикл анимации
function animationLoop(timestamp) {
  if (!isGame2Running) return; // если игра остановлена

  const dt = (timestamp - lastTimestamp) / 1000; // в секундах
  lastTimestamp = timestamp;

  update(dt);
  draw();

  requestAnimationFrame(animationLoop);
}

/***********************************************************
 * generateBoard() — генерируем поле с начальными позициями
 ***********************************************************/
function generateBoard() {
  board = [];
  for (let r = 0; r < BOARD_ROWS; r++) {
    board[r] = [];
    for (let c = 0; c < BOARD_COLS; c++) {
      const t = Math.floor(Math.random() * ICON_TYPES);
      board[r][c] = {
        type: t,
        x: c * CELL_SIZE,
        y: -Math.random() * 300, // «хаотично» падают сверху при старте
        explosionTime: null
      };
    }
  }
}

/***********************************************************
 * update(dt) — логика игры
 ***********************************************************/
function update(dt) {
  // Анимации SWAP (если swapAnimation != null)
  if (swapAnimation) {
    handleSwapAnimation();
  }

  // 1) «Взрывы»
  for (let r = 0; r < BOARD_ROWS; r++) {
    for (let c = 0; c < BOARD_COLS; c++) {
      const cell = board[r][c];
      if (cell.explosionTime !== null) {
        const elapsed = performance.now() - cell.explosionTime;
        if (elapsed > EXPLOSION_DURATION) {
          // Убираем элемент
          cell.type = -1;
          cell.explosionTime = null;
        }
      }
    }
  }

  // 2) Плавное «падение» (gravity)
  for (let c = 0; c < BOARD_COLS; c++) {
    for (let r = BOARD_ROWS - 1; r >= 0; r--) {
      const cell = board[r][c];
      if (cell.type < 0) continue; // пусто
      // Находим, куда может упасть
      let nr = r;
      while (nr+1 < BOARD_ROWS && board[nr+1][c].type === -1) {
        nr++;
      }
      if (nr !== r) {
        // «Перемещаем» вниз в массиве
        const below = board[nr][c];
        below.type = cell.type;
        below.x = cell.x;
        below.y = cell.y;
        below.explosionTime = cell.explosionTime;

        cell.type = -1;
        cell.explosionTime = null;
      }
    }
  }

  // Обновляем координаты (плавное «долетание»)
  for (let r = 0; r < BOARD_ROWS; r++) {
    for (let c = 0; c < BOARD_COLS; c++) {
      const cell = board[r][c];
      const targetY = r * CELL_SIZE;
      if (cell.y < targetY) {
        cell.y += FALL_SPEED * dt;
        if (cell.y > targetY) cell.y = targetY;
      }
    }
  }

  // 3) Заполнение новых (если пустые type=-1)
  for (let r = 0; r < BOARD_ROWS; r++) {
    for (let c = 0; c < BOARD_COLS; c++) {
      if (board[r][c].type < 0) {
        board[r][c].type = Math.floor(Math.random() * ICON_TYPES);
        board[r][c].y    = -CELL_SIZE * 2; // появятся сверху
        board[r][c].explosionTime = null;
      }
    }
  }

  // 4) Если все устаканились (не падают) — ищем совпадения
  if (isAllSettled() && !swapAnimation) {
    const matched = findMatches();
    if (matched.size > 0) {
      // Запускаем взрыв для совпавших
      matched.forEach(idx => {
        const [rr, cc] = idx.split('-').map(Number);
        board[rr][cc].explosionTime = performance.now();
      });
      // Начисляем очки
      match3Score += matched.size * 10;
    }
  }
}

/***********************************************************
 * handleSwapAnimation() — обработка анимации SWAP
 ***********************************************************/
function handleSwapAnimation() {
  if (!swapAnimation) return;

  const now = performance.now();
  const elapsed = now - swapAnimation.startTime;
  let progress  = elapsed / swapAnimation.duration;
  if (progress > 1) progress = 1;

  const r1 = swapAnimation.r1, c1 = swapAnimation.c1;
  const r2 = swapAnimation.r2, c2 = swapAnimation.c2;

  // Интерполяция позиции
  const cell1 = board[r1][c1];
  const cell2 = board[r2][c2];

  // Начальные координаты
  const startX1 = swapAnimation.fromCellStartX;
  const startY1 = swapAnimation.fromCellStartY;
  const startX2 = swapAnimation.toCellStartX;
  const startY2 = swapAnimation.toCellStartY;

  // Целевые координаты
  const endX1 = c2 * CELL_SIZE;
  const endY1 = r2 * CELL_SIZE;
  const endX2 = c1 * CELL_SIZE;
  const endY2 = r1 * CELL_SIZE;

  // Если revert — цели меняются «вернуться» на место
  if (swapAnimation.revert) {
    // меняем местами назначения, чтобы вернуть
    // cell1 «идёт назад» в (r1,c1), cell2 идёт назад в (r2,c2)
  } else {
    // «финальный» swap
  }

  // Если revert = false, cell1 анимируем к endX1/Y1, cell2 к endX2/Y2
  // Если revert = true, наоборот: cell1 -> startX1/Y1, cell2 -> startX2/Y2
  if (swapAnimation.revert) {
    // При "revert" целевые координаты для cell1 — его исходные (startX1/startY1),
    // а для cell2 — startX2/startY2
    cell1.x = lerp(startX1, startX1, progress); 
    cell1.y = lerp(startY1, startY1, progress);
    cell2.x = lerp(startX2, startX2, progress);
    cell2.y = lerp(startY2, startY2, progress);
  } else {
    // Нормальный swap
    cell1.x = lerp(startX1, endX1, progress);
    cell1.y = lerp(startY1, endY1, progress);
    cell2.x = lerp(startX2, endX2, progress);
    cell2.y = lerp(startY2, endY2, progress);
  }

  // Когда анимация закончена
  if (progress >= 1) {
    if (!swapAnimation.revert) {
      // SWAP в массиве (type)
      const tempType = cell1.type;
      cell1.type = cell2.type;
      cell2.type = tempType;
    }
    swapAnimation = null; 
  }
}

/***********************************************************
 * draw() — отрисовка
 ***********************************************************/
function draw() {
  match3Ctx.clearRect(0, 0, match3Canvas.width, match3Canvas.height);

  // Фон
  match3Ctx.fillStyle = '#000000';
  match3Ctx.fillRect(0, 0, match3Canvas.width, match3Canvas.height);

  // Ярко-зелёная сетка
  match3Ctx.strokeStyle = '#00FF00';
  for (let r = 0; r <= BOARD_ROWS; r++) {
    match3Ctx.beginPath();
    match3Ctx.moveTo(0, r*CELL_SIZE);
    match3Ctx.lineTo(BOARD_COLS*CELL_SIZE, r*CELL_SIZE);
    match3Ctx.stroke();
  }
  for (let c = 0; c <= BOARD_COLS; c++) {
    match3Ctx.beginPath();
    match3Ctx.moveTo(c*CELL_SIZE, 0);
    match3Ctx.lineTo(c*CELL_SIZE, BOARD_ROWS*CELL_SIZE);
    match3Ctx.stroke();
  }

  // Рисуем ячейки
  for (let r = 0; r < BOARD_ROWS; r++) {
    for (let c = 0; c < BOARD_COLS; c++) {
      const cell = board[r][c];
      if (cell.type < 0) continue; // пусто

      // Если выбрана (подсветка красным)
      if (match3Selected && match3Selected.row === r && match3Selected.col === c) {
        match3Ctx.fillStyle = 'rgba(255,0,0,0.3)';
        match3Ctx.fillRect(c*CELL_SIZE, r*CELL_SIZE, CELL_SIZE, CELL_SIZE);
      }

      const img = iconImages[cell.type];
      if (!img) continue;

      // «Взрыв» (увеличение + вспышка)
      let scale = 1.0;
      if (cell.explosionTime !== null) {
        const elapsed = performance.now() - cell.explosionTime;
        let fraction = elapsed / EXPLOSION_DURATION; 
        if (fraction > 1) fraction = 1;
        scale = 1 + 0.5 * fraction; 
        // Можно добавить мерцание прозрачности:
        // match3Ctx.globalAlpha = 1 - fraction;
      }
      const drawSize = CELL_SIZE * scale;
      const dx = cell.x + (CELL_SIZE - drawSize)/2;
      const dy = cell.y + (CELL_SIZE - drawSize)/2;

      match3Ctx.drawImage(img, dx, dy, drawSize, drawSize);
      // match3Ctx.globalAlpha = 1.0;
    }
  }
}

/***********************************************************
 * Функции для мгновенного удаления совпадений при старте
 ***********************************************************/
function removeAllMatchesCascade() {
  let again = true;
  while (again) {
    const matched = findMatches();
    if (matched.size === 0) {
      again = false;
    } else {
      matched.forEach(idx => {
        const [r, c] = idx.split('-').map(Number);
        board[r][c].type = -1;
      });
      applyGravityInstant();
      fillEmptyInstant();
    }
  }
}

function applyGravityInstant() {
  for (let c = 0; c < BOARD_COLS; c++) {
    for (let r = BOARD_ROWS - 1; r >= 0; r--) {
      if (board[r][c].type < 0) {
        for (let nr = r - 1; nr >= 0; nr--) {
          if (board[nr][c].type >= 0) {
            board[r][c].type = board[nr][c].type;
            board[nr][c].type = -1;
            break;
          }
        }
      }
    }
  }
}

function fillEmptyInstant() {
  for (let r = 0; r < BOARD_ROWS; r++) {
    for (let c = 0; c < BOARD_COLS; c++) {
      if (board[r][c].type < 0) {
        board[r][c].type = Math.floor(Math.random() * ICON_TYPES);
      }
    }
  }
}

/***********************************************************
 * Поиск совпадений (3+ в ряд)
 ***********************************************************/
function findMatches() {
  const matched = new Set();

  // Горизонтальные
  for (let r = 0; r < BOARD_ROWS; r++) {
    for (let c = 0; c < BOARD_COLS - 2; c++) {
      const t = board[r][c].type;
      if (t < 0) continue;
      if (t === board[r][c+1].type && t === board[r][c+2].type) {
        matched.add(`${r}-${c}`);
        matched.add(`${r}-${c+1}`);
        matched.add(`${r}-${c+2}`);
      }
    }
  }

  // Вертикальные
  for (let c = 0; c < BOARD_COLS; c++) {
    for (let r = 0; r < BOARD_ROWS - 2; r++) {
      const t = board[r][c].type;
      if (t < 0) continue;
      if (t === board[r+1][c].type && t === board[r+2][c].type) {
        matched.add(`${r}-${c}`);
        matched.add(`${r+1}-${c}`);
        matched.add(`${r+2}-${c}`);
      }
    }
  }
  return matched;
}

/***********************************************************
 * Проверка, что все упали и остановились
 ***********************************************************/
function isAllSettled() {
  for (let r = 0; r < BOARD_ROWS; r++) {
    for (let c = 0; c < BOARD_COLS; c++) {
      const cell = board[r][c];
      if (cell.y !== r * CELL_SIZE) return false;
    }
  }
  return true;
}

/***********************************************************
 * Обработка кликов/тач
 * (упрощённая реализация "drag" + swap)
 ***********************************************************/
let mouseDownInfo = null; // {startX, startY, row, col}

function onMouseDown(evt) {
  if (!isGame2Running) return;
  const rect = match3Canvas.getBoundingClientRect();
  const x = evt.clientX - rect.left;
  const y = evt.clientY - rect.top;
  mouseDownInfo = {
    startX: x,
    startY: y,
    row: Math.floor(y / CELL_SIZE),
    col: Math.floor(x / CELL_SIZE)
  };
  // Выбираем ячейку
  match3Selected = {row: mouseDownInfo.row, col: mouseDownInfo.col};

  // Подключим mousemove/up
  document.addEventListener('mousemove', onMouseMove);
  document.addEventListener('mouseup', onMouseUp);
}

function onMouseMove(evt) {
  if (!mouseDownInfo || swapAnimation) return;
  const rect = match3Canvas.getBoundingClientRect();
  const x = evt.clientX - rect.left;
  const y = evt.clientY - rect.top;

  // Проверяем, если переместились достаточно далеко к соседней ячейке
  const dx = x - mouseDownInfo.startX;
  const dy = y - mouseDownInfo.startY;
  const absDx = Math.abs(dx);
  const absDy = Math.abs(dy);

  if (absDx > CELL_SIZE * 0.4 || absDy > CELL_SIZE * 0.4) {
    // Определяем направление (вверх/вниз/влево/вправо)
    let targetRow = mouseDownInfo.row;
    let targetCol = mouseDownInfo.col;
    if (absDx > absDy) {
      if (dx > 0) targetCol++; else targetCol--;
    } else {
      if (dy > 0) targetRow++; else targetRow--;
    }
    // Проверяем, что рядом
    const rowDiff = Math.abs(targetRow - mouseDownInfo.row);
    const colDiff = Math.abs(targetCol - mouseDownInfo.col);
    if ((rowDiff === 1 && colDiff === 0) || (rowDiff === 0 && colDiff === 1)) {
      // Выполняем попытку SWAP
      doSwap(mouseDownInfo.row, mouseDownInfo.col, targetRow, targetCol);
    }
    // Сбрасываем
    mouseDownInfo = null;
    match3Selected = null;
    document.removeEventListener('mousemove', onMouseMove);
    document.removeEventListener('mouseup', onMouseUp);
  }
}

function onMouseUp() {
  // Отпустили мышь, но не «дотащили» до соседней ячейки
  mouseDownInfo = null;
  document.removeEventListener('mousemove', onMouseMove);
  document.removeEventListener('mouseup', onMouseUp);
  // Снимаем выделение
  match3Selected = null;
}

function onTouchStart(evt) {
  if (!isGame2Running) return;
  evt.preventDefault();

  const rect = match3Canvas.getBoundingClientRect();
  const touch = evt.touches[0];
  const x = touch.clientX - rect.left;
  const y = touch.clientY - rect.top;

  // Аналог mouseDown + упрощённый свайп
  mouseDownInfo = {
    startX: x,
    startY: y,
    row: Math.floor(y / CELL_SIZE),
    col: Math.floor(x / CELL_SIZE)
  };
  match3Selected = {row: mouseDownInfo.row, col: mouseDownInfo.col};

  // Добавляем обработчики для движения
  document.addEventListener('touchmove', onTouchMove, {passive: false});
  document.addEventListener('touchend', onTouchEnd);
}

function onTouchMove(evt) {
  if (!mouseDownInfo || swapAnimation) return;
  evt.preventDefault();

  const rect = match3Canvas.getBoundingClientRect();
  const touch = evt.touches[0];
  const x = touch.clientX - rect.left;
  const y = touch.clientY - rect.top;

  const dx = x - mouseDownInfo.startX;
  const dy = y - mouseDownInfo.startY;
  const absDx = Math.abs(dx);
  const absDy = Math.abs(dy);

  if (absDx > CELL_SIZE*0.4 || absDy > CELL_SIZE*0.4) {
    let targetRow = mouseDownInfo.row;
    let targetCol = mouseDownInfo.col;
    if (absDx > absDy) {
      if (dx > 0) targetCol++; else targetCol--;
    } else {
      if (dy > 0) targetRow++; else targetRow--;
    }
    // Проверяем соседство
    const rowDiff = Math.abs(targetRow - mouseDownInfo.row);
    const colDiff = Math.abs(targetCol - mouseDownInfo.col);
    if ((rowDiff === 1 && colDiff === 0) || (rowDiff === 0 && colDiff === 1)) {
      doSwap(mouseDownInfo.row, mouseDownInfo.col, targetRow, targetCol);
    }

    mouseDownInfo = null;
    match3Selected = null;
    document.removeEventListener('touchmove', onTouchMove);
    document.removeEventListener('touchend', onTouchEnd);
  }
}

function onTouchEnd() {
  mouseDownInfo = null;
  document.removeEventListener('touchmove', onTouchMove);
  document.removeEventListener('touchend', onTouchEnd);
  match3Selected = null;
}

/***********************************************************
 * doSwap(r1,c1, r2,c2) — пытаемся совершить ход
 * Если нет совпадения — анимируем «возврат».
 ***********************************************************/
function doSwap(r1, c1, r2, c2) {
  if (swapAnimation) return; // уже идёт анимация

  // Пробуем временно swap-нуть в board, проверяем совпадения
  const type1 = board[r1][c1].type;
  const type2 = board[r2][c2].type;
  board[r1][c1].type = type2;
  board[r2][c2].type = type1;

  const matched = findMatches();

  let revert = false;
  if (matched.size === 0) {
    // Нет совпадений — нужно откатить, но красиво
    revert = true;
  }

  // Сразу возвращаем (если revert=true, визуально анимируем «туда-обратно»,
  // если revert=false, оставляем как есть, анимируя в новую позицию).
  board[r1][c1].type = type1;
  board[r2][c2].type = type2;

  // Запускаем SWAP-анимацию
  startSwapAnimation(r1, c1, r2, c2, revert);
}

/***********************************************************
 * startSwapAnimation(...)
 * Заполняет swapAnimation данными, чтобы update() анимировал
 ***********************************************************/
function startSwapAnimation(r1,c1, r2,c2, revert) {
  const cell1 = board[r1][c1];
  const cell2 = board[r2][c2];

  swapAnimation = {
    r1, c1, r2, c2,
    startTime: performance.now(),
    duration: SWAP_DURATION,
    revert,
    fromCellStartX: cell1.x,
    fromCellStartY: cell1.y,
    toCellStartX:   cell2.x,
    toCellStartY:   cell2.y
  };
}

/***********************************************************
 * endMatch3Game() — конец игры
 ***********************************************************/
function endMatch3Game() {
  if (match3TimerId) {
    clearInterval(match3TimerId);
    match3TimerId = null;
  }
  // Добавляем match3Score в локальные очки
  localUserData.points += match3Score;

  // Показываем итоговое окно
  showEndGameModal('Время вышло!', `Вы заработали ${match3Score} очков!`);
}

/***********************************************************
 * Вспомогательные функции
 ***********************************************************/
function lerp(a, b, t) {
  return a + (b - a) * t;
}
