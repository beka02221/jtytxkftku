// ====== specialgame1.js ======
/**
 * PvP-змейка в стиле "Матрицы" с реалтайм синхронизацией через Firebase.
 * Использует canvas #specialGameCanvas, заданный в HTML.
 *
 * Изменения:
 * - Убрана кнопка «Приготовиться»
 * - После появления второго игрока автоматически идёт отсчёт 10 секунд
 * - Затем игра начинается (state = "playing")
 */

// ---------- Глобальные переменные под игру ----------
let sg1_canvas      = null;
let sg1_ctx         = null;
let sg1_gameId      = null;   // ID текущего матча в Firebase
let sg1_localPlayer = null;   // 'player1' или 'player2'
let sg1_gameRef     = null;   // Ссылка на узел матча

// Размер поля (в клетках)
const SG1_COLS = 20;
const SG1_ROWS = 20;
// Размер клетки в пикселях
const SG1_CELL_SIZE = 20;

// Состояние змейки игрока
let sg1_snake = {
  segments: [],
  direction: 'right',
  color: '#0f0',     // цвет (случайный)
  username: '',      // имя игрока
};

// Состояние змейки противника
let sg1_enemySnake = {
  segments: [],
  direction: 'right',
  color: '#0f0',
  username: '',
};

// Позиция яблока
let sg1_apple = { x: 10, y: 10 };

// Интервалы
let sg1_gameLoopInterval  = null; 
let sg1_sendDataInterval  = null; 
let sg1_countdownInterval = null;

// Статус игры: "searching" | "countdown" | "playing" | "finished"
let sg1_gameState = 'searching';  

/**
 * Инициализация игры "змейка"
 */
function initSpecialGame1() {
  sg1_canvas = document.getElementById('specialGameCanvas');
  sg1_ctx    = sg1_canvas.getContext('2d');

  // Стиль "Матрицы"
  sg1_canvas.style.backgroundColor = '#000';
  sg1_ctx.font      = '10px "Press Start 2P", monospace';
  sg1_ctx.textAlign = 'center';
  sg1_ctx.fillStyle = '#0f0';

  // Имя пользователя из Telegram (если есть)
  if (typeof currentUser !== 'undefined' && currentUser?.username) {
    sg1_snake.username = '@' + currentUser.username;
  } else {
    sg1_snake.username = 'Me';
  }

  // Случайный цвет змейки
  sg1_snake.color = getRandomSnakeColor();

  // Начальная позиция змейки
  sg1_snake.segments = [{x: 2, y: 2}, {x:1, y:2}, {x:0, y:2}];
  sg1_snake.direction = 'right';

  // Свайпы
  setupSwipeControls(sg1_canvas);

  // Отрисовка "Поиск соперника..."
  sg1_gameState = 'searching';
  drawSearchingScreen();

  // Поиск/создание матча
  matchMakeSnakeGame();
}

/**
 * Создание / поиск матча в Firebase
 */
