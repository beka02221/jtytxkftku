/* ========================= 
   game4.js — Tetris в стиле «Матрицы»
   Управление:
     - Клавиатура: стрелки (влево, вправо, вниз, вверх — для поворота)
     - On‑screen кнопки для мобильных устройств (касанием)
   Таймер: игра идёт 1 минуту (отсчёт отображается в виде слайдера).
   По окончании игры результат (score) сохраняется в Firebase.
========================= */

// Глобальные переменные для game4 (Тетрис)
let game4Canvas, game4Ctx;
let board = [];                 // игровое поле (матрица 20×10)
const rows = 20, cols = 10;
const cellSize = 30;            // размер клетки в пикселях
let currentPiece = null;        // текущая движущаяся фигура

const dropInterval = 500;       // интервал падения фигуры (мс)
let dropAccumulator = 0;
let lastTime = 0;
let score = 0;

// Таймер игры: 1 минута = 60000 мс
const timerTotal = 60000;
let timerStart = 0;
let timerElapsed = 0;

// Флаги управления циклом
let gameRunning = false;   // флаг работы игрового цикла
let gameStarted = false;   // игра стартует при первом нажатии клавиши
let animationFrameId;

// Цветовая схема (стиль «Матрицы»)
const backgroundColor = "black";
const staticColor = "#00FF00";  // зафиксированные блоки (X)
const activeColor = "#AAFFAA";  // движущаяся фигура (O)
const gridColor = "#004400";    // линии сетки

// Определение фигур (тетрамино)
const tetrominoes = {
  I: [
    [1, 1, 1, 1]
  ],
  J: [
    [1, 0, 0],
    [1, 1, 1]
  ],
  L: [
    [0, 0, 1],
    [1, 1, 1]
  ],
  O: [
    [1, 1],
    [1, 1]
  ],
  S: [
    [0, 1, 1],
    [1, 1, 0]
  ],
  T: [
    [0, 1, 0],
    [1, 1, 1]
  ],
  Z: [
    [1, 1, 0],
    [0, 1, 1]
  ]
};
const tetrominoTypes = Object.keys(tetrominoes);

// UI-элементы для таймера и управления (on‑screen кнопки)
let timerBarContainer, timerBar;
let controlsContainer;

/* =========================
   Функции инициализации и логики игры
========================= */

// Инициализация игрового поля (матрица заполняется нулями)
function initBoard() {
  board = [];
  for (let r = 0; r < rows; r++) {
    board[r] = new Array(cols).fill(0);
  }
}

// Проверка возможности разместить фигуру (без выхода за границы и столкновений)
function isValidMove(x, y, shape) {
  for (let r = 0; r < shape.length; r++) {
    for (let c = 0; c < shape[r].length; c++) {
      if (shape[r][c]) {
        let newX = x + c;
        let newY = y + r;
        if (newX < 0 || newX >= cols || newY < 0 || newY >= rows) return false;
        if (board[newY][newX] !== 0) return false;
      }
    }
  }
  return true;
}

// Поворот матрицы фигуры по часовой стрелке
function rotateMatrix(matrix) {
  const N = matrix.length;
  const M = matrix[0].length;
  let rotated = [];
  for (let c = 0; c < M; c++) {
    rotated[c] = [];
    for (let r = N - 1; r >= 0; r--) {
      rotated[c].push(matrix[r][c]);
    }
  }
  return rotated;
}

// Создание новой фигуры (случайного типа) и размещение её сверху
function spawnPiece() {
  const type = tetrominoTypes[Math.floor(Math.random() * tetrominoTypes.length)];
  const shape = tetrominoes[type];
  let x = Math.floor((cols - shape[0].length) / 2);
  let y = 0;
  // Если разместить фигуру невозможно – игра окончена
  if (!isValidMove(x, y, shape)) {
    endGame();
    return;
  }
  currentPiece = { x, y, shape, type };
}

// Фиксируем текущую фигуру в матрице поля
function mergePiece() {
  const { x, y, shape } = currentPiece;
  for (let r = 0; r < shape.length; r++) {
    for (let c = 0; c < shape[r].length; c++) {
      if (shape[r][c]) {
        board[y + r][x + c] = 1;
      }
    }
  }
  currentPiece = null;
}

// Проверка заполненных линий: если строка полностью заполнена, удаляем её и добавляем новую сверху
function clearLines() {
  for (let r = rows - 1; r >= 0; r--) {
    if (board[r].every(cell => cell !== 0)) {
      board.splice(r, 1);
      board.unshift(new Array(cols).fill(0));
      score += 100;  // 100 очков за строку
    }
  }
}

// Функции управления фигурой
function moveDown() {
  if (!currentPiece) return;
  if (isValidMove(currentPiece.x, currentPiece.y + 1, currentPiece.shape)) {
    currentPiece.y++;
  } else {
    mergePiece();
    clearLines();
    spawnPiece();
  }
}

function moveLeft() {
  if (!currentPiece) return;
  if (isValidMove(currentPiece.x - 1, currentPiece.y, currentPiece.shape)) {
    currentPiece.x--;
  }
}

