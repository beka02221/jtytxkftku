
/* game2.js - Улучшенный "3 в ряд" в стиле хакинга и программирования.

   ОСНОВНЫЕ ОСОБЕННОСТИ:
   1) Сетка 8x8 (можно менять gridSize).
   2) Каждая ячейка содержит одну из 5 "неоновых" иконок:
       - Замок        (lock)
       - Ошибка       (error)
       - Fraud        (мошенничество)
       - Key          (ключ)
       - Credentials  (учётные данные)
   3) При формировании 3+ в ряд (гориз/верт):
       - Эти иконки "взрываются" (исчезают).
       - Игрок получает очки (по умолчанию +10 за каждую убранную).
       - Всё над упавшими ячейками плавно опускается (анимация падения).
       - Возможны каскадные эффекты при новых совпадениях.
   4) Игра длится 1 минуту.
       - По окончании появляется окно "Время закончилось", очки записываются в БД.
   5) Возможность swap (менять местами) только соседние элементы (по клику или тапу).
   6) Стилистика "хакинга" заложена концептуально (иконки, тёмный фон и т.п.).
      Дополнительные визуальные эффекты (свечение, мерцающий код) можно
      добавить через CSS / canvas-фильтры.
*/

let match3Interval = null;   // requestAnimationFrame ID
let match3Ctx = null;        // Canvas 2D context

// Размер поля
const gridSize = 8;
const cellSize = 50;

// Таймер (1 мин)
let matchTimeLeft = 60;
let matchTimerId = null;

// Текущее поле
let matchGrid = [];

// Для анимации падения
const FALL_SPEED = 5;  // px/frame

// Иконки (5 шт.), стилизующие "хакинг/безопасность"
const iconPaths = [
  "https://img.icons8.com/ios/50/lock.png",                  // 0: lock
  "https://img.icons8.com/ios/50/error--v1.png",             // 1: error
  "https://img.icons8.com/fluency-systems-regular/50/fraud.png",          // 2: fraud
  "https://img.icons8.com/fluency-systems-regular/50/key-security--v1.png", // 3: key
  "https://img.icons8.com/fluency-systems-regular/50/user-credentials.png"  // 4: user
];

// Для хранения загруженных Image объектов
let iconImages = [];

// Состояние выбора ячейки (swap)
let selectedCell = null;
let isSwapping = false;

// Очки за текущую сессию
let matchScoreThisRound = 0;

/*
  Структура клетки (matchGrid[y][x]):

  {
    iconIndex: число (0..4),   // указывает на iconPaths
    offsetY: число,           // текущий сдвиг по вертикали для падения
    falling: bool             // падает ли вниз
    explodeFrame?: number     // если есть анимация "взрыва", можно хранить текущий кадр
    ...
  }

  Если iconIndex === -1, клетка "пустая" (для процесса гравитации).
*/

/* ---------------------------------------------------------------
   ФУНКЦИЯ initGame2() - запуск игры (вызывается из index.html)
   --------------------------------------------------------------- */
function initGame2() {
  const canvas = document.getElementById('match3Canvas');
  match3Ctx = canvas.getContext('2d');

  // Подготовим массив иконок (загрузим их в Image)
  loadIcons(() => {
    // Когда все иконки загружены, запускаем поле
    startMatch3Game();
  });
}

/* Загрузка всех иконок (чтобы не было проблем с асинхронной отрисовкой). */
function loadIcons(callback) {
  let loadedCount = 0;
  iconImages = iconPaths.map(path => {
    const img = new Image();
    img.src = path;
    img.onload = () => {
      loadedCount++;
      if (loadedCount >= iconPaths.length) {
        // Всё загружено
        callback();
      }
    };
    return img;
  });
}

