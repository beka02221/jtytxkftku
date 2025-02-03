/***********************************************************
 * game2.js — Улучшенная версия "3 в ряд" с анимациями, 
 * подсчётом очков и эффектом "Матрица" при появлении фигурок
 ***********************************************************/

// Параметры поля
const BOARD_SIZE = 8;
const ICON_TYPES = 5;  // количество видов иконок
const CELL_SIZE = 50;  // размер клетки (50px для canvas 400x400)
const GAME_TIME = 60;  // время игры (секунд)

// Звуковые эффекты (URL-ы замените на свои)
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

// Массив для загрузки изображений
let iconImages = [];

// Звуковые объекты
const swapSound      = new Audio(SWAP_SOUND_URL);
const explosionSound = new Audio(EXPLOSION_SOUND_URL);
const attemptSound   = new Audio(ATTEMPT_SOUND_URL);

// Основные переменные
let match3Canvas, match3Ctx;
let isGame2Running = false;
let match3TimerId  = null;
let timeSpan       = null;   // SPAN для отображения оставшегося времени
let timeLeft       = GAME_TIME;
let match3Score    = 0;      // заработанные очки в игре

// Игровое поле: board[row][col] = тип (от 0 до ICON_TYPES-1) или -1 (пустая)
let board = [];

// Для отслеживания выбранной ячейки (при клике/тапе)
let selectedCell = null;

// ******************** Анимационные переменные ********************

// Флаг анимации (в этот момент новые ходы не принимаются)
let animating = false;

// Объект для анимации обмена: { r1, c1, r2, c2, startTime, duration, reversing }
let currentSwapAnimation = null;

// Анимации исчезновения (fade-out) – массив объектов { r, c, startTime, duration }
let fadeAnimations = [];

// Анимации падения (gravity) – массив объектов { r, c, startY, endY, startTime, duration, currentOffset }
let gravityAnimations = [];

// Для начальной анимации появления – для каждой клетки её вертикальный отступ
let pieceInitialOffsets = []; // двумеричный массив BOARD_SIZE x BOARD_SIZE
// Параметры начального падения: { startTime, duration }
let initialFall = null;

// ******************** Функция обновления счёта в шапке ********************
function updateScoreDisplay() {
  // Отображаем сумму базовых очков и заработанных в игре
  document.getElementById('pointCount').textContent = localUserData.points + match3Score;
}

// ******************** Инициализация и сброс ********************
function initGame2() {
  if (isGame2Running) return;
  isGame2Running = true;
  match3Score = 0;
  timeLeft = GAME_TIME;
  
  match3Canvas = document.getElementById('match3Canvas');
  match3Ctx = match3Canvas.getContext('2d');

  // Загружаем изображения (однократно)
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

  // Генерируем поле без стартовых совпадений
  generateBoard();

  // Инициализируем начальные отступы для анимации появления (эффект "Матрица")
  pieceInitialOffsets = [];
  for (let r = 0; r < BOARD_SIZE; r++) {
    pieceInitialOffsets[r] = [];
    for (let c = 0; c < BOARD_SIZE; c++) {
      // Случайное значение от -100 до -500
      pieceInitialOffsets[r][c] = -(Math.random() * 400 + 100);
    }
  }
  // Анимация появления длится 1000 мс
  initialFall = { startTime: performance.now(), duration: 1000 };

  // Рисуем начальное поле с учётом анимации
  drawBoard();

  // Запускаем анимационный цикл
  animating = true;
  requestAnimationFrame(animationLoop);

  // Подключаем события (если анимация не идёт, ходы принимаются)
  match3Canvas.addEventListener('mousedown', onMouseDown);
  match3Canvas.addEventListener('touchstart', onTouchStart, { passive: false });

  // Запуск игрового таймера (каждую секунду обновляем оставшееся время)
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
  if (timeSpan && timeSpan.parentNode) {
    timeSpan.parentNode.removeChild(timeSpan);
  }
  timeSpan = null;
  if (match3Canvas) {
    match3Canvas.removeEventListener('mousedown', onMouseDown);
    match3Canvas.removeEventListener('touchstart', onTouchStart);
  }
  if (match3Ctx) {
    match3Ctx.clearRect(0, 0, match3Canvas.width, match3Canvas.height);
  }
  board = [];
  selectedCell = null;
  animating = false;
  currentSwapAnimation = null;
  fadeAnimations = [];
  gravityAnimations = [];
  pieceInitialOffsets = [];
  initialFall = null;
}

