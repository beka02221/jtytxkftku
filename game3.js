(function () {
  // --------------------
  // --- Константы ---
  // --------------------
  const COLS = 10;
  const ROWS = 20;
  const BLOCK_SIZE = 30;
  const BOARD_WIDTH = COLS * BLOCK_SIZE;  // 300
  const BOARD_HEIGHT = ROWS * BLOCK_SIZE; // 600

  const DROP_INTERVAL = 1000;       // Интервал падения (обычный)
  const FAST_DROP_INTERVAL = 100;   // Интервал при ускорении (зажат Down)
  const GAME_DURATION = 120000;     // 2 минуты в мс

  // Цвет самой фигуры (по умолчанию)
  const PIECE_COLOR = "#00FF00";

  // Сколько времени мигает строка перед удалением (мс)
  const LINE_CLEAR_ANIMATION_TIME = 500;
  // Сколько времени занимает "падение" блоков при очистке строк (мс)
  const FALL_ANIMATION_TIME = 400;

  // --------------------
  // --- Глобальные переменные ---
  // --------------------
  let canvas, ctx;
  let board;          // Матрица поля
  let currentPiece;   // Текущая фигура
  let dropCounter = 0;
  let lastTime = 0;
  let gameStartTime = 0;
  let score = 0;
  let game3Running = false;
  let game3AnimationFrameId;

  let fastDrop = false;          // флаг ускоренного падения
  let arrowDownTimeout = null;   // таймер для нажатия вниз (чтобы отличать короткое от долгого)

  // Автоповтор лево/право
  let leftPressed = false;
  let rightPressed = false;
  let leftInitialTimeout = null;
  let rightInitialTimeout = null;
  let leftInterval = null;
  let rightInterval = null;

  // Мобильные кнопки
  let controlDiv = null;

  // Состояние анимации очистки строк
  let isClearing = false;      // Идёт ли анимация очистки?
  let clearingRows = [];       // какие строки удаляются
  let clearingStartTime = 0;   // когда начали анимировать
  let linesToRemove = 0;       // сколько строк реально убрать

  // Состояние анимации падения (после очистки)
  let isFalling = false;               // идёт ли анимация падения
  let fallStartTime = 0;              // начало анимации
  let oldBoard = null;                // копия доски до падения
  let newBoard = null;                // копия доски после удаления
  let linesClearedThisTime = 0;       // сколько строк очистили для подсчёта очков

  // --------------------
  // --- Определения тетрамино ---
  // --------------------
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

  // --------------------
  // --- ФУНКЦИИ ИНИЦИАЛИЗАЦИИ ---
  // --------------------
  function createBoard() {
    board = [];
    for (let r = 0; r < ROWS; r++) {
      board[r] = new Array(COLS).fill(0);
    }
  }

  // Создаём случайную фигуру
  function randomPiece() {
    const types = Object.keys(tetrominoes);
    const randType = types[Math.floor(Math.random() * types.length)];
    return {
      shape: tetrominoes[randType].shape,
      x: Math.floor(COLS / 2) - Math.floor(tetrominoes[randType].shape[0].length / 2),
      y: 0,
    };
  }

  // --------------------
  // --- РИСОВАНИЕ ---
  // --------------------
  // Отрисовка доски + блоков
  // Добавляем time для анимаций (requestAnimationFrame даёт текущее время).
  function drawBoard(time = 0) {
    // Задаём смещение (чтобы поле было по центру канваса)
    const offsetX = (canvas.width - BOARD_WIDTH) / 2;

    ctx.lineWidth = 1;

    // Если идёт анимация падения, часть блоков берём из старой доски, часть — из новой
    // иначе просто рисуем board.
    // Но нам нужно понимать, где сейчас визуально находятся блоки, если они «едут» вниз.

    // Фактор прогресса падения от 0 до 1
    let fallProgress = 1;
    if (isFalling) {
      const elapsed = time - fallStartTime;
      fallProgress = Math.min(elapsed / FALL_ANIMATION_TIME, 1);
    }

    // Пробегаемся по всем ячейкам
    for (let r = 0; r < ROWS; r++) {
      for (let c = 0; c < COLS; c++) {
        let cellValue = 0;

        // Если есть анимация падения:
        if (isFalling) {
          // Как будет выглядеть позиция этой ячейки при «падении»?
          // В newBoard[r][c] лежит значение ячейки после падения,
          // в oldBoard[r][c] — до.
          // Но визуально блок может «ехать» из старого места в новое.
          // На самом деле, проще пробежаться по oldBoard, найти, куда
          // она «переедет» в newBoard, и интерполировать.

          // Для упрощения: если в newBoard[r][c] != 0, значит там
          // в конечном итоге будет блок. Проверим, был ли этот блок
          // на старой доске выше.
          const finalVal = newBoard[r][c];
          if (finalVal !== 0) {
            // Найдём, откуда этот блок «упал»:
            // По логике формирования newBoard, блок мог сдвинуться вниз
            // на (кол-во удалённых строк ниже) строк. Чтобы не считать каждый раз,
            // мы можем пройтись: смотрим старую доску выше r.
            // Но для наглядности — перебор:
            let foundOldRow = -1;
            for (let oldr = 0; oldr <= r; oldr++) {
              if (oldBoard[oldr][c] !== 0 && oldBoard[oldr][c] === finalVal) {
                // Предположим, это тот же блок.
                // (В реальном коде лучше хранить ID фигуры, но у нас всё = 1.
                // Для демонстрации хватит.)
                foundOldRow = oldr;
              }
            }
            if (foundOldRow !== -1 && foundOldRow !== r) {
              // Интерполируем координату
              const deltaRows = r - foundOldRow;
              const currentShift = deltaRows * fallProgress;
              // Позиция по факту будет foundOldRow + currentShift
              // Округлить не надо, рисуем плавающе, чтобы была анимация
              const drawY = (foundOldRow + currentShift) * BLOCK_SIZE;
              cellValue = finalVal;

              // Рисуем блок
              const x = offsetX + c * BLOCK_SIZE;
              const y = drawY;
              ctx.fillStyle = PIECE_COLOR;
              ctx.fillRect(x, y, BLOCK_SIZE, BLOCK_SIZE);
              // Рисуем рамку
              ctx.strokeStyle = "#005500";
              ctx.strokeRect(x, y, BLOCK_SIZE, BLOCK_SIZE);
              continue;
            } else {
              // Если не нашли старую позицию (или старое = текущее),
              // значит он не падал, просто рисуем.
              cellValue = finalVal;
            }
          }
        } else {
          // Без падения, смотрим board напрямую
          cellValue = board[r][c];
        }

        // Если ячейка заполнена (не 0), рисуем
        if (cellValue !== 0) {
          // Если идёт анимация очистки и эта строка в списке clearingRows,
          // можно сделать мигание.
          let fillCol = PIECE_COLOR;
          if (isClearing && clearingRows.includes(r)) {
            // Сделаем мигание: каждые 100 мс — переключение цвета
            const animTime = time - clearingStartTime;
            const blink = Math.floor(animTime / 100) % 2; // 0 или 1
            fillCol = blink === 0 ? "#FFFF00" : "#FF0000"; // жёлто-красное мигание
          }
          const x = offsetX + c * BLOCK_SIZE;
          const y = r * BLOCK_SIZE;

          ctx.fillStyle = fillCol;
          ctx.fillRect(x, y, BLOCK_SIZE, BLOCK_SIZE);
          ctx.strokeStyle = "#005500";
          ctx.strokeRect(x, y, BLOCK_SIZE, BLOCK_SIZE);
        } else {
          // Пустая ячейка — просто рисуем сетку
          const x = offsetX + c * BLOCK_SIZE;
          const y = r * BLOCK_SIZE;
          ctx.strokeStyle = "#002200";
          ctx.strokeRect(x, y, BLOCK_SIZE, BLOCK_SIZE);
        }
      }
    }

    // Внешняя рамка
    ctx.strokeStyle = PIECE_COLOR;
    ctx.strokeRect(offsetX, 0, BOARD_WIDTH, BOARD_HEIGHT);
  }

  // Отрисовка текущей падающей фигуры
  function drawPiece(piece) {
    if (!piece) return;
    if (isClearing || isFalling) return; // во время анимации строк не двигаем фигуру

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

  // --------------------
  // --- ЛОГИКА ---
  // --------------------
  function collide(piece) {
    for (let r = 0; r < piece.shape.length; r++) {
      for (let c = 0; c < piece.shape[r].length; c++) {
        if (piece.shape[r][c]) {
          const newX = piece.x + c;
          const newY = piece.y + r;
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

  function mergePiece(piece) {
    piece.shape.forEach((row, r) => {
      row.forEach((value, c) => {
        if (value) {
          board[piece.y + r][piece.x + c] = 1; // у нас один цвет (1)
        }
      });
    });
  }

  // Поворот матрицы
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

  // Опускание фигуры на 1 вниз
  function dropPiece() {
    if (isClearing || isFalling) return; // пока идёт анимация, не двигаем фигуры
    currentPiece.y++;
    if (collide(currentPiece)) {
      currentPiece.y--;
      mergePiece(currentPiece);
      checkLinesAndAnimate();
      currentPiece = randomPiece();
      if (collide(currentPiece)) {
        // Игра окончена
        endGame();
      }
    }
    dropCounter = 0;
  }

  // Проверяем заполненные линии
  // Но вместо мгновенного удаления — запускаем анимацию мигания.
  function checkLinesAndAnimate() {
    const toClear = [];
    for (let r = 0; r < ROWS; r++) {
      let full = true;
      for (let c = 0; c < COLS; c++) {
        if (board[r][c] === 0) {
          full = false;
          break;
        }
      }
      if (full) toClear.push(r);
    }
    if (toClear.length > 0) {
      isClearing = true;
      clearingRows = toClear;
      clearingStartTime = performance.now();
      linesToRemove = toClear.length;
      linesClearedThisTime = toClear.length;
      // Пока идёт мигание, мы «замораживаем» падение
    }
  }

  // Функция, которая действительно удаляет строки из board (после мигания)
  function removeClearedLines() {
    let count = 0;
    clearingRows.forEach((rowIndex) => {
      board.splice(rowIndex - count, 1);
      board.unshift(new Array(COLS).fill(0));
      count++;
    });
    // Начислим очки
    score += linesClearedThisTime * 30;

    // После этого запускаем анимацию падения (если хотите более реалистично —
    // можно сразу «сдвинуть» и не анимировать; здесь для примера).
    startFallAnimation();
  }

  // --------------------
  // --- АНИМАЦИЯ ПАДЕНИЯ ---
  // --------------------
  function startFallAnimation() {
    isClearing = false; // закончили мигание
    clearingRows = [];
    linesToRemove = 0;

    oldBoard = null;
    newBoard = null;

    // Сохраняем текущее состояние (уже с удалёнными строками) как newBoard
    newBoard = board.map(row => [...row]);

    // Но чтобы сделать анимацию падения, нужно откатиться назад?
    // На самом деле, для наглядности можно сказать:
    //  - oldBoard — это доска *до* removeClearedLines.
    //  Однако мы уже удалили строки. Для демонстрации «плавного» падения
    //  мы берём newBoard как финальную, а oldBoard делаем «до удаления строк»?
    //  Но на самом деле лучше сделать копию до splice. Тут для простоты:
    //    - Вызовем checkLinesAndAnimate → removeClearedLines, *потом* startFallAnimation,
    //      где oldBoard будет доской *уже без* строк.
    //    - Но визуально падать нечему, ведь мы уже убрали строку внизу?
    //  Поэтому давайте сделаем иначе:
    //    - Сначала сохраним oldBoard, потом удалим строки, запишем это в newBoard,
    //      потом начнём анимацию.

    // Упростим: мы уже удалили строки, значит всё сверху «телепортнулось».
    // Чтобы показать анимацию, сделаем наоборот:
    // oldBoard = «доска до сдвига», newBoard = «доска после сдвига».
    // но у нас уже нет старого board. Для демонстрации пусть всё «прыгает» :)

    // Закончим тем, что используем newBoard как есть. oldBoard сделаем копией newBoard,
    // потом быстро «поднимем» ряды вверх на кол-во удалённых строк, чтобы анимировать вниз.
    oldBoard = newBoard.map(row => [...row]);

    // Поднимем все ряды на linesClearedThisTime
    // Чтобы получился эффект, будто они сейчас опустятся назад вниз :)
    // (Да, это не совсем «реальный» тетрис, но демонстрирует анимацию.)
    if (linesClearedThisTime > 0) {
      const shift = linesClearedThisTime;
      for (let r = 0; r < ROWS - shift; r++) {
        oldBoard[r] = oldBoard[r + shift].slice();
      }
      for (let r = ROWS - shift; r < ROWS; r++) {
        oldBoard[r] = new Array(COLS).fill(0);
      }
    }

    // Запускаем анимацию
    isFalling = true;
    fallStartTime = performance.now();
  }

  // Когда анимация падения завершается (если требуется),
  // мы копируем newBoard в board окончательно.
  function finalizeFallAnimation() {
    isFalling = false;
    board = newBoard.map(row => [...row]);
    oldBoard = null;
    newBoard = null;
    linesClearedThisTime = 0;
  }

  // --------------------
  // --- ГЛАВНЫЙ ЦИКЛ ---
  // --------------------
  function updateGame3(time = 0) {
    const deltaTime = time - lastTime;
    lastTime = time;

    if (!isClearing && !isFalling) {
      // Обычный режим падения
      dropCounter += deltaTime;
      if (dropCounter > (fastDrop ? FAST_DROP_INTERVAL : DROP_INTERVAL)) {
        dropPiece();
      }
    } else if (isClearing) {
      // Проверяем, не закончилось ли время мигания
      const elapsed = time - clearingStartTime;
      if (elapsed >= LINE_CLEAR_ANIMATION_TIME) {
        // Удаляем строки
        removeClearedLines();
      }
    } else if (isFalling) {
      // Проверяем, не закончилось ли время падения
      const elapsed = time - fallStartTime;
      if (elapsed >= FALL_ANIMATION_TIME) {
        finalizeFallAnimation();
      }
    }

    // Проверяем время игры
    const elapsedGame = Date.now() - gameStartTime;
    if (elapsedGame >= GAME_DURATION) {
      endGame();
      return;
    }

    // Рисуем всё
    ctx.fillStyle = "#000";
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Полоска оставшегося времени
    const timeLeft = Math.max(GAME_DURATION - elapsedGame, 0);
    const sliderWidth = (timeLeft / GAME_DURATION) * canvas.width;
    ctx.fillStyle = "#00FF00";
    ctx.fillRect(0, 0, sliderWidth, 5);

    // Счёт
    ctx.fillStyle = "#00FF00";
    ctx.font = "16px 'Press Start 2P', monospace";
    ctx.textAlign = "center";
    ctx.fillText("Score: " + score, canvas.width / 2, 25);

    // Рисуем поле и фигуру
    drawBoard(time);
    drawPiece(currentPiece);

    game3AnimationFrameId = requestAnimationFrame(updateGame3);
  }

  // --------------------
  // --- УПРАВЛЕНИЕ ---
  // --------------------
  function handleKeyDown(event) {
    if (!game3Running) return;
    if (isClearing || isFalling) return; // во время анимаций не двигаем фигуру

    switch (event.key) {
      case "ArrowLeft":
        if (!leftPressed) {
          leftPressed = true;
          moveLeft();
          leftInitialTimeout = setTimeout(() => {
            leftInterval = setInterval(moveLeft, 100);
          }, 150);
        }
        break;
      case "ArrowRight":
        if (!rightPressed) {
          rightPressed = true;
          moveRight();
          rightInitialTimeout = setTimeout(() => {
            rightInterval = setInterval(moveRight, 100);
          }, 150);
        }
        break;
      case "ArrowDown":
        if (!arrowDownTimeout) {
          arrowDownTimeout = setTimeout(() => {
            fastDrop = true;
            arrowDownTimeout = null;
          }, 150);
        }
        break;
      case "ArrowUp":
        rotatePiece();
        break;
      default:
        break;
    }
  }

  function handleKeyUp(event) {
    switch (event.key) {
      case "ArrowLeft":
        clearTimeout(leftInitialTimeout);
        clearInterval(leftInterval);
        leftPressed = false;
        break;
      case "ArrowRight":
        clearTimeout(rightInitialTimeout);
        clearInterval(rightInterval);
        rightPressed = false;
        break;
      case "ArrowDown":
        if (arrowDownTimeout) {
          // Если отпустили быстро — делаем один шаг вниз
          clearTimeout(arrowDownTimeout);
          arrowDownTimeout = null;
          dropPiece();
        }
        fastDrop = false;
        break;
      default:
        break;
    }
  }

  function moveLeft() {
    currentPiece.x--;
    if (collide(currentPiece)) {
      currentPiece.x++;
    }
  }
  function moveRight() {
    currentPiece.x++;
    if (collide(currentPiece)) {
      currentPiece.x--;
    }
  }
  function rotatePiece() {
    const oldShape = currentPiece.shape;
    currentPiece.shape = rotate(currentPiece.shape);
    if (collide(currentPiece)) {
      // Попробуем сдвиг влево
      currentPiece.x--;
      if (collide(currentPiece)) {
        // Попробуем сдвиг вправо
        currentPiece.x += 2;
        if (collide(currentPiece)) {
          // Отменяем поворот
          currentPiece.x--;
          currentPiece.shape = oldShape;
        }
      }
    }
  }

  // --------------------
  // --- ВСПОМОГАТЕЛЬНЫЕ ---
  // --------------------
  // Симулируем нажатие (для кнопок мобильных)
  function simulateKeyDown(key) {
    const evt = new KeyboardEvent("keydown", { key });
    handleKeyDown(evt);
  }
  function simulateKeyUp(key) {
    const evt = new KeyboardEvent("keyup", { key });
    handleKeyUp(evt);
  }

  // --------------------
  // --- Мобильные кнопки ---
  // --------------------
  function createMobileControls() {
    controlDiv = document.createElement("div");
    controlDiv.id = "tetrisControls";

    // Кнопка влево
    const btnLeft = document.createElement("button");
    btnLeft.textContent = "←";
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

    // Кнопка поворота (ArrowUp)
    const btnRotate = document.createElement("button");
    btnRotate.textContent = "⟳";
    btnRotate.addEventListener("touchstart", (e) => {
      e.preventDefault();
      simulateKeyDown("ArrowUp");
    });
    btnRotate.addEventListener("mousedown", (e) => {
      e.preventDefault();
      simulateKeyDown("ArrowUp");
    });
    btnRotate.addEventListener("mouseup", (e) => {
      e.preventDefault();
      simulateKeyUp("ArrowUp");
    });
    btnRotate.addEventListener("touchend", (e) => {
      e.preventDefault();
      simulateKeyUp("ArrowUp");
    });

    // Кнопка вниз (ArrowDown)
    const btnDown = document.createElement("button");
    btnDown.textContent = "↓";
    btnDown.addEventListener("touchstart", (e) => {
      e.preventDefault();
      simulateKeyDown("ArrowDown");
    });
    btnDown.addEventListener("touchend", (e) => {
      e.preventDefault();
      simulateKeyUp("ArrowDown");
    });
    btnDown.addEventListener("mousedown", (e) => {
      e.preventDefault();
      simulateKeyDown("ArrowDown");
    });
    btnDown.addEventListener("mouseup", (e) => {
      e.preventDefault();
      simulateKeyUp("ArrowDown");
    });

    // Кнопка вправо
    const btnRight = document.createElement("button");
    btnRight.textContent = "→";
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

    // Добавим в body
    document.body.appendChild(controlDiv);
  }

  function removeMobileControls() {
    if (controlDiv && controlDiv.parentNode) {
      controlDiv.parentNode.removeChild(controlDiv);
      controlDiv = null;
    }
  }

  // --------------------
  // --- МОДАЛКА ---
  // --------------------
  function showModal(title, message) {
    const backdrop = document.getElementById("gameModalBackdrop");
    const modalTitle = document.getElementById("modalTitle");
    const modalMessage = document.getElementById("modalMessage");

    modalTitle.textContent = title;
    modalMessage.textContent = message;
    backdrop.style.display = "flex";
  }

  window.closeModal = function () {
    const backdrop = document.getElementById("gameModalBackdrop");
    backdrop.style.display = "none";
  };

  // --------------------
  // --- ОСНОВНЫЕ ---
  // --------------------
  function initGame3() {
    canvas = document.getElementById("game3Canvas");
    ctx = canvas.getContext("2d");

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

  function endGame() {
    if (!game3Running) return;
    game3Running = false;

    cancelAnimationFrame(game3AnimationFrameId);
    document.removeEventListener("keydown", handleKeyDown);
    document.removeEventListener("keyup", handleKeyUp);
    removeMobileControls();

    showModal("Игра окончена", `Вы набрали очков: ${score}`);
  }

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

  // Экспортируем для внешнего использования
  window.initGame3 = initGame3;
  window.resetGame3 = resetGame3;
})();
