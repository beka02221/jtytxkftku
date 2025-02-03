/***********************************************************
 * game2.js — "3 в ряд" с анимациями и звуками.
 * Работает совместно с исходным HTML (без правок html).
 ***********************************************************/

// Параметры поля
const BOARD_SIZE = 8;
const ICON_TYPES = 5;  // количество видов иконок

// Размеры
const CELL_SIZE = 50;

// Время игры (секунды)
const GAME_TIME = 60;

// Ссылки на неоновые иконки (пример)
const ICON_URLS = [
  'https://img.icons8.com/neon/100/password.png',
  'https://img.icons8.com/neon/100/fingerprint.png',
  'https://img.icons8.com/neon/100/password1.png',
  'https://img.icons8.com/neon/100/warning-shield.png',
  'https://img.icons8.com/neon/100/face-id.png'
];

// ----- Новые переменные для анимаций -----

// Каждая иконка в отрисовке хранит не только тип, но и текущее (x,y), цель (targetX,targetY).
// Это нужно, чтобы плавно двигать их при swap, падении и т.д.
let sprites = []; // двумерный массив тех же размеров, что board, где каждый элемент — объект с полями { type, x, y, targetX, targetY, alpha, removing }
                 // либо null, если клетка пуста

// Флаг, чтобы заблокировать действия пользователя во время анимации
let isAnimating = false;

// Продолжительность анимации в миллисекундах
const SWAP_ANIM_DURATION = 200;  
const REMOVE_ANIM_DURATION = 300;
const FALL_ANIM_DURATION = 300;
const INITIAL_FALL_DURATION = 400;

// Звуки (можно заменить на свои файлы)
const sfxSwapUrl    = 'https://actions.google.com/sounds/v1/cartoon/wood_plank_flicks.ogg';
const sfxMatchUrl   = 'https://actions.google.com/sounds/v1/explosions/medium_explosion.ogg';
const sfxErrorUrl   = 'https://actions.google.com/sounds/v1/cartoon/wood_plank_flicks.ogg';
const sfxFallingUrl = 'https://actions.google.com/sounds/v1/foley/cloth_flap_fast.ogg';

// Создадим объекты Audio
let sfxSwap    = new Audio(sfxSwapUrl);
let sfxMatch   = new Audio(sfxMatchUrl);
let sfxError   = new Audio(sfxErrorUrl);
let sfxFalling = new Audio(sfxFallingUrl);

// Громкость (0.0 — 1.0)
sfxSwap.volume    = 0.4;
sfxMatch.volume   = 0.5;
sfxError.volume   = 0.4;
sfxFalling.volume = 0.3;

// -----------------------------------------

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

// Координаты нажатия мышью (для swipe)
let mouseDownCell = null;

// --------------------------------------------------
// 1. Инициализация игры
// --------------------------------------------------
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

  // Инициируем массив спрайтов (для анимаций) и сделаем эффект «падения сверху»
  initSprites();
  animateInitialFall(() => {
    // После начального падения – можно взаимодействовать
    isAnimating = false;
  });

  // Подключаем события
  match3Canvas.addEventListener('mousedown', onMouseDown);
  match3Canvas.addEventListener('touchstart', onTouchStart, { passive: false });

  // Запуск таймера
  match3TimerId = setInterval(() => {
    timeLeft--;
    if (timeLeft < 0) {
      endMatch3Game();
    } else {
      timeSpan.textContent = `Время: ${timeLeft}s`;
    }
  }, 1000);

  // Запускаем цикл перерисовки (animation loop)
  requestAnimationFrame(animationLoop);
}

function resetGame2() {
  if (match3TimerId) {
    clearInterval(match3TimerId);
    match3TimerId = null;
  }
  isGame2Running = false;

  // Убираем таймер
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

  // Сбрасываем данные
  board = [];
  sprites = [];
  selectedCell = null;
  mouseDownCell = null;
}