function moveRight() {
  if (!currentPiece) return;
  if (isValidMove(currentPiece.x + 1, currentPiece.y, currentPiece.shape)) {
    currentPiece.x++;
  }
}

function rotatePiece() {
  if (!currentPiece) return;
  const newShape = rotateMatrix(currentPiece.shape);
  if (isValidMove(currentPiece.x, currentPiece.y, newShape)) {
    currentPiece.shape = newShape;
  }
}

/* =========================
   Отрисовка игрового поля
========================= */
function drawGame4() {
  // Очистка холста
  game4Ctx.clearRect(0, 0, game4Canvas.width, game4Canvas.height);
  // Фон
  game4Ctx.fillStyle = backgroundColor;
  game4Ctx.fillRect(0, 0, game4Canvas.width, game4Canvas.height);

  // Вычисляем смещение для центрирования доски
  const boardWidth = cols * cellSize;
  const boardHeight = rows * cellSize;
  const offsetX = (game4Canvas.width - boardWidth) / 2;
  const offsetY = (game4Canvas.height - boardHeight) / 2;

  // Рисуем зафиксированные блоки
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      if (board[r][c] !== 0) {
        game4Ctx.fillStyle = staticColor;
        game4Ctx.fillRect(offsetX + c * cellSize, offsetY + r * cellSize, cellSize, cellSize);
        // Рисуем символ "X" для статичных блоков
        game4Ctx.fillStyle = backgroundColor;
        game4Ctx.font = `${cellSize * 0.6}px Courier New`;
        game4Ctx.textAlign = "center";
        game4Ctx.textBaseline = "middle";
        game4Ctx.fillText("X", offsetX + c * cellSize + cellSize / 2, offsetY + r * cellSize + cellSize / 2);
      }
    }
  }

  // Рисуем движущуюся (активную) фигуру
  if (currentPiece) {
    const { x, y, shape } = currentPiece;
    for (let r = 0; r < shape.length; r++) {
      for (let c = 0; c < shape[r].length; c++) {
        if (shape[r][c]) {
          game4Ctx.fillStyle = activeColor;
          game4Ctx.fillRect(offsetX + (x + c) * cellSize, offsetY + (y + r) * cellSize, cellSize, cellSize);
          game4Ctx.fillStyle = backgroundColor;
          game4Ctx.font = `${cellSize * 0.6}px Courier New`;
          game4Ctx.textAlign = "center";
          game4Ctx.textBaseline = "middle";
          game4Ctx.fillText("O", offsetX + (x + c) * cellSize + cellSize / 2, offsetY + (y + r) * cellSize + cellSize / 2);
        }
      }
    }
  }

  // Рисуем сетку
  game4Ctx.strokeStyle = gridColor;
  game4Ctx.lineWidth = 1;
  for (let r = 0; r <= rows; r++) {
    game4Ctx.beginPath();
    game4Ctx.moveTo(offsetX, offsetY + r * cellSize);
    game4Ctx.lineTo(offsetX + boardWidth, offsetY + r * cellSize);
    game4Ctx.stroke();
  }
  for (let c = 0; c <= cols; c++) {
    game4Ctx.beginPath();
    game4Ctx.moveTo(offsetX + c * cellSize, offsetY);
    game4Ctx.lineTo(offsetX + c * cellSize, offsetY + boardHeight);
    game4Ctx.stroke();
  }

  // Отображаем счёт
  game4Ctx.fillStyle = staticColor;
  game4Ctx.font = "16px Courier New";
  game4Ctx.textAlign = "left";
  game4Ctx.fillText("Score: " + score, 10, 20);
}

/* =========================
   Игровой цикл и обновление
========================= */
function updateGame4(time) {
  if (!gameStarted) return; // до старта не обновляем
  // Вычисляем время с прошлого кадра
  const deltaTime = time - lastTime;
  lastTime = time;
  dropAccumulator += deltaTime;
  if (dropAccumulator > dropInterval) {
    moveDown();
    dropAccumulator = 0;
  }
  // Обновляем таймер
  timerElapsed = time - timerStart;
  updateTimerBar();
  if (timerElapsed >= timerTotal) {
    endGame();
  }
}

function gameLoop(time) {
  if (!gameStarted) return;
  updateGame4(time);
  drawGame4();
  if (gameRunning) {
    animationFrameId = requestAnimationFrame(gameLoop);
  }
}

/* =========================
   Обработка событий управления
========================= */
function handleKeyDown(e) {
  if (!gameStarted) {
    // При первом нажатии стартуем игру и запускаем игровой цикл
    gameStarted = true;
    gameRunning = true;
    timerStart = performance.now();
    lastTime = performance.now();
    gameLoop(lastTime);
  }
  switch (e.key) {
    case "ArrowLeft":
      moveLeft();
      break;
    case "ArrowRight":
      moveRight();
      break;
    case "ArrowDown":
      moveDown();
      break;
    case "ArrowUp":
      rotatePiece();
      break;
  }
  drawGame4();
}

