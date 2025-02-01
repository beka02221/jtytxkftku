/* game2.js
   HackMatch 3
   Тематика: хакинг/кибер. Иконки: lock, error, fraud, key, user-credentials
   Игра 8x8, swap соседних элементов, match >=3, исчезновение, падение, каскады.
   Таймер 60 сек. По истечении вызываем hackMatchTimeIsOver(score).
*/

/* Список иконок (неон/хакинг) */
const hackIcons = [
  "https://img.icons8.com/ios/50/lock.png",
  "https://img.icons8.com/ios/50/error--v1.png",
  "https://img.icons8.com/fluency-systems-regular/50/fraud.png",
  "https://img.icons8.com/fluency-systems-regular/50/key-security--v1.png",
  "https://img.icons8.com/fluency-systems-regular/50/user-credentials.png"
];

const GRID_SIZE = 8;      // Размер поля
const CELL_SIZE = 60;     // Пикселей (желательно совпадать с canvas width/height)
const TIME_LIMIT = 60;    // Секунд
let score = 0;

let grid = [];            // Матрица иконок
let canvas, ctx;
let selectedCell = null;  // Для выделения ячейки (x,y)
let startTime = 0;
let gameTimer = null;     // Интервал обновления таймера

/**
 * Функция запускается при нажатии "Играть" (index.html -> startHackMatchGame).
 */
function startHackMatchGame() {
  canvas = document.getElementById('match3Canvas');
  ctx = canvas.getContext('2d');

  // Инициализируем поле
  initGrid();
  score = 0;

  // Ставим обработчики мыши (swap)
  canvas.addEventListener('mousedown', onMouseDown);
  canvas.addEventListener('mouseup', onMouseUp);

  // Для мобильных свайпов (touch)
  canvas.addEventListener('touchstart', onTouchStart, { passive: false });
  canvas.addEventListener('touchend', onTouchEnd, { passive: false });

  // Запускаем таймер на 60 сек
  startTime = Date.now();
  gameTimer = setInterval(() => {
    const elapsed = Math.floor((Date.now() - startTime) / 1000);
    const secLeft = TIME_LIMIT - elapsed;
    if (secLeft <= 0) {
      // Время вышло
      clearInterval(gameTimer);
      gameTimer = null;
      endHackMatchGame();
    } else {
      // Обновляем отображение таймера в index.html
      updateGameTimerUI(secLeft);
    }
  }, 1000);

  // Рисуем стартовое поле и проверяем на случайные совпадения
  chainCheck();
  drawGrid();
}

/**
 * Завершаем игру (вызываем hackMatchTimeIsOver(score) из index.html).
 */
function endHackMatchGame() {
  // Удаляем обработчики
  canvas.removeEventListener('mousedown', onMouseDown);
  canvas.removeEventListener('mouseup', onMouseUp);
  canvas.removeEventListener('touchstart', onTouchStart);
  canvas.removeEventListener('touchend', onTouchEnd);

  // Сбрасываем таймер
  if (gameTimer) {
    clearInterval(gameTimer);
    gameTimer = null;
  }

  // Говорим index.html, что время вышло
  hackMatchTimeIsOver(score);
}

/**
 * Инициализируем поле случайными иконками.
 */
function initGrid() {
  grid = [];
  for (let y = 0; y < GRID_SIZE; y++) {
    let row = [];
    for (let x = 0; x < GRID_SIZE; x++) {
      row.push(randomIcon());
    }
    grid.push(row);
  }
}

/**
 * Возвращает случайную иконку из массива hackIcons.
 */
function randomIcon() {
  return hackIcons[Math.floor(Math.random() * hackIcons.length)];
}

/**
 * Отрисовка поля на canvas.
 */
function drawGrid() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  // Рисуем каждую ячейку
  for (let y = 0; y < GRID_SIZE; y++) {
    for (let x = 0; x < GRID_SIZE; x++) {
      // Фон (тёмно-зелёный, хакинг)
      ctx.fillStyle = "#003300"; 
      ctx.fillRect(x * CELL_SIZE, y * CELL_SIZE, CELL_SIZE, CELL_SIZE);

      // Если выделено
      if (selectedCell && selectedCell.x === x && selectedCell.y === y) {
        ctx.strokeStyle = "#00FF00";
        ctx.lineWidth = 3;
        ctx.strokeRect(x * CELL_SIZE + 2, y * CELL_SIZE + 2,
                       CELL_SIZE - 4, CELL_SIZE - 4);
      }

      // Рисуем иконку
      drawIcon(grid[y][x], x, y);
    }
  }
}

/**
 * Отрисовка одной иконки по ссылке iconUrl в клетке (x,y).
 */
