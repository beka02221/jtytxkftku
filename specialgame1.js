// ====== specialgame1.js ======
/**
 * PvP-змейка в стиле "Матрицы" с реалтайм синхронизацией через Firebase.
 * Использует canvas #specialGameCanvas, заданный в HTML.
 * Содержит логику:
 *  - Поиска соперника (state = "searching")
 *  - Экран ожидания + кнопка "Приготовиться" (state = "waiting")
 *  - Отсчёт (state = "countdown")
 *  - Игру (state = "playing")
 *  - Определение победителя (state = "finished")
 */

// ---------- Глобальные переменные для игры ----------
let sg1_canvas      = null;
let sg1_ctx         = null;
let sg1_gameId      = null;   // ID текущего матча в Firebase
let sg1_localPlayer = null;   // 'player1' или 'player2'
let sg1_gameRef     = null;   // Ссылка на узел матча в Firebase

// Размер поля (в клетках)
const SG1_COLS = 20;
const SG1_ROWS = 20;
// Размер клетки (пикселей)
const SG1_CELL_SIZE = 20;

// Состояние змейки игрока
let sg1_snake = {
  segments: [],       // [{x, y}, {x, y}, ...]
  direction: 'right', // 'up' | 'down' | 'left' | 'right'
  color: '#0f0',      // цвет змейки (случайно генерируем)
  username: '',       // имя локального игрока (@username из Telegram)
};

// Состояние змейки противника
let sg1_enemySnake = {
  segments: [],
  direction: 'right',
  color: '#0f0',
  username: '',
};

// Позиция яблока
let sg1_apple = {
  x: 10,
  y: 10,
};

// Интервалы
let sg1_gameLoopInterval  = null; 
let sg1_sendDataInterval  = null; 
let sg1_countdownInterval = null;

// Локальная готовность
let sg1_localReady = false;

// Статус игры: "searching" | "waiting" | "countdown" | "playing" | "finished"
let sg1_gameState = 'searching';

// HTML-кнопка "Приготовиться"
let sg1_readyButton = null;

/**
 * Инициализация игры "змейка"
 */
function initSpecialGame1() {
  sg1_canvas = document.getElementById('specialGameCanvas');
  sg1_ctx    = sg1_canvas.getContext('2d');

  // Стили "Матрицы": чёрный фон, зелёные тексты
  sg1_canvas.style.backgroundColor = '#000';
  sg1_ctx.textAlign = 'center';
  sg1_ctx.fillStyle = '#0f0';
  sg1_ctx.font = '10px "Press Start 2P", monospace';

  // Установим имя пользователя из Telegram (глобальная переменная currentUser, если есть)
  if (typeof currentUser !== 'undefined' && currentUser?.username) {
    sg1_snake.username = '@' + currentUser.username;
  } else {
    sg1_snake.username = 'Me';
  }

  // Зададим случайный цвет змейки
  sg1_snake.color = getRandomSnakeColor();

  // Начальные координаты (просто пример)
  sg1_snake.segments = [{x: 2, y: 2}, {x: 1, y: 2}, {x: 0, y: 2}];
  sg1_snake.direction = 'right';

  // Устанавливаем свайпы (touch)
  setupSwipeControls(sg1_canvas);

  // Показываем надпись "Поиск соперника"
  sg1_gameState = 'searching';
  drawSearchingScreen();

  // Создаём / ищем матч
  matchMakeSnakeGame();

  // Создаём кнопку "Приготовиться" (изначально скрыта)
  createReadyButton();
}

/**
 * Создание / поиск матча в Firebase
 */