function startMatch3Game() {
  // Генерируем сетку
  matchGrid = [];
  for (let y = 0; y < gridSize; y++) {
    matchGrid[y] = [];
    for (let x = 0; x < gridSize; x++) {
      matchGrid[y][x] = spawnCell();
    }
  }
  // Убираем стартовые совпадения, если есть (чтобы не давать халявный матч)
  removeAllMatches();

  // Запускаем таймер (60 сек)
  matchTimeLeft = 60;
  matchScoreThisRound = 0;
  matchTimerId = setInterval(() => {
    matchTimeLeft--;
    // Покажем в top-bar оставшееся время
    const timeLeftEl = document.getElementById('timeLeft');
    if (timeLeftEl) {
      timeLeftEl.textContent = matchTimeLeft + 'с';
    }

    if (matchTimeLeft <= 0) {
      endMatch3();
    }
  }, 1000);

  // Слушатель для кликов (swap по кликам)
  canvas.addEventListener('mousedown', onCanvasClick);
  canvas.addEventListener('touchstart', onTouchStart, { passive: false });

  // Игровой цикл
  match3Interval = requestAnimationFrame(match3Loop);
}

/* Генерация новой фишки (иконки). */
function spawnCell() {
  const iconIndex = Math.floor(Math.random() * iconPaths.length); // 0..4
  return {
    iconIndex,
    offsetY: -Math.random() * 300, // начальный сдвиг сверху (для анимации падения)
    falling: true
  };
}

/* ---------------------------------------------------------------
   ФУНКЦИИ ЗАВЕРШЕНИЯ / СБРОСА
   --------------------------------------------------------------- */
function endMatch3() {
  // Останавливаем таймер
  clearInterval(matchTimerId);
  matchTimerId = null;

  // Останавливаем анимацию
  if (match3Interval) {
    cancelAnimationFrame(match3Interval);
    match3Interval = null;
  }

  // Прибавляем очки к localUserData.points
  localUserData.points += matchScoreThisRound;
  updateTopBar();

  // Вызываем финальное окно (из index.html)
  showEndGameModal(
    'Время закончилось!',
    `Вы заработали ${matchScoreThisRound} очков.\nИтоговые очки: ${localUserData.points}`
  );

  // Сброс
  resetGame2();
}

function resetGame2() {
  // Отменяем анимацию
  if (match3Interval) {
    cancelAnimationFrame(match3Interval);
    match3Interval = null;
  }
  // Таймер
  if (matchTimerId) {
    clearInterval(matchTimerId);
    matchTimerId = null;
  }
  // Удаляем слушатели
  const canvas = document.getElementById('match3Canvas');
  canvas.removeEventListener('mousedown', onCanvasClick);
  canvas.removeEventListener('touchstart', onTouchStart);

  // Сброс
  match3Ctx = null;
  matchGrid = [];
  selectedCell = null;
  isSwapping = false;
  matchTimeLeft = 0;
  matchScoreThisRound = 0;
}

/* ---------------------------------------------------------------
   ОБРАБОТКА КЛИКОВ (SWAP)
   --------------------------------------------------------------- */
function onCanvasClick(e) {
  if (isSwapping) return; // Если идёт анимация обмена
  handleCellSelection(e.clientX, e.clientY);
}

function onTouchStart(e) {
  if (isSwapping) return;
  // Для мобильных — берём первую точку
  const touch = e.touches[0];
  handleCellSelection(touch.clientX, touch.clientY);
  e.preventDefault(); // Чтобы не было "прокруток" и т.д.
}

function handleCellSelection(clientX, clientY) {
  const canvas = document.getElementById('match3Canvas');
  const rect = canvas.getBoundingClientRect();
  const mouseX = clientX - rect.left;
  const mouseY = clientY - rect.top;

  const xIndex = Math.floor(mouseX / cellSize);
  const yIndex = Math.floor(mouseY / cellSize);

  if (xIndex < 0 || xIndex >= gridSize || yIndex < 0 || yIndex >= gridSize) {
    selectedCell = null;
    return;
  }

  if (!selectedCell) {
    // Выбираем первую
    selectedCell = { x: xIndex, y: yIndex };
  } else {
    // Уже есть выбранная клетка - проверим соседство
    const dx = Math.abs(xIndex - selectedCell.x);
    const dy = Math.abs(yIndex - selectedCell.y);

    if ((dx === 1 && dy === 0) || (dx === 0 && dy === 1)) {
      // Свапаем
      swapCells(selectedCell.x, selectedCell.y, xIndex, yIndex);
    }
    // Сбрасываем
    selectedCell = null;
  }
}

