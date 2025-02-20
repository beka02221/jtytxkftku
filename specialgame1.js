// ====== specialgame1.js ======
/**
 * PvP-змейка в стиле "Матрицы" с синхронизацией через Firebase.
 * Особенности:
 *  - Центрированная игровая сетка на canvas.
 *  - Обработка touch-событий с предотвращением скролла.
 *  - После нахождения противника: сначала медленно появляется надпись "Соперник найден", затем имя соперника (2 секунды), после чего начинается 10-секундный отсчёт.
 *  - Выход за границы карты приводит к поражению, оба клиента показывают модальные окна с результатом.
 */

// Глобальные переменные
let sg1_canvas      = null;
let sg1_ctx         = null;
let sg1_gameId      = null;      // ID матча в Firebase
let sg1_localPlayer = null;      // 'player1' или 'player2'
let sg1_gameRef     = null;      // Ссылка на узел матча

// Размеры сетки
const SG1_COLS = 20;
const SG1_ROWS = 20;
const SG1_CELL_SIZE = 20; // размер клетки в пикселях

// Состояния змейки игрока
let sg1_snake = {
  segments: [],
  direction: 'right',
  color: '#0f0',
  username: '',  // например, "@username"
};

// Состояние змейки противника
let sg1_enemySnake = {
  segments: [],
  direction: 'right',
  color: '#0f0',
  username: '',
};

// Яблоко
let sg1_apple = { x: 10, y: 10 };

// Интервалы
let sg1_gameLoopInterval  = null;
let sg1_sendDataInterval  = null;
let sg1_countdownInterval = null;

// Статус игры: "searching" | "countdown" | "playing" | "finished"
let sg1_gameState = 'searching';

// Флаг, чтобы анимация нахождения противника не повторялась
let sg1_opponentFoundAnimationShown = false;

/**
 * Инициализация игры.
 */
function initSpecialGame1() {
  sg1_canvas = document.getElementById('specialGameCanvas');
  sg1_ctx = sg1_canvas.getContext('2d');

  // Настройка стиля "Матрицы"
  sg1_canvas.style.backgroundColor = '#000';
  sg1_ctx.textAlign = 'center';
  sg1_ctx.fillStyle = '#0f0';
  sg1_ctx.font = '10px "Press Start 2P", monospace';

  // Имя пользователя из Telegram (если доступно)
  if (typeof currentUser !== 'undefined' && currentUser?.username) {
    sg1_snake.username = '@' + currentUser.username;
  } else {
    sg1_snake.username = 'Me';
  }

  // Случайный цвет змейки
  sg1_snake.color = getRandomSnakeColor();

  // Начальная позиция змейки
  sg1_snake.segments = [{x: 2, y: 2}, {x: 1, y: 2}, {x: 0, y: 2}];
  sg1_snake.direction = 'right';

  // Устанавливаем обработку свайпов (с предотвращением скролла)
  setupSwipeControls(sg1_canvas);

  // Показываем на канвасе надпись "Поиск соперника..."
  sg1_gameState = 'searching';
  drawSearchingScreen();

  // Создаём/ищем матч в Firebase
  matchMakeSnakeGame();
}

/**
 * Создание/поиск матча в Firebase.
 */
function matchMakeSnakeGame() {
  const gamesRef = db.ref('snakeGames');
  gamesRef.once('value', (snapshot) => {
    const gamesData = snapshot.val() || {};
    let foundGame = null;
    for (let gId in gamesData) {
      let g = gamesData[gId];
      if (!g.player2 && !g.winner) {
        foundGame = { id: gId, data: g };
        break;
      }
    }

    if (foundGame) {
      // Подключаемся как player2
      sg1_gameId = foundGame.id;
      sg1_localPlayer = 'player2';
      sg1_gameRef = db.ref('snakeGames/' + sg1_gameId);
      sg1_gameRef.update({
        player2: {
          username: sg1_snake.username,
          color: sg1_snake.color,
        }
        // state остаётся "searching" до запуска анимации
      });
    } else {
      // Создаём новый матч; мы — player1
      sg1_gameId = db.ref().child('snakeGames').push().key;
      sg1_localPlayer = 'player1';
      sg1_gameRef = db.ref('snakeGames/' + sg1_gameId);
      sg1_gameRef.set({
        player1: {
          username: sg1_snake.username,
          color: sg1_snake.color,
        },
        player2: null,
        state: 'searching',
        countdown: 0,
        winner: null,
        snake1: sg1_snake.segments,
        snake2: [],
        apple: { x: sg1_apple.x, y: sg1_apple.y },
      });
    }
    listenSnakeGameChanges();
  });
}

