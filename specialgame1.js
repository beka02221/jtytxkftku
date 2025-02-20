// ====== specialgame1.js ======
/**
 * PvP-змейка в стиле "Матрицы" с реалтайм синхронизацией через Firebase.
 * Использует canvas #specialGameCanvas, заданный в HTML.
 * Добавлен отдельный "Поиск соперника", кнопка "Приготовиться", экран ожидания и т.д.
 */

// ---------- Глобальные переменные под игру ----------
let sg1_canvas      = null;
let sg1_ctx         = null;
let sg1_gameId      = null;          // ID текущего матча
let sg1_localPlayer = null;          // 'player1' или 'player2'
let sg1_gameRef     = null;          // Ссылка на узел матча в Firebase

// Размер поля (в клетках)
const SG1_COLS = 20;
const SG1_ROWS = 20;
// Размер клетки (пикселей)
const SG1_CELL_SIZE = 20;

// Состояние змейки игрока (массив сегментов, направление и т.д.)
let sg1_snake = {
  segments: [],       // [{x, y}, {x, y}, ...]
  direction: 'right', // 'up' | 'down' | 'left' | 'right'
  color: '#0f0',      // цвет змейки (для localPlayer)
  username: '',       // имя игрока (берём из Telegram)
};

// Состояние змейки противника (читаем из БД)
let sg1_enemySnake = {
  segments: [],
  direction: 'right',
  color: '#0f0',
  username: '',
};

// Яблоко
let sg1_apple = {
  x: 10,
  y: 10,
};

// Интервалы
let sg1_gameLoopInterval    = null; 
let sg1_sendDataInterval    = null; 
let sg1_countdownInterval   = null;
let sg1_searchTimeoutHandle = null;  

// Локальные флаги готовности
let sg1_localReady = false;

// Статус игры: "searching" | "waiting" | "countdown" | "playing" | "finished"
let sg1_gameState  = 'searching';  

// HTML-кнопка "Приготовиться"
let sg1_readyButton = null;

// ---------- Инициализация игры ----------
function initSpecialGame1() {
  sg1_canvas = document.getElementById('specialGameCanvas');
  sg1_ctx    = sg1_canvas.getContext('2d');

  // Настраиваем "матрица"-стиль
  sg1_canvas.style.backgroundColor = '#000';  // чёрный фон
  sg1_ctx.font = '10px "Press Start 2P", monospace';
  sg1_ctx.textAlign = 'center';
  sg1_ctx.fillStyle = '#0f0';

  // Берём имя пользователя из глобального currentUser (из main.js, если там есть)
  if (currentUser && currentUser.username) {
    sg1_snake.username = '@' + currentUser.username;
  } else {
    sg1_snake.username = 'Me';
  }

  // Случайный цвет змейки
  sg1_snake.color = getRandomSnakeColor();

  // Стартовая позиция
  sg1_snake.segments = [{x: 2, y: 2}, {x: 1, y: 2}, {x: 0, y: 2}];
  sg1_snake.direction = 'right';

  // Устанавливаем обработку свайпов
  setupSwipeControls(sg1_canvas);

  // Создаём / ищем матч
  sg1_gameState = 'searching';
  drawSearchingScreen();

  // Подключаемся к БД
  matchMakeSnakeGame();

  // Создаём/показываем кнопку "Приготовиться"
  createReadyButton();
}

