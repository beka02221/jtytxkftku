// Game5 – Snake Game in Matrix Style with Timer & Swipe controls

// Получаем ссылку на канвас и его контекст
const canvas = document.getElementById('game5Canvas');
const ctx = canvas.getContext('2d');

// Размеры сетки и канваса
const gridSize = 20;
const canvasWidth = 400;
const canvasHeight = 650;
canvas.width = canvasWidth;
canvas.height = canvasHeight;

// Основные переменные игры
let snake;              // массив сегментов змейки [{x, y}, ...]
let snakeDirection;     // направление движения (объект с x и y)
let food;               // координаты еды {x, y}
let isGameOver;         // флаг окончания игры
let gameProgress;       // накопленный прогресс за игру (единицы)
let gameStarted;        // флаг, запущена ли игра (после "Tap to Start")
let timerStart;         // время старта игры
const timerDuration = 180000; // 3 минуты в миллисекундах

// Для фонового эффекта "Матрицы"
let matrixEffect = [];

// Для свайп-контроля
let touchStartX = null;
let touchStartY = null;

/* ========= Функции для Matrix Background ========= */
function createMatrixEffect() {
  const cols = canvasWidth / gridSize;
  const rows = canvasHeight / gridSize;
  matrixEffect = [];
  for (let i = 0; i < cols; i++) {
    matrixEffect[i] = [];
    for (let j = 0; j < rows; j++) {
      matrixEffect[i][j] = 0;
    }
  }
}

function updateMatrixEffect() {
  const cols = canvasWidth / gridSize;
  const rows = canvasHeight / gridSize;
  for (let i = 0; i < cols; i++) {
    for (let j = 0; j < rows; j++) {
      if (matrixEffect[i][j] > 0) {
        matrixEffect[i][j]--;
      }
      // Случайным образом "оживляем" ячейку
      if (Math.random() < 0.1) {
        matrixEffect[i][j] = Math.floor(Math.random() * 10) + 1;
      }
    }
  }
}

function drawMatrixEffect() {
  ctx.fillStyle = 'rgba(0, 255, 0, 0.1)';
  const cols = canvasWidth / gridSize;
  const rows = canvasHeight / gridSize;
  for (let i = 0; i < cols; i++) {
    for (let j = 0; j < rows; j++) {
      if (matrixEffect[i][j] > 0) {
        ctx.fillRect(i * gridSize, j * gridSize, gridSize, gridSize);
      }
    }
  }
}

/* ========= Функции игры ========= */
function drawSnake() {
  ctx.fillStyle = 'lime';
  snake.forEach(segment => {
    ctx.fillRect(segment.x, segment.y, gridSize, gridSize);
  });
}

function moveSnake() {
  // Вычисляем новую голову
  const head = { x: snake[0].x + snakeDirection.x, y: snake[0].y + snakeDirection.y };

  // Проверка на столкновение со стенами
  if (
    head.x < 0 || head.x >= canvasWidth ||
    head.y < 0 || head.y >= canvasHeight
  ) {
    isGameOver = true;
    return;
  }

  // Проверка на столкновение с собой
  if (snake.some(segment => segment.x === head.x && segment.y === head.y)) {
    isGameOver = true;
    return;
  }

  // Добавляем голову в начало массива
  snake.unshift(head);

  // Если съели еду – не удаляем хвост (змейка растёт) и прибавляем прогресс
  if (head.x === food.x && head.y === food.y) {
    // Прибавляем 5 единиц прогресса за съеденную еду
    gameProgress += 5;
    // Генерируем новую еду
    generateFood();
  } else {
    // Если еду не съели – удаляем последний сегмент
    snake.pop();
  }
}

function generateFood() {
  // Выбираем случайную позицию по сетке
  food = {
    x: Math.floor(Math.random() * (canvasWidth / gridSize)) * gridSize,
    y: Math.floor(Math.random() * (canvasHeight / gridSize)) * gridSize
  };
  // Можно добавить проверку, чтобы еда не появлялась внутри змейки (опционально)
}

function drawFood() {
  ctx.fillStyle = 'red';
  ctx.fillRect(food.x, food.y, gridSize, gridSize);
}

/* ========= Таймер (ползунок) ========= */
function drawTimerSlider() {
  const elapsed = Date.now() - timerStart;
  const remaining = timerDuration - elapsed;
  // Если время истекло – завершаем игру
  if (remaining <= 0) {
    isGameOver = true;
  }
  const sliderWidth = canvasWidth * (Math.max(remaining, 0) / timerDuration);
  
  // Рисуем фон ползунка (например, серым)
  ctx.fillStyle = '#444';
  ctx.fillRect(0, 0, canvasWidth, 10);
  // Рисуем текущий прогресс (зелёный)
  ctx.fillStyle = '#0f0';
  ctx.fillRect(0, 0, sliderWidth, 10);
}

/* ========= Стартовый экран ========= */
function drawStartScreen() {
  ctx.clearRect(0, 0, canvasWidth, canvasHeight);
  updateMatrixEffect();
  drawMatrixEffect();
  ctx.fillStyle = 'white';
  // Используем уникальный шрифт – он уже подключён в основном HTML
  ctx.font = '30px "Press Start 2P"';
  ctx.textAlign = 'center';
  ctx.fillText("Tap to Start", canvasWidth / 2, canvasHeight / 2);
}

