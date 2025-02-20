// ====== specialgame1.js ======
/**
 * PvP-змейка в стиле "Матрицы" с реалтайм синхронизацией через Firebase.
 *
 * Основные моменты:
 * 1. Оба игрока видят движение друг друга (каждый шлёт свои координаты в Firebase).
 * 2. При столкновении со своим хвостом или змейкой соперника локально вызываем declareWinner().
 * 3. Wrap-around (выход за границы -> появление с противоположной стороны).
 * 4. Таймер игры 2 минуты. Вверху канвы полоска, уменьшающаяся по ходу времени.
 * 5. Победитель: либо кто выжил (при столкновении одного из игроков), либо по таймеру — тот, у кого больше очков (яблок).
 */

// Длительность матча (в секундах) = 2 минуты
const GAME_DURATION = 120;

// Размер поля (в клетках)
const SG1_COLS = 20;
const SG1_ROWS = 20;
// Размер клетки (пикселы)
const SG1_CELL_SIZE = 20;

let sg1_canvas       = null;
let sg1_ctx          = null;
let sg1_gameRef      = null;
let sg1_gameId       = null;
let sg1_localPlayer  = null;  // 'player1' | 'player2'
let sg1_gameState    = 'searching'; 

// Интервалы
let sg1_countdownInterval   = null;
let sg1_mainTimerInterval   = null;
let sg1_gameLoopInterval    = null;
let sg1_sendDataInterval    = null;
let fadeInterval            = null; // для анимации "Соперник найден"

// Анимация "Соперник найден"
let foundTextAlpha = 0;
let fadeMode       = 'in';

// Локальная змейка
let sg1_snake = {
  segments: [],
  direction: 'right',
  color: '#0f0',
  username: '',
  score: 0
};

// Змейка соперника
let sg1_enemySnake = {
  segments: [],
  direction: 'right',
  color: '#f0f',
  username: 'Opponent',
  score: 0
};

// Позиция яблока
let sg1_apple = { x: 10, y: 10 };

// Сколько времени осталось (после countdown), для полоски
let timeLeft = GAME_DURATION;


////////////////////////
// 1. Инициализация
////////////////////////
function initSpecialGame1() {
  sg1_canvas = document.getElementById('specialGameCanvas');
  sg1_ctx    = sg1_canvas.getContext('2d');

  // Стили
  sg1_canvas.style.display = 'block';
  sg1_canvas.style.margin  = '0 auto'; // центрируем канву

  // "Матрица": чёрный фон, зелёный текст
  sg1_ctx.fillStyle = '#0f0';
  sg1_ctx.font      = '14px "Press Start 2P", monospace';
  sg1_ctx.textAlign = 'center';

  // Имя из Telegram (если есть)
  if (typeof currentUser !== 'undefined' && currentUser?.username) {
    sg1_snake.username = '@' + currentUser.username;
  } else {
    sg1_snake.username = 'Me';
  }

  // Настраиваем свайпы + отключаем прокрутку
  setupSwipeControls(sg1_canvas);

  // Рисуем "Поиск соперника"
  drawSearchingScreen();

  // Начинаем поиск/создание матча
  matchMakeSnakeGame();
}