// ******************** Генерация игрового поля ********************
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

// ******************** Основной анимационный цикл ********************
function animationLoop(currentTime) {
  let stillAnimating = false;

  // 1. Анимация начального падения фигурок
  if (initialFall) {
    const progress = Math.min((currentTime - initialFall.startTime) / initialFall.duration, 1);
    // Для каждой фигурки плавно уменьшаем отступ до 0
    for (let r = 0; r < BOARD_SIZE; r++) {
      for (let c = 0; c < BOARD_SIZE; c++) {
        // Интерполируем от исходного отрицательного offset до 0
        pieceInitialOffsets[r][c] = (1 - progress) * pieceInitialOffsets[r][c];
      }
    }
    if (progress < 1) {
      stillAnimating = true;
    } else {
      initialFall = null;
      // Гарантируем, что все отступы равны 0
      for (let r = 0; r < BOARD_SIZE; r++) {
        for (let c = 0; c < BOARD_SIZE; c++) {
          pieceInitialOffsets[r][c] = 0;
        }
      }
    }
  }

  // 2. Анимация обмена (swap)
  if (currentSwapAnimation) {
    const anim = currentSwapAnimation;
    const progress = Math.min((currentTime - anim.startTime) / anim.duration, 1);
    if (progress < 1) {
      stillAnimating = true;
    } else {
      if (!anim.reversing) {
        // Завершаем обмен: меняем значения в массиве
        swapIcons(anim.r1, anim.c1, anim.r2, anim.c2);
        // После обмена пытаемся обработать совпадения
        if (processMatches()) {
          currentSwapAnimation = null;
        } else {
          // Если совпадений нет – проигрываем звук неудачи и запускаем обратный обмен
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
        // Обратный обмен завершён – возвращаем исходное положение
        swapIcons(anim.r1, anim.c1, anim.r2, anim.c2);
        currentSwapAnimation = null;
      }
    }
  }

  // 3. Анимация исчезновения совпавших фигур (fade-out)
  for (let i = fadeAnimations.length - 1; i >= 0; i--) {
    const fade = fadeAnimations[i];
    const progress = (currentTime - fade.startTime) / fade.duration;
    if (progress >= 1) {
      // После завершения анимации убираем фигурку
      board[fade.r][fade.c] = -1;
      fadeAnimations.splice(i, 1);
    } else {
      stillAnimating = true;
    }
  }

  // 4. Анимация падения фигур (gravity)
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

  // Перерисовываем поле с учётом всех анимаций
  drawBoard();

  if (stillAnimating) {
    requestAnimationFrame(animationLoop);
  } else {
    animating = false;
    // Если анимаций обмена, исчезновения и падения не осталось – проверяем новые совпадения (каскады)
    if (!currentSwapAnimation && fadeAnimations.length === 0 && gravityAnimations.length === 0) {
      if (processMatches()) {
        animating = true;
        requestAnimationFrame(animationLoop);
      }
    }
  }
}

// ******************** Отрисовка доски ********************
function drawBoard() {
  match3Ctx.clearRect(0, 0, match3Canvas.width, match3Canvas.height);

  // Фон
  match3Ctx.fillStyle = '#000000';
  match3Ctx.fillRect(0, 0, match3Canvas.width, match3Canvas.height);

  // Сетка
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

  // Рисуем фигурки
  for (let r = 0; r < BOARD_SIZE; r++) {
    for (let c = 0; c < BOARD_SIZE; c++) {
      const type = board[r][c];
      if (type < 0) continue; // если клетка пуста, пропускаем

      // Если клетка выбрана – выделяем её
      if (selectedCell && selectedCell.row === r && selectedCell.col === c) {
        match3Ctx.fillStyle = 'rgba(255,0,0,0.3)';
        match3Ctx.fillRect(c * CELL_SIZE, r * CELL_SIZE, CELL_SIZE, CELL_SIZE);
      }

      // Вычисляем дополнительный сдвиг по Y:
      let offsetY = 0;
      if (pieceInitialOffsets[r] && typeof pieceInitialOffsets[r][c] === 'number') {
        offsetY += pieceInitialOffsets[r][c];
      }
      // Если для этой клетки идёт анимация падения – прибавляем текущий offset
      const grav = gravityAnimations.find(g => g.r === r && g.c === c);
      if (grav) {
        offsetY += grav.currentOffset || 0;
      }

      // Если клетка участвует в swap-анимации, корректируем её положение
      let drawX = c * CELL_SIZE;
      let drawY = r * CELL_SIZE + offsetY;
      if (currentSwapAnimation) {
        const anim = currentSwapAnimation;
        if ((anim.r1 === r && anim.c1 === c) || (anim.r2 === r && anim.c2 === c)) {
          const progress = Math.min((performance.now() - anim.startTime) / anim.duration, 1);
          let dr = anim.r2 - anim.r1;
          let dc = anim.c2 - anim.c1;
          if (anim.r1 === r && anim.c1 === c) {
            drawX = (anim.c1 * CELL_SIZE) + dc * CELL_SIZE * (anim.reversing ? (1 - progress) : progress);
            drawY = (anim.r1 * CELL_SIZE) + dr * CELL_SIZE * (anim.reversing ? (1 - progress) : progress);
          } else {
            drawX = (anim.c2 * CELL_SIZE) - dc * CELL_SIZE * (anim.reversing ? (1 - progress) : progress);
            drawY = (anim.r2 * CELL_SIZE) - dr * CELL_SIZE * (anim.reversing ? (1 - progress) : progress);
          }
        }
      }

      // Если к клетке применяется fade-анимация – устанавливаем прозрачность
      let alpha = 1;
      const fade = fadeAnimations.find(f => f.r === r && f.c === c);
      if (fade) {
        const progress = (performance.now() - fade.startTime) / fade.duration;
        alpha = Math.max(1 - progress, 0);
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

// ******************** Логика кликов/тапов и обмена ********************
let mouseDownCell = null;
function onMouseDown(evt) {
  if (!isGame2Running || animating) return;
  const rect = match3Canvas.getBoundingClientRect();
  const x = evt.clientX - rect.left;
  const y = evt.clientY - rect.top;
  const col = Math.floor(x / CELL_SIZE);
  const row = Math.floor(y / CELL_SIZE);
  mouseDownCell = { row, col };
  selectedCell = { row, col };
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
  if (Math.abs(dx) > CELL_SIZE / 2 || Math.abs(dy) > CELL_SIZE / 2) {
    let targetRow = mouseDownCell.row;
    let targetCol = mouseDownCell.col;
    if (Math.abs(dx) > Math.abs(dy)) {
      targetCol += (dx > 0 ? 1 : -1);
    } else {
      targetRow += (dy > 0 ? 1 : -1);
    }
    if (isNeighbor(mouseDownCell.row, mouseDownCell.col, targetRow, targetCol)) {
      trySwap(mouseDownCell.row, mouseDownCell.col, targetRow, targetCol);
    }
    mouseDownCell = null;
    selectedCell = null;
    drawBoard();
    document.removeEventListener('mousemove', onMouseMove);
    document.removeEventListener('mouseup', onMouseUp);
  }
}

function onMouseUp() {
  mouseDownCell = null;
  selectedCell = null;
  document.removeEventListener('mousemove', onMouseMove);
  document.removeEventListener('mouseup', onMouseUp);
  drawBoard();
}

function onTouchStart(evt) {
  if (!isGame2Running || animating) return;
  evt.preventDefault();
  const rect = match3Canvas.getBoundingClientRect();
  const touch = evt.touches[0];
  const x = touch.clientX - rect.left;
  const y = touch.clientY - rect.top;
  const col = Math.floor(x / CELL_SIZE);
  const row = Math.floor(y / CELL_SIZE);
  mouseDownCell = { row, col };
  selectedCell = { row, col };
  drawBoard();
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
      targetCol += (dx > 0 ? 1 : -1);
    } else {
      targetRow += (dy > 0 ? 1 : -1);
    }
    if (isNeighbor(mouseDownCell.row, mouseDownCell.col, targetRow, targetCol)) {
      trySwap(mouseDownCell.row, mouseDownCell.col, targetRow, targetCol);
    }
    mouseDownCell = null;
    selectedCell = null;
    drawBoard();
    document.removeEventListener('touchmove', onTouchMove);
    document.removeEventListener('touchend', onTouchEnd);
  }
}

function onTouchEnd() {
  mouseDownCell = null;
  selectedCell = null;
  document.removeEventListener('touchmove', onTouchMove);
  document.removeEventListener('touchend', onTouchEnd);
  drawBoard();
}

function isNeighbor(r1, c1, r2, c2) {
  return (Math.abs(r1 - r2) === 1 && c1 === c2) ||
         (Math.abs(c1 - c2) === 1 && r1 === r2);
}

// Попытка обмена с анимацией
function trySwap(r1, c1, r2, c2) {
  if (animating) return;
  swapSound.play();
  currentSwapAnimation = {
    r1, c1, r2, c2,
    startTime: performance.now(),
    duration: 200,
    reversing: false
  };
  animating = true;
  requestAnimationFrame(animationLoop);
}

// Меняем местами значения в массиве board
function swapIcons(r1, c1, r2, c2) {
  let temp = board[r1][c1];
  board[r1][c1] = board[r2][c2];
  board[r2][c2] = temp;
}

// ******************** Поиск совпадений и обработка очков ********************

// Функция поиска групп совпадений. Сканируем горизонтально и вертикально и возвращаем массив объектов:
// { cells: [ {r, c}, ... ], orientation: 'horizontal' или 'vertical' }
function findMatches() {
  let groups = [];
  // По горизонтали
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
          cells: Array.from({ length: length }, (_, i) => ({ r, c: start + i })),
          orientation: 'horizontal'
        });
      }
    }
  }
  // По вертикали
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
          cells: Array.from({ length: length }, (_, i) => ({ r: start + i, c })),
          orientation: 'vertical'
        });
      }
    }
  }
  return groups;
}

