// ====== specialgame1.js ======
/**
 * PvP-змейка в стиле "Матрицы" с реалтайм синхронизацией через Firebase.
 * Использует canvas #specialGameCanvas, заданный в HTML.
 */

// Глобальные переменные под игру
let sg1_canvas      = null;
let sg1_ctx         = null;
let sg1_gameId      = null;           // ID текущего матча
let sg1_localPlayer = null;           // 'player1' или 'player2'
let sg1_gameRef     = null;           // Ссылка на узел матча в Firebase

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
let sg1_gameLoopInterval  = null; 
let sg1_sendDataInterval  = null; 
let sg1_countdownInterval = null;
let sg1_readyCheckInterval= null; // проверяем готовность

// Локальные флаги готовности
let sg1_localReady = false;
// Статус игры ("waiting", "countdown", "playing", "finished")
let sg1_gameState  = 'waiting';  

// === Инициализация игры ===
function initSpecialGame1() {
  sg1_canvas = document.getElementById('specialGameCanvas');
  sg1_ctx    = sg1_canvas.getContext('2d');

  // Установка стиля для "матрицы": чёрный фон, зелёные сетки, пиксельный шрифт
  sg1_canvas.style.backgroundColor = '#000';
  sg1_ctx.font = '10px "Press Start 2P", monospace';
  sg1_ctx.textAlign = 'center';
  sg1_ctx.fillStyle = '#0f0';

  // Берём имя пользователя из глобального currentUser (из main.js)
  if (currentUser && currentUser.username) {
    sg1_snake.username = '@' + currentUser.username;
  } else {
    sg1_snake.username = 'Me';
  }

  // Генерируем случайный цвет змейки для разнообразия
  sg1_snake.color = getRandomSnakeColor();
  
  // Инициализируем локальную змейку (стартовая позиция)
  sg1_snake.segments = [{x: 2, y: 2}, {x: 1, y: 2}, {x: 0, y: 2}];
  sg1_snake.direction = 'right';

  // Настраиваем обработку свайпов (простым способом через touchstart/touchmove)
  setupSwipeControls(sg1_canvas);

  // Подключаемся к БД для поиска/создания матча
  matchMakeSnakeGame();
}

// Функция создания/поиска матча в Firebase
function matchMakeSnakeGame() {
  const gamesRef = db.ref('snakeGames');

  gamesRef.once('value', snapshot => {
    let foundGame = null;
    const gamesData = snapshot.val() || {};

    // Ищем игру, где player2 ещё не определён (и нет winner)
    for (let gId in gamesData) {
      let g = gamesData[gId];
      if (!g.player2 && !g.winner) {
        foundGame = { id: gId, data: g };
        break;
      }
    }

    if (foundGame) {
      // Подключаемся к существующей игре
      sg1_gameId = foundGame.id;
      sg1_localPlayer = 'player2';
      sg1_gameRef = db.ref('snakeGames/' + sg1_gameId);

      // Записываем player2 в БД
      sg1_gameRef.update({
        player2: {
          username: sg1_snake.username,
          color: sg1_snake.color
        }
      });
    } else {
      // Создаём новую игру
      sg1_gameId = db.ref().child('snakeGames').push().key;
      sg1_localPlayer = 'player1';
      sg1_gameRef = db.ref('snakeGames/' + sg1_gameId);

      // Задаём структуру в БД
      sg1_gameRef.set({
        player1: {
          username: sg1_snake.username,
          color: sg1_snake.color
        },
        player2: null,
        player1Ready: false,
        player2Ready: false,
        state: 'waiting',
        countdown: 0,
        winner: null,
        // Начальные позиции змей 
        snake1: sg1_snake.segments,
        snake2: [],
        apple: { x: sg1_apple.x, y: sg1_apple.y },
      });
    }

    // Подписываемся на изменения
    listenSnakeGameChanges();
  });
}

// Слушаем изменения в матче
function listenSnakeGameChanges() {
  if (!sg1_gameRef) return;

  sg1_gameRef.on('value', snapshot => {
    const data = snapshot.val();
    if (!data) return;

    // Считываем state, отсчёт, winner
    sg1_gameState = data.state;
    
    // Считываем готовность игроков
    const p1Ready = data.player1Ready;
    const p2Ready = data.player2Ready;

    // Считываем apple
    if (data.apple) {
      sg1_apple.x = data.apple.x;
      sg1_apple.y = data.apple.y;
    }

    // Считываем противника и его цвет
    if (sg1_localPlayer === 'player1') {
      // Значит противник - player2
      if (data.player2) {
        sg1_enemySnake.username = data.player2.username || 'Opponent';
        sg1_enemySnake.color    = data.player2.color    || '#0f0';
      }
      // Читаем сегменты змейки противника
      if (data.snake2) {
        sg1_enemySnake.segments = data.snake2;
      }
    } else {
      // Локальный - это player2, значит противник - player1
      if (data.player1) {
        sg1_enemySnake.username = data.player1.username || 'Opponent';
        sg1_enemySnake.color    = data.player1.color    || '#0f0';
      }
      // Читаем сегменты змейки противника
      if (data.snake1) {
        sg1_enemySnake.segments = data.snake1;
      }
    }

    // Если оба игрока есть и state=='waiting', показываем экран ожидания / кнопку Готов
    if (data.player1 && data.player2 && data.state === 'waiting') {
      drawWaitingScreen(p1Ready, p2Ready);
    }

    // Если оба готовы и state = 'countdown' — запускаем/рисуем отсчёт
    if (data.state === 'countdown') {
      drawCountdown(data.countdown);
    }

    // Если state = 'playing', запускаем игровой цикл
    if (data.state === 'playing' && !sg1_gameLoopInterval) {
      startSnakeGameLoop();
    }

    // Если есть winner => показываем победителя
    if (data.winner && sg1_gameState !== 'finished') {
      sg1_gameState = 'finished';
      showWinnerModal(data.winner);
    }
  });
}

