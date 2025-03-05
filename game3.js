(function () {
  // Размеры игрового поля и базовые константы
  const COLS = 10;
  const ROWS = 20;
  const BLOCK_SIZE = 30; // размер клетки в пикселях
  const BOARD_WIDTH = COLS * BLOCK_SIZE;   // 300px
  const BOARD_HEIGHT = ROWS * BLOCK_SIZE;    // 600px
  const DROP_INTERVAL = 1000; // интервал падения фигуры (мс) при обычном режиме
  const FAST_DROP_INTERVAL = 100; // интервал падения при быстром режиме (мс)
  const GAME_DURATION = 120000; // длительность игры: 2 минуты (120000 мс)
  const PIECE_COLOR = "#00FF00"; // неоново-зелёный (стиль Матрицы)
  const TOP_OFFSET = 80; // отступ сверху для отрисовки игрового поля

  // Глобальные переменные для игры
  let canvas, ctx;
  let board;
  let currentPiece;
  let dropCounter = 0;
  let lastTime = 0;
  let gameStartTime = 0;
  let score = 0;
  let game3Running = false;
  let game3AnimationFrameId;
  let controlDiv; // контейнер мобильных кнопок
  let fastDrop = false; // флаг быстрого падения
  let arrowDownTimeout = null; // для отслеживания длительности нажатия стрелки вниз

  // Переменные для автоповтора лево/право
  let leftPressed = false;
  let rightPressed = false;
  let leftInitialTimeout = null;
  let rightInitialTimeout = null;
  let leftInterval = null;
  let rightInterval = null;

  // Определения тетрамино (все фигуры будут зелёного цвета)
  const tetrominoes = {
    I: {
      shape: [
        [0, 0, 0, 0],
        [1, 1, 1, 1],
        [0, 0, 0, 0],
        [0, 0, 0, 0],
      ],
    },
    J: {
      shape: [
        [1, 0, 0],
        [1, 1, 1],
        [0, 0, 0],
      ],
    },
    L: {
      shape: [
        [0, 0, 1],
        [1, 1, 1],
        [0, 0, 0],
      ],
    },
    O: {
      shape: [
        [1, 1],
        [1, 1],
      ],
    },
    S: {
      shape: [
        [0, 1, 1],
        [1, 1, 0],
        [0, 0, 0],
      ],
    },
    T: {
      shape: [
        [0, 1, 0],
        [1, 1, 1],
        [0, 0, 0],
      ],
    },
    Z: {
      shape: [
        [1, 1, 0],
        [0, 1, 1],
        [0, 0, 0],
      ],
    },
  };

  // Создаём пустое игровое поле (матрица ROWS x COLS)
  function createBoard() {
    board = [];
    for (let r = 0; r < ROWS; r++) {
      board[r] = [];
      for (let c = 0; c < COLS; c++) {
        board[r][c] = 0;
      }
    }
  }

  // Рисуем игровое поле с заблокированными блоками и сеткой
  function drawBoard() {
    const offsetX = (canvas.width - BOARD_WIDTH) / 2;
    ctx.lineWidth = 2; // увеличенная толщина линий
    for (let r = 0; r < ROWS; r++) {
      for (let c = 0; c < COLS; c++) {
        const x = offsetX + c * BLOCK_SIZE;
        const y = r * BLOCK_SIZE;
        if (board[r][c] !== 0) {
          ctx.fillStyle = PIECE_COLOR;
          ctx.fillRect(x, y, BLOCK_SIZE, BLOCK_SIZE);
          ctx.strokeStyle = "#005500";
          ctx.strokeRect(x, y, BLOCK_SIZE, BLOCK_SIZE);
        } else {
          ctx.strokeStyle = "#002200";
          ctx.strokeRect(x, y, BLOCK_SIZE, BLOCK_SIZE);
        }
      }
    }
    // Отрисовка внешней рамки поля
    ctx.strokeStyle = PIECE_COLOR;
    ctx.strokeRect(offsetX, 0, BOARD_WIDTH, BOARD_HEIGHT);
    ctx.lineWidth = 1; // сброс толщины линий
  }

  // Рисуем текущую фигуру
  function drawPiece(piece) {
    const offsetX = (canvas.width - BOARD_WIDTH) / 2;
    ctx.fillStyle = PIECE_COLOR;
    ctx.shadowColor = PIECE_COLOR;
    ctx.shadowBlur = 10;
    piece.shape.forEach((row, r) => {
      row.forEach((value, c) => {
        if (value) {
          const x = offsetX + (piece.x + c) * BLOCK_SIZE;
          const y = (piece.y + r) * BLOCK_SIZE;
          ctx.fillRect(x, y, BLOCK_SIZE, BLOCK_SIZE);
          ctx.strokeStyle = "#005500";
          ctx.strokeRect(x, y, BLOCK_SIZE, BLOCK_SIZE);
        }
      });
    });
    ctx.shadowBlur = 0;
  }

  // Фиксируем фигуру на игровом поле
  function mergePiece(piece) {
    piece.shape.forEach((row, r) => {
      row.forEach((value, c) => {
        if (value) {
          board[piece.y + r][piece.x + c] = 1;
        }
      });
    });
  }

  // Проверка столкновения фигуры с границами или другими блоками
  function collide(piece) {
    for (let r = 0; r < piece.shape.length; r++) {
      for (let c = 0; c < piece.shape[r].length; c++) {
        if (piece.shape[r][c]) {
          let newX = piece.x + c;
          let newY = piece.y + r;
          if (newX < 0 || newX >= COLS || newY >= ROWS) {
            return true;
          }
          if (newY >= 0 && board[newY][newX] !== 0) {
            return true;
          }
        }
      }
    }
    return false;
  }

  // Поворот матрицы (на 90° по часовой стрелке)
  function rotate(matrix) {
    const N = matrix.length;
    const result = [];
    for (let r = 0; r < N; r++) {
      result[r] = [];
      for (let c = 0; c < N; c++) {
        result[r][c] = matrix[N - c - 1][r];
      }
    }
    return result;
  }

  // Создаём фигуру по типу (согласно тетрамино)
  function createPiece(type) {
    return {
      shape: tetrominoes[type].shape,
      x: Math.floor(COLS / 2) - Math.floor(tetrominoes[type].shape[0].length / 2),
      y: 0,
    };
  }

  // Возвращает случайную фигуру
  function randomPiece() {
    const types = Object.keys(tetrominoes);
    const rand = types[Math.floor(Math.random() * types.length)];
    return createPiece(rand);
  }

  // Проверка и удаление заполненных строк
  function clearLines() {
    let linesCleared = 0;
    outer: for (let r = ROWS - 1; r >= 0; r--) {
      for (let c = 0; c < COLS; c++) {
        if (board[r][c] === 0) {
          continue outer;
        }
      }
      board.splice(r, 1);
      board.unshift(new Array(COLS).fill(0));
      linesCleared++;
      r++;
    }
    if (linesCleared > 0) {
      score += linesCleared * 30;
    }
  }

  // Опускаем фигуру на одну строку
  function dropPiece() {
    currentPiece.y++;
    if (collide(currentPiece)) {
      currentPiece.y--;
      mergePiece(currentPiece);
      clearLines();
      currentPiece = randomPiece();
      if (collide(currentPiece)) {
        endGame();
      }
    }
    dropCounter = 0;
  }

  // Функции для автоповтора движения влево/вправо
  function moveLeft() {
    currentPiece.x--;
    if (collide(currentPiece)) {
      currentPiece.x++;
    }
    drawGame3();
  }
  function moveRight() {
    currentPiece.x++;
    if (collide(currentPiece)) {
      currentPiece.x--;
    }
    drawGame3();
  }

  // Основной игровой цикл
  function updateGame3(time = 0) {
    const deltaTime = time - lastTime;
    lastTime = time;
    dropCounter += deltaTime;
    if (dropCounter > (fastDrop ? FAST_DROP_INTERVAL : DROP_INTERVAL)) {
      dropPiece();
    }
    const elapsed = Date.now() - gameStartTime;
    if (elapsed >= GAME_DURATION) {
      endGame();
      return;
    }
    drawGame3();
    game3AnimationFrameId = requestAnimationFrame(updateGame3);
  }

  // Отрисовка игрового состояния
  function drawGame3() {
    ctx.fillStyle = "#000";
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    const timeLeft = Math.max(GAME_DURATION - (Date.now() - gameStartTime), 0);
    const sliderWidth = (timeLeft / GAME_DURATION) * canvas.width;
    ctx.fillStyle = "#00FF00";
    ctx.fillRect(0, 0, sliderWidth, 5);

    ctx.fillStyle = "#00FF00";
    ctx.font = "20px 'Press Start 2P'";
    ctx.textAlign = "center";
    ctx.fillText("Score: " + score, canvas.width / 2, 30);

    ctx.save();
    ctx.translate(0, TOP_OFFSET);
    drawBoard();
    drawPiece(currentPiece);
    ctx.restore();
  }

  // Обработчик клавиш для управления с автоповтором для "←" и "→"
  function handleKeyDown(event) {
    if (!game3Running) return;
    if (event.key === "ArrowLeft") {
      if (!leftPressed) {
        leftPressed = true;
        moveLeft();
        leftInitialTimeout = setTimeout(() => {
          leftInterval = setInterval(moveLeft, 100);
        }, 150);
      }
    } else if (event.key === "ArrowRight") {
      if (!rightPressed) {
        rightPressed = true;
        moveRight();
        rightInitialTimeout = setTimeout(() => {
          rightInterval = setInterval(moveRight, 100);
        }, 150);
      }
    } else if (event.key === "ArrowDown") {
      if (!arrowDownTimeout) {
        arrowDownTimeout = setTimeout(() => {
          fastDrop = true;
          arrowDownTimeout = null;
        }, 150);
      }
    } else if (event.key === "ArrowUp") {
      const rotated = rotate(currentPiece.shape);
      const oldShape = currentPiece.shape;
      currentPiece.shape = rotated;
      if (collide(currentPiece)) {
        if (!collide({ ...currentPiece, x: currentPiece.x - 1 })) {
          currentPiece.x--;
        } else if (!collide({ ...currentPiece, x: currentPiece.x + 1 })) {
          currentPiece.x++;
        } else {
          currentPiece.shape = oldShape;
        }
      }
    }
    drawGame3();
  }

  // Обработчик отпускания клавиш
  function handleKeyUp(event) {
    if (event.key === "ArrowLeft") {
      clearTimeout(leftInitialTimeout);
      clearInterval(leftInterval);
      leftPressed = false;
    } else if (event.key === "ArrowRight") {
      clearTimeout(rightInitialTimeout);
      clearInterval(rightInterval);
      rightPressed = false;
    } else if (event.key === "ArrowDown") {
      if (arrowDownTimeout) {
        clearTimeout(arrowDownTimeout);
        arrowDownTimeout = null;
        dropPiece();
      }
      fastDrop = false;
    }
  }

  // Функция для симуляции события отпускания клавиши
  function simulateKeyUp(key) {
    const event = new KeyboardEvent("keyup", { key: key });
    handleKeyUp(event);
  }

  // Создаём мобильные кнопки управления с автоповтором для "←" и "→"
  function createMobileControls() {
    controlDiv = document.createElement("div");
    controlDiv.id = "tetrisControls";
    controlDiv.style.position = "fixed";
    controlDiv.style.bottom = "20px";
    controlDiv.style.left = "50%";
    controlDiv.style.transform = "translateX(-50%)";
    controlDiv.style.display = "flex";
    controlDiv.style.justifyContent = "center";
    controlDiv.style.gap = "10px";
    controlDiv.style.zIndex = "1100";

    // Функция для стилизации кнопки с пиксельным эффектом
    function styleControlButton(btn) {
      btn.style.width = "50px";
      btn.style.height = "50px";
      btn.style.fontSize = "24px";
      btn.style.borderRadius = "5px";
      btn.style.border = "2px solid #00FF00";
      btn.style.background = "#000";
      btn.style.color = "#00FF00";
      btn.style.outline = "none";
      btn.style.fontFamily = "'Press Start 2P', monospace";
      btn.style.fontWeight = "bold";
      btn.style.webkitFontSmoothing = "none";
      btn.style.mozOsxFontSmoothing = "grayscale";
      btn.style.imageRendering = "pixelated";
    }

    // Кнопка "←" с автоповтором
    const btnLeft = document.createElement("button");
    btnLeft.textContent = "←";
    styleControlButton(btnLeft);
    btnLeft.addEventListener("touchstart", (e) => {
      e.preventDefault();
      if (!leftPressed) {
        leftPressed = true;
        moveLeft();
        leftInitialTimeout = setTimeout(() => {
          leftInterval = setInterval(moveLeft, 100);
        }, 150);
      }
    });
    btnLeft.addEventListener("touchend", (e) => {
      e.preventDefault();
      clearTimeout(leftInitialTimeout);
      clearInterval(leftInterval);
      leftPressed = false;
    });
    btnLeft.addEventListener("mousedown", (e) => {
      e.preventDefault();
      if (!leftPressed) {
        leftPressed = true;
        moveLeft();
        leftInitialTimeout = setTimeout(() => {
          leftInterval = setInterval(moveLeft, 100);
        }, 150);
      }
    });
    btnLeft.addEventListener("mouseup", (e) => {
      e.preventDefault();
      clearTimeout(leftInitialTimeout);
      clearInterval(leftInterval);
      leftPressed = false;
    });
    btnLeft.addEventListener("mouseleave", (e) => {
      e.preventDefault();
      clearTimeout(leftInitialTimeout);
      clearInterval(leftInterval);
      leftPressed = false;
    });

    // Кнопка "⟳" (поворот)
    const btnRotate = document.createElement("button");
    btnRotate.textContent = "⟳";
    styleControlButton(btnRotate);
    btnRotate.addEventListener("touchstart", (e) => {
      e.preventDefault();
      simulateKey("ArrowUp");
    });
    btnRotate.addEventListener("click", () => {
      simulateKey("ArrowUp");
    });

    // Кнопка "↓"
    const btnDown = document.createElement("button");
    btnDown.textContent = "↓";
    styleControlButton(btnDown);
    btnDown.addEventListener("touchstart", (e) => {
      e.preventDefault();
      simulateKey("ArrowDown");
    });
    btnDown.addEventListener("touchend", (e) => {
      e.preventDefault();
      simulateKeyUp("ArrowDown");
    });
    btnDown.addEventListener("touchcancel", (e) => {
      e.preventDefault();
      simulateKeyUp("ArrowDown");
    });
    btnDown.addEventListener("mousedown", () => {
      simulateKey("ArrowDown");
    });
    btnDown.addEventListener("mouseup", () => {
      simulateKeyUp("ArrowDown");
    });
    btnDown.addEventListener("click", () => {
      simulateKey("ArrowDown");
      simulateKeyUp("ArrowDown");
    });

    // Кнопка "→" с автоповтором
    const btnRight = document.createElement("button");
    btnRight.textContent = "→";
    styleControlButton(btnRight);
    btnRight.addEventListener("touchstart", (e) => {
      e.preventDefault();
      if (!rightPressed) {
        rightPressed = true;
        moveRight();
        rightInitialTimeout = setTimeout(() => {
          rightInterval = setInterval(moveRight, 100);
        }, 150);
      }
    });
    btnRight.addEventListener("touchend", (e) => {
      e.preventDefault();
      clearTimeout(rightInitialTimeout);
      clearInterval(rightInterval);
      rightPressed = false;
    });
    btnRight.addEventListener("mousedown", (e) => {
      e.preventDefault();
      if (!rightPressed) {
        rightPressed = true;
        moveRight();
        rightInitialTimeout = setTimeout(() => {
          rightInterval = setInterval(moveRight, 100);
        }, 150);
      }
    });
    btnRight.addEventListener("mouseup", (e) => {
      e.preventDefault();
      clearTimeout(rightInitialTimeout);
      clearInterval(rightInterval);
      rightPressed = false;
    });
    btnRight.addEventListener("mouseleave", (e) => {
      e.preventDefault();
      clearTimeout(rightInitialTimeout);
      clearInterval(rightInterval);
      rightPressed = false;
    });

    controlDiv.appendChild(btnLeft);
    controlDiv.appendChild(btnRotate);
    controlDiv.appendChild(btnDown);
    controlDiv.appendChild(btnRight);

    const gameModal = document.getElementById("gameModalBackdrop");
    if (gameModal) {
      gameModal.appendChild(controlDiv);
    } else {
      document.body.appendChild(controlDiv);
    }
  }

  // Удаляем мобильные кнопки (при завершении игры)
  function removeMobileControls() {
    if (controlDiv && controlDiv.parentNode) {
      controlDiv.parentNode.removeChild(controlDiv);
      controlDiv = null;
    }
  }

  // Имитируем событие нажатия клавиши (для кнопок "⟳" и "↓")
  function simulateKey(key) {
    const event = new KeyboardEvent("keydown", { key: key });
    handleKeyDown(event);
  }

  // Инициализация игры
  function initGame3() {
    canvas = document.getElementById("game3Canvas");
    ctx = canvas.getContext("2d");
    canvas.style.background = "#000";
    createBoard();
    currentPiece = randomPiece();
    score = 0;
    dropCounter = 0;
    lastTime = 0;
    gameStartTime = Date.now();
    game3Running = true;
    document.addEventListener("keydown", handleKeyDown);
    document.addEventListener("keyup", handleKeyUp);
    createMobileControls();
    updateGame3();
  }

  // Завершение игры
  function endGame() {
    if (!game3Running) return;
    game3Running = false;
    localUserData.points += score;
    if (userRef) {
      userRef.update({ points: localUserData.points });
    }
    cancelAnimationFrame(game3AnimationFrameId);
    document.removeEventListener("keydown", handleKeyDown);
    document.removeEventListener("keyup", handleKeyUp);
    removeMobileControls();
    showEndGameModal("Time's up!", "Your score: " + score);
  }

  // Сброс игры
  function resetGame3() {
    cancelAnimationFrame(game3AnimationFrameId);
    game3Running = false;
    document.removeEventListener("keydown", handleKeyDown);
    document.removeEventListener("keyup", handleKeyUp);
    removeMobileControls();
    if (ctx) {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
    }
  }

  window.initGame3 = initGame3;
  window.resetGame3 = resetGame3;
})();
