/***********************************************************
 * game2.js — Реализация игры «3 в ряд» в стиле "хакинг"
 ***********************************************************/

// Размер игрового поля (8x8)
const BOARD_ROWS = 8;
const BOARD_COLS = 8;
// Количество разных иконок
const ICON_TYPES = 5;

// Ссылки на изображения для иконок (неоново-хакерские элементы)
const ICON_URLS = [
  'https://img.icons8.com/ios/50/lock.png',               // 0
  'https://img.icons8.com/ios/50/error--v1.png',          // 1
  'https://img.icons8.com/fluency-systems-regular/50/fraud.png',        // 2
  'https://img.icons8.com/fluency-systems-regular/50/key-security--v1.png', // 3
  'https://img.icons8.com/fluency-systems-regular/50/user-credentials.png'  // 4
];

// Массив объектов Image (для быстрой отрисовки)
let iconImages = [];

// Основные переменные для игры
let match3Canvas = null;
let match3Ctx = null;
let board = [];         // Матрица [BOARD_ROWS][BOARD_COLS], хранит номера иконок 0..4
let match3Selected = null;  // {row, col} выбранная ячейка (при клике)
let match3Score = 0;        // Текущий счёт за партию
let timeLeft = 60;          // Секунд на игру
let match3TimerId = null;   // ID setInterval'а для таймера
let isGame2Running = false; // Флаг, что игра запущена
let timeSpan = null;        // DOM-элемент для отображения времени в шапке (динамически)

// ======================== ИНИЦИАЛИЗАЦИЯ ИГРЫ ==========================
function initGame2() {
  // Если уже идёт, не запускаем повторно
  if (isGame2Running) return;
  isGame2Running = true;

  // Сброс очков и таймера
  match3Score = 0;
  timeLeft = 60;

  // Находим canvas и контекст
  match3Canvas = document.getElementById('match3Canvas');
  match3Ctx = match3Canvas.getContext('2d');

  // Загружаем изображения (один раз)
  if (iconImages.length === 0) {
    ICON_URLS.forEach(url => {
      const img = new Image();
      img.src = url;
      iconImages.push(img);
    });
  }

  // Создаём элемент для отображения времени в шапке (не меняя HTML)
  timeSpan = document.createElement('span');
  timeSpan.style.color = '#00FF00';
  timeSpan.style.marginLeft = '10px';
  timeSpan.textContent = `Время: ${timeLeft}s`;
  // Вставим в .balances справа (или можно в любое место шапки)
  const balancesDiv = document.querySelector('.balances');
  if (balancesDiv) {
    balancesDiv.appendChild(timeSpan);
  }

  // Генерируем поле
  generateBoard();
  // Устраняем стартовые совпадения, чтобы при загрузке не было готовых «матчей»
  removeAllMatchesAndFill();

  // Отрисуем первый раз
  drawBoard();

  // Подключаем события мыши/тач для выбора и swap
  match3Canvas.addEventListener('mousedown', onCanvasClick);
  // (Опционально) для мобильных устройств — аналог touchstart
  match3Canvas.addEventListener('touchstart', evt => {
    const rect = match3Canvas.getBoundingClientRect();
    const touch = evt.touches[0];
    const x = touch.clientX - rect.left;
    const y = touch.clientY - rect.top;
    handleClick(x, y);
  });

  // Запускаем таймер обратного отсчёта
  match3TimerId = setInterval(() => {
    timeLeft--;
    if (timeLeft < 0) {
      endMatch3Game();
    } else {
      // Обновим в шапке
      if (timeSpan) {
        timeSpan.textContent = `Время: ${timeLeft}s`;
      }
    }
  }, 1000);
}

