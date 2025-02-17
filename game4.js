// game4.js – Игра Color Blocks

(function () {
  let canvas, ctx;
  let grid = [];
  const cols = 6;
  const rows = 10;
  let blockWidth = 0;
  let blockHeight = 0;
  const colors = ['red', 'green', 'blue', 'yellow', 'purple'];
  let score = 0;
  const gameDuration = 60; // время игры в секундах
  let startTime = 0;
  let animationFrameId = null;

  // Инициализация игры
  function initGame4() {
    canvas = document.getElementById('game4Canvas');
    if (!canvas) {
      console.error('Canvas с id "game4Canvas" не найден!');
      return;
    }
    // Гарантируем, что холст виден
    canvas.style.display = 'block';
    // Для наглядности задаём фон
    canvas.style.backgroundColor = '#eee';

    ctx = canvas.getContext('2d');

    // Рассчитываем размеры ячеек
    blockWidth = canvas.width / cols;
    blockHeight = (canvas.height - 50) / rows; // отступ 50px сверху для UI

    // Инициализируем сетку случайными цветными блоками
    grid = [];
    for (let r = 0; r < rows; r++) {
      let row = [];
      for (let c = 0; c < cols; c++) {
        row.push(colors[Math.floor(Math.random() * colors.length)]);
      }
      grid.push(row);
    }

    score = 0;
    startTime = Date.now();

    // Добавляем обработчики кликов и касаний
    canvas.addEventListener('click', handleClick);
    canvas.addEventListener('touchstart', handleTouch);

    console.log('Игра Color Blocks запущена');
    animationFrameId = requestAnimationFrame(gameLoop);
  }

  // Сброс игры (вызывается при завершении)
  function resetGame4() {
    if (canvas) {
      canvas.removeEventListener('click', handleClick);
      canvas.removeEventListener('touchstart', handleTouch);
    }
    if (animationFrameId) {
      cancelAnimationFrame(animationFrameId);
      animationFrameId = null;
    }
  }

  // Игровой цикл
  function gameLoop() {
    if (!canvas) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    drawUI();
    drawGrid();

    let elapsed = (Date.now() - startTime) / 1000;
    if (elapsed >= gameDuration) {
      endGame();
      return;
    }

    animationFrameId = requestAnimationFrame(gameLoop);
  }

  // Рисуем UI: таймер и счёт
  function drawUI() {
    // Фон для таймера (серый)
    ctx.fillStyle = '#ccc';
    ctx.fillRect(0, 0, canvas.width, 20);

    let timeLeft = Math.max(gameDuration - (Date.now() - startTime) / 1000, 0);
    let sliderWidth = (timeLeft / gameDuration) * canvas.width;
    ctx.fillStyle = '#00FF00';
    ctx.fillRect(0, 0, sliderWidth, 20);

    // Отображаем счёт
    ctx.fillStyle = '#000';
    ctx.font = '16px Arial';
    ctx.fillText('Score: ' + score, 10, 40);
  }

  // Рисуем игровую сетку с блоками
  function drawGrid() {
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        let block = grid[r][c];
        if (block) {
          ctx.fillStyle = block;
          ctx.fillRect(c * blockWidth, 50 + r * blockHeight, blockWidth, blockHeight);
          // Рисуем белую рамку для лучшей видимости
          ctx.strokeStyle = '#fff';
          ctx.strokeRect(c * blockWidth, 50 + r * blockHeight, blockWidth, blockHeight);
        }
      }
    }
  }

  // Определяем, на какой ячейке произошёл клик/касание
  function getCellFromCoords(x, y) {
    if (y < 50) return null; // зона UI
    let col = Math.floor(x / blockWidth);
    let row = Math.floor((y - 50) / blockHeight);
    if (col < 0 || col >= cols || row < 0 || row >= rows) return null;
    return { row, col };
  }

  // Обработчик клика мыши
  function handleClick(e) {
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    handleSelection(x, y);
  }

  // Обработчик касания
  function handleTouch(e) {
    e.preventDefault();
    const rect = canvas.getBoundingClientRect();
    const touch = e.touches[0];
    const x = touch.clientX - rect.left;
    const y = touch.clientY - rect.top;
    handleSelection(x, y);
  }

  // Обработка выбора блока: находим и удаляем связную группу
  function handleSelection(x, y) {
    const cell = getCellFromCoords(x, y);
    if (!cell) return;
    const { row, col } = cell;
    const targetColor = grid[row][col];
    if (!targetColor) return;

    // Поиск соседних блоков того же цвета (алгоритм flood fill)
    const connected = [];
    const visited = Array(rows).fill(null).map(() => Array(cols).fill(false));

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

    // Если найдено менее двух блоков, не удаляем (чтобы случайный клик не обнулял экран)
    if (connected.length < 2) return;

    // Удаляем выбранные блоки
    connected.forEach(pos => {
      grid[pos.r][pos.c] = null;
    });

    // Начисляем очки (квадратично от числа удалённых блоков)
    score += connected.length * connected.length;

    // Применяем гравитацию и сдвигаем колонки
    applyGravity();
    collapseColumns();
  }

  // Блоки опускаются вниз, если под ними пусто
  function applyGravity() {
    for (let c = 0; c < cols; c++) {
      for (let r = rows - 1; r >= 0; r--) {
        if (grid[r][c] === null) {
          for (let r2 = r - 1; r2 >= 0; r2--) {
            if (grid[r2][c] !== null) {
              grid[r][c] = grid[r2][c];
              grid[r2][c] = null;
              break;
            }
          }
        }
      }
    }
  }

  // Сдвиг колонок: если колонка пуста, сдвигаем все колонки справа налево
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

  // Завершение игры
  function endGame() {
    canvas.removeEventListener('click', handleClick);
    canvas.removeEventListener('touchstart', handleTouch);

    // Сохраняем результат в Firebase (переменные localUserData и userRef определены в index.html)
    localUserData.points = (localUserData.points || 0) + score;
    if (userRef) {
      userRef.update({ points: localUserData.points });
    }

    // Вызываем глобальную функцию для показа результата (определена в основном скрипте)
    showEndGameModal("Игра окончена", "Ваш счет: " + score);
    resetGame4();
  }

  // Экспортируем функции для вызова из основного скрипта
  window.initGame4 = initGame4;
  window.resetGame4 = resetGame4;
})();