////////////////////////
// 2. Поиск/создание матча
////////////////////////
function matchMakeSnakeGame() {
  const gamesRef = db.ref('snakeGames');
  gamesRef.once('value', snapshot => {
    const gamesData = snapshot.val() || {};
    let foundGame   = null;

    for (let gId in gamesData) {
      let g = gamesData[gId];
      // Если game не завершена, нет winner, и нет player2
      if (!g.player2 && !g.winner) {
        foundGame = { id: gId, data: g };
        break;
      }
    }

    if (foundGame) {
      // Мы — player2
      sg1_gameId      = foundGame.id;
      sg1_localPlayer = 'player2';
      sg1_gameRef     = db.ref('snakeGames/' + sg1_gameId);

      // Для player2 сделаем цвет фиолетовый (пример) и старт в другом углу
      sg1_snake.color = '#f0f';
      sg1_snake.segments = [
        { x: SG1_COLS - 3, y: SG1_ROWS - 3 },
        { x: SG1_COLS - 2, y: SG1_ROWS - 3 }
      ];
      sg1_snake.direction = 'left';

      // Обновим БД
      sg1_gameRef.update({
        player2: {
          username: sg1_snake.username,
          color: sg1_snake.color,
          score: 0
        }
      });
    } else {
      // Мы — player1
      sg1_gameId      = db.ref().child('snakeGames').push().key;
      sg1_localPlayer = 'player1';
      sg1_gameRef     = db.ref('snakeGames/' + sg1_gameId);

      // Player1 — зелёный, в другом углу
      sg1_snake.color    = '#0f0';
      sg1_snake.segments = [{x:2, y:2}, {x:1, y:2}];
      sg1_snake.direction = 'right';

      // Создаём игру в БД
      sg1_gameRef.set({
        player1: {
          username: sg1_snake.username,
          color: sg1_snake.color,
          score: 0
        },
        player2: null,
        state: 'searching',
        countdown: 0,
        winner: null,
        snake1: sg1_snake.segments,
        snake2: [],
        apple: { x: sg1_apple.x, y: sg1_apple.y },
        score1: 0,
        score2: 0
      });
    }

    // Слушаем изменения
    listenSnakeGameChanges();
  });
}


////////////////////////
// 3. Слушаем обновления матча
////////////////////////
function listenSnakeGameChanges() {
  if (!sg1_gameRef) return;

  // Событие on('value')
  sg1_gameRef.on('value', (snapshot) => {
    const data = snapshot.val();
    if (!data) return;

    sg1_gameState = data.state || 'searching';

    // Позиция яблока
    if (data.apple) {
      sg1_apple.x = data.apple.x;
      sg1_apple.y = data.apple.y;
    }

    // Очки
    sg1_snake.score       = (sg1_localPlayer === 'player1') ? (data.score1 || 0) : (data.score2 || 0);
    sg1_enemySnake.score  = (sg1_localPlayer === 'player1') ? (data.score2 || 0) : (data.score1 || 0);

    // Змейка противника
    if (sg1_localPlayer === 'player1') {
      if (data.player2) {
        sg1_enemySnake.username = data.player2.username || 'Opponent';
        sg1_enemySnake.color    = data.player2.color || '#f0f';
      }
      if (data.snake2) {
        sg1_enemySnake.segments = data.snake2;
      }
    } else {
      if (data.player1) {
        sg1_enemySnake.username = data.player1.username || 'Opponent';
        sg1_enemySnake.color    = data.player1.color || '#0f0';
      }
      if (data.snake1) {
        sg1_enemySnake.segments = data.snake1;
      }
    }

    // Состояния
    if (sg1_gameState === 'searching') {
      // Если оба игрока есть => анимация "Соперник найден"
      if (data.player1 && data.player2 && !fadeInterval) {
        startFoundAnimation();
      } else {
        drawSearchingScreen();
      }
      return;
    }
    else if (sg1_gameState === 'foundAnimation') {
      // Рисуем в foundAnimationTick()
      return;
    }
    else if (sg1_gameState === 'showOpponent') {
      // Показ имени соперника 2 секунды
      return;
    }
    else if (sg1_gameState === 'countdown') {
      drawCountdown(data.countdown);
      return;
    }
    else if (sg1_gameState === 'playing') {
      // Запускаем игровой цикл, если не запущен
      if (!sg1_gameLoopInterval) {
        startSnakeGameLoop();
      }
    }

    // Если winner => finished
    if (data.winner && sg1_gameState !== 'finished') {
      sg1_gameState = 'finished';
      showWinnerModal(data.winner);
    }
  });
}


////////////////////////
// 3.1. Экран "Поиск соперника"
////////////////////////
function drawSearchingScreen() {
  sg1_ctx.clearRect(0, 0, sg1_canvas.width, sg1_canvas.height);

  sg1_ctx.fillStyle = '#000';
  sg1_ctx.fillRect(0, 0, sg1_canvas.width, sg1_canvas.height);

  sg1_ctx.fillStyle = '#0f0';
  sg1_ctx.font = '16px "Press Start 2P", monospace';
  sg1_ctx.fillText('Поиск соперника...', sg1_canvas.width / 2, sg1_canvas.height / 2);
}


