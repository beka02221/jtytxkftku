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

  // Константы анимации очистки строки
  const FADE_DURATION = 300; // мс для анимации затухания строки
  const FALL_DURATION = 300; // мс для анимации падения рядов

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
  let fastDrop = false; // флаг быстрого падения

  // Флаги и переменные для анимации очистки строки (реализована для одного заполненного ряда)
  let clearing = false;            // идёт анимация очистки строки
  let clearPhase = "";             // "fade" – фаза затухания, "fall" – фаза падения
  let clearStartTime = 0;          // время начала текущей фазы анимации
  let clearedRow = null;           // индекс заполненной строки, которую анимируем
  let boardBeforeClear = null;     // копия игрового поля до удаления строки

  // Переменные для автоповтора движения влево/вправо
  let leftPressed = false;
  let rightPressed = false;
  let leftInitialTimeout = null;
  let rightInitialTimeout = null;
  let leftInterval = null;
  let rightInterval = null;
  let arrowDownTimeout = null; // для длительного нажатия стрелки вниз

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

  // Рисуем игровое поле (без учёта анимаций очистки)
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

  // Проверка заполненной строки и запуск анимации очистки (для одного заполненного ряда)
  function triggerClearLines() {
    // Если уже идёт анимация – не проверяем
    if (clearing) return;
    let fullRow = null;
    for (let r = ROWS - 1; r >= 0; r--) {
      let isFull = true;
      for (let c = 0; c < COLS; c++) {
        if (board[r][c] === 0) {
          isFull = false;
          break;
        }
      }
      if (isFull) {
        fullRow = r;
        break;
      }
    }
    if (fullRow !== null) {
      clearing = true;
      clearPhase = "fade";
      clearStartTime = performance.now();
      clearedRow = fullRow;
      boardBeforeClear = board.map(row => row.slice()); // глубокое копирование
    }
  }

  // Анимация очистки строки (фаза fade и fall)
  function updateClearAnimation(time) {
    if (clearPhase === "fade") {
      let progress = (time - clearStartTime) / FADE_DURATION;
      if (progress >= 1) {
        // Фаза затухания завершена: удаляем заполненную строку
        board.splice(clearedRow, 1);
        board.unshift(new Array(COLS).fill(0));
        score += 30; // начисляем очки за одну строку
        // Переходим к фазе падения: строки, находившиеся выше очищенной, будут падать вниз на BLOCK_SIZE
        clearPhase = "fall";
        clearStartTime = time;
      }
    } else if (clearPhase === "fall") {
      let progress = (time - clearStartTime) / FALL_DURATION;
      if (progress >= 1) {
        // Фаза падения завершена – завершаем анимацию очистки
        clearing = false;
      }
    }
  }

  // Отрисовка игрового состояния с учётом анимации очистки строки
  function drawGame3() {
    // Очистка всего холста
    ctx.fillStyle = "#000";
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Индикатор оставшегося времени
    const timeLeft = Math.max(GAME_DURATION - (Date.now() - gameStartTime), 0);
    const sliderWidth = (timeLeft / GAME_DURATION) * canvas.width;
    ctx.fillStyle = "#00FF00";
    ctx.fillRect(0, 0, sliderWidth, 5);

    // Отображение счёта
    ctx.fillStyle = "#00FF00";
    ctx.font = "20px 'Press Start 2P'";
    ctx.textAlign = "center";
    ctx.fillText("Score: " + score, canvas.width / 2, 30);

    ctx.save();
    ctx.translate(0, TOP_OFFSET);

    const offsetX = (canvas.width - BOARD_WIDTH) / 2;

    if (clearing) {
      if (clearPhase === "fade") {
        // Рисуем поле как обычно
        drawBoard();
        // Накладываем анимацию затухания на заполненную строку
        let progress = (performance.now() - clearStartTime) / FADE_DURATION;
        if (progress > 1) progress = 1;
        const y = clearedRow * BLOCK_SIZE;
        ctx.fillStyle = "rgba(255, 0, 0, " + (1 - progress) + ")";
        ctx.fillRect(offsetX, y, BOARD_WIDTH, BLOCK_SIZE);
        // Рисуем текущую фигуру
        drawPiece(currentPiece);
      } else if (clearPhase === "fall") {
        // Фаза падения: строки выше очищенной строки анимированно смещаются вниз
        let progress = (performance.now() - clearStartTime) / FALL_DURATION;
        if (progress > 1) progress = 1;
        // Рисуем строки, которые падали (берём их из boardBeforeClear)
        for (let r = 0; r < clearedRow; r++) {
          let offsetY = BLOCK_SIZE * (1 - progress);
          for (let c = 0; c < COLS; c++) {
            const x = offsetX + c * BLOCK_SIZE;
            const y = r * BLOCK_SIZE + offsetY;
            if (boardBeforeClear[r][c] !== 0) {
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
        // Рисуем нижнюю часть поля (начиная с очищенной строки) из обновлённого board
        for (let r = clearedRow; r < ROWS; r++) {
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
        // Текущую фигуру рисуем как обычно
        drawPiece(currentPiece);
      }
    } else {
      // Нет анимаций очистки – рисуем поле и фигуру стандартно
      drawBoard();
      drawPiece(currentPiece);
    }

    ctx.restore();
  }

  // Опускаем фигуру на одну строку
  function dropPiece() {
    // Если идёт анимация очистки, не обновляем игру
    if (clearing) return;
    currentPiece.y++;
    if (collide(currentPiece)) {
      currentPiece.y--;
      mergePiece(currentPiece);
      // После фиксации фигуры проверяем заполненную строку и запускаем анимацию, если нужно
      triggerClearLines();
      // Если новая фигура сразу сталкивается – игра окончена
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
    // Если игра завершена – выходим
    if (!game3Running) return;

    // Если идёт анимация очистки, обновляем её
    if (clearing) {
      updateClearAnimation(time);
    } else {
      const deltaTime = time - lastTime;
      dropCounter += deltaTime;
      if (dropCounter > (fastDrop ? FAST_DROP_INTERVAL : DROP_INTERVAL)) {
        dropPiece();
      }
    }
    lastTime = time;

    // Проверка времени игры
    const elapsed = Date.now() - gameStartTime;
    if (elapsed >= GAME_DURATION) {
      endGame();
      return;
    }
    drawGame3();
    game3AnimationFrameId = requestAnimationFrame(updateGame3);
  }

  // Обработчик клавиш для управления с автоповтором для "←" и "→"
  function handleKeyDown(event) {
    if (!game3Running || clearing) return;
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

  // Функция для имитации события отпускания клавиши (для кнопок "⟳" и "↓")
  function simulateKeyUp(key) {
    const event = new KeyboardEvent("keyup", { key: key });
    handleKeyUp(event);
  }

  // Имитируем событие нажатия клавиши (для кнопок "⟳" и "↓")
  function simulateKey(key) {
    const event = new KeyboardEvent("keydown", { key: key });
    handleKeyDown(event);
  }

  // Создаём мобильные кнопки управления с автоповтором для "←" и "→"
  function createMobileControls() {
    const controlDiv = document.createElement("div");
    controlDiv.id = "tetrisControls";
    // Позиционируем кнопки ниже игрового поля, чтобы они не заходили на область с фигурками
    controlDiv.style.position = "absolute";
    controlDiv.style.top = (TOP_OFFSET + BOARD_HEIGHT + 10) + "px";
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

    // Если есть модальное окно игры – добавляем кнопки туда, иначе в document.body
    const gameModal = document.getElementById("gameModalBackdrop");
    if (gameModal) {
      gameModal.appendChild(controlDiv);
    } else {
      document.body.appendChild(controlDiv);
    }
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
    // Предполагается, что localUserData и userRef определены вне этого модуля
    localUserData.points += score;
    if (typeof userRef !== "undefined" && userRef) {
      userRef.update({ points: localUserData.points });
    }
    cancelAnimationFrame(game3AnimationFrameId);
    document.removeEventListener("keydown", handleKeyDown);
    document.removeEventListener("keyup", handleKeyUp);
    showEndGameModal("Time's up!", "Your score: " + score);
  }

  // Сброс игры
  function resetGame3() {
    cancelAnimationFrame(game3AnimationFrameId);
    game3Running = false;
    document.removeEventListener("keydown", handleKeyDown);
    document.removeEventListener("keyup", handleKeyUp);
    if (ctx) {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
    }
  }

  window.initGame3 = initGame3;
  window.resetGame3 = resetGame3;
})();
