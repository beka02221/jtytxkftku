/* game2.js - "3 в ряд" с таймером 1 мин */

let match3Interval = null;
let match3Ctx = null;
const gridSize = 8;     // кол-во клеток
const cellSize = 40;    // пикселей на клетку
const matchColors = ['red', 'green', 'blue', 'yellow', 'purple'];
let matchGrid = [];

let matchTimeLeft = 60;  // 60 секунд
let matchTimerId = null;

/**
 * Запуск игры
 */
function initGame2() {
  const canvas = document.getElementById('match3Canvas');
  match3Ctx = canvas.getContext('2d');

  // Генерируем поле
  matchGrid = [];
  for (let y = 0; y < gridSize; y++) {
    matchGrid[y] = [];
    for (let x = 0; x < gridSize; x++) {
      matchGrid[y][x] = {
        color: matchColors[Math.floor(Math.random() * matchColors.length)]
      };
    }
  }

  // Запускаем таймер 1 мин
  matchTimeLeft = 60;
  matchTimerId = setInterval(() => {
    matchTimeLeft--;
    if (matchTimeLeft <= 0) {
      endMatch3();
    }
  }, 1000);

  // Запуск цикла
  match3Interval = requestAnimationFrame(match3Loop);
}

/**
 * Завершение игры (при истечении времени).
 */
function endMatch3() {
  // Останавливаем таймер
  clearInterval(matchTimerId);
  matchTimerId = null;

  // Допустим, очки = сумма "случайных" комбинаций или иное.
  // Пока возьмем просто "кол-во разных цветов" на поле
  let points = 0;
  for (let y = 0; y < gridSize; y++) {
    for (let x = 0; x < gridSize; x++) {
      if (matchGrid[y][x]) {
        points++;
      }
    }
  }

  // Вызываем итоговое окно
  showEndGameModal(
    'Время вышло!',
    `Вы набрали условных ${points} очков за 1 минуту!`
  );

  resetGame2();
}

function resetGame2() {
  if (match3Interval) {
    cancelAnimationFrame(match3Interval);
    match3Interval = null;
  }
  if (matchTimerId) {
    clearInterval(matchTimerId);
    matchTimerId = null;
  }
  match3Ctx = null;
}

/**
 * Игровой цикл (пока просто рисуем поле).
 */
function match3Loop() {
  if (!match3Ctx) return;
  drawMatch3Grid();
  match3Interval = requestAnimationFrame(match3Loop);
}

/**
 * Отрисовка сетки.
 */
function drawMatch3Grid() {
  match3Ctx.clearRect(0, 0, gridSize * cellSize, gridSize * cellSize);
  for (let y = 0; y < gridSize; y++) {
    for (let x = 0; x < gridSize; x++) {
      match3Ctx.fillStyle = matchGrid[y][x].color;
      match3Ctx.fillRect(x * cellSize, y * cellSize, cellSize, cellSize);
      // Рамка
      match3Ctx.strokeStyle = '#000';
      match3Ctx.strokeRect(x * cellSize, y * cellSize, cellSize, cellSize);
    }
  }
}
