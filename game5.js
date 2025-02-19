/* =========================
   game5.js — Snake в стиле «Матрица»

   Управление:
    - Клавиши со стрелками (←↑→↓) для ПК.
    - Свайпы для мобильных устройств.
   Механика:
    - Змейка движется по сетке.
    - При поедании еды змейка растёт, а игрок получает +10 очков (и localUserData.points).
    - Столкновение со стеной, своим хвостом или истечение времени (3 минуты) приводит к завершению игры.
   Визуальные улучшения:
    - Еда теперь красного цвета.
    - Текст "Swipe to start" отображается в розовом цвете и поднят выше.
    - Добавлен горизонтальный ползунок времени (таймер) вверху, который уменьшается с 3 минут до 0.
   При завершении игры вызывается showEndGameModal, а затем resetGame5 для очистки слушателей.
========================= */

let game5Canvas, game5Ctx;
let gridSize = 20;
let tileCountX, tileCountY;
let snake = [];
let snakeLength = 4;
let snakeDir = { x: 1, y: 0 };
let food = { x: 0, y: 0 };
let score5 = 0;
let gameRunning5 = false;
let gameStarted5 = false;
let animationFrameId5;
let lastFrameTime5 = 0;
let frameInterval = 150; // обновление каждые 150 мс

// Для обработки свайпов
let touchStartX = 0, touchStartY = 0;

// Таймер игры: 3 минуты (в миллисекундах)
let gameStartTime = null;
const totalTime = 180000; // 180000 мс = 3 минуты

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
  let startX = Math.floor(tileCountX / 2);
  let startY = Math.floor(tileCountY / 2);
  for (let i = 0; i < snakeLength; i++) {
    snake.push({ x: startX - i, y: startY });
  }
  
  // Начальное направление — вправо
  snakeDir = { x: 1, y: 0 };
  
  // Размещаем еду
  placeFood();

  // Сбрасываем счёт
  score5 = 0;

  // Флаги игры
  gameStarted5 = false;
  gameRunning5 = true;
  gameStartTime = null;

  // Слушатели для клавиатуры (ПК)
  window.addEventListener('keydown', keyDownHandler5);

  // Слушатели для сенсорного управления (мобильные)
  game5Canvas.addEventListener('touchstart', handleTouchStart5, false);
  game5Canvas.addEventListener('touchend', handleTouchEnd5, false);
  // Отменяем стандартное поведение свайпов (например, закрытие приложения)
  game5Canvas.addEventListener('touchmove', function(e) {
    e.preventDefault();
  }, { passive: false });

  // Рисуем начальный кадр с текстом "Swipe to start"
  drawGame5();

  // Запускаем игровой цикл
  animationFrameId5 = requestAnimationFrame(gameLoop5);
}

// Игровой цикл
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
    return;
  }

  // Проверка таймера (3 минуты)
  if (gameStartTime !== null) {
    let elapsed = performance.now() - gameStartTime;
    if (elapsed >= totalTime) {
      endGame5("Time's up");
      return;
    }
  }

  // Двигаем змейку
  let head = snake[snake.length - 1];
  let newHead = { x: head.x + snakeDir.x, y: head.y + snakeDir.y };

  // Проверяем столкновение со стенами
  if (newHead.x < 0 || newHead.x >= tileCountX || newHead.y < 0 || newHead.y >= tileCountY) {
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

  // Если еда съедена
  if (newHead.x === food.x && newHead.y === food.y) {
    score5 += 10;
    if (typeof localUserData !== 'undefined') {
      localUserData.points += 10;
      updateTopBar();
    }
    placeFood();
  } else {
    // Удаляем хвост, если еда не съедена
    snake.shift();
  }
}