/**
 * Подписка на изменения матча в Firebase.
 */
function listenSnakeGameChanges() {
  if (!sg1_gameRef) return;
  sg1_gameRef.on('value', (snapshot) => {
    const data = snapshot.val();
    if (!data) return;
    sg1_gameState = data.state || 'searching';

    // Обновляем координаты яблока
    if (data.apple) {
      sg1_apple.x = data.apple.x;
      sg1_apple.y = data.apple.y;
    }

    // Обновляем данные противника
    if (sg1_localPlayer === 'player1') {
      if (data.player2) {
        sg1_enemySnake.username = data.player2.username || 'Opponent';
        sg1_enemySnake.color = data.player2.color || '#0f0';
      }
      if (data.snake2) {
        sg1_enemySnake.segments = data.snake2;
      }
    } else {
      if (data.player1) {
        sg1_enemySnake.username = data.player1.username || 'Opponent';
        sg1_enemySnake.color = data.player1.color || '#0f0';
      }
      if (data.snake1) {
        sg1_enemySnake.segments = data.snake1;
      }
    }

    // Если состояние "searching" и оба игрока есть, запускаем анимацию (один раз)
    if (sg1_gameState === 'searching') {
      drawSearchingScreen();
      if (data.player1 && data.player2 && !sg1_opponentFoundAnimationShown) {
        showOpponentFoundAnimation();
      }
      return;
    }

    // Если состояние "countdown" — отрисовываем отсчёт
    if (sg1_gameState === 'countdown') {
      drawCountdown(data.countdown);
      return;
    }

    // Если состояние "playing" — запускаем игровой цикл, если ещё не запущен
    if (sg1_gameState === 'playing') {
      if (!sg1_gameLoopInterval) {
        startSnakeGameLoop();
      }
    }

    // Если есть победитель, а state ещё не "finished"
    if (data.winner && sg1_gameState !== 'finished') {
      sg1_gameState = 'finished';
      showWinnerModal(data.winner);
    }
  });

  // Дополнительно слушаем child_changed для отрисовки countdown
  db.ref('snakeGames').on('child_changed', (snap) => {
    if (snap.key !== sg1_gameId) return;
    const val = snap.val();
    if (!val) return;
    if (val.state === 'countdown') {
      sg1_gameState = 'countdown';
      drawCountdown(val.countdown);
    }
  });
}

/**
 * Анимация после нахождения противника.
 * Сначала плавно появляется текст "Соперник найден" (2 секунды),
 * затем через 2 секунды вместо него появляется имя противника,
 * и спустя 2 секунды (у player1) запускается отсчёт 10 секунд.
 */
