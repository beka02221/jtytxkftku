/* =========================
   game5.js — Snake в стиле «Матрица»

   Управление:
    - Клавиши со стрелками (←↑→↓) для ПК.
    - Свайпы для мобильных устройств.
   Механика:
    - Змейка двигается по сетке.
    - При поедании еды змейка растёт, а игрок получает +10 очков (и localUserData.points).
    - Столкновение со стеной или своим хвостом приводит к завершению игры.
   При проигрыше вызывается showEndGameModal, а затем resetGame5 для очистки слушателей.
========================= */

// Глобальные переменные для game5
let game5Canvas, game5Ctx;
let gridSize = 20;           // Размер одной ячейки сетки
let tileCountX, tileCountY;  // Количество ячеек по горизонтали и вертикали
let snake = [];              // Массив сегментов змейки: [{x, y}, ...]
let snakeLength = 4;         // Начальная длина змейки
let snakeDir = { x: 1, y: 0 };// Текущее направление (движется вправо)
let food = { x: 0, y: 0 };     // Позиция еды
let score5 = 0;              // Очки внутри этой игры
let gameRunning5 = false;    // Флаг игрового цикла
let gameStarted5 = false;    // Игра начнётся после первого свайпа/нажатия
let animationFrameId5;
let lastFrameTime5 = 0;
let frameInterval = 150;     // Интервал в мс между обновлениями (~6-7 fps)

// Для обработки свайпов
let touchStartX = 0, touchStartY = 0;

// Инициализация игры
function initGame5() {
  game5Canvas = document.getElementById('game5Canvas');
  if (!game5Canvas) {
    console.error("Canvas с id 'game5Canvas' не найден.");
    return;
  }
  game5Ctx = game5Canvas.getContext('2d');

  // Рассчитываем количество ячеек по горизонтали и вертикали
  tileCountX = Math.floor(game5Canvas.width / gridSize);
  tileCountY = Math.floor(game5Canvas.height / gridSize);

  // Сбрасываем змейку
  snake = [];
  snakeLength = 4;
  // Начальная позиция — примерно в центре
  let startX = Math.floor(tileCountX / 2);
  let startY = Math.floor(tileCountY / 2);
  for (let i = 0; i < snakeLength; i++) {
    // Каждый сегмент располагается левее головы
    snake.push({ x: startX - i, y: startY });
  }
  
  // Начальное направление — вправо
  snakeDir = { x: 1, y: 0 };
  
  // Размещаем еду случайным образом
  placeFood();

  // Сбрасываем счёт
  score5 = 0;

  // Флаги
  gameStarted5 = false;
  gameRunning5 = true;

  // Добавляем слушатель для клавиатуры (ПК)
  window.addEventListener('keydown', keyDownHandler5);

  // Добавляем слушатели для сенсорного управления (мобильные)
  game5Canvas.addEventListener('touchstart', handleTouchStart5, false);
  game5Canvas.addEventListener('touchend', handleTouchEnd5, false);

  // Рисуем первый кадр (с текстом «Swipe to start»)
  drawGame5();

  // Запускаем игровой цикл
  animationFrameId5 = requestAnimationFrame(gameLoop5);
}

// Игровой цикл через requestAnimationFrame
function gameLoop5(timestamp) {
  if (timestamp - lastFrameTime5 >= frameInterval) {
    if (gameRunning5) {
      updateGame5();
      drawGame5();
      lastFrameTime5 = timestamp;
    }
  }
  if (gameRunning5) {
    animationFrameId5 = requestAnimationFrame(gameLoop5);
  }
}

// Обновление логики игры
function updateGame5() {
  if (!gameStarted5) {
    // Пока игра не запущена, змейка не двигается
    return;
  }

  // Получаем координаты головы змейки (последний элемент массива)
  let head = snake[snake.length - 1];
  let newHead = { 
    x: head.x + snakeDir.x, 
    y: head.y + snakeDir.y 
  };

  // Проверяем столкновение со стенами
  if (
    newHead.x < 0 || 
    newHead.x >= tileCountX ||
    newHead.y < 0 || 
    newHead.y >= tileCountY
  ) {
    endGame5();
    return;
  }

  // Проверяем столкновение с телом змейки
  for (let i = 0; i < snake.length; i++) {
    if (snake[i].x === newHead.x && snake[i].y === newHead.y) {
      endGame5();
      return;
    }
  }

  // Добавляем новую голову
  snake.push(newHead);

  // Проверяем, съедена ли еда
  if (newHead.x === food.x && newHead.y === food.y) {
    score5 += 10;
    if (typeof localUserData !== 'undefined') {
      localUserData.points += 10;
      updateTopBar();
    }
    placeFood();
  } else {
    // Если еда не съедена — удаляем хвост
    snake.shift();
  }
}

