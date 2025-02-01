/***************************************************************
 * HackMatch 3 - Игра "3 в ряд" в стиле хакинга и программирования
 * -------------------------------------------------------------
 * Автор: (Ваше имя или команда)
 * Версия: 1.0
 ***************************************************************/

// ============= Константы и настройки =============
const GRID_SIZE = 8;              // Размер сетки (8x8)
const CELL_SIZE = 50;            // Размер одной ячейки в пикселях
const GAME_DURATION = 60;         // Продолжительность игры (секунд)
const HACK_BG_COLOR = "#013220";  // Тёмно-зелёный фон (хакинг-стиль)
const ICONS = [
  "https://img.icons8.com/ios/50/lock.png",
  "https://img.icons8.com/ios/50/error--v1.png",
  "https://img.icons8.com/fluency-systems-regular/50/fraud.png",
  "https://img.icons8.com/fluency-systems-regular/50/key-security--v1.png",
  "https://img.icons8.com/fluency-systems-regular/50/user-credentials.png"
];

// ============= Глобальные переменные для игры =============
let match3Canvas = null;
let match3Ctx = null;
let match3Grid = [];        // Двухмерный массив с объектами { icon, isRemoving }
let isGameRunning = false;  // Идёт ли игра
let score = 0;              // Текущий счёт
let timeLeft = GAME_DURATION;  // Сколько секунд осталось
let timerInterval = null;   // Интервал для отсчёта времени

// Данные для обработки перетаскивания
let dragStart = null;       // { x, y } – координаты ячейки, которую взяли
let dragEnd = null;         // { x, y } – координаты ячейки, куда пытаемся поставить

/***************************************************************************
 * initGame2()
 * Инициализация игры "HackMatch 3". Вызывается при открытии игрового поля.
 ***************************************************************************/
function initGame2() {
  // Получаем canvas и контекст
  match3Canvas = document.getElementById("match3Canvas");
  match3Ctx = match3Canvas.getContext("2d");

  // Задаём размеры canvas (если нужно). Можно вынести в HTML
  match3Canvas.width = GRID_SIZE * CELL_SIZE;
  match3Canvas.height = GRID_SIZE * CELL_SIZE;

  // Сбрасываем переменные
  match3Grid = [];
  score = 0;
  timeLeft = GAME_DURATION;
  isGameRunning = true;

  // Генерируем поле
  generateGrid();

  // Подключаем обработчики мыши / тач-событий (для swap)
  match3Canvas.addEventListener("mousedown", onMouseDown);
  match3Canvas.addEventListener("mousemove", onMouseMove);
  match3Canvas.addEventListener("mouseup", onMouseUp);

  match3Canvas.addEventListener("touchstart", onTouchStart);
  match3Canvas.addEventListener("touchmove", onTouchMove);
  match3Canvas.addEventListener("touchend", onTouchEnd);

  // Запускаем таймер
  timerInterval = setInterval(() => {
    timeLeft--;
    // Здесь можно обновлять отображение таймера в интерфейсе
    // Например, document.getElementById("timerDisplay").textContent = timeLeft;

    if (timeLeft <= 0) {
      endGame2();
    }
  }, 1000);

  // Запускаем игровой цикл
  requestAnimationFrame(gameLoop);
}

/***************************************************************************
 * resetGame2()
 * Полная остановка и сброс игры. Вызывается при выходе или завершении.
 ***************************************************************************/
function resetGame2() {
  isGameRunning = false;

  // Отключаем таймер
  if (timerInterval) {
    clearInterval(timerInterval);
    timerInterval = null;
  }

  // Удаляем обработчики
  match3Canvas.removeEventListener("mousedown", onMouseDown);
  match3Canvas.removeEventListener("mousemove", onMouseMove);
  match3Canvas.removeEventListener("mouseup", onMouseUp);

  match3Canvas.removeEventListener("touchstart", onTouchStart);
  match3Canvas.removeEventListener("touchmove", onTouchMove);
  match3Canvas.removeEventListener("touchend", onTouchEnd);

  match3Ctx = null;
}

