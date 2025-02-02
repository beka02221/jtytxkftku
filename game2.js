/***********************************************************
 * game2.js — «3 в ряд» (match-3) с неоновыми цветными иконками
 * и простыми анимациями (взрывы, плавное падение).
 ***********************************************************/

// Настройки игрового поля
const BOARD_ROWS = 8;
const BOARD_COLS = 8;
// Количество типов фигурок
const ICON_TYPES = 5;
// Размер ячейки (px). Если canvas 400×400, то 50×50
const CELL_SIZE = 50;    

// Ссылки на исходные иконки (чёрно-белые)
const ICON_URLS = [
  'https://img.icons8.com/ios/50/lock.png',               
  'https://img.icons8.com/ios/50/error--v1.png',          
  'https://img.icons8.com/fluency-systems-regular/50/fraud.png',        
  'https://img.icons8.com/fluency-systems-regular/50/key-security--v1.png', 
  'https://img.icons8.com/fluency-systems-regular/50/user-credentials.png'
];

// Параметры анимации
const EXPLOSION_DURATION = 300; // ms на «взрыв»
const FALL_SPEED = 300;         // пикс/с при падении
const GAME_TIME = 60;           // сек на игру

let match3Canvas, match3Ctx;
let iconImages = [];

// Основные флаги и переменные
let isGame2Running = false;
let match3TimerId = null;
let timeSpan = null;      // Отображение таймера в шапке
let timeLeft = GAME_TIME;
let match3Score = 0;

//
// Структура board[r][c]:
// {
//   type: 0..(ICON_TYPES-1) или -1 (пустая),
//   x, y: координаты для анимации,
//   explosionTime: если не null, значит «взорвана» иконка
// }
let board = [];
let match3Selected = null; // {row, col}

// Для анимации (requestAnimationFrame)
let lastTimestamp = 0;

/**************************************************************
 * Функция получения неонового фильтра для каждого типа иконки
 * Можно дорабатывать цвета/эффекты по желанию
 **************************************************************/
function getNeonFilterForType(type) {
  // База: invert(1) превращает белое в чёрное (и наоборот),
  //       brightness и saturate усиливают свечение,
  //       hue-rotate смещает оттенок,
  //       drop-shadow добавляет «неоновую» обводку (свечения).
  switch (type) {
    case 0: 
      // Зелёный (пример)
      return 'invert(1) brightness(2) saturate(2) hue-rotate(90deg) drop-shadow(0 0 8px #0f0)';
    case 1: 
      // Жёлтый
      return 'invert(1) brightness(2) saturate(2) hue-rotate(50deg) drop-shadow(0 0 8px #ff0)';
    case 2: 
      // Голубой
      return 'invert(1) brightness(2) saturate(2) hue-rotate(180deg) drop-shadow(0 0 8px #0ff)';
    case 3: 
      // Розовый
      return 'invert(1) brightness(2) saturate(2) hue-rotate(310deg) drop-shadow(0 0 8px #f0f)';
    case 4: 
      // Красный
      return 'invert(1) brightness(2) saturate(2) hue-rotate(0deg) drop-shadow(0 0 8px #f00)';
    default:
      return 'none';
  }
}

/**************************************************************
 * ИНИЦИАЛИЗАЦИЯ ИГРЫ
 **************************************************************/
function initGame2() {
  if (isGame2Running) return;
  isGame2Running = true;

  match3Score = 0;
  timeLeft = GAME_TIME;

  match3Canvas = document.getElementById('match3Canvas');
  match3Ctx = match3Canvas.getContext('2d');

  // Загрузка иконок (один раз)
  if (iconImages.length === 0) {
    ICON_URLS.forEach(url => {
      const img = new Image();
      img.src = url;
      iconImages.push(img);
    });
  }

  // Создаём метку для времени в шапке
  timeSpan = document.createElement('span');
  timeSpan.style.color = '#00FF00';
  timeSpan.style.marginLeft = '10px';
  timeSpan.textContent = `Время: ${timeLeft}s`;
  const balancesDiv = document.querySelector('.balances');
  if (balancesDiv) {
    balancesDiv.appendChild(timeSpan);
  }

  // Генерируем поле
  generateBoard();

  // Убираем возможные стартовые совпадения (без анимации)
  removeAllMatchesCascade();

  // Слушатели событий
  match3Canvas.addEventListener('mousedown', onCanvasClick);
  match3Canvas.addEventListener('touchstart', onTouchStart);

  // Таймер
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

  // Запуск анимационного цикла
  lastTimestamp = performance.now();
  requestAnimationFrame(animationLoop);
}

/**************************************************************
 * СБРОС/ВЫХОД ИЗ ИГРЫ
 **************************************************************/
