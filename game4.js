// game4.js – Игра Color Blocks

let colorBlocksInterval = null;
let colorBlocksCtx = null;

// Параметры сетки
const cols = 6;   // количество колонок
const rows = 10;  // количество строк
let blockWidth = 0;
let blockHeight = 0;
const colors = ['red', 'green', 'blue', 'yellow', 'purple'];

// Игровые переменные
let grid = [];
let score = 0;
const gameDuration = 60; // длительность игры в секундах
let startTime = 0;

/**
 * Инициализация игры. Вызывается при запуске game4.
 */
function initGame4() {
  const canvas = document.getElementById('game4Canvas');
  if (!canvas) return;
  colorBlocksCtx = canvas.getContext('2d');

  // Рассчитываем размеры блока
  blockWidth = canvas.width / cols;
  // Оставляем сверху 50px для UI (таймер и счет)
  blockHeight = (canvas.height - 50) / rows;

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

  // Запускаем игровой цикл
  colorBlocksInterval = requestAnimationFrame(gameLoop);
}

/**
 * Сброс игры – вызывается при завершении игры.
 */
function resetGame4() {
  const canvas = document.getElementById('game4Canvas');
  if (canvas) {
    canvas.removeEventListener('click', handleClick);
    canvas.removeEventListener('touchstart', handleTouch);
  }
  if (colorBlocksInterval) {
    cancelAnimationFrame(colorBlocksInterval);
    colorBlocksInterval = null;
  }
}

/**
 * Игровой цикл: обновление состояния и отрисовка.
 */
function gameLoop() {
  const canvas = document.getElementById('game4Canvas');
  // Очищаем холст
  colorBlocksCtx.clearRect(0, 0, canvas.width, canvas.height);

  // Рисуем верхний интерфейс (таймер и счет)
  drawUI();
  // Рисуем игровую сетку с блоками
  drawGrid();

  // Проверка времени игры
  const elapsed = (Date.now() - startTime) / 1000;
  if (elapsed >= gameDuration) {
    endGame();
    return;
  }

  colorBlocksInterval = requestAnimationFrame(gameLoop);
}

/**
 * Рисуем UI: ползунок времени и текущий счет.
 */
function drawUI() {
  const canvas = document.getElementById('game4Canvas');
  // Фон ползунка (серый)
  colorBlocksCtx.fillStyle = '#ccc';
  colorBlocksCtx.fillRect(0, 0, canvas.width, 20);

  // Вычисляем оставшееся время и ширину заполненной части
  const timeLeft = Math.max(gameDuration - (Date.now() - startTime) / 1000, 0);
  const sliderWidth = (timeLeft / gameDuration) * canvas.width;
  colorBlocksCtx.fillStyle = '#00FF00';
  colorBlocksCtx.fillRect(0, 0, sliderWidth, 20);

  // Рисуем счет
  colorBlocksCtx.fillStyle = '#000';
  colorBlocksCtx.font = '16px Arial';
  colorBlocksCtx.fillText('Score: ' + score, 10, 40);
}

/**
 * Отрисовка сетки блоков.
 */
function drawGrid() {
  // Игровая область начинается с y = 50
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const block = grid[r][c];
      if (block) {
        colorBlocksCtx.fillStyle = block;
        colorBlocksCtx.fillRect(c * blockWidth, 50 + r * blockHeight, blockWidth, blockHeight);
        // Отрисовка белой рамки вокруг блока
        colorBlocksCtx.strokeStyle = '#fff';
        colorBlocksCtx.strokeRect(c * blockWidth, 50 + r * blockHeight, blockWidth, blockHeight);
      }
    }
  }
}

/**
 * По координатам клика/касания определяет, на какой ячейке мы находимся.
 */
function getCellFromCoords(x, y) {
  if (y < 50) return null; // область UI
  const col = Math.floor(x / blockWidth);
  const row = Math.floor((y - 50) / blockHeight);
  if (col < 0 || col >= cols || row < 0 || row >= rows) return null;
  return { row, col };
}

/**
 * Обработчик клика мыши.
 */
function handleClick(e) {
  const canvas = document.getElementById('game4Canvas');
  const rect = canvas.getBoundingClientRect();
  const x = e.clientX - rect.left;
  const y = e.clientY - rect.top;
  handleSelection(x, y);
}

/**
 * Обработчик касания.
 */
function handleTouch(e) {
  e.preventDefault();
  const canvas = document.getElementById('game4Canvas');
  const rect = canvas.getBoundingClientRect();
  const touch = e.touches[0];
  const x = touch.clientX - rect.left;
  const y = touch.clientY - rect.top;
  handleSelection(x, y);
}

/**
 * Обработка выбора блока: находим связную область одинаковых блоков и удаляем её.
 */
function handleSelection(x, y) {
  const cell = getCellFromCoords(x, y);
  if (!cell) return;
  const { row, col } = cell;
  const targetColor = grid[row][col];
  if (!targetColor) return;

  // Алгоритм flood fill для поиска соседних блоков того же цвета
  const connected = [];
  const visited = Array(rows).fill(null).map(() => Array(cols).fill(false));

  function flood(r, c) {
    if (r < 0 || r >= rows || c < 0 || c >= cols) return;
    if (visited[r][c]) return;
    if (grid[r][c] !== targetColor) return;
    visited[r][c] = true;
    connected.push({ r, c });
    flood(r - 1, c);
    flood(r + 1, c);
    flood(r, c - 1);
    flood(r, c + 1);
  }
  flood(row, col);

  // Если найдено менее двух блоков, ничего не делаем
  if (connected.length < 2) return;

  // Удаляем найденные блоки
  connected.forEach(pos => {
    grid[pos.r][pos.c] = null;
  });

  // Начисляем очки (квадратично от количества удалённых блоков)
  score += connected.length * connected.length;

  // Применяем гравитацию и сдвигаем колонки
  applyGravity();
  collapseColumns();
}

/**
 * Гравитация – блоки опускаются вниз, если под ними пусто.
 */
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

/**
 * Сдвиг колонок – если колонка пуста, смещаем все колонки правее влево.
 */
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

/**
 * Завершение игры: убираем обработчики, сохраняем результат в Firebase и показываем окно результата.
 */
function endGame() {
  const canvas = document.getElementById('game4Canvas');
  canvas.removeEventListener('click', handleClick);
  canvas.removeEventListener('touchstart', handleTouch);

  // Обновляем баллы пользователя (глобальные localUserData и userRef определены в index.html)
  localUserData.points = (localUserData.points || 0) + score;
  if (userRef) {
    userRef.update({ points: localUserData.points });
  }

  // Показываем итоговое окно (функция showEndGameModal определена в основном скрипте)
  showEndGameModal("Игра окончена", "Ваш счет: " + score);

  resetGame4();
}

// Экспортируем функции для вызова из основного скрипта
window.initGame4 = initGame4;
window.resetGame4 = resetGame4;