// Функция создания/поиска матча
function matchMakeSnakeGame() {
  const gamesRef = db.ref('snakeGames');
  gamesRef.once('value', snapshot => {
    const gamesData = snapshot.val() || {};
    let foundGame   = null;

    // Ищем игру, где player2 == null и winner нет
    for (let gId in gamesData) {
      let g = gamesData[gId];
      if (!g.player2 && !g.winner) {
        foundGame = { id: gId, data: g };
        break;
      }
    }

    if (foundGame) {
      // Подключаемся как player2
      sg1_gameId      = foundGame.id;
      sg1_localPlayer = 'player2';
      sg1_gameRef     = db.ref('snakeGames/' + sg1_gameId);
      sg1_gameRef.update({
        player2: {
          username: sg1_snake.username,
          color: sg1_snake.color
        },
        state: 'waiting',  // переводим в waiting, раз оба уже есть
      });
    } else {
      // Создаём новую игру
      sg1_gameId      = db.ref().child('snakeGames').push().key;
      sg1_localPlayer = 'player1';
      sg1_gameRef     = db.ref('snakeGames/' + sg1_gameId);

      sg1_gameRef.set({
        player1: {
          username: sg1_snake.username,
          color: sg1_snake.color
        },
        player2: null,
        player1Ready: false,
        player2Ready: false,
        state: 'searching', // ищем соперника
        countdown: 0,
        winner: null,
        snake1: sg1_snake.segments,
        snake2: [],
        apple: { x: sg1_apple.x, y: sg1_apple.y },
      });
    }

    // Подписываемся на изменения
    listenSnakeGameChanges();
  });
}

// Подписка на обновления матча
function listenSnakeGameChanges() {
  if (!sg1_gameRef) return;

  sg1_gameRef.on('value', snapshot => {
    const data = snapshot.val();
    if (!data) return;

    sg1_gameState = data.state || 'searching';

    // Считываем готовности
    let p1Ready = data.player1Ready;
    let p2Ready = data.player2Ready;

    // Если появился соперник => state = waiting
    // (если кто-то ещё не поменял state?)
    if (data.player1 && data.player2 && sg1_gameState === 'searching') {
      sg1_gameRef.update({ state: 'waiting' });
      return;
    }

    // Считываем apple
    if (data.apple) {
      sg1_apple.x = data.apple.x;
      sg1_apple.y = data.apple.y;
    }

    // Считываем данные о противнике
    if (sg1_localPlayer === 'player1') {
      if (data.player2) {
        sg1_enemySnake.username = data.player2.username || 'Opponent';
        sg1_enemySnake.color    = data.player2.color    || '#0f0';
      }
      if (data.snake2) {
        sg1_enemySnake.segments = data.snake2;
      }
    } else {
      if (data.player1) {
        sg1_enemySnake.username = data.player1.username || 'Opponent';
        sg1_enemySnake.color    = data.player1.color    || '#0f0';
      }
      if (data.snake1) {
        sg1_enemySnake.segments = data.snake1;
      }
    }

    // Если state = 'searching' – рисуем экран поиска
    if (sg1_gameState === 'searching') {
      drawSearchingScreen();
      hideReadyButton(); // прячем кнопку, т.к. соперника ещё нет
      return;
    }

    // Если state = 'waiting' – показываем кнопку "Приготовиться"
    if (sg1_gameState === 'waiting') {
      drawWaitingScreen(data.player1Ready, data.player2Ready);
      showReadyButton(!sg1_localReady); 
      return;
    }

    // Если state = 'countdown'
    if (sg1_gameState === 'countdown') {
      hideReadyButton(); // Прячем кнопку, отсчёт начался
      drawCountdown(data.countdown);
      return;
    }

    // Если state = 'playing'
    if (sg1_gameState === 'playing') {
      hideReadyButton();
      // Запускаем игровой цикл (если ещё не запущен)
      if (!sg1_gameLoopInterval) {
        startSnakeGameLoop();
      }
    }

    // Победитель?
    if (data.winner && sg1_gameState !== 'finished') {
      // Игра закончена
      sg1_gameState = 'finished';
      showWinnerModal(data.winner);
    }
  });

  // Слушаем child_changed (для готовности + запуск countdown),
  // инициализируем логику только player1, чтобы он "запускал" отсчёт.
  db.ref('snakeGames').on('child_changed', (snap) => {
    if (snap.key !== sg1_gameId) return;
    let val = snap.val();
    if (!val) return;

    let p1Ready = val.player1Ready;
    let p2Ready = val.player2Ready;
    let st      = val.state;
    if (p1Ready && p2Ready && st === 'waiting') {
      // Запускает отсчёт только player1
      if (sg1_localPlayer === 'player1') {
        startCountdown();
      }
    }
  });
}