// --------------------------------------------------
// 2. Генерация поля (без стартовых «3 в ряд»)
// --------------------------------------------------
function generateBoard() {
  board = [];
  for (let r = 0; r < BOARD_SIZE; r++) {
    board[r] = [];
    for (let c = 0; c < BOARD_SIZE; c++) {
      let icon = randomIcon();
      // Проверяем, чтобы не было стартовых матчей
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

// --------------------------------------------------
// 3. Инициализация «спрайтов» (для анимации)
// --------------------------------------------------
function initSprites() {
  sprites = [];
  for (let r = 0; r < BOARD_SIZE; r++) {
    sprites[r] = [];
    for (let c = 0; c < BOARD_SIZE; c++) {
      const type = board[r][c];
      if (type < 0) {
        sprites[r][c] = null;
      } else {
        // Начнём «выше» экрана для эффекта падения
        const startY = - (Math.random() * 300 + 50); // случайная высота
        sprites[r][c] = {
          type: type,
          x: c * CELL_SIZE,
          y: startY,
          targetX: c * CELL_SIZE,
          targetY: r * CELL_SIZE,
          alpha: 1,          // для анимации исчезания
          removing: false    // флаг, что иконка «взрывается»
        };
      }
    }
  }
  isAnimating = true; // пока идёт падение при старте
}

/** Анимация первоначального падения (все иконки опускаются на свои targetY) */
function animateInitialFall(onComplete) {
  const startTime = performance.now();
  const duration = INITIAL_FALL_DURATION; // мс

  // Опционально – звук
  sfxFalling.currentTime = 0;
  sfxFalling.play().catch(()=>{});

  function step(now) {
    const elapsed = now - startTime;
    const t = Math.min(elapsed / duration, 1);
    for (let r = 0; r < BOARD_SIZE; r++) {
      for (let c = 0; c < BOARD_SIZE; c++) {
        if (sprites[r][c]) {
          // Линейная интерполяция
          const dy = sprites[r][c].targetY - sprites[r][c].y;
          sprites[r][c].y += dy * t; // Под конец анимации иконка будет на targetY
        }
      }
    }
    if (t < 1) {
      requestAnimationFrame(step);
    } else {
      // Убедимся, что каждая иконка встала на место
      for (let rr = 0; rr < BOARD_SIZE; rr++) {
        for (let cc = 0; cc < BOARD_SIZE; cc++) {
          if (sprites[rr][cc]) {
            sprites[rr][cc].y = sprites[rr][cc].targetY;
          }
        }
      }
      if (onComplete) onComplete();
    }
  }
  requestAnimationFrame(step);
}

// --------------------------------------------------
// 4. Цикл анимации (перерисовка)
// --------------------------------------------------
function animationLoop() {
  drawBoard(); // рисуем всё текущее состояние
  requestAnimationFrame(animationLoop);
}

/** Отрисовка поля на canvas */
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

  // Рисуем иконки (с учётом alpha и текущих x,y)
  for (let r = 0; r < BOARD_SIZE; r++) {
    for (let c = 0; c < BOARD_SIZE; c++) {
      const spr = sprites[r][c];
      if (!spr) continue;

      // Если эта клетка выбрана – нарисуем полупрозрачный прямоугольник
      if (selectedCell && selectedCell.row === r && selectedCell.col === c) {
        match3Ctx.fillStyle = 'rgba(255,0,0,0.3)';
        match3Ctx.fillRect(c * CELL_SIZE, r * CELL_SIZE, CELL_SIZE, CELL_SIZE);
      }

      // Рисуем саму иконку
      const img = iconImages[spr.type];
      if (img) {
        match3Ctx.save();
        match3Ctx.globalAlpha = spr.alpha; // для исчезновения
        match3Ctx.drawImage(img, spr.x, spr.y, CELL_SIZE, CELL_SIZE);
        match3Ctx.restore();
      }
    }
  }
}

// --------------------------------------------------
// 5. Логика кликов/тапов + SWAP
// --------------------------------------------------
function onMouseDown(evt) {
  if (!isGame2Running || isAnimating) return; // если идёт анимация, не даём ход
  const rect = match3Canvas.getBoundingClientRect();
  const x = evt.clientX - rect.left;
  const y = evt.clientY - rect.top;

  const col = Math.floor(x / CELL_SIZE);
  const row = Math.floor(y / CELL_SIZE);

  mouseDownCell = { row, col };
  selectedCell  = { row, col };

  // Навешиваем mousemove/up
  document.addEventListener('mousemove', onMouseMove);
  document.addEventListener('mouseup', onMouseUp);
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
      // Горизонтально
      if (dx > 0) targetCol++; else targetCol--;
    } else {
      // Вертикально
      if (dy > 0) targetRow++; else targetRow--;
    }

    // Проверяем, что целевая клетка рядом
    if (isNeighbor(mouseDownCell.row, mouseDownCell.col, targetRow, targetCol)) {
      trySwap(mouseDownCell.row, mouseDownCell.col, targetRow, targetCol);
    }

    mouseDownCell = null;
    selectedCell  = null;
    document.removeEventListener('mousemove', onMouseMove);
    document.removeEventListener('mouseup', onMouseUp);
  }
}

