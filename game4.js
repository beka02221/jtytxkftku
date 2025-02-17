(function () {
  // --- Глобальные переменные игры ---
  let canvas, ctx;
  let grid = [];
  const cols = 6;
  const rows = 10;
  let blockWidth, blockHeight;
  const colors = ['red', 'green', 'blue', 'yellow', 'purple'];
  let score = 0;
  const gameDuration = 60; // 60 секунд
  let startTime;
  let animationFrameId;
  let gameOver = false;

  // --- Инициализация игры ---
  function initGame4() {
    // Получаем холст и контекст
    canvas = document.getElementById('game4Canvas');
    ctx = canvas.getContext('2d');

    // Рассчитываем размеры блока
    blockWidth = canvas.width / cols;
    // Оставляем сверху 50px для UI (ползунок времени и счёт)
    blockHeight = (canvas.height - 50) / rows;

    // Инициализируем сетку случайными цветами
    grid = [];
    for (let r = 0; r < rows; r++) {
      let row = [];
      for (let c = 0; c < cols; c++) {
        row.push(colors[Math.floor(Math.random() * colors.length)]);
      }
      grid.push(row);
    }
    score = 0;
    gameOver = false;
    startTime = Date.now();

    // Добавляем обработчики событий для клика и касания
    canvas.addEventListener('click', handleClick);
    canvas.addEventListener('touchstart', handleTouch);

    // Запускаем игровой цикл
    gameLoop();
  }

  // --- Сброс игры (вызывается при закрытии игры) ---
  function resetGame4() {
    if (canvas) {
      canvas.removeEventListener('click', handleClick);
      canvas.removeEventListener('touchstart', handleTouch);
    }
    if (animationFrameId) {
      cancelAnimationFrame(animationFrameId);
    }
  }

  // --- Игровой цикл ---
  function gameLoop() {
    // Очищаем холст
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Рисуем интерфейс: ползунок времени и счёт
    drawUI();

    // Рисуем сетку блоков
    drawGrid();

    // Проверяем истечение времени
    let elapsed = (Date.now() - startTime) / 1000;
    if (elapsed >= gameDuration) {
      endGame();
      return;
    }

    animationFrameId = requestAnimationFrame(gameLoop);
  }

  // --- Рисуем верхний UI (ползунок времени и счёт) ---
  function drawUI() {
    // Вычисляем оставшееся время
    let timeLeft = Math.max(gameDuration - (Date.now() - startTime) / 1000, 0);
    let sliderWidth = (timeLeft / gameDuration) * canvas.width;

    // Фон для ползунка (серый)
    ctx.fillStyle = '#ccc';
    ctx.fillRect(0, 0, canvas.width, 20);

    // Заполненный участок ползунка (зелёный)
    ctx.fillStyle = '#00FF00';
    ctx.fillRect(0, 0, sliderWidth, 20);

    // Выводим счёт
    ctx.fillStyle = '#000';
    ctx.font = '16px Arial';
    ctx.fillText('Score: ' + score, 10, 40);
  }

  // --- Рисуем игровую сетку ---
  function drawGrid() {
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        let cell = grid[r][c];
        if (cell) {
          ctx.fillStyle = cell;
          ctx.fillRect(c * blockWidth, 50 + r * blockHeight, blockWidth, blockHeight);
          // Рисуем белую границу вокруг блока
          ctx.strokeStyle = '#fff';
          ctx.strokeRect(c * blockWidth, 50 + r * blockHeight, blockWidth, blockHeight);
        }
      }
    }
  }

  // --- Определяем, на какой ячейке произошло нажатие ---
  function getCellFromCoordinates(x, y) {
    if (y < 50) return null; // зона UI
    let col = Math.floor(x / blockWidth);
    let row = Math.floor((y - 50) / blockHeight);
    if (col < 0 || col >= cols || row < 0 || row >= rows) return null;
    return { row, col };
  }

  // --- Обработчики событий (клик и касание) ---
  function handleClick(e) {
    const rect = canvas.getBoundingClientRect();
    let x = e.clientX - rect.left;
    let y = e.clientY - rect.top;
    handleSelection(x, y);
  }

  function handleTouch(e) {
    e.preventDefault();
    const rect = canvas.getBoundingClientRect();
    let touch = e.touches[0];
    let x = touch.clientX - rect.left;
    let y = touch.clientY - rect.top;
    handleSelection(x, y);
  }

  // --- Обработка выбора ячейки ---
  function handleSelection(x, y) {
    let cellPos = getCellFromCoordinates(x, y);
    if (!cellPos) return;
    let { row, col } = cellPos;
    let targetColor = grid[row][col];
    if (!targetColor) return;

    // Поиск смежных блоков того же цвета (алгоритм flood fill)
    let connected = [];
    let visited = Array(rows)
      .fill(0)
      .map(() => Array(cols).fill(false));

    function floodFill(r, c) {
      if (r < 0 || r >= rows || c < 0 || c >= cols) return;
      if (visited[r][c]) return;
      if (grid[r][c] !== targetColor) return;
      visited[r][c] = true;
      connected.push({ r, c });
      floodFill(r - 1, c);
      floodFill(r + 1, c);
      floodFill(r, c - 1);
      floodFill(r, c + 1);
    }
    floodFill(row, col);

    // Если группа состоит менее чем из 2 блоков – ничего не делаем
    if (connected.length < 2) return;

    // Удаляем найденные блоки
    connected.forEach(pos => {
      grid[pos.r][pos.c] = null;
    });

    // Начисляем очки (например, квадратичный прирост)
    score += connected.length * connected.length;

    // Применяем гравитацию и сдвигаем колонки
    applyGravity();
    collapseColumns();
  }

  // --- Гравитация: блоки опускаются вниз ---
  function applyGravity() {
    for (let c = 0; c < cols; c++) {
      for (let r = rows - 1; r >= 0; r--) {
        if (grid[r][c] === null) {
          for (let nr = r - 1; nr >= 0; nr--) {
            if (grid[nr][c] !== null) {
              grid[r][c] = grid[nr][c];
              grid[nr][c] = null;
              break;
            }
          }
        }
      }
    }
  }

  // --- Сдвиг колонок: если колонка пуста, смещаем все справа налево ---
  function collapseColumns() {
    let targetCol = 0;
    for (let c = 0; c < cols; c++) {
      let isEmpty = true;
      for (let r = 0; r < rows; r++) {
        if (grid[r][c] !== null) {
          isEmpty = false;
          break;
        }
      }
      if (!isEmpty) {
        if (targetCol !== c) {
          for (let r = 0; r < rows; r++) {
            grid[r][targetCol] = grid[r][c];
            grid[r][c] = null;
          }
        }
        targetCol++;
      }
    }
  }

  // --- Завершение игры ---
  function endGame() {
    gameOver = true;
    canvas.removeEventListener('click', handleClick);
    canvas.removeEventListener('touchstart', handleTouch);

    // Обновляем баллы пользователя (глобальные переменные localUserData и userRef уже определены)
    localUserData.points = (localUserData.points || 0) + score;
    if (userRef) {
      userRef.update({ points: localUserData.points });
    }

    // Показываем модальное окно завершения игры (функция showEndGameModal определена в основном скрипте)
    showEndGameModal("Game Over", "Your score: " + score);
  }

  // --- Экспорт функций для вызова из основного скрипта ---
  window.initGame4 = initGame4;
  window.resetGame4 = resetGame4;
})();