// =========================== ЭКРАНЫ И ИНТЕРФЕЙС ===========================

// Рисуем экран "Поиск соперника..."
function drawSearchingScreen() {
  sg1_ctx.clearRect(0, 0, sg1_canvas.width, sg1_canvas.height);
  sg1_ctx.fillStyle = '#000';
  sg1_ctx.fillRect(0, 0, sg1_canvas.width, sg1_canvas.height);

  sg1_ctx.fillStyle = '#0f0';
  sg1_ctx.font = '16px "Press Start 2P", monospace';
  sg1_ctx.textAlign = 'center';
  sg1_ctx.fillText('Поиск соперника...', sg1_canvas.width / 2, sg1_canvas.height / 2);
}

// Рисуем экран ожидания готовности
function drawWaitingScreen(p1Ready, p2Ready) {
  sg1_ctx.clearRect(0, 0, sg1_canvas.width, sg1_canvas.height);
  sg1_ctx.fillStyle = '#000';
  sg1_ctx.fillRect(0, 0, sg1_canvas.width, sg1_canvas.height);

  sg1_ctx.fillStyle = '#0f0';
  sg1_ctx.font = '14px "Press Start 2P", monospace';
  sg1_ctx.textAlign = 'center';

  // Текст "Оба игрока в лобби"
  sg1_ctx.fillText('Соперник найден!', sg1_canvas.width/2, sg1_canvas.height/2 - 40);

  // Статусы готовности
  let myStatusText     = sg1_localReady ? 'Готов' : 'Не готов';
  let enemyStatusText  = (sg1_localPlayer === 'player1')
                           ? (p2Ready ? 'Готов' : 'Не готов')
                           : (p1Ready ? 'Готов' : 'Не готов');
  
  sg1_ctx.fillText('Вы: ' + myStatusText, sg1_canvas.width/2, sg1_canvas.height/2 - 10);
  sg1_ctx.fillText('Соперник: ' + enemyStatusText, sg1_canvas.width/2, sg1_canvas.height/2 + 20);

  if (sg1_localReady && !((sg1_localPlayer === 'player1') ? p2Ready : p1Ready)) {
    // Если я готов, а соперник нет
    sg1_ctx.font = '12px "Press Start 2P", monospace';
    sg1_ctx.fillText('Ожидание соперника...', sg1_canvas.width/2, sg1_canvas.height/2 + 60);
  }
}

// Создаём кнопку "Приготовиться" (HTML), чтобы нажимать
function createReadyButton() {
  // Если кнопка уже существует, выходим
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
  sg1_readyButton.style.zIndex = '999';  // выше canvas
  sg1_readyButton.style.display = 'none'; // изначально скрыта

  sg1_readyButton.addEventListener('click', onReadyButtonClick);

  document.body.appendChild(sg1_readyButton);
}

// Обработчик нажатия "Приготовиться"
function onReadyButtonClick() {
  if (!sg1_gameRef) return;

  sg1_localReady = true;
  
  if (sg1_localPlayer === 'player1') {
    sg1_gameRef.update({ player1Ready: true });
  } else {
    sg1_gameRef.update({ player2Ready: true });
  }

  // Обновим экран (на нём будет "Ожидание соперника")
  sg1_gameRef.once('value').then(snap => {
    const data = snap.val();
    drawWaitingScreen(data.player1Ready, data.player2Ready);
  });

  // Можно сразу прятать кнопку или менять текст
  // Но лучше просто скрыть
  hideReadyButton();
}