function showOpponentFoundAnimation() {
  sg1_opponentFoundAnimationShown = true;
  // Отрисовка "Соперник найден" по центру
  sg1_ctx.clearRect(0, 0, sg1_canvas.width, sg1_canvas.height);
  sg1_ctx.fillStyle = '#000';
  sg1_ctx.fillRect(0, 0, sg1_canvas.width, sg1_canvas.height);
  sg1_ctx.fillStyle = '#0f0';
  sg1_ctx.font = '16px "Press Start 2P", monospace';
  sg1_ctx.fillText('Соперник найден', sg1_canvas.width / 2, sg1_canvas.height / 2);
  // Через 2 секунды показываем имя противника
  setTimeout(() => {
    sg1_ctx.clearRect(0, 0, sg1_canvas.width, sg1_canvas.height);
    sg1_ctx.fillStyle = '#000';
    sg1_ctx.fillRect(0, 0, sg1_canvas.width, sg1_canvas.height);
    let opponentName = sg1_enemySnake.username || 'Opponent';
    sg1_ctx.fillText(opponentName, sg1_canvas.width / 2, sg1_canvas.height / 2);
    // Через 2 секунды запускаем отсчёт (только у player1)
    setTimeout(() => {
      sg1_ctx.clearRect(0, 0, sg1_canvas.width, sg1_canvas.height);
      if (sg1_localPlayer === 'player1') {
        startCountdown(10);
      }
    }, 2000);
  }, 2000);
}

/**
 * Отрисовка экрана "Поиск соперника..."
 * (Текст центрируется по canvas)
 */
function drawSearchingScreen() {
  sg1_ctx.clearRect(0, 0, sg1_canvas.width, sg1_canvas.height);
  sg1_ctx.fillStyle = '#000';
  sg1_ctx.fillRect(0, 0, sg1_canvas.width, sg1_canvas.height);
  sg1_ctx.fillStyle = '#0f0';
  sg1_ctx.font = '16px "Press Start 2P", monospace';
  sg1_ctx.fillText('Поиск соперника...', sg1_canvas.width / 2, sg1_canvas.height / 2);
}

/**
 * Запуск отсчёта (от seconds до 0).
 * При окончании отсчёта (только у player1) state переходит в "playing".
 */
function startCountdown(seconds) {
  sg1_gameRef.update({
    state: 'countdown',
    countdown: seconds
  });
  let count = seconds;
  sg1_countdownInterval = setInterval(() => {
    count--;
    if (count >= 0) {
      sg1_gameRef.update({ countdown: count });
    } else {
      clearInterval(sg1_countdownInterval);
      sg1_gameRef.update({
        state: 'playing',
        countdown: 0
      });
    }
  }, 1000);
}

/**
 * Отрисовка отсчёта (число по центру).
 */
function drawCountdown(num) {
  sg1_ctx.clearRect(0, 0, sg1_canvas.width, sg1_canvas.height);
  sg1_ctx.fillStyle = '#000';
  sg1_ctx.fillRect(0, 0, sg1_canvas.width, sg1_canvas.height);
  sg1_ctx.fillStyle = '#0f0';
  sg1_ctx.font = '40px "Press Start 2P", monospace';
  sg1_ctx.fillText(num.toString(), sg1_canvas.width / 2, sg1_canvas.height / 2);
}

/**
 * ИГРОВОЙ ЦИКЛ
 */
function startSnakeGameLoop() {
  if (sg1_gameLoopInterval) return;
  sg1_gameLoopInterval = setInterval(gameTick, 150);
  sg1_sendDataInterval = setInterval(sendLocalSnakeData, 150);
}

function gameTick() {
  updateSnake(sg1_snake);
  checkCollisions(sg1_snake, sg1_enemySnake);
  drawGame();
}

/**
 * Обновление позиции змейки.
 */
function updateSnake(snake) {
  const head = { ...snake.segments[0] };
  switch (snake.direction) {
    case 'up': head.y--; break;
    case 'down': head.y++; break;
    case 'left': head.x--; break;
    case 'right': head.x++; break;
  }
  snake.segments.unshift(head);
  if (head.x === sg1_apple.x && head.y === sg1_apple.y) {
    generateNewApple();
  } else {
    snake.segments.pop();
  }
}

/**
 * Генерация нового яблока.
 */
function generateNewApple() {
  sg1_apple.x = Math.floor(Math.random() * SG1_COLS);
  sg1_apple.y = Math.floor(Math.random() * SG1_ROWS);
  sg1_gameRef.update({
    apple: { x: sg1_apple.x, y: sg1_apple.y }
  });
}