function resetGame2() {
  if (match3TimerId) {
    clearInterval(match3TimerId);
    match3TimerId = null;
  }
  isGame2Running = false;

  // Удаляем таймер из шапки
  if (timeSpan && timeSpan.parentNode) {
    timeSpan.parentNode.removeChild(timeSpan);
  }
  timeSpan = null;

  // Удаляем события
  if (match3Canvas) {
    match3Canvas.removeEventListener('mousedown', onCanvasClick);
    match3Canvas.removeEventListener('touchstart', onTouchStart);
  }

  // Очистка canvas
  if (match3Ctx) {
    match3Ctx.clearRect(0, 0, match3Canvas.width, match3Canvas.height);
  }

  board = [];
  match3Selected = null;
}

/**************************************************************
 * Генерация начального поля
 **************************************************************/
function generateBoard() {
  board = [];
  for (let r = 0; r < BOARD_ROWS; r++) {
    board[r] = [];
    for (let c = 0; c < BOARD_COLS; c++) {
      const type = Math.floor(Math.random() * ICON_TYPES);
      board[r][c] = {
        type,
        x: c * CELL_SIZE,
        y: r * CELL_SIZE,
        explosionTime: null
      };
    }
  }
}

/**************************************************************
 * АНИМАЦИОННЫЙ ЦИКЛ
 **************************************************************/
function animationLoop(timestamp) {
  if (!isGame2Running) return;

  let dt = (timestamp - lastTimestamp) / 1000; // время в секундах
  lastTimestamp = timestamp;

  update(dt);
  draw();

  requestAnimationFrame(animationLoop);
}

/**************************************************************
 * ЛОГИКА ОБНОВЛЕНИЯ
 **************************************************************/
function update(dt) {
  // 1) «Взрывы» (проверяем explosionTime)
  for (let r = 0; r < BOARD_ROWS; r++) {
    for (let c = 0; c < BOARD_COLS; c++) {
      const cell = board[r][c];
      if (cell.explosionTime !== null) {
        const elapsed = performance.now() - cell.explosionTime;
        if (elapsed > EXPLOSION_DURATION) {
          cell.type = -1; // убираем фигурку
          cell.explosionTime = null;
        }
      }
    }
  }

  // 2) Плавное падение вниз
  for (let r = BOARD_ROWS - 2; r >= 0; r--) {
    for (let c = 0; c < BOARD_COLS; c++) {
      const cell = board[r][c];
      if (cell.type < 0) continue; // пустая ячейка не падает

      // Ищем, куда можно упасть
      let nr = r;
      while (nr + 1 < BOARD_ROWS && board[nr+1][c].type === -1) {
        nr++;
      }
      if (nr !== r) {
        // «Переносим» ячейку вниз в массиве
        const downCell = board[nr][c];
        downCell.type = cell.type;
        downCell.x = cell.x;
        downCell.y = cell.y;
        downCell.explosionTime = cell.explosionTime;

        cell.type = -1;
        cell.explosionTime = null;
      }
    }
  }

  // Медленно перемещаем фактические координаты (cell.y) к нужному месту
  for (let r = 0; r < BOARD_ROWS; r++) {
    for (let c = 0; c < BOARD_COLS; c++) {
      const cell = board[r][c];
      const targetY = r * CELL_SIZE;
      if (cell.y < targetY) {
        cell.y += FALL_SPEED * dt;
        if (cell.y > targetY) {
          cell.y = targetY;
        }
      }
    }
  }

  // 3) Заполняем пустые клетки (type=-1) новыми фигурками
  for (let r = 0; r < BOARD_ROWS; r++) {
    for (let c = 0; c < BOARD_COLS; c++) {
      if (board[r][c].type < 0) {
        board[r][c].type = Math.floor(Math.random() * ICON_TYPES);
        board[r][c].explosionTime = null;
        // Пусть появляются сверху (для анимации падения)
        board[r][c].y = -CELL_SIZE;
      }
    }
  }

  // 4) Если поле «устаканилось», проверяем новые совпадения
  if (isAllSettled()) {
    let matched = findMatches();
    if (matched.size > 0) {
      // Запускаем «взрывы»
      matched.forEach(idx => {
        const [rr, cc] = idx.split('-').map(Number);
        board[rr][cc].explosionTime = performance.now();
      });
      // Начисляем очки
      match3Score += matched.size * 10;
      // Score не отображаем на Canvas, 
      // в конце прибавим к localUserData.points
    }
  }
}

/**************************************************************
 * РИСОВАНИЕ
 **************************************************************/