// Сброс (вызывается из главного скрипта finishGame() => resetGame2())
function resetGame2() {
  // Останавливаем таймер
  if (match3TimerId) {
    clearInterval(match3TimerId);
    match3TimerId = null;
  }
  // Снимем флаг
  isGame2Running = false;

  // Удаляем timeSpan из шапки
  if (timeSpan && timeSpan.parentNode) {
    timeSpan.parentNode.removeChild(timeSpan);
  }
  timeSpan = null;

  // Сбрасываем слушатели
  if (match3Canvas) {
    match3Canvas.removeEventListener('mousedown', onCanvasClick);
    match3Canvas.removeEventListener('touchstart', () => {});
  }

  // Можно дополнительно очистить canvas
  if (match3Ctx) {
    match3Ctx.clearRect(0, 0, match3Canvas.width, match3Canvas.height);
  }
  board = [];
  match3Selected = null;
}

/********************************************************
 * Генерация и отрисовка игрового поля
 ********************************************************/
function generateBoard() {
  board = new Array(BOARD_ROWS);
  for (let r = 0; r < BOARD_ROWS; r++) {
    board[r] = new Array(BOARD_COLS);
    for (let c = 0; c < BOARD_COLS; c++) {
      // Случайная иконка 0..4
      board[r][c] = Math.floor(Math.random() * ICON_TYPES);
    }
  }
}

function drawBoard() {
  match3Ctx.clearRect(0, 0, match3Canvas.width, match3Canvas.height);

  // Рисуем фон всего поля (тёмно-зелёный)
  match3Ctx.fillStyle = '#003300';
  match3Ctx.fillRect(0, 0, match3Canvas.width, match3Canvas.height);

  const cellSize = match3Canvas.width / BOARD_COLS; // 400 / 8 = 50
  for (let r = 0; r < BOARD_ROWS; r++) {
    for (let c = 0; c < BOARD_COLS; c++) {
      const x = c * cellSize;
      const y = r * cellSize;

      // Если ячейка выделена
      if (match3Selected && match3Selected.row === r && match3Selected.col === c) {
        match3Ctx.fillStyle = '#004400'; // Чуть светлее
        match3Ctx.fillRect(x, y, cellSize, cellSize);
      }

      // Рисуем иконку
      const iconIndex = board[r][c];
      if (iconIndex >= 0 && iconImages[iconIndex]) {
        const img = iconImages[iconIndex];
        // Стараемся вписать в ячейку по центру
        const offset = 5; // небольшой отступ
        match3Ctx.drawImage(
          img,
          x + offset, 
          y + offset,
          cellSize - offset*2,
          cellSize - offset*2
        );
      }
    }
  }

  // Доп. инфо: счёт (в правом верхнем углу)
  match3Ctx.fillStyle = '#00FF00';
  match3Ctx.font = '16px "Press Start 2P", cursive';
  match3Ctx.textAlign = 'right';
  match3Ctx.fillText(`Score: ${match3Score}`, match3Canvas.width - 10, 20);
}

/********************************************************
 * Обработка кликов/тапов по canvas
 ********************************************************/
function onCanvasClick(evt) {
  const rect = match3Canvas.getBoundingClientRect();
  const x = evt.clientX - rect.left;
  const y = evt.clientY - rect.top;
  handleClick(x, y);
}

function handleClick(x, y) {
  if (!isGame2Running) return;

  const cellSize = match3Canvas.width / BOARD_COLS;
  const col = Math.floor(x / cellSize);
  const row = Math.floor(y / cellSize);

  if (!match3Selected) {
    // Первая ячейка выбора
    match3Selected = { row, col };
  } else {
    // Вторая ячейка выбора — проверяем на соседство
    const rowDiff = Math.abs(match3Selected.row - row);
    const colDiff = Math.abs(match3Selected.col - col);

    if ((rowDiff === 1 && colDiff === 0) || (rowDiff === 0 && colDiff === 1)) {
      // Ячейки соседние — пробуем swap
      swapAndCheck(match3Selected.row, match3Selected.col, row, col);
    }

    // Снимаем выбор
    match3Selected = null;
  }

  // Перерисуем
  drawBoard();
}

/********************************************************
 * SWAP + поиск совпадений и каскады
 ********************************************************/