function matchMakeSnakeGame() {
  const gamesRef = db.ref('snakeGames');

  gamesRef.once('value', (snapshot) => {
    const gamesData = snapshot.val() || {};
    let foundGame   = null;

    // 1. Ищем игру, где player2 ещё нет (и нет winner)
    for (let gId in gamesData) {
      let g = gamesData[gId];
      if (!g.player2 && !g.winner) {
        foundGame = { id: gId, data: g };
        break;
      }
    }

    if (foundGame) {
      // Значит мы - player2
      sg1_gameId      = foundGame.id;
      sg1_localPlayer = 'player2';
      sg1_gameRef     = db.ref('snakeGames/' + sg1_gameId);

      // Записываем player2 в БД
      sg1_gameRef.update({
        player2: {
          username: sg1_snake.username,
          color: sg1_snake.color,
        },
        state: 'waiting',  // Раз соперник подключился, переходим к "waiting"
      });
    } else {
      // Создаём новую игру (мы - player1)
      sg1_gameId      = db.ref().child('snakeGames').push().key;
      sg1_localPlayer = 'player1';
      sg1_gameRef     = db.ref('snakeGames/' + sg1_gameId);

      // Записываем структуру
      sg1_gameRef.set({
        player1: {
          username: sg1_snake.username,
          color: sg1_snake.color,
        },
        player2: null,
        player1Ready: false,
        player2Ready: false,
        state: 'searching',
        countdown: 0,
        winner: null,
        snake1: sg1_snake.segments,
        snake2: [],
        apple: { x: sg1_apple.x, y: sg1_apple.y },
      });
    }

    // Подписываемся на изменения матча
    listenSnakeGameChanges();
  });
}

/**
 * Подписка на изменения данных матча
 */
function listenSnakeGameChanges() {
  if (!sg1_gameRef) return;

  sg1_gameRef.on('value', (snapshot) => {
    const data = snapshot.val();
    if (!data) return;

    sg1_gameState = data.state || 'searching';

    // Готовности
    const p1Ready = data.player1Ready;
    const p2Ready = data.player2Ready;

    // Яблоко
    if (data.apple) {
      sg1_apple.x = data.apple.x;
      sg1_apple.y = data.apple.y;
    }

    // Заполним enemySnake
    if (sg1_localPlayer === 'player1') {
      // Противник - player2
      if (data.player2) {
        sg1_enemySnake.username = data.player2.username || 'Opponent';
        sg1_enemySnake.color    = data.player2.color || '#0f0';
      }
      if (data.snake2) {
        sg1_enemySnake.segments = data.snake2;
      }
    } else {
      // Мы - player2, значит противник player1
      if (data.player1) {
        sg1_enemySnake.username = data.player1.username || 'Opponent';
        sg1_enemySnake.color    = data.player1.color || '#0f0';
      }
      if (data.snake1) {
        sg1_enemySnake.segments = data.snake1;
      }
    }

    // Обрабатываем текущее состояние
    if (sg1_gameState === 'searching') {
      drawSearchingScreen();
      hideReadyButton();
      return;
    }

    if (sg1_gameState === 'waiting') {
      drawWaitingScreen(data);
      // Показываем кнопку "Приготовиться", если локальный ещё не нажал
      showReadyButton(!sg1_localReady); 
      return;
    }

    if (sg1_gameState === 'countdown') {
      hideReadyButton(); // отсчёт - кнопку прячем
      drawCountdown(data.countdown);
      return;
    }

    if (sg1_gameState === 'playing') {
      hideReadyButton();
      // Запускаем игровой цикл, если не запущен
      if (!sg1_gameLoopInterval) {
        startSnakeGameLoop();
      }
    }

    // Если есть победитель (winner) и state != 'finished'
    if (data.winner && sg1_gameState !== 'finished') {
      // Завершение
      sg1_gameState = 'finished';
      showWinnerModal(data.winner);
    }
  });

  // Отдельно слушаем child_changed, чтобы отследить момент,
  // когда оба стали готовы, и запустить countdown (делает player1).
  db.ref('snakeGames').on('child_changed', (snap) => {
    if (snap.key !== sg1_gameId) return;
    let val = snap.val();
    if (!val) return;

    const p1Ready = val.player1Ready;
    const p2Ready = val.player2Ready;
    const st      = val.state;

    // Если оба готовы и всё ещё waiting
    if (p1Ready && p2Ready && st === 'waiting') {
      if (sg1_localPlayer === 'player1') {
        // Только player1 запускает отсчёт
        startCountdown();
      }
    }
  });
}

// ================== ЭКРАНЫ И УПРАВЛЕНИЕ ИНТЕРФЕЙСОМ ==================

