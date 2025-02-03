/***********************************************************
 * game2.js — Улучшенная версия "3 в ряд" с анимациями и звуками
 ***********************************************************/

// Параметры поля
const BOARD_SIZE = 8;
const ICON_TYPES = 5;  // количество видов иконок
const CELL_SIZE = 50;  // размер клетки (50px для 400x400 canvas)
const GAME_TIME = 60;  // время игры (секунд)

// Звуковые эффекты (URL-ы замените на подходящие файлы)
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
let match3Score    = 0;

// Игровое поле: board[row][col] = тип от 0 до ICON_TYPES-1, либо -1 (пусто)
let board = [];

// Для отслеживания выбранной ячейки (при клике/тапе)
let selectedCell = null; // {row, col}

// ******************** Анимационные переменные ********************

// Флаг анимации (не принимаем новые ходы, пока идёт анимация)
let animating = false;

// Для анимации обмена: объект { r1, c1, r2, c2, startTime, duration, reversing }
let currentSwapAnimation = null;

// Для анимации исчезновения (fade-out) совпадающих клеток
// Массив объектов { r, c, startTime, duration }
let fadeAnimations = [];

// Для анимации падения (гравитации) – для уже существующих и новых фигур
// Массив объектов { r, c, startY, endY, startTime, duration }
let gravityAnimations = [];

// Для начальной анимации «падения» фигурок (начальное появление)
// Для каждой клетки хранится изначальный вертикальный отступ (отрицательное значение)
let pieceInitialOffsets = []; // двумерный массив, размер BOARD_SIZE x BOARD_SIZE
let initialFall = null;       // объект { startTime, duration } для начального падения

// ******************** Инициализация и сброс ********************
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

  // Инициализируем массив pieceInitialOffsets для анимации начального падения
  pieceInitialOffsets = [];
  for (let r = 0; r < BOARD_SIZE; r++) {
    pieceInitialOffsets[r] = [];
    for (let c = 0; c < BOARD_SIZE; c++) {
      // Каждая фигурка начинает с произвольного отступа сверху (от -200 до -100)
      pieceInitialOffsets[r][c] = -(Math.random() * 100 + 100);
    }
  }
  // Устанавливаем параметры начального падения (duration – 800 мс)
  initialFall = { startTime: performance.now(), duration: 800 };

  // Рисуем начальное поле (с учётом анимации)
  drawBoard();

  // Запускаем анимационный цикл
  animating = true;
  requestAnimationFrame(animationLoop);

  // Подключаем события (если анимаций нет, новые ходы принимаются)
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

  // Сброс анимационных переменных
  animating = false;
  currentSwapAnimation = null;
  fadeAnimations = [];
  gravityAnimations = [];
  pieceInitialOffsets = [];
  initialFall = null;
}

// ******************** Генерация поля ********************
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