////////////////////////
// 4. Анимация "Соперник найден"
////////////////////////
function startFoundAnimation() {
  sg1_gameRef.update({ state: 'foundAnimation' });
  sg1_gameState = 'foundAnimation';

  foundTextAlpha = 0;
  fadeMode = 'in';

  fadeInterval = setInterval(foundAnimationTick, 50);
}

function foundAnimationTick() {
  if (fadeMode === 'in') {
    foundTextAlpha += 0.05;
    if (foundTextAlpha >= 1) {
      foundTextAlpha = 1;
      fadeMode = 'pause';
      setTimeout(() => {
        fadeMode = 'out';
      }, 500);
    }
  } else if (fadeMode === 'out') {
    foundTextAlpha -= 0.05;
    if (foundTextAlpha <= 0) {
      foundTextAlpha = 0;
      clearInterval(fadeInterval);
      fadeInterval = null;

      sg1_gameRef.update({ state: 'showOpponent' });
      sg1_gameState = 'showOpponent';

      // Показываем имя соперника 2 секунды
      startShowOpponentNamePhase();
    }
  }
  drawFoundAnimation();
}

function drawFoundAnimation() {
  sg1_ctx.clearRect(0, 0, sg1_canvas.width, sg1_canvas.height);
  sg1_ctx.fillStyle = '#000';
  sg1_ctx.fillRect(0, 0, sg1_canvas.width, sg1_canvas.height);

  sg1_ctx.save();
  sg1_ctx.globalAlpha = foundTextAlpha;
  sg1_ctx.fillStyle = '#0f0';
  sg1_ctx.font = '20px "Press Start 2P", monospace';
  sg1_ctx.fillText('Соперник найден', sg1_canvas.width / 2, sg1_canvas.height / 2);
  sg1_ctx.restore();
}


////////////////////////
// 5. Показываем имя соперника 2 секунды
////////////////////////
function startShowOpponentNamePhase() {
  // Рисуем
  drawShowOpponentName();
  // Через 2 секунды -> countdown(10)
  setTimeout(() => {
    if (sg1_localPlayer === 'player1') {
      startCountdown(10);
    }
  }, 2000);
}

function drawShowOpponentName() {
  sg1_ctx.clearRect(0, 0, sg1_canvas.width, sg1_canvas.height);
  sg1_ctx.fillStyle = '#000';
  sg1_ctx.fillRect(0, 0, sg1_canvas.width, sg1_canvas.height);

  const oppName = sg1_enemySnake.username || 'Opponent';

  sg1_ctx.fillStyle = '#0f0';
  sg1_ctx.font = '20px "Press Start 2P", monospace';
  sg1_ctx.fillText(oppName, sg1_canvas.width/2, sg1_canvas.height/2);
}


////////////////////////
// 6. Отсчёт 10 секунд
////////////////////////
function startCountdown(sec) {
  sg1_gameRef.update({ state: 'countdown', countdown: sec });

  let count = sec;
  sg1_countdownInterval = setInterval(() => {
    count--;
    if (count >= 0) {
      sg1_gameRef.update({ countdown: count });
    } else {
      clearInterval(sg1_countdownInterval);
      sg1_countdownInterval = null;

      // Начинаем игру (playing)
      sg1_gameRef.update({ state: 'playing', countdown: 0 });
    }
  }, 1000);
}

function drawCountdown(num) {
  sg1_ctx.clearRect(0, 0, sg1_canvas.width, sg1_canvas.height);

  sg1_ctx.fillStyle = '#000';
  sg1_ctx.fillRect(0, 0, sg1_canvas.width, sg1_canvas.height);

  sg1_ctx.fillStyle = '#0f0';
  sg1_ctx.font = '40px "Press Start 2P", monospace';
  sg1_ctx.fillText(num.toString(), sg1_canvas.width/2, sg1_canvas.height/2);
}


////////////////////////
// 7. Основной игровой цикл (playing)
////////////////////////
function startSnakeGameLoop() {
  if (sg1_gameLoopInterval) return;

  timeLeft = GAME_DURATION;

  // Запускаем цикл "тик" каждые 150мс
  sg1_gameLoopInterval = setInterval(gameTick, 150);
  // Отправка данных локальной змейки
  sg1_sendDataInterval = setInterval(sendLocalSnakeData, 150);

  // Таймер матча (1с)
  sg1_mainTimerInterval = setInterval(() => {
    timeLeft--;
    if (timeLeft <= 0) {
      clearInterval(sg1_mainTimerInterval);
      sg1_mainTimerInterval = null;
      // Вызываем finishGameByTime только со стороны player1
      if (sg1_localPlayer === 'player1') {
        finishGameByTime();
      }
    }
  }, 1000);
}