/**
 * Проверка столкновений.
 * Если змейка выходит за границы, либо сталкивается с собой или с противником – вызывается declareWinner.
 */
function checkCollisions(snake, enemy) {
  const head = snake.segments[0];
  // Выход за границы
  if (head.x < 0 || head.x >= SG1_COLS || head.y < 0 || head.y >= SG1_ROWS) {
    declareWinner(opponentOf(sg1_localPlayer));
    return;
  }
  // Столкновение с собой
  for (let i = 1; i < snake.segments.length; i++) {
    if (head.x === snake.segments[i].x && head.y === snake.segments[i].y) {
      declareWinner(opponentOf(sg1_localPlayer));
      return;
    }
  }
  // Столкновение с противником
  for (let seg of enemy.segments) {
    if (head.x === seg.x && head.y === seg.y) {
      declareWinner(opponentOf(sg1_localPlayer));
      return;
    }
  }
}

/**
 * Определяет оппонента.
 */
function opponentOf(player) {
  return (player === 'player1') ? 'player2' : 'player1';
}

/**
 * Записываем победителя в Firebase.
 */
function declareWinner(winnerPlayer) {
  if (!sg1_gameRef) return;
  sg1_gameRef.update({
    winner: winnerPlayer,
    state: 'finished'
  });
}

/**
 * Отрисовка игрового поля.
 * Здесь сетка, яблоко и змейки отрисовываются с учетом отступов, чтобы область была по центру canvas.
 */
function drawGame() {
  // Вычисляем размеры сетки и отступы для центрирования
  const gridWidth = SG1_COLS * SG1_CELL_SIZE;
  const gridHeight = SG1_ROWS * SG1_CELL_SIZE;
  const offsetX = (sg1_canvas.width - gridWidth) / 2;
  const offsetY = (sg1_canvas.height - gridHeight) / 2;

  sg1_ctx.clearRect(0, 0, sg1_canvas.width, sg1_canvas.height);

  // Фон canvas
  sg1_ctx.fillStyle = '#000';
  sg1_ctx.fillRect(0, 0, sg1_canvas.width, sg1_canvas.height);

  // Отрисовка сетки (центрированная)
  sg1_ctx.strokeStyle = 'rgba(0,255,0,0.2)';
  for (let x = 0; x <= SG1_COLS; x++) {
    sg1_ctx.beginPath();
    sg1_ctx.moveTo(offsetX + x * SG1_CELL_SIZE, offsetY);
    sg1_ctx.lineTo(offsetX + x * SG1_CELL_SIZE, offsetY + gridHeight);
    sg1_ctx.stroke();
  }
  for (let y = 0; y <= SG1_ROWS; y++) {
    sg1_ctx.beginPath();
    sg1_ctx.moveTo(offsetX, offsetY + y * SG1_CELL_SIZE);
    sg1_ctx.lineTo(offsetX + gridWidth, offsetY + y * SG1_CELL_SIZE);
    sg1_ctx.stroke();
  }

  // Отрисовка яблока
  sg1_ctx.fillStyle = '#f00';
  sg1_ctx.fillRect(
    offsetX + sg1_apple.x * SG1_CELL_SIZE,
    offsetY + sg1_apple.y * SG1_CELL_SIZE,
    SG1_CELL_SIZE,
    SG1_CELL_SIZE
  );

  // Отрисовка змейки игрока и имени над головой
  drawSnake(sg1_snake, offsetX, offsetY);
  drawUsernameAboveHead(sg1_snake, offsetX, offsetY);

  // Отрисовка змейки противника и имени
  drawSnake(sg1_enemySnake, offsetX, offsetY);
  drawUsernameAboveHead(sg1_enemySnake, offsetX, offsetY);
}

/**
 * Отрисовка змейки с учётом смещения.
 */
function drawSnake(snakeObj, offsetX, offsetY) {
  sg1_ctx.fillStyle = snakeObj.color;
  snakeObj.segments.forEach((seg) => {
    sg1_ctx.fillRect(
      offsetX + seg.x * SG1_CELL_SIZE,
      offsetY + seg.y * SG1_CELL_SIZE,
      SG1_CELL_SIZE,
      SG1_CELL_SIZE
    );
  });
}

