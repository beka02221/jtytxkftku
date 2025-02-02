
/***********************************************************
 * game2.js — Упрощённая, но корректная механика "3 в ряд"
 * на canvas, вдохновлённая логикой вашего jQuery-примера.
 ***********************************************************/

// Параметры поля
const BOARD_SIZE = 8;
const ICON_TYPES = 5;  // количество видов иконок

// Размеры (для canvas 400x400 будет 8x8, клетка = 50px)
const CELL_SIZE = 50;

// Время игры (секунды)
const GAME_TIME = 60;

// Ссылки на неоновые иконки
const ICON_URLS = [
  'https://img.icons8.com/neon/100/password.png',
  'https://img.icons8.com/neon/100/fingerprint.png',
  'https://img.icons8.com/neon/100/password1.png',
  'https://img.icons8.com/neon/100/warning-shield.png',
  'https://img.icons8.com/neon/100/face-id.png'
];

// Массив для загрузки изображений
let iconImages = [];

// Основные переменные
let match3Canvas, match3Ctx;
let isGame2Running = false;
let match3TimerId  = null;
let timeSpan       = null;   // SPAN для отображения оставшегося времени
let timeLeft       = GAME_TIME;
let match3Score    = 0;

// 2D-массив board[row][col]:
//    board[r][c] = от 0 до ICON_TYPES-1 (тип иконки), либо -1 (пусто)
let board = [];

// Запоминаем выбранную ячейку при нажатии/тапе
let selectedCell = null; // {row, col}

///////////////////////////////////////////////////////////////////////////////
// 1. Инициализация и сброс
///////////////////////////////////////////////////////////////////////////////
function initGame2() {
  if (isGame2Running) return;
  isGame2Running = true;

  match3Score = 0;
  timeLeft    = GAME_TIME;

  match3Canvas = document.getElementById('match3Canvas');
  match3Ctx    = match3Canvas.getContext('2d');

  // Загружаем изображения (один раз)
  if (iconImages.length === 0) {
    ICON_URLS.forEach(url => {
      const img = new Image();
      img.src = url;
      iconImages.push(img);
    });
  }

  // Создаём SPAN для таймера
  timeSpan = document.createElement('span');
  timeSpan.style.color = '#00FF00';
  timeSpan.style.marginLeft = '10px';
  timeSpan.textContent = `Время: ${timeLeft}s`;

  const balancesDiv = document.querySelector('.balances');
  if (balancesDiv) {
    balancesDiv.appendChild(timeSpan);
  }

  // Генерируем поле (без стартовых совпадений)
  generateBoard();

  // Рисуем начальное поле
  drawBoard();

  // Подключаем события
  match3Canvas.addEventListener('mousedown', onMouseDown);
  match3Canvas.addEventListener('touchstart', onTouchStart, { passive: false });

  // Запуск таймера на секунды
  match3TimerId = setInterval(() => {
    timeLeft--;
    if (timeLeft < 0) {
      endMatch3Game();
    } else {
      timeSpan.textContent = `Время: ${timeLeft}s`;
    }
  }, 1000);
}

function resetGame2() {
  if (match3TimerId) {
    clearInterval(match3TimerId);
    match3TimerId = null;
  }
  isGame2Running = false;

  // Убираем таймер из шапки
  if (timeSpan && timeSpan.parentNode) {
    timeSpan.parentNode.removeChild(timeSpan);
  }
  timeSpan = null;

  // Снимаем события
  if (match3Canvas) {
    match3Canvas.removeEventListener('mousedown', onMouseDown);
    match3Canvas.removeEventListener('touchstart', onTouchStart);
  }

  // Очищаем canvas
  if (match3Ctx) {
    match3Ctx.clearRect(0, 0, match3Canvas.width, match3Canvas.height);
  }

  // Сбрасываем массив
  board = [];
  selectedCell = null;
}