function finishGameByTime() {
  if (!sg1_gameRef) return;
  sg1_gameRef.once('value').then(snap => {
    const val = snap.val();
    if (!val) return;

    const s1 = val.score1 || 0;
    const s2 = val.score2 || 0;
    let winner = null;
    // У кого больше очков, тот и победил
    if (s1 > s2) winner = 'player1';
    else if (s2 > s1) winner = 'player2';
    else {
      // При равенстве — можно сказать "ничья" = 'player1' (или пишите draw)
      winner = 'player1'; 
    }
    sg1_gameRef.update({ winner: winner, state: 'finished' });
  });
}

// "Тик" игры
function gameTick() {
  // Двигаем локальную змейку
  updateSnake(sg1_snake);

  // Проверяем столкновение (локально). Если "я" врезался, объявляем победителя — соперник
  checkCollisions(sg1_snake, sg1_enemySnake);

  // Рисуем всё
  drawGame();
}


////////////////////////
// 7.1 Движение с wrap-around
////////////////////////
function updateSnake(snake) {
  if (!snake.segments.length) return;

  const head = {...snake.segments[0]};
  switch (snake.direction) {
    case 'up':    head.y--; break;
    case 'down':  head.y++; break;
    case 'left':  head.x--; break;
    case 'right': head.x++; break;
  }

  // Wrap-around
  if (head.x < 0) head.x = SG1_COLS - 1;
  if (head.x >= SG1_COLS) head.x = 0;
  if (head.y < 0) head.y = SG1_ROWS - 1;
  if (head.y >= SG1_ROWS) head.y = 0;

  // Добавляем голову
  snake.segments.unshift(head);

  // Проверяем, не съели ли яблоко (только локально отправляем транзакцию)
  if (head.x === sg1_apple.x && head.y === sg1_apple.y) {
    if (sg1_localPlayer === 'player1') {
      sg1_gameRef.transaction((curr) => {
        if (!curr) return curr;
        curr.score1 = (curr.score1 || 0) + 1;
        curr.apple  = randomApple();
        return curr;
      });
    } else {
      sg1_gameRef.transaction((curr) => {
        if (!curr) return curr;
        curr.score2 = (curr.score2 || 0) + 1;
        curr.apple  = randomApple();
        return curr;
      });
    }
  } else {
    // Убираем хвост
    snake.segments.pop();
  }
}

// Генерация нового яблока
function randomApple() {
  return {
    x: Math.floor(Math.random() * SG1_COLS),
    y: Math.floor(Math.random() * SG1_ROWS)
  };
}


////////////////////////
// 7.2 Проверка столкновений
////////////////////////
function checkCollisions(localSnake, enemySnake) {
  if (!localSnake.segments.length) return;
  const head = localSnake.segments[0];

  // 1) Столкновение с собственной "шеей" или хвостом
  for (let i = 1; i < localSnake.segments.length; i++) {
    if (head.x === localSnake.segments[i].x && head.y === localSnake.segments[i].y) {
      // Наш змей врезался в себя => выиграл соперник
      declareWinner(opponentOf(sg1_localPlayer));
      return;
    }
  }

  // 2) Столкновение с сегментами соперника
  for (let seg of enemySnake.segments) {
    if (head.x === seg.x && head.y === seg.y) {
      // Наш змей врезался в соперника => соперник выиграл
      declareWinner(opponentOf(sg1_localPlayer));
      return;
    }
  }
}

// Вычисляем, кто соперник
function opponentOf(player) {
  return (player === 'player1') ? 'player2' : 'player1';
}

// Записываем winner в БД
function declareWinner(winnerPlayer) {
  if (!sg1_gameRef) return;
  sg1_gameRef.update({
    winner: winnerPlayer,
    state: 'finished'
  });
}