/***************************************************************************
 * endGame2()
 * Завершает игру при окончании времени (или другой причине).
 * Вызывается при timeLeft <= 0.
 ***************************************************************************/
function endGame2() {
  // Останавливаем игру
  resetGame2();

  // Обновляем базу данных (если нужно)
  updateScoreInDatabase(score);

  // Показываем результат (можно через модалку, вывод на экран и т.д.)
  showGameOverMessage(score);
}

/***************************************************************************
 * generateGrid()
 * Генерация случайного поля, чтобы изначально не было больших матчей.
 * При необходимости можно повторять проверку, пока есть совпадения.
 ***************************************************************************/
function generateGrid() {
  // Заполняем случайными иконками
  for (let row = 0; row < GRID_SIZE; row++) {
    match3Grid[row] = [];
    for (let col = 0; col < GRID_SIZE; col++) {
      match3Grid[row][col] = {
        icon: getRandomIcon(),
        isRemoving: false
      };
    }
  }
  // Если хотим избежать стартовых матчей – проверяем и перегенерируем
  // (Для простоты здесь не делаем, но можно добавить логику)
}

/***************************************************************************
 * gameLoop()
 * Основной цикл игры. Вызывается через requestAnimationFrame.
 ***************************************************************************/
function gameLoop() {
  if (!isGameRunning || !match3Ctx) return;

  // Рисуем поле
  drawBoard();

  // Постоянно проверяем, нет ли новых совпадений после swap/каскадов
  // (Можно делать чаще/реже по событию)
  checkAndClearMatches();
  applyGravity();
  refillEmptyCells();

  requestAnimationFrame(gameLoop);
}

/***************************************************************************
 * drawBoard()
 * Рисуем игровое поле (фон и иконки).
 ***************************************************************************/
function drawBoard() {
  // Тёмно-зелёный фон под все поле
  match3Ctx.fillStyle = HACK_BG_COLOR;
  match3Ctx.fillRect(0, 0, match3Canvas.width, match3Canvas.height);

  // Рисуем каждую ячейку
  for (let row = 0; row < GRID_SIZE; row++) {
    for (let col = 0; col < GRID_SIZE; col++) {
      const cell = match3Grid[row][col];
      if (!cell) continue;

      // Координаты в пикселях
      const x = col * CELL_SIZE;
      const y = row * CELL_SIZE;

      // Фон ячейки (прозрачный или с лёгким неоновым оттенком)
      // Можно дорисовать "неон" (совмещённый слой).
      // match3Ctx.fillStyle = "rgba(0, 255, 0, 0.1)";
      // match3Ctx.fillRect(x, y, CELL_SIZE, CELL_SIZE);

      // Рисуем иконку
      if (cell.icon) {
        drawIcon(cell.icon, x, y);
      }

      // Можно нарисовать "неон" по контуру
      // match3Ctx.strokeStyle = "#00ff00";
      // match3Ctx.strokeRect(x, y, CELL_SIZE, CELL_SIZE);
    }
  }
}

/***************************************************************************
 * drawIcon(iconUrl, x, y)
 * Рисуем иконку в заданной ячейке.
 ***************************************************************************/
function drawIcon(iconUrl, x, y) {
  const image = new Image();
  image.src = iconUrl;
  // Чтобы не перегружать запросами, обычно делают pre-load или кеш.
  // Для упрощения здесь каждый раз создаём объект.

  // Когда изображение загрузится, рисуем
  image.onload = () => {
    // Рассчитываем размер, чтобы вписать в CELL_SIZE
    match3Ctx.drawImage(image, x + 5, y + 5, CELL_SIZE - 10, CELL_SIZE - 10);
    // Можно добавить неоновую обводку, glow и т.д. через эффекты Canvas или CSS.
  };
}