// Показать кнопку
function showReadyButton(show) {
  if (!sg1_readyButton) return;
  if (show) {
    sg1_readyButton.style.display = 'block';
  } else {
    sg1_readyButton.style.display = 'none';
  }
}

// Скрыть кнопку
function hideReadyButton() {
  if (!sg1_readyButton) return;
  sg1_readyButton.style.display = 'none';
}

// Отсчёт (5..1) => потом state = 'playing'
function startCountdown() {
  let count = 5;
  sg1_gameRef.update({
    state: 'countdown',
    countdown: count
  });

  sg1_countdownInterval = setInterval(() => {
    count--;
    if (count >= 1) {
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

// Рисуем крупный отсчёт
function drawCountdown(num) {
  sg1_ctx.clearRect(0, 0, sg1_canvas.width, sg1_canvas.height);

  sg1_ctx.fillStyle = '#000';
  sg1_ctx.fillRect(0, 0, sg1_canvas.width, sg1_canvas.height);

  sg1_ctx.fillStyle = '#0f0';
  sg1_ctx.font = '40px "Press Start 2P", monospace';
  sg1_ctx.textAlign = 'center';
  sg1_ctx.fillText(num.toString(), sg1_canvas.width / 2, sg1_canvas.height / 2);
}

// =========================== ИГРОВОЙ ЦИКЛ ===========================

function startSnakeGameLoop() {
  // Если уже идёт, выходим
  if (sg1_gameLoopInterval) return;

  // Каждые ~150 мс двигаем змейку
  sg1_gameLoopInterval = setInterval(gameTick, 150);

  // Отправляем данные о своей змейке
  sg1_sendDataInterval = setInterval(sendLocalSnakeData, 150);
}

function gameTick() {
  updateSnake(sg1_snake);
  checkCollisions(sg1_snake, sg1_enemySnake);

  drawGame();
}

// Обновить змейку
function updateSnake(snake) {
  // голова
  const head = {...snake.segments[0]};
  switch (snake.direction) {
    case 'up':    head.y -= 1; break;
    case 'down':  head.y += 1; break;
    case 'left':  head.x -= 1; break;
    case 'right': head.x += 1; break;
  }
  snake.segments.unshift(head);

  // проверяем, не съели ли яблоко
  if (head.x === sg1_apple.x && head.y === sg1_apple.y) {
    generateNewApple();
  } else {
    // убираем хвост
    snake.segments.pop();
  }
}

// Генерация нового яблока
function generateNewApple() {
  sg1_apple.x = Math.floor(Math.random() * SG1_COLS);
  sg1_apple.y = Math.floor(Math.random() * SG1_ROWS);

  // Обновим в БД
  sg1_gameRef.update({
    apple: { x: sg1_apple.x, y: sg1_apple.y }
  });
}

// Проверка коллизий
function checkCollisions(snake, enemy) {
  const head = snake.segments[0];

  // 1) Граница
  if (head.x < 0 || head.x >= SG1_COLS || head.y < 0 || head.y >= SG1_ROWS) {
    declareWinner(opponentOf(sg1_localPlayer));
    return;
  }
  // 2) Со своей же змейкой
  for (let i = 1; i < snake.segments.length; i++) {
    if (head.x === snake.segments[i].x && head.y === snake.segments[i].y) {
      declareWinner(opponentOf(sg1_localPlayer));
      return;
    }
  }
  // 3) Столкновение с противником
  for (let i = 0; i < enemy.segments.length; i++) {
    if (head.x === enemy.segments[i].x && head.y === enemy.segments[i].y) {
      declareWinner(opponentOf(sg1_localPlayer));
      return;
    }
  }
}

// Оппонент
function opponentOf(player) {
  return (player === 'player1') ? 'player2' : 'player1';
}

// Записать победителя
function declareWinner(winnerPlayer) {
  if (!sg1_gameRef) return;
  sg1_gameRef.update({
    winner: winnerPlayer,
    state: 'finished'
  });
}

// Рисуем текущее состояние
function drawGame() {
  sg1_ctx.clearRect(0, 0, sg1_canvas.width, sg1_canvas.height);

  // фон
  sg1_ctx.fillStyle = '#000';
  sg1_ctx.fillRect(0, 0, sg1_canvas.width, sg1_canvas.height);

  // "сеточная" подложка зелёным
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

  // яблоко (красный)
  sg1_ctx.fillStyle = '#f00';
  sg1_ctx.fillRect(
    sg1_apple.x * SG1_CELL_SIZE,
    sg1_apple.y * SG1_CELL_SIZE,
    SG1_CELL_SIZE,
    SG1_CELL_SIZE
  );

  // змейки
  drawSnake(sg1_snake);
  drawSnake(sg1_enemySnake);

  // никнеймы
  drawUsernameAboveHead(sg1_snake);
  drawUsernameAboveHead(sg1_enemySnake);
}

// Рисуем сегменты змейки
function drawSnake(snakeObj) {
  sg1_ctx.fillStyle = snakeObj.color;
  snakeObj.segments.forEach(segment => {
    sg1_ctx.fillRect(
      segment.x * SG1_CELL_SIZE,
      segment.y * SG1_CELL_SIZE,
      SG1_CELL_SIZE,
      SG1_CELL_SIZE
    );
  });
}

// Ник над головой
function drawUsernameAboveHead(snakeObj) {
  if (!snakeObj.segments || snakeObj.segments.length === 0) return;
  const head = snakeObj.segments[0];
  sg1_ctx.fillStyle = '#0f0';
  sg1_ctx.font = '10px "Press Start 2P", monospace';
  sg1_ctx.textAlign = 'center';

  const px = head.x * SG1_CELL_SIZE + SG1_CELL_SIZE / 2;
  const py = head.y * SG1_CELL_SIZE - 5;
  sg1_ctx.fillText(snakeObj.username, px, py);
}

// Отправить данные о змейке
function sendLocalSnakeData() {
  if (!sg1_gameRef) return;
  if (sg1_localPlayer === 'player1') {
    sg1_gameRef.update({ snake1: sg1_snake.segments });
  } else {
    sg1_gameRef.update({ snake2: sg1_snake.segments });
  }
}

// Модал "Победитель"
function showWinnerModal(winnerPlayer) {
  clearIntervals();

  let title = 'Game Over';
  let message = (winnerPlayer === sg1_localPlayer)
    ? 'Вы выиграли!'
    : 'Вы проиграли!';

  // Глобальная функция (из main.js) - показать EndGameModal
  showEndGameModal(title, message);
}

// Сброс игры
function resetSpecialGame1() {
  clearIntervals();
  if (sg1_gameRef) {
    sg1_gameRef.off();
  }
  sg1_gameRef      = null;
  sg1_gameId       = null;
  sg1_localPlayer  = null;
  sg1_localReady   = false;
  sg1_gameState    = 'searching';

  // Спрятать кнопку
  hideReadyButton();
}

// Очистка интервалов
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
  let startX = 0, startY = 0, endX = 0, endY = 0;

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
      // горизонталь
      if (diffX > 0 && sg1_snake.direction !== 'left') {
        sg1_snake.direction = 'right';
      } else if (diffX < 0 && sg1_snake.direction !== 'right') {
        sg1_snake.direction = 'left';
      }
    } else {
      // вертикаль
      if (diffY > 0 && sg1_snake.direction !== 'up') {
        sg1_snake.direction = 'down';
      } else if (diffY < 0 && sg1_snake.direction !== 'down') {
        sg1_snake.direction = 'up';
      }
    }
  });
}

// Случайный цвет
function getRandomSnakeColor() {
  const colors = ['#0f0', '#0ff', '#7fff00', '#39ff14', '#32cd32'];
  return colors[Math.floor(Math.random() * colors.length)];
}