function drawIcon(iconUrl, x, y) {
  const img = new Image();
  img.src = iconUrl;
  // При загрузке картинки рисуем её
  img.onload = () => {
    const offsetX = x * CELL_SIZE + (CELL_SIZE - 40) / 2; // 40 - предполагаемый размер иконки
    const offsetY = y * CELL_SIZE + (CELL_SIZE - 40) / 2;
    ctx.drawImage(img, offsetX, offsetY, 40, 40);
  };
}

/* ----------------------------------------------------------------
   Управление: мышь + touch (облегчённая логика)
---------------------------------------------------------------- */
let mouseStart = null; // координаты начала клика (для свайпа)

function onMouseDown(e) {
  const rect = canvas.getBoundingClientRect();
  const mx = e.clientX - rect.left;
  const my = e.clientY - rect.top;
  const gridX = Math.floor(mx / CELL_SIZE);
  const gridY = Math.floor(my / CELL_SIZE);

  mouseStart = { x: gridX, y: gridY };
}

function onMouseUp(e) {
  if (!mouseStart) return;
  const rect = canvas.getBoundingClientRect();
  const mx = e.clientX - rect.left;
  const my = e.clientY - rect.top;
  const gridX = Math.floor(mx / CELL_SIZE);
  const gridY = Math.floor(my / CELL_SIZE);

  // Проверяем, соседние ли ячейки
  if (isNeighbor(mouseStart.x, mouseStart.y, gridX, gridY)) {
    swapAndCheck(mouseStart.x, mouseStart.y, gridX, gridY);
  } else {
    // Если клик по одной ячейке – просто выделяем
    if (mouseStart.x === gridX && mouseStart.y === gridY) {
      selectedCell = { x: gridX, y: gridY };
      drawGrid();
    }
  }

  mouseStart = null;
}

function onTouchStart(e) {
  e.preventDefault();
  if (!e.touches[0]) return;
  const rect = canvas.getBoundingClientRect();
  const mx = e.touches[0].clientX - rect.left;
  const my = e.touches[0].clientY - rect.top;
  const gridX = Math.floor(mx / CELL_SIZE);
  const gridY = Math.floor(my / CELL_SIZE);

  mouseStart = { x: gridX, y: gridY };
}

function onTouchEnd(e) {
  e.preventDefault();
  if (!mouseStart) return;
  // Для простоты, примем, что touchend происходит там же (не учитываем перемещение).
  // Либо можно отлавливать touchmove и определять направление свайпа.
  const rect = canvas.getBoundingClientRect();
  // Возьмём последнюю позицию пальца (touches=0, значит берём changedTouches)
  if (!e.changedTouches[0]) return;
  const mx = e.changedTouches[0].clientX - rect.left;
  const my = e.changedTouches[0].clientY - rect.top;
  const gridX = Math.floor(mx / CELL_SIZE);
  const gridY = Math.floor(my / CELL_SIZE);

  // Проверяем, соседние ли ячейки
  if (isNeighbor(mouseStart.x, mouseStart.y, gridX, gridY)) {
    swapAndCheck(mouseStart.x, mouseStart.y, gridX, gridY);
  } else {
    // Просто выделяем
    if (mouseStart.x === gridX && mouseStart.y === gridY) {
      selectedCell = { x: gridX, y: gridY };
      drawGrid();
    }
  }

  mouseStart = null;
}

/**
 * Проверка, являются ли ячейки соседними.
 */
function isNeighbor(x1, y1, x2, y2) {
  return (
    (x1 === x2 && Math.abs(y1 - y2) === 1) ||
    (y1 === y2 && Math.abs(x1 - x2) === 1)
  );
}

/**
 * Меняем местами две иконки и проверяем на совпадения.
 */
function swapAndCheck(x1, y1, x2, y2) {
  // Меняем в grid
  const temp = grid[y1][x1];
  grid[y1][x1] = grid[y2][x2];
  grid[y2][x2] = temp;

  // Рисуем (временно)
  drawGrid();

  // Проверяем, есть ли совпадения
  if (!checkMatches()) {
    // Если совпадений нет, возвращаем обратно
    const tmp = grid[y1][x1];
    grid[y1][x1] = grid[y2][x2];
    grid[y2][x2] = tmp;
    drawGrid();
  } else {
    // Если есть совпадение, запускаем каскады
    chainCheck();
  }
}

/**
 * Полный цикл проверки + каскадов.
 */
function chainCheck() {
  let combo = true;
  while (combo) {
    const matched = checkMatches();
    if (matched > 0) {
      // Есть совпадения, удаляем + начисляем очки
      score += matched * 10; // к примеру, 10 очков за каждую группу
      removeMatches();
      dropIcons();
    } else {
      combo = false;
    }
  }
  // После каскадов перерисовываем
  drawGrid();
}

