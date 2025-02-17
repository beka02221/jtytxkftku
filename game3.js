/* ===============================
   game3.js — Tetris в стиле Матрицы
   Управление:
    - Стрелки клавиатуры: ←, →, ↓ для перемещения, ↑ для поворота
    - Мобильные кнопки (создаются динамически)
   Таймер игры — 1 минута (отображается в виде слайдера вверху)
   По завершении игры сумма набранных очков прибавляется к балансу
=============================== */
(function () {
  // Размеры игрового поля и базовые константы
  const COLS = 10;
  const ROWS = 20;
  const BLOCK_SIZE = 20; // уменьшен размер клетки (было 30)
  const BOARD_WIDTH = COLS * BLOCK_SIZE;   // 200px
  const BOARD_HEIGHT = ROWS * BLOCK_SIZE;    // 400px
  const DROP_INTERVAL = 1000; // интервал падения фигуры (мс)
  const GAME_DURATION = 60000; // длительность игры: 1 минута (60000 мс)
  const PIECE_COLOR = "#00FF00"; // неоново-зелёный (стиль Матрицы)
  
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

  // Рисуем игровое поле с заблокированными блоками
  function drawBoard() {
    // Центрируем поле по горизонтали
    const offsetX = (canvas.width - BOARD_WIDTH) / 2;
    for (let r = 0; r < ROWS; r++) {
      for (let c = 0; c < COLS; c++) {
        if (board[r][c] !== 0) {
          ctx.fillStyle = PIECE_COLOR;
          ctx.fillRect(offsetX + c * BLOCK_SIZE, r * BLOCK_SIZE, BLOCK_SIZE, BLOCK_SIZE);
          ctx.strokeStyle = "#003300";
          ctx.strokeRect(offsetX + c * BLOCK_SIZE, r * BLOCK_SIZE, BLOCK_SIZE, BLOCK_SIZE);
        } else {
          // Рисуем тонкую сетку
          ctx.strokeStyle = "#001100";
          ctx.strokeRect(offsetX + c * BLOCK_SIZE, r * BLOCK_SIZE, BLOCK_SIZE, BLOCK_SIZE);
        }
      }
    }
  }

  // Рисуем текущую фигуру
  function drawPiece(piece) {
    const offsetX = (canvas.width - BOARD_WIDTH) / 2;
    ctx.fillStyle = PIECE_COLOR;
    // Эффект свечения
    ctx.shadowColor = PIECE_COLOR;
    ctx.shadowBlur = 10;
    piece.shape.forEach((row, r) => {
      row.forEach((value, c) => {
        if (value) {
          ctx.fillRect(offsetX + (piece.x + c) * BLOCK_SIZE, (piece.y + r) * BLOCK_SIZE, BLOCK_SIZE, BLOCK_SIZE);
          ctx.strokeStyle = "#003300";
          ctx.strokeRect(offsetX + (piece.x + c) * BLOCK_SIZE, (piece.y + r) * BLOCK_SIZE, BLOCK_SIZE, BLOCK_SIZE);
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
      // Начальная позиция по горизонтали — по центру
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
      // Если строка заполнена – удаляем её
      board.splice(r, 1);
      board.unshift(new Array(COLS).fill(0));
      linesCleared++;
      r++; // повторная проверка той же строки (так как строки сдвинулись)
    }
    if (linesCleared > 0) {
      score += linesCleared * 100;
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
        // Если новая фигура сразу столкнулась – игра окончена
        endGame();
      }
    }
    dropCounter = 0;
  }

  // Основной игровой цикл
  function updateGame3(time = 0) {
    const deltaTime = time - lastTime;
    lastTime = time;
    dropCounter += deltaTime;
    if (dropCounter > DROP_INTERVAL) {
      dropPiece();
    }

    // Проверяем, истёк ли игровой таймер (1 минута)
    const elapsed = Date.now() - gameStartTime;
    if (elapsed >= GAME_DURATION) {
      endGame();
      return;
    }

    drawGame3();
    game3AnimationFrameId = requestAnimationFrame(updateGame3);
  }

  // Отрисовка всего игрового состояния
  function drawGame3() {
    // Заливаем фон (стиль Матрицы: чёрный)
    ctx.fillStyle = "#000";
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Рисуем таймер в виде слайдера вверху
    const timeLeft = Math.max(GAME_DURATION - (Date.now() - gameStartTime), 0);
    const sliderWidth = (timeLeft / GAME_DURATION) * canvas.width;
    ctx.fillStyle = "#00FF00";
    ctx.fillRect(0, 0, sliderWidth, 5);

    // Рисуем игровое поле и текущую фигуру
    drawBoard();
    drawPiece(currentPiece);

    // Отображаем текущий счёт (шрифт “Press Start 2P”)
    ctx.fillStyle = "#00FF00";
    ctx.font = "20px 'Press Start 2P'";
    ctx.fillText("Score: " + score, 10, 30);
  }

  // Обработчик клавиш для управления
  function handleKeyDown(event) {
    if (!game3Running) return;
    if (event.key === "ArrowLeft") {
      currentPiece.x--;
      if (collide(currentPiece)) {
        currentPiece.x++;
      }
    } else if (event.key === "ArrowRight") {
      currentPiece.x++;
      if (collide(currentPiece)) {
        currentPiece.x--;
      }
    } else if (event.key === "ArrowDown") {
      dropPiece();
    } else if (event.key === "ArrowUp") {
      // Поворот фигуры
      const rotated = rotate(currentPiece.shape);
      const oldShape = currentPiece.shape;
      currentPiece.shape = rotated;
      if (collide(currentPiece)) {
        // Пробуем сдвиг ("wall kick")
        if (!collide({ ...currentPiece, x: currentPiece.x - 1 })) {
          currentPiece.x--;
        } else if (!collide({ ...currentPiece, x: currentPiece.x + 1 })) {
          currentPiece.x++;
        } else {
          currentPiece.shape = oldShape; // откат
        }
      }
    }
    drawGame3();
  }

  // Создаём мобильные кнопки управления (лево, поворот, вниз, право)
  function createMobileControls() {
    controlDiv = document.createElement("div");
    controlDiv.id = "tetrisControls";
    // Стили для контейнера кнопок
    controlDiv.style.position = "fixed";
    controlDiv.style.bottom = "20px";
    controlDiv.style.left = "50%";
    controlDiv.style.transform = "translateX(-50%)";
    controlDiv.style.display = "flex";
    controlDiv.style.justifyContent = "center";
    controlDiv.style.gap = "10px";
    controlDiv.style.zIndex = "9999"; // повышенный z-index, чтобы кнопки были поверх всего

    // Функция для стилизации кнопки
    function styleControlButton(btn) {
      btn.style.width = "50px";
      btn.style.height = "50px";
      btn.style.fontSize = "24px";
      btn.style.borderRadius = "5px";
      btn.style.border = "2px solid #00FF00";
      btn.style.background = "#000";
      btn.style.color = "#00FF00";
      btn.style.outline = "none";
    }

    // Кнопка влево
    const btnLeft = document.createElement("button");
    btnLeft.textContent = "←";
    styleControlButton(btnLeft);
    btnLeft.addEventListener("touchstart", (e) => {
      e.preventDefault();
      simulateKey("ArrowLeft");
    });
    btnLeft.addEventListener("click", () => {
      simulateKey("ArrowLeft");
    });

    // Кнопка поворота
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

    // Кнопка вниз
    const btnDown = document.createElement("button");
    btnDown.textContent = "↓";
    styleControlButton(btnDown);
    btnDown.addEventListener("touchstart", (e) => {
      e.preventDefault();
      simulateKey("ArrowDown");
    });
    btnDown.addEventListener("click", () => {
      simulateKey("ArrowDown");
    });

    // Кнопка вправо
    const btnRight = document.createElement("button");
    btnRight.textContent = "→";
    styleControlButton(btnRight);
    btnRight.addEventListener("touchstart", (e) => {
      e.preventDefault();
      simulateKey("ArrowRight");
    });
    btnRight.addEventListener("click", () => {
      simulateKey("ArrowRight");
    });

    // Добавляем кнопки в контейнер
    controlDiv.appendChild(btnLeft);
    controlDiv.appendChild(btnRotate);
    controlDiv.appendChild(btnDown);
    controlDiv.appendChild(btnRight);

    // Добавляем контейнер в тело документа
    document.body.appendChild(controlDiv);
  }

  // Удаляем мобильные кнопки (при завершении игры)
  function removeMobileControls() {
    if (controlDiv) {
      document.body.removeChild(controlDiv);
      controlDiv = null;
    }
  }

  // Имитируем событие нажатия клавиши
  function simulateKey(key) {
    const event = new KeyboardEvent("keydown", { key: key });
    handleKeyDown(event);
  }

  // Инициализация игры (вызывается из основного скрипта)
  function initGame3() {
    canvas = document.getElementById("game3Canvas");
    ctx = canvas.getContext("2d");
    // Задаём фон canvas (стиль Матрицы)
    canvas.style.background = "#000";
    createBoard();
    currentPiece = randomPiece();
    score = 0;
    dropCounter = 0;
    lastTime = 0;
    gameStartTime = Date.now();
    game3Running = true;
    // Добавляем обработчик клавиатуры
    document.addEventListener("keydown", handleKeyDown);
    // Создаём мобильные кнопки
    createMobileControls();
    // Запускаем игровой цикл
    updateGame3();
  }

  // Завершение игры
  function endGame() {
    if (!game3Running) return;
    game3Running = false;
    // Добавляем набранный счёт к балансу пользователя
    localUserData.points += score;
    if (userRef) {
      userRef.update({ points: localUserData.points });
    }
    cancelAnimationFrame(game3AnimationFrameId);
    document.removeEventListener("keydown", handleKeyDown);
    removeMobileControls();
    // Вызываем модальное окно завершения игры (функция определена в основном скрипте)
    showEndGameModal("Time's up!", "Your score: " + score);
  }

  // Сброс игры (вызывается при закрытии игрового модала)
  function resetGame3() {
    cancelAnimationFrame(game3AnimationFrameId);
    game3Running = false;
    document.removeEventListener("keydown", handleKeyDown);
    removeMobileControls();
    if (ctx) {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
    }
  }

  // Экспорт функций в глобальную область, чтобы основной скрипт мог их вызвать
  window.initGame3 = initGame3;
  window.resetGame3 = resetGame3;
})();

  // Экспорт функций в глобальную область, чтобы основной скрипт мог их вызвать
  window.initGame3 = initGame3;
  window.resetGame3 = resetGame3;
})();