/** Отрисовка экрана "Поиск соперника..." */
function drawSearchingScreen() {
  sg1_ctx.clearRect(0, 0, sg1_canvas.width, sg1_canvas.height);
  sg1_ctx.fillStyle = '#000';
  sg1_ctx.fillRect(0, 0, sg1_canvas.width, sg1_canvas.height);

  sg1_ctx.fillStyle = '#0f0';
  sg1_ctx.font = '16px "Press Start 2P", monospace';
  sg1_ctx.textAlign = 'center';
  sg1_ctx.fillText('Поиск соперника...', sg1_canvas.width / 2, sg1_canvas.height / 2);
}

/**
 * Экран ожидания (state = "waiting")
 * Выводим: "Соперник найден: username", статусы готовности
 */
function drawWaitingScreen(data) {
  sg1_ctx.clearRect(0, 0, sg1_canvas.width, sg1_canvas.height);
  sg1_ctx.fillStyle = '#000';
  sg1_ctx.fillRect(0, 0, sg1_canvas.width, sg1_canvas.height);

  sg1_ctx.fillStyle = '#0f0';
  sg1_ctx.textAlign = 'center';
  sg1_ctx.font = '14px "Press Start 2P", monospace';

  // Оппонент
  let opponentUsername = '';
  if (sg1_localPlayer === 'player1' && data.player2) {
    opponentUsername = data.player2.username || 'Opponent';
  } else if (sg1_localPlayer === 'player2' && data.player1) {
    opponentUsername = data.player1.username || 'Opponent';
  }

  // Пишем "Соперник найден: @username"
  if (opponentUsername) {
    sg1_ctx.fillText('Соперник найден:', sg1_canvas.width/2, sg1_canvas.height/2 - 60);
    sg1_ctx.fillText(opponentUsername, sg1_canvas.width/2, sg1_canvas.height/2 - 35);
  } else {
    sg1_ctx.fillText('Соперник найден!', sg1_canvas.width/2, sg1_canvas.height/2 - 35);
  }

  // Статусы готовности
  const p1Ready = data.player1Ready;
  const p2Ready = data.player2Ready;

  let localReadyText    = sg1_localReady ? 'Готов' : 'Не готов';
  let enemyIsReady      = (sg1_localPlayer === 'player1') ? p2Ready : p1Ready;
  let enemyReadyText    = enemyIsReady ? 'Готов' : 'Не готов';

  sg1_ctx.fillText('Вы: ' + localReadyText, sg1_canvas.width/2, sg1_canvas.height/2 + 0);
  sg1_ctx.fillText('Соперник: ' + enemyReadyText, sg1_canvas.width/2, sg1_canvas.height/2 + 30);

  if (sg1_localReady && !enemyIsReady) {
    sg1_ctx.font = '12px "Press Start 2P", monospace';
    sg1_ctx.fillText('Ожидание соперника...', sg1_canvas.width/2, sg1_canvas.height/2 + 60);
  }
}

/** Создаём HTML-кнопку "Приготовиться" */
function createReadyButton() {
  // Если уже есть, выходим
  if (sg1_readyButton) return;

  sg1_readyButton = document.createElement('button');
  sg1_readyButton.innerText = 'ПРИГОТОВИТЬСЯ';
  sg1_readyButton.style.position = 'absolute';
  sg1_readyButton.style.top = '50%';
  sg1_readyButton.style.left = '50%';
  sg1_readyButton.style.transform = 'translate(-50%, -50%)';
  sg1_readyButton.style.padding = '10px 20px';
  sg1_readyButton.style.fontFamily = '"Press Start 2P", monospace';
  sg1_readyButton.style.fontSize = '14px';
  sg1_readyButton.style.color = '#0f0';
  sg1_readyButton.style.backgroundColor = '#000';
  sg1_readyButton.style.border = '2px solid #0f0';
  sg1_readyButton.style.borderRadius = '8px';
  sg1_readyButton.style.cursor = 'pointer';
  sg1_readyButton.style.zIndex = '999';
  sg1_readyButton.style.display = 'none'; // скрыта по умолчанию

  sg1_readyButton.addEventListener('click', onReadyButtonClick);

  document.body.appendChild(sg1_readyButton);
}