// Функция, которая обрабатывает найденные совпадения: начисляет очки, запускает анимацию исчезновения и потом гравитацию.
// Возвращает true, если были найдены совпадения.
function processMatches() {
  let groups = findMatches();
  if (groups.length === 0) return false;
  // Для каждой группы начисляем очки по схеме: каждые 3 подряд дают 5 очков
  groups.forEach(group => {
    match3Score += Math.floor(group.cells.length / 3) * 5;
  });
  updateScoreDisplay();
  // Собираем уникальные клетки для исчезновения
  const uniqueCells = {};
  groups.forEach(group => {
    group.cells.forEach(cell => {
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
  // По окончании исчезновения запускаем анимацию гравитации
  setTimeout(() => {
    animateGravity();
  }, 210);
  animating = true;
  requestAnimationFrame(animationLoop);
  return true;
}

// ******************** Анимация падения фигур (gravity) ********************
function animateGravity() {
  // Проходим по каждой колонке снизу вверх: если клетка пуста (-1), ищем сверху ближайшую непустую
  for (let c = 0; c < BOARD_SIZE; c++) {
    for (let r = BOARD_SIZE - 1; r >= 0; r--) {
      if (board[r][c] === -1) {
        for (let rr = r - 1; rr >= 0; rr--) {
          if (board[rr][c] !== -1) {
            // Запускаем анимацию падения для перемещения фигурки из (rr, c) в (r, c)
            gravityAnimations.push({
              r: r, c: c,
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
  // Заполняем оставшиеся пустые клетки новыми фигурками с анимацией появления сверху
  for (let c = 0; c < BOARD_SIZE; c++) {
    for (let r = 0; r < BOARD_SIZE; r++) {
      if (board[r][c] === -1) {
        board[r][c] = randomIcon();
        gravityAnimations.push({
          r: r, c: c,
          startY: -CELL_SIZE * (Math.random() * 2 + 1),
          endY: 0,
          startTime: performance.now(),
          duration: 300
        });
      }
    }
  }
  animating = true;
  requestAnimationFrame(animationLoop);
}

// ******************** Завершение игры ********************
function endMatch3Game() {
  if (match3TimerId) {
    clearInterval(match3TimerId);
    match3TimerId = null;
  }
  // При окончании игры начисляем заработанные очки к базовому счёту и обновляем базу данных
  localUserData.points += match3Score;
  updateScoreDisplay();
  showEndGameModal('Время вышло!', `Вы заработали ${match3Score} очков!`);
}