function swapCells(x1, y1, x2, y2) {
  isSwapping = true;

  const temp = matchGrid[y1][x1];
  matchGrid[y1][x1] = matchGrid[y2][x2];
  matchGrid[y2][x2] = temp;

  // Проверяем совпадения
  const matched = findAllMatches();
  if (matched.length > 0) {
    removeMatches(matched);
    // Каскады могут повторяться, пусть всё произойдёт
    setTimeout(() => {
      isSwapping = false;
    }, 400);
  } else {
    // Нет совпадений - откат
    setTimeout(() => {
      const temp2 = matchGrid[y1][x1];
      matchGrid[y1][x1] = matchGrid[y2][x2];
      matchGrid[y2][x2] = temp2;
      isSwapping = false;
    }, 300);
  }
}

/* ---------------------------------------------------------------
   ПОИСК "3+" В РЯД
   --------------------------------------------------------------- */
function findAllMatches() {
  const matched = [];
  // Горизонтали
  for (let y = 0; y < gridSize; y++) {
    for (let x = 0; x < gridSize - 2; x++) {
      const i1 = matchGrid[y][x].iconIndex;
      const i2 = matchGrid[y][x+1].iconIndex;
      const i3 = matchGrid[y][x+2].iconIndex;
      if (i1 !== -1 && i1 === i2 && i2 === i3) {
        matched.push({ x, y }, { x: x+1, y }, { x: x+2, y });
      }
    }
  }
  // Вертикали
  for (let x = 0; x < gridSize; x++) {
    for (let y = 0; y < gridSize - 2; y++) {
      const i1 = matchGrid[y][x].iconIndex;
      const i2 = matchGrid[y+1][x].iconIndex;
      const i3 = matchGrid[y+2][x].iconIndex;
      if (i1 !== -1 && i1 === i2 && i2 === i3) {
        matched.push({ x, y }, { x, y: y+1 }, { x, y: y+2 });
      }
    }
  }
  // Убираем дубли
  const used = {};
  const unique = [];
  matched.forEach(cell => {
    const key = cell.x + '_' + cell.y;
    if (!used[key]) {
      used[key] = true;
      unique.push(cell);
    }
  });
  return unique;
}

/* ---------------------------------------------------------------
   УДАЛЕНИЕ СОВПАДЕНИЙ
   --------------------------------------------------------------- */
function removeMatches(matchedCells) {
  // +10 очков за каждую удалённую фишку
  matchScoreThisRound += matchedCells.length * 10;

  // Помечаем как пустые
  matchedCells.forEach(cell => {
    const { x, y } = cell;
    matchGrid[y][x].iconIndex = -1;
  });

  // Анимация "взрыва" (можно усложнить)
  // Для упрощения - сразу уберём, а затем падение
  setTimeout(() => {
    applyGravity();
  }, 200);
}

/* ---------------------------------------------------------------
   КАСКАДЫ (GRAVITY)
   --------------------------------------------------------------- */
function applyGravity() {
  // Снизу вверх
  for (let x = 0; x < gridSize; x++) {
    for (let y = gridSize - 1; y >= 0; y--) {
      if (matchGrid[y][x].iconIndex === -1) {
        for (let ny = y - 1; ny >= 0; ny--) {
          if (matchGrid[ny][x].iconIndex !== -1) {
            // swap
            matchGrid[y][x].iconIndex = matchGrid[ny][x].iconIndex;
            matchGrid[y][x].offsetY = matchGrid[y][x].offsetY;
            matchGrid[y][x].falling = true;

            matchGrid[ny][x].iconIndex = -1;
            break;
          }
        }
      }
    }
  }
  // Заполним верхние пустоты новыми
  for (let y = 0; y < gridSize; y++) {
    for (let x = 0; x < gridSize; x++) {
      if (matchGrid[y][x].iconIndex === -1) {
        matchGrid[y][x] = spawnCell();
      }
    }
  }
  // Проверим, не создались ли новые совпадения
  setTimeout(() => {
    const matched = findAllMatches();
    if (matched.length > 0) {
      removeMatches(matched);
    }
  }, 200);
}