/** Обработчик клика на кнопку "Приготовиться" */
function onReadyButtonClick() {
  if (!sg1_gameRef) return;
  
  sg1_localReady = true;

  if (sg1_localPlayer === 'player1') {
    sg1_gameRef.update({ player1Ready: true });
  } else {
    sg1_gameRef.update({ player2Ready: true });
  }

  // Обновим картинку экрана (будет "Ожидание соперника...")
  sg1_gameRef.once('value').then((snap) => {
    const data = snap.val();
    drawWaitingScreen(data);
  });

  // Скрываем кнопку
  hideReadyButton();
}

/** Показать кнопку (если нужно) */
function showReadyButton(show) {
  if (!sg1_readyButton) return;
  sg1_readyButton.style.display = show ? 'block' : 'none';
}

/** Спрятать кнопку */
function hideReadyButton() {
  if (!sg1_readyButton) return;
  sg1_readyButton.style.display = 'none';
}

// ----------------- ОТСЧЁТ -----------------
function startCountdown() {
  let count = 5;
  sg1_gameRef.update({
    state: 'countdown',
    countdown: count,
  });

  sg1_countdownInterval = setInterval(() => {
    count--;
    if (count >= 1) {
      sg1_gameRef.update({ countdown: count });
    } else {
      clearInterval(sg1_countdownInterval);
      sg1_gameRef.update({
        state: 'playing',
        countdown: 0,
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
  sg1_ctx.fillText(num.toString(), sg1_canvas.width / 2, sg1_canvas.height / 2);
}

// ----------------- ИГРОВОЙ ЦИКЛ ЗМЕЙКИ -----------------
function startSnakeGameLoop() {
  if (sg1_gameLoopInterval) return; // уже идёт

  // Раз в 150 мс — шаг
  sg1_gameLoopInterval = setInterval(gameTick, 150);
  // И отправка данных
  sg1_sendDataInterval = setInterval(sendLocalSnakeData, 150);
}

function gameTick() {
  // Обновляем локальную змейку
  updateSnake(sg1_snake);
  // Проверяем коллизии
  checkCollisions(sg1_snake, sg1_enemySnake);

  // Рисуем игру
  drawGame();
}

function updateSnake(snake) {
  const head = {...snake.segments[0]};
  switch (snake.direction) {
    case 'up':    head.y -= 1; break;
    case 'down':  head.y += 1; break;
    case 'left':  head.x -= 1; break;
    case 'right': head.x += 1; break;
  }
  snake.segments.unshift(head);

  // Яблоко?
  if (head.x === sg1_apple.x && head.y === sg1_apple.y) {
    generateNewApple();
  } else {
    // Хвост
    snake.segments.pop();
  }
}

// Создание нового яблока и запись в БД
function generateNewApple() {
  sg1_apple.x = Math.floor(Math.random() * SG1_COLS);
  sg1_apple.y = Math.floor(Math.random() * SG1_ROWS);

  sg1_gameRef.update({
    apple: { x: sg1_apple.x, y: sg1_apple.y },
  });
}

// Проверка коллизий
function checkCollisions(snake, enemy) {
  const head = snake.segments[0];

  // 1. Границы
  if (head.x < 0 || head.x >= SG1_COLS || head.y < 0 || head.y >= SG1_ROWS) {
    declareWinner(getOpponent());
    return;
  }
  // 2. Сам с собой
  for (let i = 1; i < snake.segments.length; i++) {
    if (head.x === snake.segments[i].x && head.y === snake.segments[i].y) {
      declareWinner(getOpponent());
      return;
    }
  }
  // 3. С противником
  for (let seg of enemy.segments) {
    if (head.x === seg.x && head.y === seg.y) {
      declareWinner(getOpponent());
      return;
    }
  }
}

/** Вернёт 'player1' или 'player2' противоположного игрока */
function getOpponent() {
  return (sg1_localPlayer === 'player1') ? 'player2' : 'player1';
}

/** Записываем победителя в Firebase */
function declareWinner(winnerPlayer) {
  if (!sg1_gameRef) return;
  sg1_gameRef.update({
    winner: winnerPlayer,
    state: 'finished',
  });
}

// Рисуем поле, змейки, яблоко
function drawGame() {
  sg1_ctx.clearRect(0, 0, sg1_canvas.width, sg1_canvas.height);

  // Фон
  sg1_ctx.fillStyle = '#000';
  sg1_ctx.fillRect(0, 0, sg1_canvas.width, sg1_canvas.height);

  // Зелёная сетка
  sg1_ctx.strokeStyle = 'rgba(0, 255, 0, 0.2)';
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

  // Змейки
  drawSnake(sg1_snake);
  drawSnake(sg1_enemySnake);

  // Никнеймы
  drawUsernameAboveHead(sg1_snake);
  drawUsernameAboveHead(sg1_enemySnake);
}

/** Рисуем змейку (сегменты) */
function drawSnake(snakeObj) {
  sg1_ctx.fillStyle = snakeObj.color;
  snakeObj.segments.forEach((segment) => {
    sg1_ctx.fillRect(
      segment.x * SG1_CELL_SIZE,
      segment.y * SG1_CELL_SIZE,
      SG1_CELL_SIZE,
      SG1_CELL_SIZE
    );
  });
}

/** Рисуем никнейм над головой */
function drawUsernameAboveHead(snakeObj) {
  if (!snakeObj.segments || snakeObj.segments.length === 0) return;
  const head = snakeObj.segments[0];
  
  sg1_ctx.fillStyle = '#0f0'; // можно snakeObj.color, если хотите
  sg1_ctx.font = '10px "Press Start 2P", monospace';
  sg1_ctx.textAlign = 'center';

  const px = head.x * SG1_CELL_SIZE + SG1_CELL_SIZE / 2;
  const py = head.y * SG1_CELL_SIZE - 5; // чуть выше головы

  sg1_ctx.fillText(snakeObj.username, px, py);
}

/** Отправляем локальные данные о змейке в Firebase */
function sendLocalSnakeData() {
  if (!sg1_gameRef) return;

  if (sg1_localPlayer === 'player1') {
    sg1_gameRef.update({ snake1: sg1_snake.segments });
  } else {
    sg1_gameRef.update({ snake2: sg1_snake.segments });
  }
}

/** Показываем финальный экран (через глобальную функцию в main.js) */
function showWinnerModal(winnerPlayer) {
  clearIntervals();

  let title   = 'Результат';
  let message = (winnerPlayer === sg1_localPlayer) ? 'Вы выиграли!' : 'Вы проиграли!';
  // Используем глобальную функцию из main.js
  showEndGameModal(title, message);
}

/** Сброс игры (вызывается при закрытии модалки endgame) */
function resetSpecialGame1() {
  clearIntervals();

  if (sg1_gameRef) {
    sg1_gameRef.off();
  }

  sg1_gameRef     = null;
  sg1_gameId      = null;
  sg1_localPlayer = null;
  sg1_localReady  = false;
  sg1_gameState   = 'searching';

  hideReadyButton();
}

/** Очищаем интервалы */
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

/** Обрабатываем свайпы (направления) */
function setupSwipeControls(canvas) {
  let startX = 0;
  let startY = 0;
  let endX   = 0;
  let endY   = 0;

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
      // Горизонтальный свайп
      if (diffX > 0 && sg1_snake.direction !== 'left') {
        sg1_snake.direction = 'right';
      } else if (diffX < 0 && sg1_snake.direction !== 'right') {
        sg1_snake.direction = 'left';
      }
    } else {
      // Вертикальный свайп
      if (diffY > 0 && sg1_snake.direction !== 'up') {
        sg1_snake.direction = 'down';
      } else if (diffY < 0 && sg1_snake.direction !== 'down') {
        sg1_snake.direction = 'up';
      }
    }
  });
}

/** Генерируем случайный цвет змейки (из набора зелёных/неоновых) */
function getRandomSnakeColor() {
  const colors = ['#0f0', '#0ff', '#7fff00', '#39ff14', '#32cd32'];
  return colors[Math.floor(Math.random() * colors.length)];
}