function swapAndCheck(r1, c1, r2, c2) {
  // Меняем местами
  swapCells(r1, c1, r2, c2);

  // Проверяем, появились ли совпадения
  const matched = findMatches();
  if (matched.size === 0) {
    // Нет совпадений — меняем обратно
    swapCells(r1, c1, r2, c2);
  } else {
    // Есть совпадения — удаляем, каскадим
    removeAllMatchesAndFill();
  }
}

// Просто меняем содержимое двух ячеек
function swapCells(r1, c1, r2, c2) {
  const temp = board[r1][c1];
  board[r1][c1] = board[r2][c2];
  board[r2][c2] = temp;
}

/********************************************************
 * Поиск совпадений (3+ одинаковых подряд)
 * Возвращает Set с индексами "r-c", которые совпали
 ********************************************************/
function findMatches() {
  const matched = new Set();

  // Горизонтали
  for (let r = 0; r < BOARD_ROWS; r++) {
    for (let c = 0; c < BOARD_COLS - 2; c++) {
      const v = board[r][c];
      if (v < 0) continue;
      if (v === board[r][c+1] && v === board[r][c+2]) {
        // есть совпадение
        matched.add(`${r}-${c}`);
        matched.add(`${r}-${c+1}`);
        matched.add(`${r}-${c+2}`);
      }
    }
  }

  // Вертикали
  for (let c = 0; c < BOARD_COLS; c++) {
    for (let r = 0; r < BOARD_ROWS - 2; r++) {
      const v = board[r][c];
      if (v < 0) continue;
      if (v === board[r+1][c] && v === board[r+2][c]) {
        // есть совпадение
        matched.add(`${r}-${c}`);
        matched.add(`${r+1}-${c}`);
        matched.add(`${r+2}-${c}`);
      }
    }
  }

  return matched;
}

/********************************************************
 * Многократное удаление совпадений, "падение" и заполнение
 ********************************************************/
function removeAllMatchesAndFill() {
  let loop = true;
  while (loop) {
    const matched = findMatches();
    if (matched.size === 0) {
      loop = false;
      break;
    }

    // Удаляем все совпавшие (ставим -1)
    matched.forEach(idx => {
      const [r, c] = idx.split('-').map(Number);
      board[r][c] = -1;
    });

    // Начисляем очки (по кол-ву совпавших)
    match3Score += matched.size * 10;

    // "Падение" вниз
    applyGravity();
    // Заполнение сверху
    fillEmptyCells();
  }
  drawBoard();
}

// Сдвигаем иконки вниз, если есть пустые ячейки (-1)
function applyGravity() {
  for (let c = 0; c < BOARD_COLS; c++) {
    for (let r = BOARD_ROWS - 1; r >= 0; r--) {
      if (board[r][c] === -1) {
        // Ищем сверху ближайшую непустую
        for (let nr = r - 1; nr >= 0; nr--) {
          if (board[nr][c] !== -1) {
            board[r][c] = board[nr][c];
            board[nr][c] = -1;
            break;
          }
        }
      }
    }
  }
}

// Заполняем пустые ячейки (-1) случайными иконками
function fillEmptyCells() {
  for (let r = 0; r < BOARD_ROWS; r++) {
    for (let c = 0; c < BOARD_COLS; c++) {
      if (board[r][c] === -1) {
        board[r][c] = Math.floor(Math.random() * ICON_TYPES);
      }
    }
  }
}

/********************************************************
 * Завершение игры (когда вышло время)
 ********************************************************/
function endMatch3Game() {
  // Останавливаем таймер
  if (match3TimerId) {
    clearInterval(match3TimerId);
    match3TimerId = null;
  }

  // Добавляем очки к локальным данным пользователя
  // (Чтобы потом сохранились в БД при closeGameModal)
  localUserData.points += match3Score;

  // Показываем итоговое окно из общего скрипта
  showEndGameModal("Время вышло!", `Вы заработали ${match3Score} очков!`);
}

// ------------------------------------------------------
// Этот файл экспортирует только две функции, которые
// вызываются из основного скрипта:
//   initGame2()   - Запуск игры
//   resetGame2()  - Сброс игры при выходе
// ------------------------------------------------------