// Отрисовка игры
function drawGame5() {
  // Заливаем фон чёрным (стиль "Матрицы")
  game5Ctx.fillStyle = "#000000";
  game5Ctx.fillRect(0, 0, game5Canvas.width, game5Canvas.height);

  // Рисуем еду зелёным квадратом
  game5Ctx.fillStyle = "#00FF00";
  game5Ctx.fillRect(food.x * gridSize, food.y * gridSize, gridSize, gridSize);

  // Рисуем змейку (голова ярче, хвост – темнее)
  for (let i = 0; i < snake.length; i++) {
    game5Ctx.fillStyle = i === snake.length - 1 ? "#00FF00" : "#008000";
    let s = snake[i];
    game5Ctx.fillRect(s.x * gridSize, s.y * gridSize, gridSize, gridSize);
  }

  // Отображаем счёт
  game5Ctx.fillStyle = "#00FF00";
  game5Ctx.font = "16px monospace";
  game5Ctx.textAlign = "left";
  game5Ctx.fillText("Score: " + score5, 10, 20);

  // Если игра ещё не начата, показываем текст с призывом свайпнуть для старта
  if (!gameStarted5) {
    game5Ctx.fillStyle = "#00FF00";
    game5Ctx.font = "20px monospace";
    game5Ctx.textAlign = "center";
    game5Ctx.fillText("Swipe to start", game5Canvas.width / 2, game5Canvas.height / 2);
  }
}

// Размещаем еду в случайном месте (не на змейке)
function placeFood() {
  food.x = Math.floor(Math.random() * tileCountX);
  food.y = Math.floor(Math.random() * tileCountY);

  for (let i = 0; i < snake.length; i++) {
    if (snake[i].x === food.x && snake[i].y === food.y) {
      placeFood();
      return;
    }
  }
}

// Обработчик нажатия клавиш для ПК
function keyDownHandler5(e) {
  if (!gameStarted5) {
    gameStarted5 = true;
  }
  switch (e.key) {
    case "ArrowUp":
      if (snakeDir.y !== 1) {
        snakeDir = { x: 0, y: -1 };
      }
      break;
    case "ArrowDown":
      if (snakeDir.y !== -1) {
        snakeDir = { x: 0, y: 1 };
      }
      break;
    case "ArrowLeft":
      if (snakeDir.x !== 1) {
        snakeDir = { x: -1, y: 0 };
      }
      break;
    case "ArrowRight":
      if (snakeDir.x !== -1) {
        snakeDir = { x: 1, y: 0 };
      }
      break;
    default:
      break;
  }
}

// Обработчик начала касания (свайпа)
function handleTouchStart5(e) {
  const touch = e.touches[0];
  touchStartX = touch.clientX;
  touchStartY = touch.clientY;
}

// Обработчик окончания касания (свайпа)
function handleTouchEnd5(e) {
  const touch = e.changedTouches[0];
  const dx = touch.clientX - touchStartX;
  const dy = touch.clientY - touchStartY;
  const absDx = Math.abs(dx);
  const absDy = Math.abs(dy);
  const threshold = 30; // Минимальная дистанция для распознавания свайпа

  if (absDx < threshold && absDy < threshold) {
    // Недостаточная дистанция – не считаем свайпом
    return;
  }

  // Если игра ещё не началась, запускаем её
  if (!gameStarted5) {
    gameStarted5 = true;
  }

  // Определяем направление свайпа
  if (absDx > absDy) {
    // Горизонтальный свайп
    if (dx > 0 && snakeDir.x !== -1) {
      snakeDir = { x: 1, y: 0 };
    } else if (dx < 0 && snakeDir.x !== 1) {
      snakeDir = { x: -1, y: 0 };
    }
  } else {
    // Вертикальный свайп
    if (dy > 0 && snakeDir.y !== -1) {
      snakeDir = { x: 0, y: 1 };
    } else if (dy < 0 && snakeDir.y !== 1) {
      snakeDir = { x: 0, y: -1 };
    }
  }
}

// Завершение игры
function endGame5() {
  gameRunning5 = false;
  if (typeof userRef !== 'undefined' && typeof localUserData !== 'undefined') {
    userRef.update({ points: localUserData.points });
  }
  showEndGameModal("Game Over", "Your score: " + score5);
}

// Сброс игры (вызывается при закрытии модального окна)
function resetGame5() {
  cancelAnimationFrame(animationFrameId5);
  window.removeEventListener('keydown', keyDownHandler5);
  game5Canvas.removeEventListener('touchstart', handleTouchStart5);
  game5Canvas.removeEventListener('touchend', handleTouchEnd5);
  if (game5Ctx) {
    game5Ctx.clearRect(0, 0, game5Canvas.width, game5Canvas.height);
  }
  gameRunning5 = false;
  gameStarted5 = false;
}