///////////////////////////////////////////////////////////////////////////////
// 2. Генерация поля и исключение стартовых «3 в ряд»
///////////////////////////////////////////////////////////////////////////////
function generateBoard() {
  board = [];
  for (let r = 0; r < BOARD_SIZE; r++) {
    board[r] = [];
    for (let c = 0; c < BOARD_SIZE; c++) {
      let icon = randomIcon();
      // Проверяем, чтобы не было стартовых матчей
      // (похожая логика, как в примере jQuery)
      // Если слева 2 таких же
      while (c >= 2 && board[r][c-1] === icon && board[r][c-2] === icon) {
        icon = randomIcon();
      }
      // Если сверху 2 таких же
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

///////////////////////////////////////////////////////////////////////////////
// 3. Отрисовка на canvas
///////////////////////////////////////////////////////////////////////////////
function drawBoard() {
  match3Ctx.clearRect(0, 0, match3Canvas.width, match3Canvas.height);

  // Фон
  match3Ctx.fillStyle = '#000000';
  match3Ctx.fillRect(0, 0, match3Canvas.width, match3Canvas.height);

  // Сетка (ярко-зелёная)
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

  // Рисуем иконки
  for (let r = 0; r < BOARD_SIZE; r++) {
    for (let c = 0; c < BOARD_SIZE; c++) {
      const type = board[r][c];
      if (type < 0) continue; // пустая

      // Выделим красным, если эта клетка выбрана
      if (selectedCell && selectedCell.row === r && selectedCell.col === c) {
        match3Ctx.fillStyle = 'rgba(255,0,0,0.3)';
        match3Ctx.fillRect(c * CELL_SIZE, r * CELL_SIZE, CELL_SIZE, CELL_SIZE);
      }

      const img = iconImages[type];
      if (img) {
        match3Ctx.drawImage(
          img,
          c * CELL_SIZE,   // x
          r * CELL_SIZE,   // y
          CELL_SIZE, CELL_SIZE
        );
      }
    }
  }
}

///////////////////////////////////////////////////////////////////////////////
// 4. Логика кликов/тапов + SWAP
///////////////////////////////////////////////////////////////////////////////
let mouseDownCell = null;

function onMouseDown(evt) {
  if (!isGame2Running) return;
  const rect = match3Canvas.getBoundingClientRect();
  const x = evt.clientX - rect.left;
  const y = evt.clientY - rect.top;

  const col = Math.floor(x / CELL_SIZE);
  const row = Math.floor(y / CELL_SIZE);

  mouseDownCell = { row, col };
  selectedCell  = { row, col };

  // Навешиваем mousemove/up для «перетаскивания»
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

  // Если двинулись достаточно далеко, определяем направление
  if (Math.abs(dx) > CELL_SIZE / 2 || Math.abs(dy) > CELL_SIZE / 2) {
    let targetRow = mouseDownCell.row;
    let targetCol = mouseDownCell.col;

    if (Math.abs(dx) > Math.abs(dy)) {
      // Горизонтальное движение
      if (dx > 0) targetCol++; else targetCol--;
    } else {
      // Вертикальное
      if (dy > 0) targetRow++; else targetRow--;
    }

    // Проверяем, что ячейка рядом
    if (isNeighbor(mouseDownCell.row, mouseDownCell.col, targetRow, targetCol)) {
      trySwap(mouseDownCell.row, mouseDownCell.col, targetRow, targetCol);
    }

    // Сбрасываем
    mouseDownCell = null;
    selectedCell  = null;
    drawBoard();

    // Убираем обработчики
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

// То же для touch
function onTouchStart(evt) {
  if (!isGame2Running) return;
  evt.preventDefault();

  const rect = match3Canvas.getBoundingClientRect();
  const touch = evt.touches[0];
  const x = touch.clientX - rect.left;
  const y = touch.clientY - rect.top;

  const col = Math.floor(x / CELL_SIZE);
  const row = Math.floor(y / CELL_SIZE);

  mouseDownCell = { row, col };
  selectedCell  = { row, col };
  drawBoard();

  // Навешиваем «слушатели» для touchmove/up
  document.addEventListener('touchmove', onTouchMove, { passive: false });
  document.addEventListener('touchend', onTouchEnd);
}

function onTouchMove(evt) {
  if (!mouseDownCell) return;
  evt.preventDefault();

  const rect = match3Canvas.getBoundingClientRect();
  const touch = evt.touches[0];
  const x = touch.clientX - rect.left;
  const y = touch.clientY - rect.top;

  const dx = x - (mouseDownCell.col * CELL_SIZE + CELL_SIZE / 2);
  const dy = y - (mouseDownCell.row * CELL_SIZE + CELL_SIZE / 2);

  if (Math.abs(dx) > CELL_SIZE / 2 || Math.abs(dy) > CELL_SIZE / 2) {
    let targetRow = mouseDownCell.row;
    let targetCol = mouseDownCell.col;

    if (Math.abs(dx) > Math.abs(dy)) {
      if (dx > 0) targetCol++; else targetCol--;
    } else {
      if (dy > 0) targetRow++; else targetRow--;
    }

    if (isNeighbor(mouseDownCell.row, mouseDownCell.col, targetRow, targetCol)) {
      trySwap(mouseDownCell.row, mouseDownCell.col, targetRow, targetCol);
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

function isNeighbor(r1, c1, r2, c2) {
  return (Math.abs(r1 - r2) === 1 && c1 === c2) ||
         (Math.abs(c1 - c2) === 1 && r1 === r2);
}

///////////////////////////////////////////////////////////////////////////////
// 5. Попытка SWAP
///////////////////////////////////////////////////////////////////////////////
function trySwap(r1, c1, r2, c2) {
  // Меняем в массиве
  swapIcons(r1, c1, r2, c2);

  // Проверяем совпадения
  let hasMatches = checkAllMatches();
  if (!hasMatches) {
    // Если нет, откатываем
    swapIcons(r1, c1, r2, c2);
  }
  // Перерисуем
  drawBoard();
}

// Просто перестановка в массиве board
function swapIcons(r1, c1, r2, c2) {
  let temp = board[r1][c1];
  board[r1][c1] = board[r2][c2];
  board[r2][c2] = temp;
}

///////////////////////////////////////////////////////////////////////////////
// 6. Поиск совпадений и удаление
///////////////////////////////////////////////////////////////////////////////
function checkAllMatches() {
  // Ищем все совпадения (3+)
  let matches = findMatches();
  if (matches.length === 0) {
    return false;
  }
  // Удаляем
  removeMatches(matches);

  // Повторяем пока есть новые совпадения (каскады)
  while (true) {
    applyGravity();
    fillEmpty();
    const next = findMatches();
    if (next.length === 0) break;
    removeMatches(next);
  }

  return true;
}

/**
 * Находит *все* совпадения (гориз. и вертикальные),
 * возвращает массив массивов клеток [ {r,c}, {r,c}, ... ]
 */
function findMatches() {
  let found = [];

  // Горизонтали
  for (let r = 0; r < BOARD_SIZE; r++) {
    for (let c = 0; c < BOARD_SIZE - 2; c++) {
      let t = board[r][c];
      if (t < 0) continue; // пустая
      if (board[r][c+1] === t && board[r][c+2] === t) {
        // Собираем все, что идут подряд
        let length = 3;
        while (c + length < BOARD_SIZE && board[r][c+length] === t) {
          length++;
        }
        let group = [];
        for (let i = 0; i < length; i++) {
          group.push({ r, c: c + i });
        }
        found.push(group);
        c += (length - 1);
      }
    }
  }

  // Вертикали
  for (let c = 0; c < BOARD_SIZE; c++) {
    for (let r = 0; r < BOARD_SIZE - 2; r++) {
      let t = board[r][c];
      if (t < 0) continue;
      if (board[r+1][c] === t && board[r+2][c] === t) {
        let length = 3;
        while (r + length < BOARD_SIZE && board[r+length][c] === t) {
          length++;
        }
        let group = [];
        for (let i = 0; i < length; i++) {
          group.push({ r: r + i, c });
        }
        found.push(group);
        r += (length - 1);
      }
    }
  }

  // Склеиваем все группы в один общий массив (на случай пересечений)
  // или можно вернуть массив массивов. Мы вернём единый «список клеток».
  let uniqueCells = [];
  found.forEach(group => {
    group.forEach(cell => {
      uniqueCells.push(cell);
    });
  });
  return uniqueCells;
}

// Удаляем найденные совпадения, ставим -1
function removeMatches(cells) {
  // Начисляем очки
  match3Score += cells.length * 10;
  // Удаляем
  cells.forEach(cell => {
    board[cell.r][cell.c] = -1;
  });
}

/**
 * "Роняем" иконки вниз (как в вашем примере)
 */
function applyGravity() {
  for (let c = 0; c < BOARD_SIZE; c++) {
    for (let r = BOARD_SIZE - 1; r >= 0; r--) {
      if (board[r][c] === -1) {
        // Ищем выше первую непустую
        for (let rr = r - 1; rr >= 0; rr--) {
          if (board[rr][c] !== -1) {
            board[r][c] = board[rr][c];
            board[rr][c] = -1;
            break;
          }
        }
      }
    }
  }
}

/**
 * Заполняем сверху новые иконки, если есть -1
 */
function fillEmpty() {
  for (let r = 0; r < BOARD_SIZE; r++) {
    for (let c = 0; c < BOARD_SIZE; c++) {
      if (board[r][c] === -1) {
        board[r][c] = randomIcon();
      }
    }
  }
}

///////////////////////////////////////////////////////////////////////////////
// 7. Завершение игры
///////////////////////////////////////////////////////////////////////////////
function endMatch3Game() {
  // Останавливаем таймер
  if (match3TimerId) {
    clearInterval(match3TimerId);
    match3TimerId = null;
  }
  // Добавляем match3Score в локальные очки
  localUserData.points += match3Score;

  // Показываем итоговое окно из основного кода
  showEndGameModal('Время вышло!', `Вы заработали ${match3Score} очков!`);
}
