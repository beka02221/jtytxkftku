/***********************************************************
 * game2.js — «3 в ряд» (match-3) с простыми анимациями
 ***********************************************************/

// Настройки
const BOARD_ROWS = 8;
const BOARD_COLS = 8;
const ICON_TYPES = 5;
const CELL_SIZE = 50;    // Размер ячейки (если canvas 400x400, то 50)

// Ссылки на иконки
const ICON_URLS = [
  'https://img.icons8.com/ios/50/lock.png',               
  'https://img.icons8.com/ios/50/error--v1.png',          
  'https://img.icons8.com/fluency-systems-regular/50/fraud.png',        
  'https://img.icons8.com/fluency-systems-regular/50/key-security--v1.png', 
  'https://img.icons8.com/fluency-systems-regular/50/user-credentials.png'
];

// Длительность «взрыва» (ms)
const EXPLOSION_DURATION = 300;
// Скорость падения (пикселей в секунду)
const FALL_SPEED = 300;
// Время игры (секунды)
const GAME_TIME = 60;

let match3Canvas, match3Ctx;
let iconImages = [];
let isGame2Running = false;
let match3TimerId = null;
let timeSpan = null;   // DOM-элемент для отображения времени (добавляем в шапку)
let timeLeft = GAME_TIME;
let match3Score = 0;

// Структура для каждой ячейки
// board[r][c] = {
//   type: <0..ICON_TYPES-1> или -1 (если пусто),
//   x:   текущая координата X (для анимации),
//   y:   текущая координата Y (для анимации),
//   explosionTime: timestamp начала взрыва (если удаляется)
// }
let board = [];
let match3Selected = null; // {row, col}

let lastTimestamp = 0; // для rAF-цикла

/**
 * Инициализация игры
 */
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

  // Создаем метку для времени
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

  // Убираем возможные стартовые совпадения
  removeAllMatchesCascade();

  // Подключаем события для кликов/тач
  match3Canvas.addEventListener('mousedown', onCanvasClick);
  match3Canvas.addEventListener('touchstart', onTouchStart);

  // Запуск таймера на секунды
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

/**
 * Сброс игры (вызывается при выходе из игры)
 */
function resetGame2() {
  if (match3TimerId) {
    clearInterval(match3TimerId);
    match3TimerId = null;
  }
  isGame2Running = false;

  // Удаляем timeSpan из шапки
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

/********************************************************
 * Генерация начального поля
 ********************************************************/
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

/********************************************************
 * Анимационный цикл
 ********************************************************/
function animationLoop(timestamp) {
  if (!isGame2Running) return; // если игра остановилась

  let dt = (timestamp - lastTimestamp) / 1000; // секунды
  lastTimestamp = timestamp;

  update(dt);
  draw();

  requestAnimationFrame(animationLoop);
}

/**
 * Логика обновления
 */
function update(dt) {
  // 1) Обновляем анимацию «взрывов» (если explosionTime != null)
  //    Если прошло > EXPLOSION_DURATION, удаляем ячейку (type=-1)
  for (let r = 0; r < BOARD_ROWS; r++) {
    for (let c = 0; c < BOARD_COLS; c++) {
      const cell = board[r][c];
      if (cell.explosionTime !== null) {
        const elapsed = performance.now() - cell.explosionTime;
        if (elapsed > EXPLOSION_DURATION) {
          // Считаем ячейку пустой
          cell.type = -1;
          cell.explosionTime = null;
        }
      }
    }
  }

  // 2) Плавное падение (если ниже пусто)
  //    Считаем, что клетки падают вниз (row+1) если там type=-1
  //    Меняем row в board, но с анимацией x,y
  for (let r = BOARD_ROWS - 2; r >= 0; r--) {
    for (let c = 0; c < BOARD_COLS; c++) {
      const cell = board[r][c];
      if (cell.type < 0) continue; // пустая — нечего падать

      // Пробуем упасть вниз, пока можем
      let nr = r;
      while (nr + 1 < BOARD_ROWS && board[nr+1][c].type === -1) {
        nr++;
      }
      if (nr !== r) {
        // «Опускаем» запись в массиве
        const downCell = board[nr][c];
        // Меняем свойства
        downCell.type = cell.type;
        downCell.x = cell.x;
        downCell.y = cell.y;
        downCell.explosionTime = cell.explosionTime;
        // Очищаем старую
        cell.type = -1;
        cell.explosionTime = null;
      }
    }
  }

  // Обновляем фактические координаты (x, y) — плавно двигаем к row*CELL_SIZE
  for (let r = 0; r < BOARD_ROWS; r++) {
    for (let c = 0; c < BOARD_COLS; c++) {
      const cell = board[r][c];
      const targetY = r * CELL_SIZE;
      // Двигаем вниз, если cell.y < targetY
      if (cell.y < targetY) {
        cell.y += FALL_SPEED * dt;
        if (cell.y > targetY) {
          cell.y = targetY;
        }
      }
    }
  }

  // 3) Заполняем пустоты новыми
  for (let r = 0; r < BOARD_ROWS; r++) {
    for (let c = 0; c < BOARD_COLS; c++) {
      if (board[r][c].type < 0) {
        board[r][c].type = Math.floor(Math.random() * ICON_TYPES);
        board[r][c].explosionTime = null;
        // Появляется за пределами сверху (для анимации падения)
        board[r][c].y = -CELL_SIZE;
      }
    }
  }

  // 4) Проверяем, есть ли стабильные матчи (после окончания падения)
  //    Чтобы не удалять во время анимации, убедимся, что все ячейки на месте
  if (isAllSettled()) {
    // Проверяем матчи
    let matched = findMatches();
    if (matched.size > 0) {
      // Запускаем взрывы
      matched.forEach(idx => {
        const [rr, cc] = idx.split('-').map(Number);
        board[rr][cc].explosionTime = performance.now();
      });
      // Начисляем очки (в коде — по кол-ву ячеек x 10)
      match3Score += matched.size * 10;
      // Но не обновляем top-bar, поскольку там отображается "points" (сумма)
      // Запишем только после окончания партии (endMatch3Game).
    }
  }
}

/**
 * Рисование
 */
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

  // Рисуем элементы
  for (let r = 0; r < BOARD_ROWS; r++) {
    for (let c = 0; c < BOARD_COLS; c++) {
      const cell = board[r][c];
      if (cell.type < 0) continue; // пустая

      // Если ячейка выделена, зальём красным подложку
      if (match3Selected && match3Selected.row === r && match3Selected.col === c) {
        match3Ctx.fillStyle = 'rgba(255,0,0,0.2)';
        match3Ctx.fillRect(c*CELL_SIZE, r*CELL_SIZE, CELL_SIZE, CELL_SIZE);
      }

      const img = iconImages[cell.type];
      if (img) {
        // Анимация «взрыва» (мигание / масштаб)
        let scale = 1.0;
        if (cell.explosionTime !== null) {
          const elapsed = performance.now() - cell.explosionTime;
          let fraction = elapsed / EXPLOSION_DURATION; // от 0 до 1
          if (fraction > 1) fraction = 1;
          // Пусть scale растет от 1 до 1.5
          scale = 1 + 0.5 * fraction;
          // Также можно сделать мерцание прозрачности
          // match3Ctx.globalAlpha = 1 - fraction;
        }

        const drawSize = CELL_SIZE * scale;
        const dx = cell.x + (CELL_SIZE - drawSize)/2;
        const dy = cell.y + (CELL_SIZE - drawSize)/2;

        match3Ctx.drawImage(img, dx, dy, drawSize, drawSize);

        // match3Ctx.globalAlpha = 1.0; // восстанавливаем
      }
    }
  }
}