/**
 * Находит все совпадения (3+ в ряд).
 * Возвращает количество найденных "групп" или 0, если нет.
 * Или можем вернуть общее число затронутых ячеек.
 */
function checkMatches() {
  const toRemove = []; // массив координат, которые надо удалить

  // Ищем горизонтальные совпадения
  for (let y = 0; y < GRID_SIZE; y++) {
    for (let x = 0; x < GRID_SIZE - 2; x++) {
      const icon = grid[y][x];
      if (icon &&
          icon === grid[y][x+1] &&
          icon === grid[y][x+2]) {
        // Нашли минимум 3 подряд
        let matchLen = 3;
        // Проверим, не идет ли дальше
        let nx = x + 3;
        while (nx < GRID_SIZE && grid[y][nx] === icon) {
          matchLen++;
          nx++;
        }
        // Записываем все эти ячейки
        for (let i = 0; i < matchLen; i++) {
          toRemove.push({ x: x + i, y });
        }
        x += matchLen - 1; // пропускаем
      }
    }
  }

  // Ищем вертикальные совпадения
  for (let x = 0; x < GRID_SIZE; x++) {
    for (let y = 0; y < GRID_SIZE - 2; y++) {
      const icon = grid[y][x];
      if (icon &&
          icon === grid[y+1][x] &&
          icon === grid[y+2][x]) {
        // Нашли минимум 3 подряд
        let matchLen = 3;
        let ny = y + 3;
        while (ny < GRID_SIZE && grid[ny][x] === icon) {
          matchLen++;
          ny++;
        }
        // Записываем
        for (let i = 0; i < matchLen; i++) {
          toRemove.push({ x, y: y + i });
        }
        y += matchLen - 1;
      }
    }
  }

  // Убираем дубликаты
  const unique = {};
  toRemove.forEach(cell => {
    unique[`${cell.x}_${cell.y}`] = true;
  });
  const cellsToRemove = Object.keys(unique);

  return cellsToRemove.length;
}

/**
 * Удаляем совпавшие иконки (заменяем на null).
 */
function removeMatches() {
  // Для каждого совпавшего ставим null
  // Повторяем логику checkMatches, но теперь уже конкретнее
  const toRemove = [];

  // Горизонтали
  for (let y = 0; y < GRID_SIZE; y++) {
    for (let x = 0; x < GRID_SIZE - 2; x++) {
      const icon = grid[y][x];
      if (icon &&
          icon === grid[y][x+1] &&
          icon === grid[y][x+2]) {
        let matchLen = 3;
        let nx = x + 3;
        while (nx < GRID_SIZE && grid[y][nx] === icon) {
          matchLen++;
          nx++;
        }
        for (let i = 0; i < matchLen; i++) {
          toRemove.push({ x: x + i, y });
        }
        x += matchLen - 1;
      }
    }
  }

  // Вертикали
  for (let x = 0; x < GRID_SIZE; x++) {
    for (let y = 0; y < GRID_SIZE - 2; y++) {
      const icon = grid[y][x];
      if (icon &&
          icon === grid[y+1][x] &&
          icon === grid[y+2][x]) {
        let matchLen = 3;
        let ny = y + 3;
        while (ny < GRID_SIZE && grid[ny][x] === icon) {
          matchLen++;
          ny++;
        }
        for (let i = 0; i < matchLen; i++) {
          toRemove.push({ x, y: y + i });
        }
        y += matchLen - 1;
      }
    }
  }

  // Убираем дубли
  const unique = {};
  toRemove.forEach(cell => {
    unique[`${cell.x}_${cell.y}`] = true;
  });
  const cellsToRemove = Object.keys(unique);

  // Ставим null
  cellsToRemove.forEach(key => {
    const [x, y] = key.split('_');
    grid[y][x] = null;
  });
}

/**
 * "Просыпаем" ячейки вниз, заполняем верх рандомом.
 */
function dropIcons() {
  for (let x = 0; x < GRID_SIZE; x++) {
    // Сдвигаем вниз
    for (let y = GRID_SIZE - 1; y >= 0; y--) {
      if (grid[y][x] === null) {
        // Найдем сверху следующую не-null
        let ny = y - 1;
        while (ny >= 0 && grid[ny][x] === null) {
          ny--;
        }
        if (ny >= 0) {
          // Перемещаем
          grid[y][x] = grid[ny][x];
          grid[ny][x] = null;
        } else {
          // Нет, тогда ставим рандом
          grid[y][x] = randomIcon();
        }
      }
    }
  }
}
