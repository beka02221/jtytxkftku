
(function () {
  // Размеры игрового поля и базовые константы
  const COLS = 10;
  const ROWS = 20;
  const BLOCK_SIZE = 30; // размер клетки в пикселях
  const BOARD_WIDTH = COLS * BLOCK_SIZE;   // 300px
  const BOARD_HEIGHT = ROWS * BLOCK_SIZE;  // 600px
  
  const DROP_INTERVAL = 1000;      // интервал падения фигуры (мс) при обычном режиме
  const FAST_DROP_INTERVAL = 100;  // интервал падения при быстром режиме (мс)
  const GAME_DURATION = 120000;    // длительность игры: 2 минуты (120000 мс)

  // "Неоново-зелёный" по умолчанию
  const PIECE_COLOR = "#00FF00";  
  // Отступ сверху для отрисовки игрового поля (если нужно сместить вниз)
  const TOP_OFFSET = 80;

  // Параметры для анимации удаления линий
  const LINE_CLEAR_DURATION = 500; // 0.5 секунды мигаем строкой
  const FLASH_FREQUENCY = 100;     // каждые 100 мс меняем цвет для мигания

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
  
  // флаг быстрого падения
  let fastDrop = false;
  // время ожидания перед включением fastDrop (чтобы короткое нажатие делало одиночное "шаг вниз")
  let arrowDownTimeout = null;

  // Переменные для автоповтора лево/право
  let leftPressed = false;
  let rightPressed = false;
  let leftInitialTimeout = null;
  let rightInitialTimeout = null;
  let leftInterval = null;
  let rightInterval = null;

  // Для мобильных кнопок
  let controlDiv = null;

  // Переменные для анимации удаления линий
  let animatingLineClear = false;   // флаг, что мы сейчас мигаем заполненные линии
  let lineClearStartTime = 0;       // время начала анимации
  let linesToClear = [];            // массив индексов строк, которые надо очистить после анимации

  // Определения тетрамино
  // (Все будут одного цвета, но можно расширить логику, чтобы каждая фигура имела свой цвет)
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
        board[r][c] = 0; // 0 означает пусто
      }
    }
  }

  // Функция для получения цвета клетки с учётом анимации удаления
  function getCellColor(r, c) {
    const cellVal = board[r][c];

    // Если клетка пустая
    if (cellVal === 0) {
      return null; // в drawBoard проверим, если null — не заливаем
    }

    // Если сейчас идёт анимация удаления и эта строка в списке linesToClear,
    // мигаем между красным и белым
    if (animatingLineClear && linesToClear.includes(r)) {
      const elapsed = Date.now() - lineClearStartTime;
      // каждую половину FLASH_FREQUENCY чередуем цвет
      const phase = Math.floor((elapsed % (FLASH_FREQUENCY * 2)) / FLASH_FREQUENCY);
      return phase === 0 ? "#FFFFFF" : "#FF0000";
    }

    // Иначе возвращаем основной цвет тетрамино
    return PIECE_COLOR;
  }

  // Рисуем игровое поле
  function drawBoard() {
    const offsetX = (canvas.width - BOARD_WIDTH) / 2;

    ctx.lineWidth = 2; 
    for (let r = 0; r < ROWS; r++) {
      for (let c = 0; c < COLS; c++) {
        const x = offsetX + c * BLOCK_SIZE;
        const y = r * BLOCK_SIZE;
        const color = getCellColor(r, c);

        if (color) {
          // заблокированный блок
          ctx.fillStyle = color;
          ctx.fillRect(x, y, BLOCK_SIZE, BLOCK_SIZE);
          ctx.strokeStyle = "#005500";
          ctx.strokeRect(x, y, BLOCK_SIZE, BLOCK_SIZE);
        } else {
          // пустая клетка - просто нарисуем сетку
          ctx.strokeStyle = "#002200";
          ctx.strokeRect(x, y, BLOCK_SIZE, BLOCK_SIZE);
        }
      }
    }

    // Отрисовка внешней рамки поля
    ctx.strokeStyle = PIECE_COLOR;
    ctx.strokeRect(offsetX, 0, BOARD_WIDTH, BOARD_HEIGHT);
    ctx.lineWidth = 1; 
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
          board[piece.y + r][piece.x + c] = 1; // тут можно хранить разные цифры для разных фигур
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
          // Границы поля
          if (newX < 0 || newX >= COLS || newY >= ROWS) {
            return true;
          }
          // Столкновение с уже лежащим блоком
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

  // Запуск анимации подсвечивания заполненных строк (если есть)
  function checkAndStartLineClearAnimation() {
    let fullLines = [];
    for (let r = 0; r < ROWS; r++) {
      let isFull = true;
      for (let c = 0; c < COLS; c++) {
        if (board[r][c] === 0) {
          isFull = false;
          break;
        }
      }
      if (isFull) {
        fullLines.push(r);
      }
    }
    if (fullLines.length > 0) {
      // Запускаем анимацию
      animatingLineClear = true;
      linesToClear = fullLines;
      lineClearStartTime = Date.now();
    }
  }

  // Удаляем «полные» строки из доски (после анимации)
  // и добавляем пустые строки сверху
  function removeFullLines() {
    let linesCleared = 0;
    linesToClear.forEach((rowIndex) => {
      board.splice(rowIndex, 1);
      board.unshift(new Array(COLS).fill(0));
      linesCleared++;
    });
    // Добавляем очки
    if (linesCleared > 0) {
      score += linesCleared * 30;
    }
    linesToClear = [];
  }

  // Опускаем фигуру на одну строку
  function dropPiece() {
    currentPiece.y++;
    if (collide(currentPiece)) {
      // откат обратно
      currentPiece.y--;
      mergePiece(currentPiece);

      // Проверяем заполненные строки (запускаем анимацию, если есть)
      checkAndStartLineClearAnimation();

      // Сразу даём новую фигуру (если строк нет, мы продолжим обычную игру)
      currentPiece = randomPiece();
      // Если новая фигура сразу не может встать, значит игра окончена
      if (collide(currentPiece)) {
        endGame();
      }
    }
    dropCounter = 0;
  }

  // Автоповтор влево
  function moveLeft() {
    currentPiece.x--;
    if (collide(currentPiece)) {
      currentPiece.x++;
    }
    drawGame3();
  }
  // Автоповтор вправо
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

    // Если идёт анимация удаления линий, проверим, не пора ли завершать
    if (animatingLineClear) {
      const elapsed = Date.now() - lineClearStartTime;
      // Если прошла заданная длительность мигания, удаляем строки
      if (elapsed >= LINE_CLEAR_DURATION) {
        removeFullLines();       // физически убираем строки
        animatingLineClear = false;
      }
      // Пока анимация идёт, мы не двигаем фигуру, не обрабатываем dropPiece
      // Просто перерисовываем кадр и всё.
      drawGame3();

    } else {
      // Обычный игровой режим — двигаем фигуру
      dropCounter += deltaTime;
      if (dropCounter > (fastDrop ? FAST_DROP_INTERVAL : DROP_INTERVAL)) {
        dropPiece();
      }
      // Проверяем, не вышло ли время (2 минуты)
      const elapsed = Date.now() - gameStartTime;
      if (elapsed >= GAME_DURATION) {
        endGame();
        return;
      }
      // Рисуем всё
      drawGame3();
    }
    // Рекурсивно заказываем следующий кадр анимации
    game3AnimationFrameId = requestAnimationFrame(updateGame3);
  }

  // Отрисовка текущего состояния
  function drawGame3() {
    ctx.fillStyle = "#000000";
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Полоска таймера
    const timeLeft = Math.max(GAME_DURATION - (Date.now() - gameStartTime), 0);
    const sliderWidth = (timeLeft / GAME_DURATION) * canvas.width;
    ctx.fillStyle = "#00FF00";
    ctx.fillRect(0, 0, sliderWidth, 5);

    // Текст со счётом
    ctx.fillStyle = "#00FF00";
    ctx.font = "20px 'Press Start 2P', monospace";
    ctx.textAlign = "center";
    ctx.fillText("Score: " + score, canvas.width / 2, 30);

    // Сдвигаем ось Y, если нужен TOP_OFFSET
    ctx.save();
    ctx.translate(0, TOP_OFFSET);
    drawBoard();
    // Рисуем фигуру, если не идёт анимация удаления
    // (Можно рисовать даже при анимации — но тогда мешается визуально)
    if (!animatingLineClear) {
      drawPiece(currentPiece);
    }
    ctx.restore();
  }

  // Обработчик нажатия клавиш
  function handleKeyDown(event) {
    if (!game3Running) return;

    // Если идёт анимация удаления, обычно блокируем управление:
    if (animatingLineClear) {
      return;
    }

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
      // Через 150 мс включаем fastDrop, если кнопку не отпустили
      if (!arrowDownTimeout) {
        arrowDownTimeout = setTimeout(() => {
          fastDrop = true;
          arrowDownTimeout = null;
        }, 150);
      }
    } else if (event.key === "ArrowUp") {
      // Поворот фигуры
      const rotated = rotate(currentPiece.shape);
      const oldShape = currentPiece.shape;
      currentPiece.shape = rotated;
      if (collide(currentPiece)) {
        // пробуем сдвинуться влево
        if (!collide({ ...currentPiece, x: currentPiece.x - 1 })) {
          currentPiece.x--;
        }
        // или вправо
        else if (!collide({ ...currentPiece, x: currentPiece.x + 1 })) {
          currentPiece.x++;
        } 
        // иначе откатываем поворот
        else {
          currentPiece.shape = oldShape;
        }
      }
      drawGame3();
    }
  }

  // Обработчик отпускания клавиш
  function handleKeyUp(event) {
    if (!game3Running) return;

    if (event.key === "ArrowLeft") {
      clearTimeout(leftInitialTimeout);
      clearInterval(leftInterval);
      leftPressed = false;
    } else if (event.key === "ArrowRight") {
      clearTimeout(rightInitialTimeout);
      clearInterval(rightInterval);
      rightPressed = false;
    } else if (event.key === "ArrowDown") {
      // Если отпустили раньше 150 мс — делаем одиночное "шаг вниз"
      if (arrowDownTimeout) {
        clearTimeout(arrowDownTimeout);
        arrowDownTimeout = null;
        // Одноразовое опускание
        dropPiece();
      }
      // Иначе выключаем fastDrop
      fastDrop = false;
    }
  }

  // Имитируем событие нажатия клавиши
  function simulateKey(key) {
    const event = new KeyboardEvent("keydown", { key: key });
    handleKeyDown(event);
  }
  // Имитируем событие отпускания клавиши
  function simulateKeyUp(key) {
    const event = new KeyboardEvent("keyup", { key: key });
    handleKeyUp(event);
  }

  // Создаём мобильные кнопки управления
  function createMobileControls() {
    controlDiv = document.createElement("div");
    controlDiv.id = "tetrisControls";

    // Стили, чтобы кнопки всегда были внизу, по центру,
    // и не перекрывали канвас (или хотя бы минимизировать шансы)
    controlDiv.style.position = "fixed";
    controlDiv.style.bottom = "20px";
    controlDiv.style.left = "50%";
    controlDiv.style.transform = "translateX(-50%)";
    controlDiv.style.zIndex = "9999";
    controlDiv.style.width = "220px";
    controlDiv.style.display = "flex";
    controlDiv.style.justifyContent = "space-between";
    controlDiv.style.backgroundColor = "rgba(0,0,0,0.2)";
    controlDiv.style.padding = "10px";
    controlDiv.style.borderRadius = "8px";

    // Функция для стилизации пиксельной кнопки
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
      btn.style.cursor = "pointer";
    }

    // Кнопка "←"
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

    // Кнопка "⟳" (поворот)
    const btnRotate = document.createElement("button");
    btnRotate.textContent = "⟳";
    styleControlButton(btnRotate);
    // Только одиночное нажатие
    btnRotate.addEventListener("touchstart", (e) => {
      e.preventDefault();
      simulateKey("ArrowUp");
    });
    btnRotate.addEventListener("mousedown", (e) => {
      e.preventDefault();
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
    btnDown.addEventListener("mousedown", (e) => {
      e.preventDefault();
      simulateKey("ArrowDown");
    });
    btnDown.addEventListener("mouseup", (e) => {
      e.preventDefault();
      simulateKeyUp("ArrowDown");
    });

    // Кнопка "→"
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

    // Добавляем кнопки в контейнер
    controlDiv.appendChild(btnLeft);
    controlDiv.appendChild(btnRotate);
    controlDiv.appendChild(btnDown);
    controlDiv.appendChild(btnRight);

    // Добавляем контейнер на страницу
    document.body.appendChild(controlDiv);
  }

  // Удаляем мобильные кнопки (при завершении / сбросе игры)
  function removeMobileControls() {
    if (controlDiv && controlDiv.parentNode) {
      controlDiv.parentNode.removeChild(controlDiv);
      controlDiv = null;
    }
  }

  // Инициализация игры
  function initGame3() {
    canvas = document.getElementById("game3Canvas");
    if (!canvas) {
      console.error("Canvas with id 'game3Canvas' not found!");
      return;
    }
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

    createMobileControls();  // показываем мобильные кнопки

    // Запускаем цикл
    updateGame3();
  }

  // Завершение игры
  function endGame() {
    if (!game3Running) return;
    game3Running = false;

    // Останавливаем анимацию
    cancelAnimationFrame(game3AnimationFrameId);

    // Удаляем события
    document.removeEventListener("keydown", handleKeyDown);
    document.removeEventListener("keyup", handleKeyUp);

    // Убираем кнопки
    removeMobileControls();

    // Здесь можно показывать модалку или выводить сообщение
    alert("Game Over! Your score: " + score);
  }

  // Сброс игры (очистка экрана и т.п.)
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

  // Экспортируем функции в глобальный объект для кнопок
  window.initGame3 = initGame3;
  window.resetGame3 = resetGame3;
})();