/**
 * Отрисовка имени (никнейма) над головой змейки.
 */
function drawUsernameAboveHead(snakeObj, offsetX, offsetY) {
  if (!snakeObj.segments.length) return;
  const head = snakeObj.segments[0];
  sg1_ctx.fillStyle = '#0f0';
  sg1_ctx.font = '10px "Press Start 2P", monospace';
  const px = offsetX + head.x * SG1_CELL_SIZE + SG1_CELL_SIZE / 2;
  const py = offsetY + head.y * SG1_CELL_SIZE - 5;
  sg1_ctx.fillText(snakeObj.username, px, py);
}

/**
 * Отправка локальных данных змейки в Firebase.
 */
function sendLocalSnakeData() {
  if (!sg1_gameRef) return;
  if (sg1_localPlayer === 'player1') {
    sg1_gameRef.update({ snake1: sg1_snake.segments });
  } else {
    sg1_gameRef.update({ snake2: sg1_snake.segments });
  }
}

/**
 * Показываем модальное окно победы/поражения.
 * Глобальная функция showEndGameModal должна быть реализована в основном файле.
 */
function showWinnerModal(winnerPlayer) {
  clearIntervals();
  let title = 'Итог игры';
  let message = (winnerPlayer === sg1_localPlayer) ? 'Вы выиграли!' : 'Вы проиграли!';
  showEndGameModal(title, message);
}

/**
 * Сброс игры.
 */
function resetSpecialGame1() {
  clearIntervals();
  if (sg1_gameRef) {
    sg1_gameRef.off();
  }
  sg1_gameRef = null;
  sg1_gameId = null;
  sg1_localPlayer = null;
  sg1_gameState = 'searching';
}

/**
 * Очищаем интервалы.
 */
function clearIntervals() {
  if (sg1_gameLoopInterval) {
    clearInterval(sg1_gameLoopInterval);
    sg1_gameLoopInterval = null;
  }
  if (sg1_sendDataInterval) {
    clearInterval(sg1_sendDataInterval);
    sg1_sendDataInterval = null;
  }
  if (sg1_countdownInterval) {
    clearInterval(sg1_countdownInterval);
    sg1_countdownInterval = null;
  }
}

/**
 * Обработка свайпов с предотвращением прокрутки.
 */
function setupSwipeControls(canvas) {
  let startX = 0, startY = 0, endX = 0, endY = 0;
  canvas.addEventListener('touchstart', (e) => {
    e.preventDefault();
    const touch = e.touches[0];
    startX = touch.clientX;
    startY = touch.clientY;
  }, { passive: false });
  
  canvas.addEventListener('touchmove', (e) => {
    e.preventDefault();
    const touch = e.touches[0];
    endX = touch.clientX;
    endY = touch.clientY;
  }, { passive: false });
  
  canvas.addEventListener('touchend', (e) => {
    let diffX = endX - startX;
    let diffY = endY - startY;
    if (Math.abs(diffX) > Math.abs(diffY)) {
      if (diffX > 0 && sg1_snake.direction !== 'left') {
        sg1_snake.direction = 'right';
      } else if (diffX < 0 && sg1_snake.direction !== 'right') {
        sg1_snake.direction = 'left';
      }
    } else {
      if (diffY > 0 && sg1_snake.direction !== 'up') {
        sg1_snake.direction = 'down';
      } else if (diffY < 0 && sg1_snake.direction !== 'down') {
        sg1_snake.direction = 'up';
      }
    }
  });
}

/**
 * Генерация случайного цвета змейки (зелёные/неон оттенки).
 */
function getRandomSnakeColor() {
  const colors = ['#0f0', '#0ff', '#7fff00', '#39ff14', '#32cd32'];
  return colors[Math.floor(Math.random() * colors.length)];
}