// Нарисовать экран "Поиск соперника / Ожидание готовности"
function drawWaitingScreen(p1Ready, p2Ready) {
  sg1_ctx.clearRect(0, 0, sg1_canvas.width, sg1_canvas.height);

  sg1_ctx.fillStyle = '#000';
  sg1_ctx.fillRect(0, 0, sg1_canvas.width, sg1_canvas.height);

  sg1_ctx.fillStyle = '#0f0';
  sg1_ctx.textAlign = 'center';
  sg1_ctx.font = '16px "Press Start 2P", monospace';

  if (!p1Ready || !p2Ready) {
    // Сообщение
    sg1_ctx.fillText('Ожидание готовности...', sg1_canvas.width/2, sg1_canvas.height/2 - 30);

    // Пишем статус локального игрока
    const localReadyText = sg1_localReady ? 'Вы готовы' : 'Нажмите "Готов"';
    sg1_ctx.fillText(localReadyText, sg1_canvas.width/2, sg1_canvas.height/2);

    // Кнопка "Готов" (условно нарисуем её)
    sg1_ctx.font = '12px "Press Start 2P", monospace';
    sg1_ctx.fillText('[Tap to READY]', sg1_canvas.width/2, sg1_canvas.height/2 + 40);
  }
}

// Обрабатываем клик/тап по canvas, если мы в режиме ожидания — ставим ready
sg1_canvas?.addEventListener('click', () => {
  if (sg1_gameState === 'waiting' && !sg1_localReady) {
    // Ставим локальную готовность
    sg1_localReady = true;
    if (sg1_localPlayer === 'player1') {
      sg1_gameRef.update({ player1Ready: true });
    } else {
      sg1_gameRef.update({ player2Ready: true });
    }
    // (В БД слушаем, когда оба будут готовы, и запускаем отсчёт)
    // Локально обновим картинку экрана
    sg1_gameRef.once('value').then(snap => {
      const data = snap.val();
      drawWaitingScreen(data.player1Ready, data.player2Ready);
    });
  }
});

// Функция старта отсчёта (запускается на "серверной логике" или у первого игрока):
// Можно реализовать логику при изменении p1Ready && p2Ready => state='countdown'
function startCountdown() {
  // Псевдо: 5..1
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
  sg1_ctx.fillText(num.toString(), sg1_canvas.width / 2, sg1_canvas.height / 2);
}

// Функция запуска основного цикла игры
function startSnakeGameLoop() {
  // Если уже идёт, выходим
  if (sg1_gameLoopInterval) return;

  // Каждые ~150 мс двигаем змейку, рисуем
  sg1_gameLoopInterval = setInterval(gameTick, 150);
  
  // Интервал отправки данных в БД
  sg1_sendDataInterval = setInterval(sendLocalSnakeData, 150);
}

// Каждое "тиканье" игры
function gameTick() {
  updateSnake(sg1_snake);
  checkCollisions(sg1_snake, sg1_enemySnake);

  drawGame();
}

// Обновить змейку (локально)
function updateSnake(snake) {
  // Берём голову
  const head = { ...snake.segments[0] };
  // Сдвигаем согласно direction
  switch (snake.direction) {
    case 'up':    head.y -= 1; break;
    case 'down':  head.y += 1; break;
    case 'left':  head.x -= 1; break;
    case 'right': head.x += 1; break;
  }
  // Добавляем новую голову
  snake.segments.unshift(head);
  // Проверяем, не съели ли яблоко
  if (head.x === sg1_apple.x && head.y === sg1_apple.y) {
    // Съели яблоко, генерим новое
    generateNewApple();
  } else {
    // Убираем хвост
    snake.segments.pop();
  }
}

// Генерируем новое яблоко (и пишем в БД)
function generateNewApple() {
  sg1_apple.x = Math.floor(Math.random() * SG1_COLS);
  sg1_apple.y = Math.floor(Math.random() * SG1_ROWS);

  // Обновим в БД
  sg1_gameRef.update({
    apple: { x: sg1_apple.x, y: sg1_apple.y }
  });
}