function matchMakeSnakeGame() {
  const gamesRef = db.ref('snakeGames');
  gamesRef.once('value', (snapshot) => {
    const gamesData = snapshot.val() || {};
    let foundGame   = null;

    // Ищем матч, где player2 нет и нет winner
    for (let gId in gamesData) {
      let g = gamesData[gId];
      if (!g.player2 && !g.winner) {
        foundGame = { id: gId, data: g };
        break;
      }
    }

    if (foundGame) {
      // Мы подключаемся как player2
      sg1_gameId      = foundGame.id;
      sg1_localPlayer = 'player2';
      sg1_gameRef     = db.ref('snakeGames/' + sg1_gameId);

      // Записываем данные о player2, переход в countdown (установим чуть позже)
      sg1_gameRef.update({
        player2: {
          username: sg1_snake.username,
          color: sg1_snake.color,
        },
        // Оставим state="searching" до момента подписки
      });
    } else {
      // Мы — player1, создаём новый матч
      sg1_gameId      = db.ref().child('snakeGames').push().key;
      sg1_localPlayer = 'player1';
      sg1_gameRef     = db.ref('snakeGames/' + sg1_gameId);

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

    // Слушаем изменения матча
    listenSnakeGameChanges();
  });
}

/**
 * Подписка на обновления
 */
function listenSnakeGameChanges() {
  if (!sg1_gameRef) return;

  sg1_gameRef.on('value', (snapshot) => {
    let data = snapshot.val();
    if (!data) return;

    sg1_gameState = data.state || 'searching';

    // Считываем apple
    if (data.apple) {
      sg1_apple.x = data.apple.x;
      sg1_apple.y = data.apple.y;
    }

    // Противник (enemySnake)
    if (sg1_localPlayer === 'player1') {
      // player2 - противник
      if (data.player2) {
        sg1_enemySnake.username = data.player2.username || 'Opponent';
        sg1_enemySnake.color    = data.player2.color    || '#0f0';
      }
      if (data.snake2) {
        sg1_enemySnake.segments = data.snake2;
      }
    } else {
      // player1 - противник
      if (data.player1) {
        sg1_enemySnake.username = data.player1.username || 'Opponent';
        sg1_enemySnake.color    = data.player1.color    || '#0f0';
      }
      if (data.snake1) {
        sg1_enemySnake.segments = data.snake1;
      }
    }

    // Обработка состояний
    if (sg1_gameState === 'searching') {
      drawSearchingScreen();
      // Если оба игрока уже есть, но state всё ещё searching —
      // Запустить обратный отсчёт (сделаем это только со стороны player1).
      if (data.player1 && data.player2) {
        if (sg1_localPlayer === 'player1') {
          startCountdown(10); 
        }
      }
      return;
    }

    if (sg1_gameState === 'countdown') {
      // Рисуем отсчёт
      drawCountdown(data.countdown);
      return;
    }

    if (sg1_gameState === 'playing') {
      // Запускаем игровой цикл, если ещё не запущен
      if (!sg1_gameLoopInterval) {
        startSnakeGameLoop();
      }
    }

    // Если есть победитель
    if (data.winner && sg1_gameState !== 'finished') {
      sg1_gameState = 'finished';
      showWinnerModal(data.winner);
    }
  });

  // Также слушаем child_changed, чтобы отловить момент,
  // когда в BД установят state='countdown' и countdown = ...
  db.ref('snakeGames').on('child_changed', (snap) => {
    if (snap.key !== sg1_gameId) return;
    let val = snap.val();
    if (!val) return;

    if (val.state === 'countdown') {
      sg1_gameState = 'countdown';
      drawCountdown(val.countdown);
    }
  });
}

// ---------------- ЭКРАН "ПОИСК СОПЕРНИКА" ----------------
function drawSearchingScreen() {
  sg1_ctx.clearRect(0, 0, sg1_canvas.width, sg1_canvas.height);
  sg1_ctx.fillStyle = '#000';
  sg1_ctx.fillRect(0, 0, sg1_canvas.width, sg1_canvas.height);

  sg1_ctx.fillStyle = '#0f0';
  sg1_ctx.font = '16px "Press Start 2P", monospace';
  sg1_ctx.textAlign = 'center';
  sg1_ctx.fillText('Поиск соперника...', sg1_canvas.width/2, sg1_canvas.height/2);
}

// ---------------- ОТСЧЁТ (10..0) ----------------
function startCountdown(seconds) {
  // Устанавливаем state='countdown' и countdown=seconds в БД
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

function drawCountdown(num) {
  sg1_ctx.clearRect(0, 0, sg1_canvas.width, sg1_canvas.height);

  sg1_ctx.fillStyle = '#000';
  sg1_ctx.fillRect(0, 0, sg1_canvas.width, sg1_canvas.height);

  sg1_ctx.fillStyle = '#0f0';
  sg1_ctx.font = '40px "Press Start 2P", monospace';
  sg1_ctx.textAlign = 'center';

  const text = (num >= 0) ? num.toString() : '0';
  sg1_ctx.fillText(text, sg1_canvas.width/2, sg1_canvas.height/2);
}

// ---------------- ИГРОВОЙ ЦИКЛ ----------------
function startSnakeGameLoop() {
  if (sg1_gameLoopInterval) return; // уже идёт

  // Каждые ~150 мс
  sg1_gameLoopInterval = setInterval(gameTick, 150);
  sg1_sendDataInterval = setInterval(sendLocalSnakeData, 150);
}

function gameTick() {
  updateSnake(sg1_snake);
  checkCollisions(sg1_snake, sg1_enemySnake);

  drawGame();
}

// Движение змейки
function updateSnake(snake) {
  const head = { ...snake.segments[0] };
  switch (snake.direction) {
    case 'up':    head.y--; break;
    case 'down':  head.y++; break;
    case 'left':  head.x--; break;
    case 'right': head.x++; break;
  }
  snake.segments.unshift(head);

  // Проверим яблоко
  if (head.x === sg1_apple.x && head.y === sg1_apple.y) {
    generateNewApple();
  } else {
    // Убираем хвост
    snake.segments.pop();
  }
}

function generateNewApple() {
  sg1_apple.x = Math.floor(Math.random() * SG1_COLS);
  sg1_apple.y = Math.floor(Math.random() * SG1_ROWS);
  sg1_gameRef.update({
    apple: { x: sg1_apple.x, y: sg1_apple.y }
  });
}

// Проверка коллизий
function checkCollisions(snake, enemy) {
  const head = snake.segments[0];

  // 1) Границы
  if (head.x < 0 || head.x >= SG1_COLS || head.y < 0 || head.y >= SG1_ROWS) {
    declareWinner(opponentOf(sg1_localPlayer));
    return;
  }
  // 2) Сама с собой
  for (let i = 1; i < snake.segments.length; i++) {
    if (head.x === snake.segments[i].x && head.y === snake.segments[i].y) {
      declareWinner(opponentOf(sg1_localPlayer));
      return;
    }
  }
  // 3) Соперник
  for (let seg of enemy.segments) {
    if (head.x === seg.x && head.y === seg.y) {
      declareWinner(opponentOf(sg1_localPlayer));
      return;
    }
  }
}

function opponentOf(player) {
  return (player === 'player1') ? 'player2' : 'player1';
}

function declareWinner(winnerPlayer) {
  if (!sg1_gameRef) return;
  sg1_gameRef.update({
    winner: winnerPlayer,
    state: 'finished'
  });
}

// Отрисовка игрового поля
function drawGame() {
  sg1_ctx.clearRect(0, 0, sg1_canvas.width, sg1_canvas.height);

  // Фон
  sg1_ctx.fillStyle = '#000';
  sg1_ctx.fillRect(0, 0, sg1_canvas.width, sg1_canvas.height);

  // Зелёная сетка
  sg1_ctx.strokeStyle = 'rgba(0,255,0,0.2)';
  for (let x = 0; x <= SG1_COLS; x++) {
    sg1_ctx.beginPath();
    sg1_ctx.moveTo(x * SG1_CELL_SIZE, 0);
    sg1_ctx.lineTo(x * SG1_CELL_SIZE, SG1_ROWS * SG1_CELL_SIZE);
    sg1_ctx.stroke();
  }
  for (let y = 0; y <= SG1_ROWS; y++) {
    sg1_ctx.beginPath();
    sg1_ctx.moveTo(0, y * SG1_CELL_SIZE);
    sg1_ctx.lineTo(SG1_COLS * SG1_CELL_SIZE, y * SG1_CELL_SIZE);
    sg1_ctx.stroke();
  }

  // Яблоко (красное)
  sg1_ctx.fillStyle = '#f00';
  sg1_ctx.fillRect(
    sg1_apple.x * SG1_CELL_SIZE,
    sg1_apple.y * SG1_CELL_SIZE,
    SG1_CELL_SIZE,
    SG1_CELL_SIZE
  );

  // Змейка своя
  drawSnake(sg1_snake);
  drawUsernameAboveHead(sg1_snake);

  // Змейка противника
  drawSnake(sg1_enemySnake);
  drawUsernameAboveHead(sg1_enemySnake);
}

function drawSnake(snakeObj) {
  sg1_ctx.fillStyle = snakeObj.color;
  snakeObj.segments.forEach(seg => {
    sg1_ctx.fillRect(
      seg.x * SG1_CELL_SIZE,
      seg.y * SG1_CELL_SIZE,
      SG1_CELL_SIZE,
      SG1_CELL_SIZE
    );
  });
}

function drawUsernameAboveHead(snakeObj) {
  if (!snakeObj.segments.length) return;
  const head = snakeObj.segments[0];

  sg1_ctx.fillStyle = '#0f0';
  sg1_ctx.font = '10px "Press Start 2P", monospace';
  sg1_ctx.textAlign = 'center';
  
  const px = head.x * SG1_CELL_SIZE + SG1_CELL_SIZE/2;
  const py = head.y * SG1_CELL_SIZE - 5;
  sg1_ctx.fillText(snakeObj.username, px, py);
}

// Отправка локальных данных о змейке
function sendLocalSnakeData() {
  if (!sg1_gameRef) return;
  if (sg1_localPlayer === 'player1') {
    sg1_gameRef.update({ snake1: sg1_snake.segments });
  } else {
    sg1_gameRef.update({ snake2: sg1_snake.segments });
  }
}

// Финальное окно (через main.js)
function showWinnerModal(winnerPlayer) {
  clearIntervals();

  let title   = 'Итог игры';
  let message = (winnerPlayer === sg1_localPlayer)
    ? 'Вы выиграли!'
    : 'Вы проиграли!';

  // Глобальная функция (из main.js)
  showEndGameModal(title, message);
}

// Сброс игры
function resetSpecialGame1() {
  clearIntervals();
  if (sg1_gameRef) {
    sg1_gameRef.off();
  }
  sg1_gameRef     = null;
  sg1_gameId      = null;
  sg1_localPlayer = null;
  sg1_gameState   = 'searching';
}

// Очищаем интервалы
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

// Свайпы
function setupSwipeControls(canvas) {
  let startX = 0;
  let startY = 0;
  let endX = 0;
  let endY = 0;

  canvas.addEventListener('touchstart', (e) => {
    const touch = e.touches[0];
    startX = touch.clientX;
    startY = touch.clientY;
  });

  canvas.addEventListener('touchmove', (e) => {
    const touch = e.touches[0];
    endX = touch.clientX;
    endY = touch.clientY;
  });

  canvas.addEventListener('touchend', (e) => {
    let diffX = endX - startX;
    let diffY = endY - startY;

    if (Math.abs(diffX) > Math.abs(diffY)) {
      // Горизонтально
      if (diffX > 0 && sg1_snake.direction !== 'left') {
        sg1_snake.direction = 'right';
      } else if (diffX < 0 && sg1_snake.direction !== 'right') {
        sg1_snake.direction = 'left';
      }
    } else {
      // Вертикально
      if (diffY > 0 && sg1_snake.direction !== 'up') {
        sg1_snake.direction = 'down';
      } else if (diffY < 0 && sg1_snake.direction !== 'down') {
        sg1_snake.direction = 'up';
      }
    }
  });
}

/** Генерируем случайный цвет змейки (зелёные/неоновые оттенки) */
function getRandomSnakeColor() {
  const colors = ['#0f0', '#0ff', '#7fff00', '#39ff14', '#32cd32'];
  return colors[Math.floor(Math.random() * colors.length)];
}