// Отрисовка игры
function drawGame5() {
  // Фон (чёрный, стиль "Матрицы")
  game5Ctx.fillStyle = "#000000";
  game5Ctx.fillRect(0, 0, game5Canvas.width, game5Canvas.height);

  // Если игра запущена, рисуем таймер
  if (gameStarted5 && gameStartTime !== null) {
    drawTimerBar();
  }

  // Рисуем еду (красного цвета)
  game5Ctx.fillStyle = "#FF0000";
  game5Ctx.fillRect(food.x * gridSize, food.y * gridSize, gridSize, gridSize);

  // Рисуем змейку
  for (let i = 0; i < snake.length; i++) {
    game5Ctx.fillStyle = i === snake.length - 1 ? "#00FF00" : "#008000";
    let s = snake[i];
    game5Ctx.fillRect(s.x * gridSize, s.y * gridSize, gridSize, gridSize);
  }

  // Отображаем счёт (смещён ниже таймера)
  game5Ctx.fillStyle = "#00FF00";
  game5Ctx.font = "16px monospace";
  game5Ctx.textAlign = "left";
  game5Ctx.fillText("Score: " + score5, 10, 30);

  // Если игра ещё не начата, показываем текст "Swipe to start" в розовом цвете и выше центра
  if (!gameStarted5) {
    game5Ctx.fillStyle = "#ff69b4";
    game5Ctx.font = "20px monospace";
    game5Ctx.textAlign = "center";
    game5Ctx.fillText("Swipe to start", game5Canvas.width / 2, game5Canvas.height / 4);
  }
}

// Рисование горизонтального таймера (ползунка) вверху экрана
function drawTimerBar() {
  let elapsed = performance.now() - gameStartTime;
  let remaining = Math.max(totalTime - elapsed, 0);
  let ratio = remaining / totalTime;
  
  // Фон таймера (серый)
  game5Ctx.fillStyle = "#555";
  game5Ctx.fillRect(0, 0, game5Canvas.width, 10);
  
  // Заполненная часть таймера (розовая)
  game5Ctx.fillStyle = "#ff69b4";
  game5Ctx.fillRect(0, 0, game5Canvas.width * ratio, 10);
}

// Размещаем еду в случайном месте, не попадающем в тело змейки
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

// Обработчик клавиатуры для ПК
function keyDownHandler5(e) {
  if (!gameStarted5) {
    gameStarted5 = true;
    gameStartTime = performance.now();
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

// Обработчик начала касания (свайп)
function handleTouchStart5(e) {
  const touch = e.touches[0];
  touchStartX = touch.clientX;
  touchStartY = touch.clientY;
}

// Обработчик окончания касания (свайп)
function handleTouchEnd5(e) {
  const touch = e.changedTouches[0];
  const dx = touch.clientX - touchStartX;
  const dy = touch.clientY - touchStartY;
  const absDx = Math.abs(dx);
  const absDy = Math.abs(dy);
  const threshold = 30; // минимальное расстояние для распознавания свайпа
  
  if (absDx < threshold && absDy < threshold) {
    return;
  }
  
  if (!gameStarted5) {
    gameStarted5 = true;
    gameStartTime = performance.now();
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

// Завершение игры (при столкновении или истечении времени)
// Принимает опциональное сообщение (например, "Time's up")
function endGame5(msg) {
  gameRunning5 = false;
  let finalMsg = msg ? msg : "Game Over";
  if (typeof userRef !== 'undefined' && typeof localUserData !== 'undefined') {
    userRef.update({ points: localUserData.points });
  }
  showEndGameModal(finalMsg, "Your score: " + score5);
}

// Сброс игры (вызывается при закрытии модального окна)
function resetGame5() {
  cancelAnimationFrame(animationFrameId5);
  window.removeEventListener('keydown', keyDownHandler5);
  game5Canvas.removeEventListener('touchstart', handleTouchStart5);
  game5Canvas.removeEventListener('touchend', handleTouchEnd5);
  game5Canvas.removeEventListener('touchmove', function(e) {
    e.preventDefault();
  });
  if (game5Ctx) {
    game5Ctx.clearRect(0, 0, game5Canvas.width, game5Canvas.height);
  }
  gameRunning5 = false;
  gameStarted5 = false;
}