// Проверка столкновений
function checkCollisions(snake, enemy) {
  const head = snake.segments[0];
  
  // 1) Столкновение с границей
  if (head.x < 0 || head.x >= SG1_COLS || head.y < 0 || head.y >= SG1_ROWS) {
    declareWinner((sg1_localPlayer === 'player1') ? 'player2' : 'player1');
    return;
  }
  // 2) Столкновение с собственной змейкой
  for (let i = 1; i < snake.segments.length; i++) {
    if (head.x === snake.segments[i].x && head.y === snake.segments[i].y) {
      // Проигрыш
      declareWinner((sg1_localPlayer === 'player1') ? 'player2' : 'player1');
      return;
    }
  }
  // 3) Столкновение с противником
  for (let i = 0; i < enemy.segments.length; i++) {
    if (head.x === enemy.segments[i].x && head.y === enemy.segments[i].y) {
      declareWinner((sg1_localPlayer === 'player1') ? 'player2' : 'player1');
      return;
    }
  }
}

// Записать победителя в БД
function declareWinner(winnerPlayer) {
  if (!sg1_gameRef) return;
  sg1_gameRef.update({
    winner: winnerPlayer,
    state: 'finished'
  });
}

// Рисуем текущее состояние на canvas
function drawGame() {
  sg1_ctx.clearRect(0, 0, sg1_canvas.width, sg1_canvas.height);

  // Заливка фона
  sg1_ctx.fillStyle = '#000';
  sg1_ctx.fillRect(0, 0, sg1_canvas.width, sg1_canvas.height);

  // Рисуем "сетку" (зелёные линии)
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

  // Рисуем яблоко (красное)
  sg1_ctx.fillStyle = '#f00';
  sg1_ctx.fillRect(sg1_apple.x * SG1_CELL_SIZE, sg1_apple.y * SG1_CELL_SIZE, SG1_CELL_SIZE, SG1_CELL_SIZE);

  // Рисуем змейки
  drawSnake(sg1_snake);
  drawSnake(sg1_enemySnake);

  // При желании отрисовать ник над головой змейки
  drawUsernameAboveHead(sg1_snake);
  drawUsernameAboveHead(sg1_enemySnake);
}

// Отрисовка змейки
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

// Отрисовать ник над головой
function drawUsernameAboveHead(snakeObj) {
  if (snakeObj.segments.length === 0) return;
  let head = snakeObj.segments[0];
  sg1_ctx.fillStyle = '#0f0'; // или snakeObj.color
  sg1_ctx.font = '10px "Press Start 2P", monospace';
  sg1_ctx.textAlign = 'center';

  let px = head.x * SG1_CELL_SIZE + SG1_CELL_SIZE / 2;
  let py = head.y * SG1_CELL_SIZE - 5; // чуть выше головы

  sg1_ctx.fillText(snakeObj.username, px, py);
}

// Отправить локальные данные о змейке (segments) в БД
function sendLocalSnakeData() {
  if (!sg1_gameRef) return;
  if (sg1_localPlayer === 'player1') {
    sg1_gameRef.update({
      snake1: sg1_snake.segments,
    });
  } else {
    sg1_gameRef.update({
      snake2: sg1_snake.segments,
    });
  }
}

// Показать модальное окно "Победитель"
function showWinnerModal(winnerPlayer) {
  clearIntervals();

  let title = 'Game Over';
  let message = (winnerPlayer === sg1_localPlayer) 
    ? 'Вы выиграли!' 
    : 'Вы проиграли!';

  // Вызываем глобальную функцию (из main.js), которая показывает EndGameModal
  showEndGameModal(title, message);
}

// Сброс игры (вызывается при выходе из игры)
function resetSpecialGame1() {
  clearIntervals();
  // Снимаем подписку
  if (sg1_gameRef) {
    sg1_gameRef.off();
  }
  sg1_gameRef = null;
  sg1_gameId  = null;
  sg1_localPlayer = null;
  sg1_localReady  = false;
  sg1_gameState   = 'waiting';
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

// Установка свайпов
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

// Генератор случайного цвета змейки (зелёные-голубые оттенки)
function getRandomSnakeColor() {
  // Можно вернуть просто несколько вариантов, например
  const colors = ['#0f0', '#0ff', '#7fff00', '#39ff14', '#32cd32'];
  return colors[Math.floor(Math.random() * colors.length)];
}

/**
 * Логика, чтобы (например) один из клиентов мог отслеживать, когда оба готовы, и запустить отсчёт.
 * Тут упрощённо: при каждом обновлении player1Ready/player2Ready мы смотрим,
 * если оба true и state==='waiting', ставим state='countdown' + запустить startCountdown().
 * Это можно делать либо на "серверной" части, либо условно у "host" (player1).
 */
if (typeof window !== 'undefined') {
  // Пример "наблюдения" изменений readiness (в демо — у player1):
  db.ref('snakeGames').on('child_changed', (snap) => {
    let val = snap.val();
    // Если это именно наша игра
    if (snap.key === sg1_gameId) {
      // Проверяем, не нужно ли запустить отсчёт
      if (val.player1Ready && val.player2Ready && val.state === 'waiting') {
        // Только player1 в данном примере "уполномочен" начать отсчёт:
        if (sg1_localPlayer === 'player1') {
          startCountdown();
        }
      }
    }
  });
}