/***************************************************************************
 * checkAndClearMatches()
 * Ищет все совпадения (3+ в ряд по горизонтали или вертикали),
 * помечает их для удаления, если есть.
 * Затем удаляет и начисляет очки.
 ***************************************************************************/
function checkAndClearMatches() {
  let matchesFound = false;

  // Сбрасываем флаги удаления
  for (let row = 0; row < GRID_SIZE; row++) {
    for (let col = 0; col < GRID_SIZE; col++) {
      if (match3Grid[row][col]) {
        match3Grid[row][col].isRemoving = false;
      }
    }
  }

  // Проверяем горизонтальные совпадения
  for (let row = 0; row < GRID_SIZE; row++) {
    for (let col = 0; col < GRID_SIZE - 2; col++) {
      const icon1 = match3Grid[row][col].icon;
      const icon2 = match3Grid[row][col + 1].icon;
      const icon3 = match3Grid[row][col + 2].icon;
      if (icon1 && icon1 === icon2 && icon2 === icon3) {
        // Нашли минимум 3 подряд
        match3Grid[row][col].isRemoving = true;
        match3Grid[row][col + 1].isRemoving = true;
        match3Grid[row][col + 2].isRemoving = true;
        matchesFound = true;
      }
    }
  }

  // Проверяем вертикальные совпадения
  for (let col = 0; col < GRID_SIZE; col++) {
    for (let row = 0; row < GRID_SIZE - 2; row++) {
      const icon1 = match3Grid[row][col].icon;
      const icon2 = match3Grid[row + 1][col].icon;
      const icon3 = match3Grid[row + 2][col].icon;
      if (icon1 && icon1 === icon2 && icon2 === icon3) {
        // Нашли минимум 3 подряд
        match3Grid[row][col].isRemoving = true;
        match3Grid[row + 1][col].isRemoving = true;
        match3Grid[row + 2][col].isRemoving = true;
        matchesFound = true;
      }
    }
  }

  // Если есть совпадения, удаляем иконки и даём очки
  if (matchesFound) {
    let removedCount = 0;
    for (let row = 0; row < GRID_SIZE; row++) {
      for (let col = 0; col < GRID_SIZE; col++) {
        if (match3Grid[row][col].isRemoving) {
          match3Grid[row][col].icon = null; // убираем иконку
          removedCount++;
        }
      }
    }
    // Начислим очки: например, +10 за каждую удалённую иконку
    score += removedCount * 10;
    // Здесь можно обновлять UI-элемент, показывающий score
    // Например: document.getElementById("scoreDisplay").textContent = score;
  }
}

/***************************************************************************
 * applyGravity()
 * "Притягивает" иконки вниз, если под ними пустые ячейки (icon = null).
 ***************************************************************************/
function applyGravity() {
  for (let col = 0; col < GRID_SIZE; col++) {
    // Снизу вверх (чтобы "ронять" иконки вниз)
    for (let row = GRID_SIZE - 1; row >= 0; row--) {
      if (match3Grid[row][col].icon === null) {
        // Ищем выше иконку
        for (let aboveRow = row - 1; aboveRow >= 0; aboveRow--) {
          if (match3Grid[aboveRow][col].icon) {
            match3Grid[row][col].icon = match3Grid[aboveRow][col].icon;
            match3Grid[aboveRow][col].icon = null;
            break;
          }
        }
      }
    }
  }
}

/***************************************************************************
 * refillEmptyCells()
 * Заполняет пустые ячейки (icon = null) новыми случайными иконками.
 ***************************************************************************/
function refillEmptyCells() {
  for (let row = 0; row < GRID_SIZE; row++) {
    for (let col = 0; col < GRID_SIZE; col++) {
      if (match3Grid[row][col].icon === null) {
        match3Grid[row][col].icon = getRandomIcon();
      }
    }
  }
}

/***************************************************************************
 * getRandomIcon()
 * Возвращает случайный URL-иконки из массива ICONS.
 ***************************************************************************/
function getRandomIcon() {
  return ICONS[Math.floor(Math.random() * ICONS.length)];
}