/********************************************************
 * Проверка, что все ячейки «устаканились» (не падают)
 ********************************************************/
function isAllSettled() {
  for (let r = 0; r < BOARD_ROWS; r++) {
    for (let c = 0; c < BOARD_COLS; c++) {
      const cell = board[r][c];
      // Если y != row*CELL_SIZE, значит ещё двигается
      if (cell.y !== r * CELL_SIZE) {
        return false;
      }
    }
  }
  return true;
}

/********************************************************
 * Поиск совпадений (3+)
 ********************************************************/
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

/********************************************************
 * Удаление всех совпадений (без анимации) — для старта
 ********************************************************/
function removeAllMatchesCascade() {
  let again = true;
  while (again) {
    let matched = findMatches();
    if (matched.size === 0) {
      again = false;
    } else {
      // Ставим -1
      matched.forEach(idx => {
        const [r, c] = idx.split('-').map(Number);
        board[r][c].type = -1;
      });
      // "Падение"
      applyGravityInstant();
      // Заполняем пустоты
      fillEmptyInstant();
    }
  }
}

/**
 * Мгновенное падение (без анимации, для стартовой генерации)
 */
function applyGravityInstant() {
  for (let c = 0; c < BOARD_COLS; c++) {
    for (let r = BOARD_ROWS - 1; r >= 0; r--) {
      if (board[r][c].type < 0) {
        // Ищем сверху ближайшую непустую
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

/**
 * Мгновенное заполнение пустот (для стартовой генерации)
 */
function fillEmptyInstant() {
  for (let r = 0; r < BOARD_ROWS; r++) {
    for (let c = 0; c < BOARD_COLS; c++) {
      if (board[r][c].type < 0) {
        board[r][c].type = Math.floor(Math.random() * ICON_TYPES);
      }
    }
  }
}

/********************************************************
 * Обработка кликов
 ********************************************************/
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
  if (!isAllSettled()) return; // пока анимация падения — не даём ходить

  const col = Math.floor(x / CELL_SIZE);
  const row = Math.floor(y / CELL_SIZE);

  if (!match3Selected) {
    match3Selected = { row, col };
  } else {
    // Проверка на соседство
    const r1 = match3Selected.row, c1 = match3Selected.col;
    if ((Math.abs(r1 - row) === 1 && c1 === col) ||
        (Math.abs(c1 - col) === 1 && r1 === row)) {
      swapAndCheck(r1, c1, row, col);
    }
    match3Selected = null;
  }
}

/********************************************************
 * Swap + проверка совпадений
 ********************************************************/
function swapAndCheck(r1, c1, r2, c2) {
  // Мгновенный swap в board
  let tmp = board[r1][c1].type;
  board[r1][c1].type = board[r2][c2].type;
  board[r2][c2].type = tmp;

  // Проверка
  let matched = findMatches();
  if (matched.size === 0) {
    // откатываем
    tmp = board[r1][c1].type;
    board[r1][c1].type = board[r2][c2].type;
    board[r2][c2].type = tmp;
  } else {
    // Есть совпадения — запустится анимация взрывов/падения в update()
  }
}

/********************************************************
 * Окончание игры
 ********************************************************/
function endMatch3Game() {
  if (match3TimerId) {
    clearInterval(match3TimerId);
    match3TimerId = null;
  }
  // Добавляем match3Score к локальным очкам
  localUserData.points += match3Score;

  // Показываем итоговое окно (из основного скрипта)
  showEndGameModal(
    'Время вышло!',
    `Вы заработали ${match3Score} очков!`
  );
}

/********************************************************
 * Экспортируем только две функции:
 *   initGame2() и resetGame2()
 ********************************************************/