/* ========= Экран Game Over ========= */
function drawGameOver() {
  ctx.fillStyle = 'black';
  ctx.fillRect(0, 0, canvasWidth, canvasHeight);
  ctx.fillStyle = 'white';
  ctx.font = '30px "Press Start 2P"';
  ctx.textAlign = 'center';
  ctx.fillText("Game Over", canvasWidth / 2, canvasHeight / 2);
}

/* ========= Основной игровой цикл ========= */
function gameLoop() {
  // Если игра ещё не запущена, просто показываем стартовый экран
  if (!gameStarted) {
    drawStartScreen();
    // Ждём нажатия – цикл перерисовки будет вызван снова событием "tap"
    setTimeout(gameLoop, 100);
    return;
  }
  // Если игра завершена – выводим экран Game Over и обновляем БД через 2 сек.
  if (isGameOver) {
    drawGameOver();
    // Итоговый прогресс записывается только по окончании игры:
    // прибавляем накопленный прогресс к баллу пользователя
    setTimeout(() => {
      localUserData.points += gameProgress;
      if (userRef) {
        userRef.update({ points: localUserData.points });
      }
      finishGame();
    }, 2000);
    return;
  }

  // Очищаем канвас и рисуем фон
  ctx.clearRect(0, 0, canvasWidth, canvasHeight);
  updateMatrixEffect();
  drawMatrixEffect();

  // Двигаем змейку и отрисовываем её
  moveSnake();
  drawSnake();
  // Рисуем еду
  drawFood();
  // Рисуем таймер (ползунок)
  drawTimerSlider();

  // Обновляем информацию о прогрессе в UI:
  // При этом итоговое количество баллов = текущие баллы + прогресс за игру.
  document.getElementById('pointCount').textContent = (localUserData.points || 0) + gameProgress;

  setTimeout(gameLoop, 100);
}

/* ========= Управление клавиатурой ========= */
document.addEventListener('keydown', function(event) {
  // Если игра ещё не запущена – игнорируем управление
  if (!gameStarted) return;
  let newDir;
  if (event.key === 'ArrowUp' && snakeDirection.y === 0) {
    newDir = { x: 0, y: -gridSize };
  } else if (event.key === 'ArrowDown' && snakeDirection.y === 0) {
    newDir = { x: 0, y: gridSize };
  } else if (event.key === 'ArrowLeft' && snakeDirection.x === 0) {
    newDir = { x: -gridSize, y: 0 };
  } else if (event.key === 'ArrowRight' && snakeDirection.x === 0) {
    newDir = { x: gridSize, y: 0 };
  }
  if (newDir) {
    snakeDirection = newDir;
  }
});

/* ========= Управление свайпами (touch) ========= */
canvas.addEventListener('touchstart', function(e) {
  // Если игра не началась – используем это для старта (см. onStartTap ниже)
  if (!gameStarted) return;
  const touch = e.touches[0];
  touchStartX = touch.clientX;
  touchStartY = touch.clientY;
});

canvas.addEventListener('touchend', function(e) {
  // Если игра не началась – не обрабатываем свайп
  if (!gameStarted) return;
  if (touchStartX === null || touchStartY === null) return;
  const touchEndX = e.changedTouches[0].clientX;
  const touchEndY = e.changedTouches[0].clientY;
  const diffX = touchEndX - touchStartX;
  const diffY = touchEndY - touchStartY;
  // Определяем направление свайпа
  if (Math.abs(diffX) > Math.abs(diffY)) {
    // горизонтальный свайп
    if (diffX > 0 && snakeDirection.x === 0) {
      snakeDirection = { x: gridSize, y: 0 };
    } else if (diffX < 0 && snakeDirection.x === 0) {
      snakeDirection = { x: -gridSize, y: 0 };
    }
  } else {
    // вертикальный свайп
    if (diffY > 0 && snakeDirection.y === 0) {
      snakeDirection = { x: 0, y: gridSize };
    } else if (diffY < 0 && snakeDirection.y === 0) {
      snakeDirection = { x: 0, y: -gridSize };
    }
  }
  touchStartX = null;
  touchStartY = null;
});

/* ========= Старт игры по тапу ========= */
function onStartTap() {
  // Если игра ещё не запущена, начинаем игру
  if (!gameStarted) {
    gameStarted = true;
    // Сохраняем время старта для таймера
    timerStart = Date.now();
    // Убираем слушатель старта (если требуется)
  }
}
// Обработчики для клика и тача (на старте)
canvas.addEventListener('click', onStartTap);
canvas.addEventListener('touchstart', function(e) {
  if (!gameStarted) {
    e.preventDefault(); // предотвращаем нежелательные события
    onStartTap();
  }
}, { passive: false });

/* ========= Инициализация игры ========= */
function initGame5() {
  // Сбрасываем все переменные
  snake = [{ x: 160, y: 320 }];
  // Изначальное направление – вправо
  snakeDirection = { x: gridSize, y: 0 };
  generateFood();
  isGameOver = false;
  gameProgress = 0;
  gameStarted = false;
  createMatrixEffect();
  // Рисуем стартовый экран с надписью "Tap to Start"
  drawStartScreen();
  // Запускаем игровой цикл (он будет ждать старта)
  gameLoop();
}
