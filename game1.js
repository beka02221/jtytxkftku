/* game2.js – Полная реализация игры "HackMatch 3" */

(function() {
  // Размеры поля и ячеек
  const ROWS = 8,
        COLS = 8,
        cellSize = 60; // размер ячейки в пикселях

  // Массив для хранения состояния игрового поля (матрица)
  let grid = [];

  // Массив для хранения загруженных изображений (иконок)
  let icons = [];
  // URL-ы иконок (неоновые элементы, тематические для хакинга)
  const iconUrls = [
    "https://img.icons8.com/ios/50/lock.png",
    "https://img.icons8.com/ios/50/error--v1.png",
    "https://img.icons8.com/fluency-systems-regular/50/fraud.png",
    "https://img.icons8.com/fluency-systems-regular/50/key-security--v1.png",
    "https://img.icons8.com/fluency-systems-regular/50/user-credentials.png"
  ];
  let imagesLoaded = 0,
      totalImages = iconUrls.length;

  // Ссылка на canvas и его контекст
  let canvas, ctx;

  // Переменные для управления выбором и анимацией
  let selectedCell = null;  // { row, col } выбранная ячейка
  let isProcessing = false; // флаг блокировки ввода во время анимаций/обработки

  // Переменные для игры
  let score = 0;                 // текущий счёт (увеличивается на 10 за каждую удалённую иконку)
  let gameStartTime = 0;         // время начала игры (в мс)
  const GAME_DURATION = 60 * 1000; // 60 секунд

  // Предварительная загрузка изображений
  function preloadImages(callback) {
    for (let i = 0; i < iconUrls.length; i++) {
      const img = new Image();
      img.src = iconUrls[i];
      img.onload = function() {
        imagesLoaded++;
        if (imagesLoaded === totalImages) {
          callback();
        }
      };
      icons.push(img);
    }
  }

  // Инициализация игрового поля – заполняем матрицу случайными типами (индексами иконок)
  function initGrid() {
    grid = [];
    for (let r = 0; r < ROWS; r++) {
      let row = [];
      for (let c = 0; c < COLS; c++) {
        row.push({
          type: Math.floor(Math.random() * iconUrls.length), // случайный тип
          offsetY: 0,        // смещение по вертикали (для анимации падения)
          exploding: false,  // флаг эффекта «взрыва»
          explosionTime: 0   // время начала эффекта взрыва
        });
      }
      grid.push(row);
    }
    // Если на старте есть совпадения, убираем их (чтобы игрок начинал с "чистого" поля)
    clearInitialMatches();
  }

  // Убираем начальные совпадения (повторяем до тех пор, пока они не исчезнут)
  function clearInitialMatches() {
    let matches = findMatches();
    while (matches.length > 0) {
      removeMatches(matches);
      collapseGrid();
      matches = findMatches();
    }
  }

  // Рисуем игровое поле – каждую ячейку с фоном, иконкой, а также эффекты выделения/взрыва
  function drawGrid(timestamp) {
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    for (let r = 0; r < ROWS; r++) {
      for (let c = 0; c < COLS; c++) {
        const x = c * cellSize,
              y = r * cellSize;
        const cell = grid[r][c];

        // Заливка ячейки – тёмно-зелёный фон (атмосфера киберпространства)
        ctx.fillStyle = "#013220";
        ctx.fillRect(x, y, cellSize, cellSize);

        // Рассчитываем позицию для рисования с учётом вертикального смещения (анимация падения)
        const drawY = y + cell.offsetY;

        // Если ячейка не пустая, рисуем иконку
        if (cell.type !== null) {
          const img = icons[cell.type];
          // Размер изображения – 80% от размера ячейки
          const imgSize = cellSize * 0.8,
                imgX = x + (cellSize - imgSize) / 2,
                imgY = drawY + (cellSize - imgSize) / 2;
          ctx.drawImage(img, imgX, imgY, imgSize, imgSize);
        }

        // Если ячейка выбрана, рисуем неоновую рамку
        if (selectedCell && selectedCell.row === r && selectedCell.col === c) {
          ctx.strokeStyle = "#00FF00";
          ctx.lineWidth = 4;
          ctx.strokeRect(x + 2, y + 2, cellSize - 4, cellSize - 4);
        }

        // Если ячейка находится в состоянии "взрыва", рисуем эффект (радиальный градиент)
        if (cell.exploding) {
          const progress = (timestamp - cell.explosionTime) / 300;
          if (progress < 1) {
            const centerX = x + cellSize / 2,
                  centerY = drawY + cellSize / 2,
                  radius = cellSize * progress;
            const grad = ctx.createRadialGradient(centerX, centerY, 0, centerX, centerY, radius);
            grad.addColorStop(0, "rgba(0,255,0,0.8)");
            grad.addColorStop(1, "rgba(0,255,0,0)");
            ctx.fillStyle = grad;
            ctx.beginPath();
            ctx.arc(centerX, centerY, radius, 0, 2 * Math.PI);
            ctx.fill();
          } else {
            cell.exploding = false; // завершаем эффект
          }
        }
      }
    }
  }

  // Главный игровой цикл – вызывается через requestAnimationFrame
  function gameLoop(timestamp) {
    // Проверяем, не истекло ли время игры (60 секунд)
    if (timestamp - gameStartTime >= GAME_DURATION) {
      // Время вышло – завершаем игру
      // Передаём итоговый счёт через глобальную функцию game2TimeUp (она должна быть определена в index.html)
      game2TimeUp(score);
      return;
    }
    drawGrid(timestamp);
    requestAnimationFrame(gameLoop);
  }

  // Находим совпадения – возвращаем массив объектов {row, col} для ячеек, входящих в линии из трёх и более
  function findMatches() {
    let matches = [];
    // Горизонтальные совпадения
    for (let r = 0; r < ROWS; r++) {
      let matchLength = 1;
      for (let c = 0; c < COLS; c++) {
        if (c < COLS - 1 &&
            grid[r][c].type !== null &&
            grid[r][c].type === grid[r][c + 1].type) {
          matchLength++;
        } else {
          if (matchLength >= 3) {
            for (let k = 0; k < matchLength; k++) {
              matches.push({ row: r, col: c - k });
            }
          }
          matchLength = 1;
        }
      }
    }
    // Вертикальные совпадения
    for (let c = 0; c < COLS; c++) {
      let matchLength = 1;
      for (let r = 0; r < ROWS; r++) {
        if (r < ROWS - 1 &&
            grid[r][c].type !== null &&
            grid[r][c].type === grid[r + 1][c].type) {
          matchLength++;
        } else {
          if (matchLength >= 3) {
            for (let k = 0; k < matchLength; k++) {
              matches.push({ row: r - k, col: c });
            }
          }
          matchLength = 1;
        }
      }
    }
    // Убираем дубликаты
    const unique = {};
    return matches.filter(cell => {
      const key = cell.row + "-" + cell.col;
      if (!unique[key]) {
        unique[key] = true;
        return true;
      }
      return false;
    });
  }

  // Удаляем совпавшие ячейки: для каждой найденной ячейки запускаем эффект взрыва, обнуляем её и начисляем очки
  function removeMatches(matches) {
    matches.forEach(cell => {
      const current = grid[cell.row][cell.col];
      if (current.type !== null) {
        current.exploding = true;
        current.explosionTime = performance.now();
        current.type = null; // удаляем ячейку
        score += 10; // начисляем 10 очков за каждую удалённую иконку
      }
    });
  }

  // "Схлопывание" поля: ячейки опускаются вниз, а сверху появляются новые
  function collapseGrid() {
    // Для каждой колонки
    for (let c = 0; c < COLS; c++) {
      let emptySpaces = 0;
      // Проходим снизу вверх
      for (let r = ROWS - 1; r >= 0; r--) {
        if (grid[r][c].type === null) {
          emptySpaces++;
          grid[r][c].offsetY = emptySpaces * cellSize;
        } else if (emptySpaces > 0) {
          // Перемещаем ячейку вниз на количество пустых мест
          grid[r + emptySpaces][c].type = grid[r][c].type;
          grid[r + emptySpaces][c].offsetY = grid[r][c].offsetY;
          grid[r][c].type = null;
          grid[r][c].offsetY = 0;
        }
      }
      // Заполняем пустые ячейки сверху
      for (let r = 0; r < emptySpaces; r++) {
        grid[r][c].type = Math.floor(Math.random() * iconUrls.length);
        // Задаём смещение, чтобы анимация падения была видна
        grid[r][c].offsetY = -((emptySpaces - r) * cellSize);
      }
    }
  }

  // Меняем местами два элемента (без анимации – можно доработать при необходимости)
  function swapCells(r1, c1, r2, c2) {
    const temp = grid[r1][c1].type;
    grid[r1][c1].type = grid[r2][c2].type;
    grid[r2][c2].type = temp;
  }

  // Обработка клика по canvas – реализует выбор ячейки и обмен с соседней
  function onCanvasClick(e) {
    if (isProcessing) return;
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left,
          y = e.clientY - rect.top;
    const col = Math.floor(x / cellSize),
          row = Math.floor(y / cellSize);
    if (row < 0 || row >= ROWS || col < 0 || col >= COLS) return;

    if (!selectedCell) {
      // Если ни одна ячейка не выбрана, запоминаем текущую
      selectedCell = { row, col };
    } else {
      // Проверяем, что выбранная ячейка соседняя (по горизонтали или вертикали)
      const dr = Math.abs(row - selectedCell.row),
            dc = Math.abs(col - selectedCell.col);
      if ((dr === 1 && dc === 0) || (dr === 0 && dc === 1)) {
        // Начинаем обработку обмена
        isProcessing = true;
        swapCells(selectedCell.row, selectedCell.col, row, col);
        // Проверяем, появилось ли совпадение после обмена
        const matches = findMatches();
        if (matches.length > 0) {
          // Если обмен валиден, обрабатываем совпадения с небольшой задержкой для "анимации"
          setTimeout(() => {
            processMatches();
          }, 300);
        } else {
          // Если обмен не привёл к совпадению, возвращаем обратно
          setTimeout(() => {
            swapCells(selectedCell.row, selectedCell.col, row, col);
            isProcessing = false;
          }, 300);
        }
      }
      selectedCell = null;
    }
  }

  // Рекурсивная функция для обработки совпадений (включая каскады)
  function processMatches() {
    const matches = findMatches();
    if (matches.length > 0) {
      removeMatches(matches);
      setTimeout(() => {
        collapseGrid();
        setTimeout(() => {
          processMatches();
          isProcessing = false;
        }, 300);
      }, 300);
    } else {
      isProcessing = false;
    }
  }

  // Главная функция инициализации игры "HackMatch 3"
  function initGame2() {
    canvas = document.getElementById('match3Canvas');
    ctx = canvas.getContext('2d');
    canvas.width = COLS * cellSize;
    canvas.height = ROWS * cellSize;

    preloadImages(() => {
      initGrid();
      score = 0;
      gameStartTime = performance.now();
      canvas.addEventListener('click', onCanvasClick);
      requestAnimationFrame(gameLoop);
    });
  }

  // Сброс игры (например, при закрытии модального окна)
  function resetGame2() {
    if (canvas) {
      canvas.removeEventListener('click', onCanvasClick);
    }
    // Дополнительный сброс анимаций можно добавить при необходимости
  }

  // Экспортируем функции для доступа из index.html
  window.initGame2 = initGame2;
  window.resetGame2 = resetGame2;
})();