function onMouseUp() {
  mouseDownCell = null;
  selectedCell  = null;
  document.removeEventListener('mousemove', onMouseMove);
  document.removeEventListener('mouseup', onMouseUp);
}

// То же для touch
function onTouchStart(evt) {
  if (!isGame2Running || isAnimating) return;
  evt.preventDefault();

  const rect = match3Canvas.getBoundingClientRect();
  const touch = evt.touches[0];
  const x = touch.clientX - rect.left;
  const y = touch.clientY - rect.top;

  const col = Math.floor(x / CELL_SIZE);
  const row = Math.floor(y / CELL_SIZE);

  mouseDownCell = { row, col };
  selectedCell  = { row, col };

  // Навешиваем «слушатели»
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
    document.removeEventListener('touchmove', onTouchMove);
    document.removeEventListener('touchend', onTouchEnd);
  }
}

function onTouchEnd() {
  mouseDownCell = null;
  selectedCell  = null;
  document.removeEventListener('touchmove', onTouchMove);
  document.removeEventListener('touchend', onTouchEnd);
}

function isNeighbor(r1, c1, r2, c2) {
  return (Math.abs(r1 - r2) === 1 && c1 === c2) ||
         (Math.abs(c1 - c2) === 1 && r1 === r2);
}

// --------------------------------------------------
// 6. Попытка SWAP с анимацией
// --------------------------------------------------
function trySwap(r1, c1, r2, c2) {
  if (isAnimating) return;
  isAnimating = true;

  // Сыграем звук
  sfxSwap.currentTime = 0;
  sfxSwap.play().catch(()=>{});

  // Мгновенно в логике меняем элементы
  swapIcons(r1, c1, r2, c2);

  // Анимируем «обмен местами» в спрайтах
  animateSwap(r1, c1, r2, c2, () => {
    // Когда swap закончен — проверим совпадения
    let hasMatches = checkAllMatches();
    if (!hasMatches) {
      // Нет совпадений – делаем обратный swap
      sfxError.currentTime = 0;
      sfxError.play().catch(()=>{});
      swapIcons(r1, c1, r2, c2);
      animateSwap(r1, c1, r2, c2, () => {
        isAnimating = false;
      });
    } else {
      // Были совпадения, анимации удаления/падения запустятся внутри checkAllMatches
      // и после их завершения isAnimating = false
    }
  });
}

/** Меняем местами в логике board */
function swapIcons(r1, c1, r2, c2) {
  let temp = board[r1][c1];
  board[r1][c1] = board[r2][c2];
  board[r2][c2] = temp;

  // Поменяем и в спрайтах
  let tempSpr = sprites[r1][c1];
  sprites[r1][c1] = sprites[r2][c2];
  sprites[r2][c2] = tempSpr;
}

/** Анимация перестановки */
function animateSwap(r1, c1, r2, c2, onComplete) {
  const spr1 = sprites[r1][c1];
  const spr2 = sprites[r2][c2];
  if (!spr1 || !spr2) {
    // На всякий случай, если пусто
    if (onComplete) onComplete();
    return;
  }
  const startTime = performance.now();
  const duration = SWAP_ANIM_DURATION; // мс

  const startX1 = spr1.x;
  const startY1 = spr1.y;
  const startX2 = spr2.x;
  const startY2 = spr2.y;

  const endX1 = c1 * CELL_SIZE;
  const endY1 = r1 * CELL_SIZE;
  const endX2 = c2 * CELL_SIZE;
  const endY2 = r2 * CELL_SIZE;

  function step(now) {
    const elapsed = now - startTime;
    const t = Math.min(elapsed / duration, 1);

    // Линейная интерполяция
    spr1.x = lerp(startX1, endX2, t);
    spr1.y = lerp(startY1, endY2, t);
    spr2.x = lerp(startX2, endX1, t);
    spr2.y = lerp(startY2, endY1, t);

    if (t < 1) {
      requestAnimationFrame(step);
    } else {
      // Убедимся, что спрайты «встали» точно
      spr1.x = endX2;
      spr1.y = endY2;
      spr2.x = endX1;
      spr2.y = endY1;
      if (onComplete) onComplete();
    }
  }
  requestAnimationFrame(step);
}