// Создание on‑screen кнопок для мобильных устройств
function createControls() {
  controlsContainer = document.createElement("div");
  controlsContainer.id = "game4Controls";
  controlsContainer.style.position = "absolute";
  controlsContainer.style.top = (game4Canvas.offsetTop + game4Canvas.height + 10) + "px";
  controlsContainer.style.left = game4Canvas.offsetLeft + "px";
  controlsContainer.style.width = game4Canvas.width + "px";
  controlsContainer.style.display = "flex";
  controlsContainer.style.justifyContent = "space-around";
  controlsContainer.style.zIndex = 1000;

  const btnLeft = document.createElement("button");
  btnLeft.textContent = "←";
  btnLeft.style.fontSize = "20px";
  btnLeft.onclick = () => { moveLeft(); drawGame4(); };

  const btnRotate = document.createElement("button");
  btnRotate.textContent = "⟳";
  btnRotate.style.fontSize = "20px";
  btnRotate.onclick = () => { rotatePiece(); drawGame4(); };

  const btnRight = document.createElement("button");
  btnRight.textContent = "→";
  btnRight.style.fontSize = "20px";
  btnRight.onclick = () => { moveRight(); drawGame4(); };

  const btnDown = document.createElement("button");
  btnDown.textContent = "↓";
  btnDown.style.fontSize = "20px";
  btnDown.onclick = () => { moveDown(); drawGame4(); };

  controlsContainer.appendChild(btnLeft);
  controlsContainer.appendChild(btnRotate);
  controlsContainer.appendChild(btnRight);
  controlsContainer.appendChild(btnDown);

  game4Canvas.parentNode.appendChild(controlsContainer);
}

// Удаление on‑screen кнопок
function removeControls() {
  if (controlsContainer && controlsContainer.parentNode) {
    controlsContainer.parentNode.removeChild(controlsContainer);
    controlsContainer = null;
  }
}

// Создание слайдера таймера
function createTimerBar() {
  timerBarContainer = document.createElement("div");
  timerBarContainer.id = "game4TimerBarContainer";
  timerBarContainer.style.position = "absolute";
  timerBarContainer.style.top = (game4Canvas.offsetTop - 30) + "px";
  timerBarContainer.style.left = game4Canvas.offsetLeft + "px";
  timerBarContainer.style.width = (cols * cellSize) + "px";
  timerBarContainer.style.height = "20px";
  timerBarContainer.style.border = "2px solid " + staticColor;
  timerBarContainer.style.backgroundColor = backgroundColor;
  timerBarContainer.style.zIndex = 1000;

  timerBar = document.createElement("div");
  timerBar.id = "game4TimerBar";
  timerBar.style.height = "100%";
  timerBar.style.width = "100%";
  timerBar.style.backgroundColor = staticColor;
  timerBarContainer.appendChild(timerBar);

  game4Canvas.parentNode.appendChild(timerBarContainer);
}

// Обновление слайдера таймера (уменьшение ширины)
function updateTimerBar() {
  if (timerBar) {
    let remaining = Math.max(timerTotal - timerElapsed, 0);
    let percentage = (remaining / timerTotal) * 100;
    timerBar.style.width = percentage + "%";
  }
}

/* =========================
   Завершение и сброс игры
========================= */
function endGame() {
  gameRunning = false;
  window.removeEventListener("keydown", handleKeyDown);
  removeControls();
  if (timerBarContainer && timerBarContainer.parentNode) {
    timerBarContainer.parentNode.removeChild(timerBarContainer);
    timerBarContainer = null;
  }
  // Сохранение результата в Firebase (при наличии глобальных userRef и localUserData)
  if (typeof userRef !== "undefined" && userRef) {
    let newPoints = (localUserData.points || 0) + score;
    userRef.update({ points: newPoints });
  }
  if (typeof showEndGameModal === "function") {
    showEndGameModal("Game Over", "Your score: " + score);
  }
}

function initGame4() {
  game4Canvas = document.getElementById("game4Canvas");
  if (!game4Canvas) return;
  game4Ctx = game4Canvas.getContext("2d");
  game4Canvas.style.backgroundColor = backgroundColor;
  game4Canvas.style.border = "2px solid " + staticColor;

  initBoard();
  score = 0;
  gameStarted = false;
  gameRunning = false;
  dropAccumulator = 0;
  lastTime = 0;
  timerStart = 0;
  timerElapsed = 0;
  currentPiece = null;
  spawnPiece();
  drawGame4();

  window.addEventListener("keydown", handleKeyDown);
  createControls();
  createTimerBar();
}

function resetGame4() {
  cancelAnimationFrame(animationFrameId);
  gameRunning = false;
  window.removeEventListener("keydown", handleKeyDown);
  removeControls();
  if (game4Ctx) {
    game4Ctx.clearRect(0, 0, game4Canvas.width, game4Canvas.height);
  }
}

    window.addEventListener("keydown", handleKeyDown);
    createUIElements();

    animationFrameId = requestAnimationFrame(gameLoop);
  };

  /*************************************************************
   * Сброс игры (вызывается при закрытии модального окна)
   *************************************************************/
  window.resetGame4 = function () {
    cancelAnimationFrame(animationFrameId);
    window.removeEventListener("keydown", handleKeyDown);
    removeUIElements();
    if (ctx) {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
    }
  };
})();