////////////////////////
// 8. Отрисовка
////////////////////////
function drawGame() {
  sg1_ctx.clearRect(0, 0, sg1_canvas.width, sg1_canvas.height);

  // 1) Полоска таймера
  sg1_ctx.save();
  drawTimeBar();
  sg1_ctx.restore();

  // 2) Смещаемся на 8px вниз (под полоску)
  sg1_ctx.save();
  sg1_ctx.translate(0, 8); 

  // Задний фон
  sg1_ctx.fillStyle = '#000';
  sg1_ctx.fillRect(0, 0, sg1_canvas.width, sg1_canvas.height - 8);

  // Сетка
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

  // Яблоко
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

  sg1_ctx.restore();
}

// Полоска таймера (topbar)
function drawTimeBar() {
  const barWidth  = sg1_canvas.width;
  const barHeight = 8;
  const fraction  = timeLeft / GAME_DURATION; // от 1 до 0
  const filledWidth = fraction * barWidth;

  // Серый фон
  sg1_ctx.fillStyle = '#444';
  sg1_ctx.fillRect(0, 0, barWidth, barHeight);

  // Зелёная часть
  sg1_ctx.fillStyle = '#0f0';
  sg1_ctx.fillRect(0, 0, filledWidth, barHeight);
}

// Отрисовка змейки
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

// Ник над головой
function drawUsernameAboveHead(snakeObj) {
  if (!snakeObj.segments.length) return;
  const head = snakeObj.segments[0];
  sg1_ctx.fillStyle = '#0f0'; // или snakeObj.color
  sg1_ctx.font = '10px "Press Start 2P", monospace';
  sg1_ctx.textAlign = 'center';

  const px = head.x * SG1_CELL_SIZE + SG1_CELL_SIZE/2;
  const py = head.y * SG1_CELL_SIZE - 5;
  sg1_ctx.fillText(snakeObj.username, px, py);
}


////////////////////////
// 9. Завершение (Winner Modal)
////////////////////////
function showWinnerModal(winnerPlayer) {
  clearIntervals();

  let title   = 'Итог';
  let message = '';
  if (winnerPlayer === 'player1' && sg1_localPlayer === 'player1') {
    message = 'Вы победили!';
  } else if (winnerPlayer === 'player2' && sg1_localPlayer === 'player2') {
    message = 'Вы победили!';
  } else {
    message = 'Вы проиграли!';
  }

  // Глобальная функция в main.js
  showEndGameModal(title, message);
}

// Сброс игры при закрытии
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

// Остановка всех интервалов
function clearIntervals() {
  if (sg1_countdownInterval) {
    clearInterval(sg1_countdownInterval);
    sg1_countdownInterval = null;
  }
  if (sg1_gameLoopInterval) {
    clearInterval(sg1_gameLoopInterval);
    sg1_gameLoopInterval = null;
  }
  if (sg1_sendDataInterval) {
    clearInterval(sg1_sendDataInterval);
    sg1_sendDataInterval = null;
  }
  if (sg1_mainTimerInterval) {
    clearInterval(sg1_mainTimerInterval);
    sg1_mainTimerInterval = null;
  }
  if (fadeInterval) {
    clearInterval(fadeInterval);
    fadeInterval = null;
  }
}


////////////////////////
// 10. Свайпы + отключение прокрутки
////////////////////////
function setupSwipeControls(canvas) {
  let startX = 0, startY = 0;
  let endX   = 0, endY   = 0;

  // touchstart
  canvas.addEventListener('touchstart', (e) => {
    const touch = e.touches[0];
    startX = touch.clientX;
    startY = touch.clientY;
    e.preventDefault(); // отключаем скролл
  }, { passive: false });

  // touchmove
  canvas.addEventListener('touchmove', (e) => {
    const touch = e.touches[0];
    endX = touch.clientX;
    endY = touch.clientY;
    e.preventDefault(); 
  }, { passive: false });

  // touchend
  canvas.addEventListener('touchend', (e) => {
    e.preventDefault();
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
  }, { passive: false });
}


////////////////////////
// Дополнительно: случайный цвет (если понадобится)
////////////////////////
function getRandomSnakeColor() {
  const colors = ['#ff1493', '#f0f', '#ff0', '#0ff', '#84c3be', '#ffbcad'];
  return colors[Math.floor(Math.random() * colors.length)];
}