function lerp(a, b, t) {
  return a + (b - a) * t;
}

// --------------------------------------------------
// 7. Поиск совпадений, удаление, падение
// --------------------------------------------------
function checkAllMatches() {
  let matches = findMatches();
  if (matches.length === 0) {
    return false;
  }
  // Удаляем
  removeMatches(matches, () => {
    // После удаления делаем «каскады»: падение и заполнение
    applyGravityAnimation(() => {
      fillEmptyAnimation(() => {
        // Снова проверим, вдруг новые совпадения
        let next = findMatches();
        if (next.length > 0) {
          removeMatches(next, () => {
            applyGravityAnimation(() => {
              fillEmptyAnimation(() => {
                // Закончили каскад
                isAnimating = false;
              });
            });
          });
        } else {
          // Больше нет совпадений
          isAnimating = false;
        }
      });
    });
  });
  return true;
}

/** Находит все совпадения (гориз. и вертик.) */
function findMatches() {
  let found = [];

  // Горизонтали
  for (let r = 0; r < BOARD_SIZE; r++) {
    for (let c = 0; c < BOARD_SIZE - 2; c++) {
      let t = board[r][c];
      if (t < 0) continue;
      if (board[r][c+1] === t && board[r][c+2] === t) {
        let length = 3;
        while (c + length < BOARD_SIZE && board[r][c+length] === t) {
          length++;
        }
        for (let i = 0; i < length; i++) {
          found.push({ r, c: c + i });
        }
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
        for (let i = 0; i < length; i++) {
          found.push({ r: r + i, c });
        }
        r += (length - 1);
      }
    }
  }

  return found;
}

/** Удаляем найденные совпадения (анимация «взрыва») */
function removeMatches(cells, onComplete) {
  // Сыграем звук «взрыва»
  sfxMatch.currentTime = 0;
  sfxMatch.play().catch(()=>{});

  // Очки
  match3Score += cells.length * 10;

  // Помечаем в массиве board как -1
  cells.forEach(cell => {
    board[cell.r][cell.c] = -1;
  });

  // Анимация исчезновения (fade out)
  const startTime = performance.now();
  const duration = REMOVE_ANIM_DURATION;

  cells.forEach(cell => {
    if (sprites[cell.r][cell.c]) {
      sprites[cell.r][cell.c].removing = true; // для логики
    }
  });

  function step(now) {
    const elapsed = now - startTime;
    const t = Math.min(elapsed / duration, 1);

    cells.forEach(cell => {
      const spr = sprites[cell.r][cell.c];
      if (spr) {
        spr.alpha = 1 - t; // плавная потеря прозрачности
      }
    });

    if (t < 1) {
      requestAnimationFrame(step);
    } else {
      // Полностью убираем
      cells.forEach(cell => {
        sprites[cell.r][cell.c] = null;
      });
      if (onComplete) onComplete();
    }
  }
  requestAnimationFrame(step);
}