/***************************************************************************
 * Обработчики мыши и тач-событий (упрощённая логика Swap)
 ***************************************************************************/

// Конвертируем координаты клика в координаты ячейки (колонка, строка)
function getCellFromXY(clientX, clientY) {
  const rect = match3Canvas.getBoundingClientRect();
  // положение относительно canvas
  const x = clientX - rect.left;
  const y = clientY - rect.top;
  const col = Math.floor(x / CELL_SIZE);
  const row = Math.floor(y / CELL_SIZE);
  return { row, col };
}

// MOUSE
function onMouseDown(e) {
  e.preventDefault();
  dragStart = getCellFromXY(e.clientX, e.clientY);
  dragEnd = null;
}

function onMouseMove(e) {
  if (!dragStart) return;
  e.preventDefault();
  dragEnd = getCellFromXY(e.clientX, e.clientY);
}

function onMouseUp(e) {
  e.preventDefault();
  if (!dragStart || !dragEnd) {
    dragStart = null;
    dragEnd = null;
    return;
  }
  attemptSwap(dragStart, dragEnd);
  dragStart = null;
  dragEnd = null;
}

// TOUCH
function onTouchStart(e) {
  e.preventDefault();
  const touch = e.touches[0];
  if (!touch) return;
  dragStart = getCellFromXY(touch.clientX, touch.clientY);
  dragEnd = null;
}

function onTouchMove(e) {
  e.preventDefault();
  const touch = e.touches[0];
  if (!touch || !dragStart) return;
  dragEnd = getCellFromXY(touch.clientX, touch.clientY);
}

function onTouchEnd(e) {
  e.preventDefault();
  if (!dragStart || !dragEnd) {
    dragStart = null;
    dragEnd = null;
    return;
  }
  attemptSwap(dragStart, dragEnd);
  dragStart = null;
  dragEnd = null;
}

/***************************************************************************
 * attemptSwap(cellA, cellB)
 * Проверяем, соседние ли ячейки. Если да, меняем иконки местами.
 ***************************************************************************/
function attemptSwap(cellA, cellB) {
  if (!cellA || !cellB) return;
  const { row: r1, col: c1 } = cellA;
  const { row: r2, col: c2 } = cellB;

  // Проверяем валидность
  if (r1 < 0 || r1 >= GRID_SIZE || c1 < 0 || c1 >= GRID_SIZE) return;
  if (r2 < 0 || r2 >= GRID_SIZE || c2 < 0 || c2 >= GRID_SIZE) return;

  // Соседние ли клетки? (по горизонтали или вертикали)
  const isAdjacent = (Math.abs(r1 - r2) + Math.abs(c1 - c2) === 1);
  if (!isAdjacent) return;

  // Меняем иконки
  const tempIcon = match3Grid[r1][c1].icon;
  match3Grid[r1][c1].icon = match3Grid[r2][c2].icon;
  match3Grid[r2][c2].icon = tempIcon;
}

/***************************************************************************
 * Заглушки для интеграции с остальным проектом
 ***************************************************************************/

/**
 * updateScoreInDatabase(finalScore)
 * Обновляет счёт пользователя в базе данных (заглушка).
 */
function updateScoreInDatabase(finalScore) {
  // Здесь вы можете вызвать Firebase или другую логику
  // Например: db.ref(`users/${currentUser.username}`).update({ points: finalScore })
  console.log("Обновление очков в БД:", finalScore);
}

/**
 * showGameOverMessage(finalScore)
 * Показывает сообщение об окончании игры и выводит результат (заглушка).
 */
function showGameOverMessage(finalScore) {
  // Здесь можно показать модалку, заменить содержимое экрана и т.д.
  // Для примера — вывод в консоль:
  console.log(`Время вышло! Вы заработали: ${finalScore} очков`);
  // Или используйте свой глобальный модал:
  // showGlobalModal("Время вышло", `Вы заработали ${finalScore} очков!`);
}