/* ---------------------------------------------------------------
   УДАЛЯЕМ ВСЕ НАЧАЛЬНЫЕ МАТЧИ (чтобы поле было "чистым")
   --------------------------------------------------------------- */
function removeAllMatches() {
  let again = true;
  while (again) {
    const matched = findAllMatches();
    if (matched.length > 0) {
      matched.forEach(cell => {
        matchGrid[cell.y][cell.x].iconIndex = -1;
      });
      applyGravity();
    } else {
      again = false;
    }
  }
}

/* ---------------------------------------------------------------
   updateFalling() - анимация падения
   --------------------------------------------------------------- */
function updateFalling() {
  for (let y = 0; y < gridSize; y++) {
    for (let x = 0; x < gridSize; x++) {
      const cell = matchGrid[y][x];
      if (cell.falling) {
        const targetY = y * cellSize;
        cell.offsetY += FALL_SPEED;
        if (cell.offsetY >= targetY) {
          cell.offsetY = targetY;
          cell.falling = false;
        }
      }
    }
  }
}

/* ---------------------------------------------------------------
   Основной цикл (match3Loop)
   --------------------------------------------------------------- */
function match3Loop() {
  if (!match3Ctx) return;

  // Обновляем падение
  updateFalling();

  // Рисуем поле
  drawMatch3Grid();

  // Следующий кадр
  match3Interval = requestAnimationFrame(match3Loop);
}

/* ---------------------------------------------------------------
   РИСОВАНИЕ (drawMatch3Grid)
   --------------------------------------------------------------- */
function drawMatch3Grid() {
  match3Ctx.clearRect(0, 0, gridSize * cellSize, gridSize * cellSize);

  // Рисуем "тёмно-зелёный" фон ячеек (как заявлено в описании)
  for (let y = 0; y < gridSize; y++) {
    for (let x = 0; x < gridSize; x++) {
      match3Ctx.fillStyle = '#003300'; // тёмно-зелёный
      match3Ctx.fillRect(x*cellSize, y*cellSize, cellSize, cellSize);
    }
  }

  // Рисуем иконки
  for (let y = 0; y < gridSize; y++) {
    for (let x = 0; x < gridSize; x++) {
      const cell = matchGrid[y][x];
      if (cell.iconIndex >= 0) {
        // Определяем конечную позицию
        const px = x * cellSize;
        const py = y * cellSize;
        const centerX = px + cellSize/2;
        const centerY = (py + cellSize/2) - (y*cellSize) + cell.offsetY;

        const iconImg = iconImages[cell.iconIndex];
        if (iconImg) {
          // "Неоновое" свечение можно эмулировать тенью
          match3Ctx.save();
          match3Ctx.shadowColor = '#0F0';
          match3Ctx.shadowBlur  = 6;

          const iconSize = cellSize * 0.8; // 80% от клетки
          match3Ctx.drawImage(
            iconImg,
            centerX - iconSize/2,
            centerY - iconSize/2,
            iconSize, iconSize
          );
          match3Ctx.restore();
        }
      }
    }
  }

  // Выделение выбранной клетки (подсветка)
  if (selectedCell) {
    match3Ctx.strokeStyle = '#00FF00';
    match3Ctx.lineWidth = 3;
    match3Ctx.strokeRect(
      selectedCell.x * cellSize + 2,
      selectedCell.y * cellSize + 2,
      cellSize - 4, cellSize - 4
    );
  }
}