/** Анимация «падения» (gravity) */
function applyGravityAnimation(onComplete) {
  // Сначала логически всё «роняем»
  applyGravity();

  // Теперь у нас в board уже новые позиции.  
  // Нужно анимировать spites так, чтобы они плавно перешли в новые row,col.
  // Для этого создадим массив «целевых координат».
  let moves = [];
  for (let c = 0; c < BOARD_SIZE; c++) {
    for (let r = BOARD_SIZE - 1; r >= 0; r--) {
      if (board[r][c] >= 0) {
        // board[r][c] есть какой-то тип
        // Найдём соответствующий sprite (который остался после удаления),
        // который стоял где-то выше в этой же колонке.
        // Т.е. идём вверх по sprite и ищем, у кого row,col = (старое место).
        // Проще: проверим, если sprites[r][c] уже совпадает, значит он остался на месте.
        const spr = sprites[r][c];
        if (!spr || spr.type !== board[r][c]) {
          // Значит sprite «спустился» сверху
          // Идём вверх, ищем sprite c таким типом, который ещё не учтён
          for (let rr = r - 1; rr >= 0; rr--) {
            if (sprites[rr][c] && sprites[rr][c].type === board[r][c]) {
              moves.push({
                fromR: rr, fromC: c,
                toR: r,   toC: c
              });
              break;
            }
          }
        }
      }
    }
  }

  const startTime = performance.now();
  const duration = FALL_ANIM_DURATION;

  // Звук
  if (moves.length > 0) {
    sfxFalling.currentTime = 0;
    sfxFalling.play().catch(()=>{});
  }

  // Чтобы при анимации не было «дублирования» спрайтов,
  // сразу переставим их в окончательный массив sprites (но с x,y не меняем),
  // а в старых местах обнулим.
  moves.forEach(m => {
    const spr = sprites[m.fromR][m.fromC];
    sprites[m.toR][m.toC] = spr;
    sprites[m.fromR][m.fromC] = null;
  });

  // Теперь у спрайта меняем его targetY
  moves.forEach(m => {
    const spr = sprites[m.toR][m.toC];
    spr.targetX = m.toC * CELL_SIZE;
    spr.targetY = m.toR * CELL_SIZE;
  });

  function step(now) {
    const elapsed = now - startTime;
    const t = Math.min(elapsed / duration, 1);

    moves.forEach(m => {
      const spr = sprites[m.toR][m.toC];
      if (spr) {
        // Линейная интерполяция от старого y к новому
        const oldY = spr.y;
        const goalY = spr.targetY;
        spr.y = lerp(oldY, goalY, 0.2); 
        // Параметр 0.2 — скорость «пружины». Можно усложнить, но для примера хватит.
        // Или можно по классике spr.y = oldY + (goalY - oldY) * t;
      }
    });

    // Проверим, закончили ли мы (примерно)
    let allAtDestination = true;
    moves.forEach(m => {
      const spr = sprites[m.toR][m.toC];
      if (spr && Math.abs(spr.y - spr.targetY) > 2) {
        allAtDestination = false;
      }
    });

    if (!allAtDestination) {
      requestAnimationFrame(step);
    } else {
      // На всякий случай выравниваем
      moves.forEach(m => {
        const spr = sprites[m.toR][m.toC];
        if (spr) {
          spr.y = spr.targetY;
        }
      });
      if (onComplete) onComplete();
    }
  }
  if (moves.length > 0) {
    requestAnimationFrame(step);
  } else {
    // Если ничего не двигается, сразу callback
    onComplete();
  }
}

/** Логика-«роняем» иконки вниз */
function applyGravity() {
  for (let c = 0; c < BOARD_SIZE; c++) {
    for (let r = BOARD_SIZE - 1; r >= 0; r--) {
      if (board[r][c] === -1) {
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

/** Анимация появления новых иконок сверху */
function fillEmptyAnimation(onComplete) {
  // Логически добавляем новые иконки
  let newCells = [];
  for (let r = 0; r < BOARD_SIZE; r++) {
    for (let c = 0; c < BOARD_SIZE; c++) {
      if (board[r][c] === -1) {
        board[r][c] = randomIcon();
        newCells.push({r, c, type: board[r][c]});
      }
    }
  }
  // Спрайты тоже создаём «выше» и двигаем вниз
  newCells.forEach(cell => {
    sprites[cell.r][cell.c] = {
      type: cell.type,
      x: cell.c * CELL_SIZE,
      y: -CELL_SIZE,            // чуть выше
      targetX: cell.c * CELL_SIZE,
      targetY: cell.r * CELL_SIZE,
      alpha: 1,
      removing: false
    };
  });

  if (newCells.length === 0) {
    // Нечего делать
    onComplete();
    return;
  }

  const startTime = performance.now();
  const duration = FALL_ANIM_DURATION;

  // Звук падения
  sfxFalling.currentTime = 0;
  sfxFalling.play().catch(()=>{});

  function step(now) {
    const t = Math.min((now - startTime) / duration, 1);
    newCells.forEach(cell => {
      const spr = sprites[cell.r][cell.c];
      if (spr) {
        spr.y = lerp(-CELL_SIZE, spr.targetY, t);
      }
    });
    if (t < 1) {
      requestAnimationFrame(step);
    } else {
      // Выравниваем
      newCells.forEach(cell => {
        const spr = sprites[cell.r][cell.c];
        spr.y = spr.targetY;
      });
      onComplete();
    }
  }
  requestAnimationFrame(step);
}

// --------------------------------------------------
// 8. Завершение игры
// --------------------------------------------------
function endMatch3Game() {
  if (match3TimerId) {
    clearInterval(match3TimerId);
    match3TimerId = null;
  }
  localUserData.points += match3Score;
  showEndGameModal('Время вышло!', `Вы заработали ${match3Score} очков!`);
}
