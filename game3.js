// game4.js
(function () {
  /*************************************************************
   * Параметры игрового поля и глобальные переменные
   *************************************************************/
  const rows = 20; // число строк в матрице
  const cols = 10; // число столбцов
  const cellSize = 30; // размер клетки в пикселях

  let canvas, ctx;
  let board = [];
  let currentPiece = null;
  let score = 0;

  // Параметры падения фигуры
  const dropInterval = 500; // интервал падения в мс
  let lastTime = 0;
  let dropAccumulator = 0;
  let animationFrameId = null;

  // Таймер игры: 60 секунд (60000 мс)
  const totalTime = 60000;
  let timerStart = null;
  let timerElapsed = 0;

  // Флаги
  let gameOverFlag = false;

  // Цветовая схема (стиль «Матрицы»)
  const backgroundColor = "black";
  const staticColor = "#00FF00"; // для зафиксированных блоков ("X")
  const activeColor = "#AAFFAA"; // для движущейся фигуры ("O")
  const gridColor = "#004400";   // цвет линий сетки

  // Смещения для отрисовки доски (центрирование)
  let offsetX = 0;
  let offsetY = 0;

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

  /*************************************************************
   * Инициализация доски
   *************************************************************/
  function initBoard() {
    board = [];
    for (let r = 0; r < rows; r++) {
      board[r] = new Array(cols).fill(0);
    }
  }

  /*************************************************************
   * Логика проверки и преобразования фигур
   *************************************************************/
  function isValidMove(x, y, shape) {
    for (let r = 0; r < shape.length; r++) {
      for (let c = 0; c < shape[r].length; c++) {
        if (shape[r][c]) {
          const newX = x + c;
          const newY = y + r;
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

  // Создание новой фигуры
  function spawnPiece() {
    const type = tetrominoTypes[Math.floor(Math.random() * tetrominoTypes.length)];
    const shape = tetrominoes[type];
    const x = Math.floor((cols - shape[0].length) / 2);
    const y = 0;
    if (!isValidMove(x, y, shape)) {
      endGame();
      return;
    }
    currentPiece = { x, y, shape, type };
  }

  // Фиксируем фигуру на поле
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

  // Проверка заполненных линий и их удаление
  function clearLines() {
    let linesCleared = 0;
    for (let r = rows - 1; r >= 0; r--) {
      if (board[r].every(cell => cell !== 0)) {
        board.splice(r, 1);
        board.unshift(new Array(cols).fill(0));
        linesCleared++;
        r++; // повторная проверка текущей строки
      }
    }
    if (linesCleared > 0) {
      score += linesCleared * 100; // 100 очков за линию
    }
  }

  /*************************************************************
   * Отрисовка игрового поля (на Canvas)
   *************************************************************/
  function drawBoard() {
    // Очистка канвы
    ctx.fillStyle = backgroundColor;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Вычисляем смещения для центрирования доски
    const boardWidth = cols * cellSize;
    const boardHeight = rows * cellSize;
    offsetX = (canvas.width - boardWidth) / 2;
    offsetY = (canvas.height - boardHeight) / 2;

    // Отрисовка статичных блоков поля
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        if (board[r][c] !== 0) {
          drawCell(c, r, staticColor, "X");
        } else {
          drawCell(c, r, null, "");
        }
      }
    }

    // Отрисовка активной (движущейся) фигуры
    if (currentPiece) {
      const { x, y, shape } = currentPiece;
      for (let r = 0; r < shape.length; r++) {
        for (let c = 0; c < shape[r].length; c++) {
          if (shape[r][c]) {
            drawCell(x + c, y + r, activeColor, "O");
          }
        }
      }
    }

    // Рисуем сетку
    drawGrid();
  }

  // Рисует отдельную клетку (с учётом смещения)
  function drawCell(c, r, color, symbol) {
    const x = offsetX + c * cellSize;
    const y = offsetY + r * cellSize;
    if (color) {
      ctx.fillStyle = color;
      ctx.fillRect(x, y, cellSize, cellSize);
    } else {
      ctx.fillStyle = backgroundColor;
      ctx.fillRect(x, y, cellSize, cellSize);
    }
    if (symbol) {
      ctx.fillStyle = backgroundColor;
      ctx.font = `${cellSize * 0.6}px Courier New`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(symbol, x + cellSize / 2, y + cellSize / 2);
    }
  }

  // Рисует линии сетки
  function drawGrid() {
    ctx.strokeStyle = gridColor;
    ctx.lineWidth = 1;
    // Вертикальные линии
    for (let c = 0; c <= cols; c++) {
      const x = offsetX + c * cellSize;
      ctx.beginPath();
      ctx.moveTo(x, offsetY);
      ctx.lineTo(x, offsetY + rows * cellSize);
      ctx.stroke();
    }
    // Горизонтальные линии
    for (let r = 0; r <= rows; r++) {
      const y = offsetY + r * cellSize;
      ctx.beginPath();
      ctx.moveTo(offsetX, y);
      ctx.lineTo(offsetX + cols * cellSize, y);
      ctx.stroke();
    }
  }

  /*************************************************************
   * Функции управления фигурой
   *************************************************************/
  function moveDown() {
    if (!currentPiece) return;
    const newY = currentPiece.y + 1;
    if (isValidMove(currentPiece.x, newY, currentPiece.shape)) {
      currentPiece.y = newY;
    } else {
      mergePiece();
      clearLines();
      spawnPiece();
    }
  }

  function moveLeft() {
    if (!currentPiece) return;
    const newX = currentPiece.x - 1;
    if (isValidMove(newX, currentPiece.y, currentPiece.shape)) {
      currentPiece.x = newX;
    }
  }

  function moveRight() {
    if (!currentPiece) return;
    const newX = currentPiece.x + 1;
    if (isValidMove(newX, currentPiece.y, currentPiece.shape)) {
      currentPiece.x = newX;
    }
  }

  function rotatePiece() {
    if (!currentPiece) return;
    const newShape = rotateMatrix(currentPiece.shape);
    if (isValidMove(currentPiece.x, currentPiece.y, newShape)) {
      currentPiece.shape = newShape;
    }
  }

  /*************************************************************
   * Основной игровой цикл и таймер
   *************************************************************/
  function gameLoop(time) {
    if (!timerStart) timerStart = time;
    const deltaTime = time - lastTime;
    lastTime = time;
    dropAccumulator += deltaTime;

    // Обновляем таймер
    timerElapsed = time - timerStart;
    updateTimerBar();

    // Если время закончилось, завершаем игру
    if (timerElapsed >= totalTime) {
      endGame();
      return;
    }

    if (dropAccumulator > dropInterval) {
      moveDown();
      dropAccumulator = 0;
    }
    drawBoard();
    animationFrameId = requestAnimationFrame(gameLoop);
  }

  // Обновление слайдера таймера (в процентах)
  function updateTimerBar() {
    if (timerBar) {
      const remaining = Math.max(totalTime - timerElapsed, 0);
      const percentage = (remaining / totalTime) * 100;
      timerBar.style.width = percentage + "%";
    }
  }

  /*************************************************************
   * Обработка клавиатурных событий
   *************************************************************/
  function handleKeyDown(e) {
    if (gameOverFlag) return;
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
  }

  /*************************************************************
   * Создание on‑screen кнопок и таймера (стилизация через JS)
   *************************************************************/
  let timerBarContainer = null;
  let timerBar = null;
  let controlsContainer = null;

  function createUIElements() {
    // Создаём контейнер для слайдера таймера
    timerBarContainer = document.createElement("div");
    timerBarContainer.id = "game4TimerBarContainer";
    timerBarContainer.style.position = "absolute";
    // Размещаем слайдер чуть выше игрового поля
    timerBarContainer.style.top = (canvas.offsetTop - 30) + "px";
    timerBarContainer.style.left = canvas.offsetLeft + "px";
    timerBarContainer.style.width = (cols * cellSize) + "px";
    timerBarContainer.style.height = "20px";
    timerBarContainer.style.border = "2px solid " + staticColor;
    timerBarContainer.style.backgroundColor = backgroundColor;
    timerBarContainer.style.zIndex = 1000;

    // Внутренний элемент, который будет уменьшаться по ширине
    timerBar = document.createElement("div");
    timerBar.id = "game4TimerBar";
    timerBar.style.height = "100%";
    timerBar.style.width = "100%";
    timerBar.style.backgroundColor = staticColor;
    timerBarContainer.appendChild(timerBar);

    // Добавляем слайдер в родительский контейнер канвы
    canvas.parentNode.appendChild(timerBarContainer);

    // Создаём контейнер для кнопок управления (для мобильных устройств)
    controlsContainer = document.createElement("div");
    controlsContainer.id = "game4Controls";
    controlsContainer.style.position = "absolute";
    // Размещаем кнопки под игровым полем
    controlsContainer.style.top = (canvas.offsetTop + canvas.height + 10) + "px";
    controlsContainer.style.left = canvas.offsetLeft + "px";
    controlsContainer.style.width = canvas.width + "px";
    controlsContainer.style.display = "flex";
    controlsContainer.style.justifyContent = "space-around";
    controlsContainer.style.zIndex = 1000;

    // Создаём кнопки: Влево, Повернуть, Вправо, Вниз
    const btnLeft = document.createElement("button");
    btnLeft.textContent = "←";
    btnLeft.style.fontSize = "20px";
    btnLeft.onclick = () => moveLeft();

    const btnRotate = document.createElement("button");
    btnRotate.textContent = "⟳";
    btnRotate.style.fontSize = "20px";
    btnRotate.onclick = () => rotatePiece();

    const btnRight = document.createElement("button");
    btnRight.textContent = "→";
    btnRight.style.fontSize = "20px";
    btnRight.onclick = () => moveRight();

    const btnDown = document.createElement("button");
    btnDown.textContent = "↓";
    btnDown.style.fontSize = "20px";
    btnDown.onclick = () => moveDown();

    // Стилизуем кнопки
    [btnLeft, btnRotate, btnRight, btnDown].forEach(btn => {
      btn.style.backgroundColor = "#222";
      btn.style.color = staticColor;
      btn.style.border = "2px solid " + staticColor;
      btn.style.padding = "10px 15px";
      btn.style.borderRadius = "5px";
      btn.style.cursor = "pointer";
    });

    controlsContainer.appendChild(btnLeft);
    controlsContainer.appendChild(btnRotate);
    controlsContainer.appendChild(btnRight);
    controlsContainer.appendChild(btnDown);

    canvas.parentNode.appendChild(controlsContainer);
  }

  // Удаляем созданные элементы интерфейса (при завершении игры)
  function removeUIElements() {
    if (timerBarContainer && timerBarContainer.parentNode) {
      timerBarContainer.parentNode.removeChild(timerBarContainer);
      timerBarContainer = null;
    }
    if (controlsContainer && controlsContainer.parentNode) {
      controlsContainer.parentNode.removeChild(controlsContainer);
      controlsContainer = null;
    }
  }

  /*************************************************************
   * Завершение игры и сохранение прогресса в Firebase
   *************************************************************/
  function endGame() {
    gameOverFlag = true;
    cancelAnimationFrame(animationFrameId);
    window.removeEventListener("keydown", handleKeyDown);
    removeUIElements();

    // Сохранение результата в Firebase (при наличии глобальных userRef и localUserData)
    if (typeof userRef !== "undefined" && userRef) {
      const newPoints = (localUserData.points || 0) + score;
      userRef.update({ points: newPoints });
    }
    // Вызываем глобальную функцию для показа модального окна окончания игры
    if (typeof showEndGameModal === "function") {
      showEndGameModal("Game Over", "Your score: " + score);
    }
  }

  /*************************************************************
   * Инициализация игры (вызывается из основного скрипта)
   *************************************************************/
  window.initGame4 = function () {
    canvas = document.getElementById("game4Canvas");
    if (!canvas) return;
    ctx = canvas.getContext("2d");

    // Стилизуем Canvas через JS (фон, рамка)
    canvas.style.backgroundColor = backgroundColor;
    canvas.style.border = "2px solid " + staticColor;

    initBoard();
    score = 0;
    gameOverFlag = false;
    currentPiece = null;
    spawnPiece();

    lastTime = 0;
    dropAccumulator = 0;
    timerStart = null;
    timerElapsed = 0;

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