// ******************** Основной анимационный цикл ********************
function animationLoop(currentTime) {
  let stillAnimating = false;

  // 1. Обновление начального падения (initialFall)
  if (initialFall) {
    const progress = Math.min((currentTime - initialFall.startTime) / initialFall.duration, 1);
    // Для каждой фигурки обновляем отступ: от начального значения до 0
    for (let r = 0; r < BOARD_SIZE; r++) {
      for (let c = 0; c < BOARD_SIZE; c++) {
        pieceInitialOffsets[r][c] = pieceInitialOffsets[r][c] * (1 - progress);
      }
    }
    if (progress < 1) {
      stillAnimating = true;
    } else {
      initialFall = null;
      // Гарантируем, что все offset равны 0
      for (let r = 0; r < BOARD_SIZE; r++) {
        for (let c = 0; c < BOARD_SIZE; c++) {
          pieceInitialOffsets[r][c] = 0;
        }
      }
    }
  }

  // 2. Обновление анимации обмена (swap)
  if (currentSwapAnimation) {
    const anim = currentSwapAnimation;
    const progress = Math.min((currentTime - anim.startTime) / anim.duration, 1);
    if (progress < 1) {
      stillAnimating = true;
    } else {
      // Если обмен завершён – если ещё не перевёрнули обратно
      if (!anim.reversing) {
        // Выполняем обмен в массиве board
        swapIcons(anim.r1, anim.c1, anim.r2, anim.c2);
        // Проверяем совпадения
        if (findMatches().length > 0) {
          // Если совпадения есть, запускаем анимацию исчезновения
          animateMatches(findMatches());
          // Сбрасываем swap-анимацию
          currentSwapAnimation = null;
        } else {
          // Если совпадений нет, проигрываем звук неудачной попытки и запускаем обратный обмен
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

  // 3. Обновление анимаций исчезновения (fade-out)
  for (let i = fadeAnimations.length - 1; i >= 0; i--) {
    const fade = fadeAnimations[i];
    const progress = (currentTime - fade.startTime) / fade.duration;
    if (progress >= 1) {
      // Закончили исчезать – убираем фигурку
      board[fade.r][fade.c] = -1;
      fadeAnimations.splice(i, 1);
    } else {
      stillAnimating = true;
    }
  }

  // 4. Обновление анимаций падения (gravity)
  for (let i = gravityAnimations.length - 1; i >= 0; i--) {
    const grav = gravityAnimations[i];
    const progress = Math.min((currentTime - grav.startTime) / grav.duration, 1);
    grav.currentOffset = (1 - progress) * (grav.startY - grav.endY);
    if (progress < 1) {
      stillAnimating = true;
    } else {
      // По завершении – обновляем board: перемещаем фигурку в нужную ячейку
      // (Уже выполнено в animateGravity, поэтому просто убираем анимацию)
      gravityAnimations.splice(i, 1);
    }
  }

  // Перерисовываем доску с учетом анимаций
  drawBoard();

  if (stillAnimating) {
    requestAnimationFrame(animationLoop);
  } else {
    animating = false;
    // После завершения падения – проверяем каскады совпадений
    if (!currentSwapAnimation && fadeAnimations.length === 0 && gravityAnimations.length === 0) {
      const moreMatches = findMatches();
      if (moreMatches.length > 0) {
        animateMatches(moreMatches);
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

  // Рисуем иконки
  for (let r = 0; r < BOARD_SIZE; r++) {
    for (let c = 0; c < BOARD_SIZE; c++) {
      const type = board[r][c];
      if (type < 0) continue; // пустая клетка

      // Если клетка выбрана – выделяем
      if (selectedCell && selectedCell.row === r && selectedCell.col === c) {
        match3Ctx.fillStyle = 'rgba(255,0,0,0.3)';
        match3Ctx.fillRect(c * CELL_SIZE, r * CELL_SIZE, CELL_SIZE, CELL_SIZE);
      }

      // Определяем дополнительные смещения по Y: начальное падение и (падение по гравитации)
      let offsetY = 0;
      if (pieceInitialOffsets[r] && typeof pieceInitialOffsets[r][c] === 'number') {
        offsetY += pieceInitialOffsets[r][c];
      }
      // Если для данной ячейки запущена анимация гравитации – добавляем текущий offset
      const grav = gravityAnimations.find(g => g.r === r && g.c === c);
      if (grav) {
        offsetY += grav.currentOffset || 0;
      }

      // Если эта клетка участвует в swap-анимации, вычисляем её позицию
      let drawX = c * CELL_SIZE;
      let drawY = r * CELL_SIZE + offsetY;
      if (currentSwapAnimation) {
        const anim = currentSwapAnimation;
        // Если эта клетка – одна из обмениваемых
        if ((anim.r1 === r && anim.c1 === c) || (anim.r2 === r && anim.c2 === c)) {
          const progress = Math.min((performance.now() - anim.startTime) / anim.duration, 1);
          let dr = anim.r2 - anim.r1;
          let dc = anim.c2 - anim.c1;
          if (anim.reversing) progress; // при обратном обмене используем ту же логику
          if (anim.r1 === r && anim.c1 === c) {
            drawX = (anim.c1 * CELL_SIZE) + dc * CELL_SIZE * (anim.reversing ? (1 - progress) : progress);
            drawY = (anim.r1 * CELL_SIZE) + dr * CELL_SIZE * (anim.reversing ? (1 - progress) : progress);
          } else {
            drawX = (anim.c2 * CELL_SIZE) - dc * CELL_SIZE * (anim.reversing ? (1 - progress) : progress);
            drawY = (anim.r2 * CELL_SIZE) - dr * CELL_SIZE * (anim.reversing ? (1 - progress) : progress);
          }
        }
      }

      // Если к данной клетке применяется fade-анимация, устанавливаем прозрачность
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
      match3Ctx.globalAlpha = 1; // сбрасываем
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
  selectedCell  = { row, col };

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
  selectedCell  = null;
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
  selectedCell  = { row, col };
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
  selectedCell  = null;
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
  if (animating) return; // не допускаем, если идёт другая анимация
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

// Обмен значениями в массиве board
function swapIcons(r1, c1, r2, c2) {
  let temp = board[r1][c1];
  board[r1][c1] = board[r2][c2];
  board[r2][c2] = temp;
}

// ******************** Поиск совпадений и анимация удаления ********************

// Находит все совпадения (возвращает массив объектов клеток)
function findMatches() {
  let found = [];

  // По горизонтали
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

  // По вертикали
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

// Запускает анимацию исчезновения совпавших фигурок
function animateMatches(matches) {
  // Проигрываем звук взрыва
  explosionSound.play();
  // Для каждой найденной клетки добавляем fade-анимацию (200 мс)
  matches.forEach(cell => {
    fadeAnimations.push({
      r: cell.r,
      c: cell.c,
      startTime: performance.now(),
      duration: 200
    });
  });
  // После исчезновения – запускаем анимацию гравитации через небольшой задержку
  setTimeout(() => {
    animateGravity();
  }, 210);
  animating = true;
  requestAnimationFrame(animationLoop);
}

// Анимация гравитации: «опускание» фигурок в пустые клетки и заполнение новых
function animateGravity() {
  // Для каждой колонки просматриваем снизу вверх
  for (let c = 0; c < BOARD_SIZE; c++) {
    for (let r = BOARD_SIZE - 1; r >= 0; r--) {
      if (board[r][c] === -1) {
        // Находим ближайшую не пустую сверху
        for (let rr = r - 1; rr >= 0; rr--) {
          if (board[rr][c] !== -1) {
            // Запускаем анимацию падения для клетки (rr, c) до (r, c)
            gravityAnimations.push({
              r: r, c: c,
              startY: (rr - r) * CELL_SIZE, // сколько нужно сместить
              endY: 0,
              startTime: performance.now(),
              duration: 200
            });
            // Перемещаем значение в board (на самом деле поменяем после анимации)
            board[r][c] = board[rr][c];
            board[rr][c] = -1;
            break;
          }
        }
      }
    }
  }
  // Заполняем пустые клетки новыми фигурками с анимацией падения сверху
  for (let c = 0; c < BOARD_SIZE; c++) {
    for (let r = 0; r < BOARD_SIZE; r++) {
      if (board[r][c] === -1) {
        board[r][c] = randomIcon();
        // Запускаем анимацию: новая фигурка падает с верхней области
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
  localUserData.points += match3Score;
  showEndGameModal('Время вышло!', `Вы заработали ${match3Score} очков!`);
}
