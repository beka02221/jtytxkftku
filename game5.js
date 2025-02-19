/* =========================
   game5.js — Snake в стиле «Матрица»

   Управление:
    - Клавиши со стрелками (←↑→↓).
   Механика:
    - Змейка двигается по сетке.
    - Если съедает «еду», растет на 1 сегмент и даёт +10 очков.
    - Столкновение со стеной или с собой — конец игры.
   При проигрыше или выигрыше — вызываем showEndGameModal.
========================= */

// Глобальные переменные для game5
let game5Canvas, game5Ctx;
let gridSize = 20;           // Размер одной ячейки на сетке
let tileCountX, tileCountY;  // Кол-во ячеек по горизонтали/вертикали
let snake = [];              // Массив сегментов змейки: [{x, y}, ...]
let snakeLength = 4;         // Начальная длина змейки
let snakeDir = { x: 1, y: 0 };// Текущее направление (движется вправо)
let food = { x: 0, y: 0 };   // Позиция еды
let score5 = 0;              // Очки внутри этой игры
let gameRunning5 = false;    // Флаг для игрового цикла
let gameStarted5 = false;    // Начнём движение после нажатия кнопок
let animationFrameId5;
let lastFrameTime5 = 0;
let frameInterval = 150;     // Интервал в мс между ходами ( ~6-7 fps )

// Инициализация игры
function initGame5() {
  game5Canvas = document.getElementById('game5Canvas');
  if (!game5Canvas) {
    console.error("Canvas с id 'game5Canvas' не найден.");
    return;
  }
  game5Ctx = game5Canvas.getContext('2d');

  // Рассчитываем, сколько «клеток» помещается
  tileCountX = Math.floor(game5Canvas.width / gridSize);
  tileCountY = Math.floor(game5Canvas.height / gridSize);

  // Сбрасываем змейку
  snake = [];
  snakeLength = 4; // можно варьировать
  // Начальные координаты (примерно центр)
  let startX = Math.floor(tileCountX / 2);
  let startY = Math.floor(tileCountY / 2);
  for (let i = 0; i < snakeLength; i++) {
    // «Хвост» влево от головы
    snake.push({ x: startX - i, y: startY });
  }
  
  // Начальное направление — вправо
  snakeDir = { x: 1, y: 0 };
  
  // Случайно размещаем «еду»
  placeFood();

  // Сбрасываем счёт
  score5 = 0;

  // Флаги
  gameStarted5 = false;
  gameRunning5 = true;

  // Слушатели клавиатуры
  window.addEventListener('keydown', keyDownHandler5);

  // Рисуем 1-ый кадр
  drawGame5();

  // Запускаем цикл
  animationFrameId5 = requestAnimationFrame(gameLoop5);
}

// Основной игровой цикл через requestAnimationFrame
function gameLoop5(timestamp) {
  // Проверяем, пора ли обновлять кадр (учитываем frameInterval)
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
    // Пока не нажали клавишу — змейка «стоит» на месте
    return;
  }

  // Берём координаты головы (последний элемент массива snake)
  let head = snake[snake.length - 1];
  // Новая позиция головы
  let newHead = { 
    x: head.x + snakeDir.x, 
    y: head.y + snakeDir.y 
  };

  // Проверяем столкновения со стенами
  if (
    newHead.x < 0 || 
    newHead.x >= tileCountX ||
    newHead.y < 0 || 
    newHead.y >= tileCountY
  ) {
    // Столкновение со стеной — конец
    endGame5();
    return;
  }

  // Проверяем столкновения с «собой»
  for (let i = 0; i < snake.length; i++) {
    if (snake[i].x === newHead.x && snake[i].y === newHead.y) {
      // Столкнулись с хвостом
      endGame5();
      return;
    }
  }

  // Добавляем новую голову в массив
  snake.push(newHead);

  // Проверяем, съедена ли «еда»
  if (newHead.x === food.x && newHead.y === food.y) {
    // Добавляем очки
    score5 += 10;
    if (typeof localUserData !== 'undefined') {
      localUserData.points += 10;
      updateTopBar(); // обновим в шапке
    }
    placeFood();
  } else {
    // Если не съели еду — удаляем хвост (обычное движение)
    snake.shift();
  }
}

// Отрисовка игры
function drawGame5() {
  // Фон (чёрный)
  game5Ctx.fillStyle = "#000000";
  game5Ctx.fillRect(0, 0, game5Canvas.width, game5Canvas.height);

  // Рисуем «еду» (зелёный квадрат)
  game5Ctx.fillStyle = "#00FF00";
  game5Ctx.fillRect(food.x * gridSize, food.y * gridSize, gridSize, gridSize);

  // Рисуем змейку (зелёные сегменты)
  for (let i = 0; i < snake.length; i++) {
    game5Ctx.fillStyle = i === snake.length - 1 ? "#00FF00" : "#008000";
    let s = snake[i];
    game5Ctx.fillRect(s.x * gridSize, s.y * gridSize, gridSize, gridSize);
  }

  // Отображаем счёт
  game5Ctx.fillStyle = "#00FF00";
  game5Ctx.font = "16px monospace";
  game5Ctx.fillText("Score: " + score5, 10, 20);
}

// Размещаем «еду» в случайном месте
function placeFood() {
  food.x = Math.floor(Math.random() * tileCountX);
  food.y = Math.floor(Math.random() * tileCountY);

  // На всякий случай проверим, чтобы еда не появилась на змейке
  for (let i = 0; i < snake.length; i++) {
    if (snake[i].x === food.x && snake[i].y === food.y) {
      // Если совпало, генерируем заново
      placeFood();
      return;
    }
  }
}

// Обработчик нажатия клавиш
function keyDownHandler5(e) {
  // Если игра не запущена — запускаем
  if (!gameStarted5) {
    gameStarted5 = true;
  }

  // Устанавливаем направление змейки
  // Исключаем обратный ход (180 град. поворот)
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

// Завершение игры
function endGame5() {
  gameRunning5 = false;
  // Сохраняем очки в БД (если есть текущий пользователь)
  if (typeof userRef !== 'undefined' && typeof localUserData !== 'undefined') {
    userRef.update({ points: localUserData.points });
  }
  showEndGameModal("Game Over", "Your score: " + score5);
}

// Сброс игры (вызывается при закрытии модального окна)
function resetGame5() {
  cancelAnimationFrame(animationFrameId5);
  window.removeEventListener('keydown', keyDownHandler5);
  if (game5Ctx) {
    game5Ctx.clearRect(0, 0, game5Canvas.width, game5Canvas.height);
  }
  gameRunning5 = false;
  gameStarted5 = false;
}