function draw() {
  match3Ctx.clearRect(0, 0, match3Canvas.width, match3Canvas.height);

  // Чёрный фон
  match3Ctx.fillStyle = '#000';
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

  // Рисуем иконки
  for (let r = 0; r < BOARD_ROWS; r++) {
    for (let c = 0; c < BOARD_COLS; c++) {
      const cell = board[r][c];
      if (cell.type < 0) continue; // пустая

      // Подсветка красной ячейкой, если выбрана
      if (match3Selected && match3Selected.row === r && match3Selected.col === c) {
        match3Ctx.fillStyle = 'rgba(255,0,0,0.3)';
        match3Ctx.fillRect(c*CELL_SIZE, r*CELL_SIZE, CELL_SIZE, CELL_SIZE);
      }

      // Готовим фильтр (неоновый цвет)
      const prevFilter = match3Ctx.filter; 
      match3Ctx.filter = getNeonFilterForType(cell.type);

      // Анимация «взрыва» — масштаб
      let scale = 1.0;
      if (cell.explosionTime !== null) {
        const elapsed = performance.now() - cell.explosionTime;
        let fraction = elapsed / EXPLOSION_DURATION; 
        if (fraction > 1) fraction = 1;
        scale = 1 + 0.5 * fraction; // от 1.0 до 1.5
      }

      // Рисуем иконку
      const img = iconImages[cell.type];
      if (img) {
        const drawSize = CELL_SIZE * scale;
        const dx = cell.x + (CELL_SIZE - drawSize) / 2;
        const dy = cell.y + (CELL_SIZE - drawSize) / 2;
        match3Ctx.drawImage(img, dx, dy, drawSize, drawSize);
      }

      // Возвращаем старый фильтр
      match3Ctx.filter = prevFilter;
    }
  }
}

/**************************************************************
 * Проверка, что все ячейки на месте (не падают)
 **************************************************************/
function isAllSettled() {
  for (let r = 0; r < BOARD_ROWS; r++) {
    for (let c = 0; c < BOARD_COLS; c++) {
      const cell = board[r][c];
      if (cell.y !== r * CELL_SIZE) {
        return false;
      }
    }
  }
  return true;
}

/**************************************************************
 * Поиск совпадений (3+ в ряд)
 **************************************************************/
function findMatches() {
  const matched = new Set();

  // Горизонтали
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
  // Вертикали
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

/**************************************************************
 * Удаление совпадений перед стартом (без анимации)
 **************************************************************/
function removeAllMatchesCascade() {
  let again = true;
  while (again) {
    let matched = findMatches();
    if (matched.size === 0) {
      again = false;
    } else {
      // Помечаем пустыми
      matched.forEach(idx => {
        const [rr, cc] = idx.split('-').map(Number);
        board[rr][cc].type = -1;
      });
      // Мгновенное «падение»
      applyGravityInstant();
      // Заполнение пустот
      fillEmptyInstant();
    }
  }
}

/**************************************************************
 * Мгновенное падение (без анимации) — для стартовой подготовки
 **************************************************************/
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

/**************************************************************
 * Мгновенное заполнение пустот (без анимации) — старт
 **************************************************************/
function fillEmptyInstant() {
  for (let r = 0; r < BOARD_ROWS; r++) {
    for (let c = 0; c < BOARD_COLS; c++) {
      if (board[r][c].type < 0) {
        board[r][c].type = Math.floor(Math.random() * ICON_TYPES);
      }
    }
  }
}

/**************************************************************
 * Обработка кликов по canvas
 **************************************************************/
function onCanvasClick(evt) {
  const rect = match3Canvas.getBoundingClientRect();
  const x = evt.clientX - rect.left;
  const y = evt.clientY - rect.top;
  handleClick(x, y);
}

function onTouchStart(evt) {
  const rect = match3Canvas.getBoundingClientRect();
  const touch = evt.touches[0];
  const x = touch.clientX - rect.left;
  const y = touch.clientY - rect.top;
  handleClick(x, y);
}

function handleClick(x, y) {
  if (!isGame2Running) return;
  if (!isAllSettled()) return; // пока падают — не даём ходить

  const col = Math.floor(x / CELL_SIZE);
  const row = Math.floor(y / CELL_SIZE);

  if (!match3Selected) {
    match3Selected = { row, col };
  } else {
    // Проверяем соседние клетки
    const r1 = match3Selected.row, c1 = match3Selected.col;
    if ((Math.abs(r1 - row) === 1 && c1 === col) ||
        (Math.abs(c1 - col) === 1 && r1 === row)) {
      swapAndCheck(r1, c1, row, col);
    }
    match3Selected = null;
  }
}

/**************************************************************
 * SWAP + проверка на совпадения
 **************************************************************/
function swapAndCheck(r1, c1, r2, c2) {
  // Swap
  let temp = board[r1][c1].type;
  board[r1][c1].type = board[r2][c2].type;
  board[r2][c2].type = temp;

  // Проверяем
  let matched = findMatches();
  if (matched.size === 0) {
    // Если нет совпадений, откатываем
    temp = board[r1][c1].type;
    board[r1][c1].type = board[r2][c2].type;
    board[r2][c2].type = temp;
  }
}

/**************************************************************
 * Завершение игры
 **************************************************************/
function endMatch3Game() {
  if (match3TimerId) {
    clearInterval(match3TimerId);
    match3TimerId = null;
  }
  // Добавляем очки к локальным
  localUserData.points += match3Score;

  // Показываем итог (из общего скрипта)
  showEndGameModal('Время вышло!', `Вы заработали ${match3Score} очков!`);
}

/**************************************************************
 * Экспорт (две функции), чтобы вызывались из основного кода:
 *   initGame2()  - запуск игры
 *   resetGame2() - сброс при выходе
 **************************************************************/
