// ====== specialgame1.js ======
/**
 * PvP-змейка в стиле "Матрицы" с реалтайм синхронизацией через Firebase.
 *
 * Функционал:
 * 1. Игра начинается с поиска соперника (state = "searching").
 *    Как только второй игрок подключается, запускается анимация "Соперник найден"
 *    (fade in/out). Затем на 2 секунды показывается имя противника, после чего
 *    запускается отсчёт 10 секунд (state = "countdown").
 * 2. После отсчёта игра (state = "playing") длится 2 минуты (GAME_DURATION = 120),
 *    во время которых вверху канвы отрисовывается таймер (topbar).
 * 3. При выходе за границы игрового поля змейка появляется с противоположной стороны (wrap-around).
 * 4. Если голова змейки сталкивается с её хвостом или с любым сегментом змейки противника,
 *    происходит проигрыш.
 * 5. В конце игры (по истечении времени) сравниваются очки (съеденные яблоки), и показывается
 *    модальное окно с победой/поражением.
 * 6. Игроки видят движение противника: данные обновляются в реальном времени через Firebase.
 * 7. Обработчики touch-событий используют e.preventDefault(), чтобы отключить нежелательную прокрутку.
 */

//////////////////////////////////////////
// Глобальные настройки и переменные
//////////////////////////////////////////

// Общая длительность матча (2 минуты = 120 секунд)
const GAME_DURATION = 120;  

// Размер игрового поля (в клетках)
const SG1_COLS = 20;
const SG1_ROWS = 20;

// Размер клетки (в пикселях)
const SG1_CELL_SIZE = 20;

let sg1_canvas       = null;
let sg1_ctx          = null;
let sg1_gameRef      = null;   // Ссылка на Firebase
let sg1_gameId       = null;   // ID матча
let sg1_localPlayer  = null;   // 'player1' или 'player2'
let sg1_gameState    = 'searching'; // "searching" | "foundAnimation" | "showOpponent" | "countdown" | "playing" | "finished"
let sg1_countdownInterval = null;
let sg1_mainTimerInterval = null;

// Интервалы для игрового цикла и синхронизации
let sg1_gameLoopInterval = null;
let sg1_sendDataInterval = null;

// Параметры для анимации "Соперник найден"
let foundTextAlpha = 0;  // значение от 0 до 1
let fadeMode = 'in';     // 'in' или 'out' (или 'pause')
let fadeInterval = null;

// Игровой таймер (для полоски времени)
let timeLeft = GAME_DURATION;  

// Данные змейки локального игрока
let sg1_snake = {
  segments: [],
  direction: 'right',
  color: '#0f0',
  username: '',
  score: 0
};

// Данные змейки соперника
let sg1_enemySnake = {
  segments: [],
  direction: 'right',
  color: '#f0f',
  username: 'Opponent',
  score: 0
};

// Позиция яблока
let sg1_apple = { x: 10, y: 10 };

//////////////////////////////////////////
// Инициализация игры (вызывается при запуске)
//////////////////////////////////////////
function initSpecialGame1() {
  sg1_canvas = document.getElementById('specialGameCanvas');
  sg1_ctx    = sg1_canvas.getContext('2d');
  
  // Устанавливаем стили канвы: выравнивание по центру
  sg1_canvas.style.display = 'block';
  sg1_canvas.style.margin = '0 auto';

  sg1_ctx.fillStyle = '#0f0';
  sg1_ctx.font = '14px "Press Start 2P", monospace';
  sg1_ctx.textAlign = 'center';

  // Устанавливаем имя игрока из Telegram (если есть)
  if (typeof currentUser !== 'undefined' && currentUser?.username) {
    sg1_snake.username = '@' + currentUser.username;
  } else {
    sg1_snake.username = 'Me';
  }

  // Отключаем прокрутку при свайпе и устанавливаем обработчики
  setupSwipeControls(sg1_canvas);

  // Сначала показываем "Поиск соперника..."
  drawSearchingScreen();

  // Запускаем поиск/создание матча
  matchMakeSnakeGame();
}

//////////////////////////////////////////
// Поиск/создание матча (matchmaking)
//////////////////////////////////////////
function matchMakeSnakeGame() {
  const gamesRef = db.ref('snakeGames');
  gamesRef.once('value', snapshot => {
    const gamesData = snapshot.val() || {};
    let foundGame   = null;

    // Ищем игру, где нет player2 и нет winner
    for (let gId in gamesData) {
      let g = gamesData[gId];
      if (!g.player2 && !g.winner) {
        foundGame = { id: gId, data: g };
        break;
      }
    }

    if (foundGame) {
      // Если найдена игра, мы становимся player2
      sg1_gameId      = foundGame.id;
      sg1_localPlayer = 'player2';
      sg1_gameRef     = db.ref('snakeGames/' + sg1_gameId);

      // Назначаем цвет для player2 (отличный от player1)
      sg1_snake.color = '#f0f';
      // Стартовая позиция для player2 —, например, в правом нижнем углу
      sg1_snake.segments = [{x: SG1_COLS - 3, y: SG1_ROWS - 3}, {x: SG1_COLS - 2, y: SG1_ROWS - 3}];
      sg1_snake.direction = 'left';

      // Обновляем запись о player2
      sg1_gameRef.update({
        player2: {
          username: sg1_snake.username,
          color: sg1_snake.color,
          score: 0
        }
      });
    } else {
      // Иначе создаём новую игру — мы player1
      sg1_gameId      = db.ref().child('snakeGames').push().key;
      sg1_localPlayer = 'player1';
      sg1_gameRef     = db.ref('snakeGames/' + sg1_gameId);

      sg1_snake.color = '#0f0';
      // Стартовая позиция для player1 — в левом верхнем углу
      sg1_snake.segments = [{x: 2, y: 2}, {x: 1, y: 2}];
      sg1_snake.direction = 'right';

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

    // Подписываемся на изменения матча
    listenSnakeGameChanges();
  });
}

//////////////////////////////////////////
// Подписка на изменения (Firebase)
//////////////////////////////////////////
function listenSnakeGameChanges() {
  if (!sg1_gameRef) return;

  sg1_gameRef.on('value', snapshot => {
    let data = snapshot.val();
    if (!data) return;

    sg1_gameState = data.state || 'searching';

    // Обновляем позицию яблока
    if (data.apple) {
      sg1_apple.x = data.apple.x;
      sg1_apple.y = data.apple.y;
    }

    // Обновляем очки
    sg1_snake.score = (sg1_localPlayer === 'player1') ? (data.score1 || 0) : (data.score2 || 0);
    sg1_enemySnake.score = (sg1_localPlayer === 'player1') ? (data.score2 || 0) : (data.score1 || 0);

    // Обновляем данные противника
    if (sg1_localPlayer === 'player1') {
      if (data.player2) {
        sg1_enemySnake.username = data.player2.username || 'Opponent';
        sg1_enemySnake.color = data.player2.color || '#f0f';
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

    // Обрабатываем состояния
    if (sg1_gameState === 'searching') {
      // Если оба игрока подключились, запускаем анимацию "Соперник найден"
      if (data.player1 && data.player2 && !fadeInterval) {
        startFoundAnimation();
      } else {
        drawSearchingScreen();
      }
      return;
    }
    else if (sg1_gameState === 'foundAnimation') {
      // Анимация отрисовывается в foundAnimationTick()
      return;
    }
    else if (sg1_gameState === 'showOpponent') {
      // 2 секунды показывается имя соперника
      return;
    }
    else if (sg1_gameState === 'countdown') {
      drawCountdown(data.countdown);
      return;
    }
    else if (sg1_gameState === 'playing') {
      if (!sg1_gameLoopInterval) {
        startSnakeGameLoop();
      }
    }

    if (data.winner && sg1_gameState !== 'finished') {
      sg1_gameState = 'finished';
      showWinnerModal(data.winner);
    }
  });
}

//////////////////////////////////////////
// Рисуем "Поиск соперника..."
//////////////////////////////////////////
function drawSearchingScreen() {
  sg1_ctx.clearRect(0, 0, sg1_canvas.width, sg1_canvas.height);
  sg1_ctx.fillStyle = '#000';
  sg1_ctx.fillRect(0, 0, sg1_canvas.width, sg1_canvas.height);
  sg1_ctx.fillStyle = '#0f0';
  sg1_ctx.font = '16px "Press Start 2P", monospace';
  sg1_ctx.fillText('Поиск соперника...', sg1_canvas.width/2, sg1_canvas.height/2);
}

//////////////////////////////////////////
// Анимация "Соперник найден" (fade in/out)
//////////////////////////////////////////
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
      setTimeout(() => { fadeMode = 'out'; }, 500);
    }
  }
  else if (fadeMode === 'out') {
    foundTextAlpha -= 0.05;
    if (foundTextAlpha <= 0) {
      foundTextAlpha = 0;
      clearInterval(fadeInterval);
      fadeInterval = null;
      sg1_gameRef.update({ state: 'showOpponent' });
      sg1_gameState = 'showOpponent';
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
  sg1_ctx.fillText('Соперник найден', sg1_canvas.width/2, sg1_canvas.height/2);
  sg1_ctx.restore();
}

//////////////////////////////////////////
// Показываем имя соперника на 2 секунды
//////////////////////////////////////////
function startShowOpponentNamePhase() {
  drawShowOpponentName();
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

//////////////////////////////////////////
// Отсчёт 10 секунд
//////////////////////////////////////////
function startCountdown(sec) {
  sg1_gameRef.update({
    state: 'countdown',
    countdown: sec
  });
  let count = sec;
  sg1_countdownInterval = setInterval(() => {
    count--;
    if (count >= 0) {
      sg1_gameRef.update({ countdown: count });
    } else {
      clearInterval(sg1_countdownInterval);
      sg1_countdownInterval = null;
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

//////////////////////////////////////////
// Игровой цикл (playing)
//////////////////////////////////////////
function startSnakeGameLoop() {
  if (sg1_gameLoopInterval) return;
  timeLeft = GAME_DURATION;
  sg1_gameLoopInterval = setInterval(gameTick, 150);
  sg1_sendDataInterval = setInterval(sendLocalSnakeData, 150);
  sg1_mainTimerInterval = setInterval(() => {
    timeLeft--;
    if (timeLeft <= 0) {
      clearInterval(sg1_mainTimerInterval);
      sg1_mainTimerInterval = null;
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
    if (s1 > s2) winner = 'player1';
    else if (s2 > s1) winner = 'player2';
    else winner = 'player1'; // в случае ничьей выбираем player1
    sg1_gameRef.update({
      winner: winner,
      state: 'finished'
    });
  });
}

function gameTick() {
  updateSnake(sg1_snake);
  // Проверка столкновений: если голова сталкивается с хвостом или с любым сегментом противника
  if (checkCollisions(sg1_snake, sg1_enemySnake)) {
    return; // столкновение обработано в checkCollisions()
  }
  drawGame();
}

//////////////////////////////////////////
// Проверка столкновений (self + enemy)
//////////////////////////////////////////
function checkCollisions(snake, enemy) {
  const head = snake.segments[0];
  // Столкновение с собственным хвостом (начиная со 2-го сегмента)
  for (let i = 1; i < snake.segments.length; i++) {
    if (head.x === snake.segments[i].x && head.y === snake.segments[i].y) {
      declareWinner(opponentOf(sg1_localPlayer));
      return true;
    }
  }
  // Столкновение с любой частью змейки противника
  for (let i = 0; i < enemy.segments.length; i++) {
    if (head.x === enemy.segments[i].x && head.y === enemy.segments[i].y) {
      declareWinner(opponentOf(sg1_localPlayer));
      return true;
    }
  }
  return false;
}

function opponentOf(player) {
  return (player === 'player1') ? 'player2' : 'player1';
}

//////////////////////////////////////////
// Движение змейки с wrap-around
//////////////////////////////////////////
function updateSnake(snake) {
  const head = { ...snake.segments[0] };
  switch (snake.direction) {
    case 'up':    head.y -= 1; break;
    case 'down':  head.y += 1; break;
    case 'left':  head.x -= 1; break;
    case 'right': head.x += 1; break;
  }
  // Wrap-around: если выходим за границы, появляется с противоположной стороны
  if (head.x < 0) head.x = SG1_COLS - 1;
  if (head.x >= SG1_COLS) head.x = 0;
  if (head.y < 0) head.y = SG1_ROWS - 1;
  if (head.y >= SG1_ROWS) head.y = 0;
  snake.segments.unshift(head);

  // Если съели яблоко — увеличиваем счёт и генерируем новое яблоко
  if (head.x === sg1_apple.x && head.y === sg1_apple.y) {
    if (sg1_localPlayer === 'player1') {
      sg1_gameRef.transaction(curr => {
        if (curr) {
          curr.score1 = (curr.score1 || 0) + 1;
          curr.apple = randomApple();
        }
        return curr;
      });
    } else {
      sg1_gameRef.transaction(curr => {
        if (curr) {
          curr.score2 = (curr.score2 || 0) + 1;
          curr.apple = randomApple();
        }
        return curr;
      });
    }
  } else {
    snake.segments.pop();
  }
}

function randomApple() {
  return {
    x: Math.floor(Math.random() * SG1_COLS),
    y: Math.floor(Math.random() * SG1_ROWS)
  };
}

//////////////////////////////////////////
// Отрисовка: topbar, игровое поле, змейки, никнеймы
//////////////////////////////////////////
function drawGame() {
  sg1_ctx.clearRect(0, 0, sg1_canvas.width, sg1_canvas.height);

  // 1) Рисуем полоску времени (topbar) в самом верху
  sg1_ctx.save();
  drawTimeBar();
  sg1_ctx.restore();

  // 2) Рисуем игровое поле ниже полоски (сдвигаем на высоту topbar)
  sg1_ctx.save();
  sg1_ctx.translate(0, 8); // высота полоски = 8 пикселей

  // Фон игрового поля
  sg1_ctx.fillStyle = '#000';
  sg1_ctx.fillRect(0, 0, sg1_canvas.width, sg1_canvas.height - 8);

  // Рисуем сетку
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

  // Рисуем змейки
  drawSnake(sg1_snake);
  drawSnake(sg1_enemySnake);

  // Рисуем никнеймы
  drawUsernameAboveHead(sg1_snake);
  drawUsernameAboveHead(sg1_enemySnake);

  sg1_ctx.restore();
}

// Рисуем полоску таймера (topbar) вверху канвы
function drawTimeBar() {
  const barWidth = sg1_canvas.width;
  const barHeight = 8;
  const fraction = timeLeft / GAME_DURATION;
  const filledWidth = fraction * barWidth;
  sg1_ctx.fillStyle = '#444';
  sg1_ctx.fillRect(0, 0, barWidth, barHeight);
  sg1_ctx.fillStyle = '#0f0';
  sg1_ctx.fillRect(0, 0, filledWidth, barHeight);
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

//////////////////////////////////////////
// Отправка локальных данных (свой ход)
//////////////////////////////////////////
function sendLocalSnakeData() {
  if (!sg1_gameRef) return;
  if (sg1_localPlayer === 'player1') {
    sg1_gameRef.update({ snake1: sg1_snake.segments });
  } else {
    sg1_gameRef.update({ snake2: sg1_snake.segments });
  }
}

//////////////////////////////////////////
// Победа / Поражение (модальное окно)
//////////////////////////////////////////
function showWinnerModal(winnerPlayer) {
  clearIntervals();
  let title = 'Итог';
  let message = '';
  if ((winnerPlayer === 'player1' && sg1_localPlayer === 'player1') ||
      (winnerPlayer === 'player2' && sg1_localPlayer === 'player2')) {
    message = 'Вы победили!';
  } else {
    message = 'Вы проиграли!';
  }
  // Глобальная функция (из main.js) для показа модалки
  showEndGameModal(title, message);
}

//////////////////////////////////////////
// Сброс игры
//////////////////////////////////////////
function resetSpecialGame1() {
  clearIntervals();
  if (sg1_gameRef) { sg1_gameRef.off(); }
  sg1_gameRef = null;
  sg1_gameId = null;
  sg1_localPlayer = null;
  sg1_gameState = 'searching';
}

function clearIntervals() {
  if (sg1_countdownInterval) { clearInterval(sg1_countdownInterval); sg1_countdownInterval = null; }
  if (sg1_gameLoopInterval) { clearInterval(sg1_gameLoopInterval); sg1_gameLoopInterval = null; }
  if (sg1_sendDataInterval) { clearInterval(sg1_sendDataInterval); sg1_sendDataInterval = null; }
  if (sg1_mainTimerInterval) { clearInterval(sg1_mainTimerInterval); sg1_mainTimerInterval = null; }
  if (fadeInterval) { clearInterval(fadeInterval); fadeInterval = null; }
}

//////////////////////////////////////////
// Обработка свайпов и отключение прокрутки
//////////////////////////////////////////
function setupSwipeControls(canvas) {
  let startX = 0, startY = 0;
  let endX = 0, endY = 0;
  canvas.addEventListener('touchstart', (e) => {
    const touch = e.touches[0];
    startX = touch.clientX;
    startY = touch.clientY;
    e.preventDefault();
  }, { passive: false });
  canvas.addEventListener('touchmove', (e) => {
    const touch = e.touches[0];
    endX = touch.clientX;
    endY = touch.clientY;
    e.preventDefault();
  }, { passive: false });
  canvas.addEventListener('touchend', (e) => {
    e.preventDefault();
    let diffX = endX - startX;
    let diffY = endY - startY;
    if (Math.abs(diffX) > Math.abs(diffY)) {
      if (diffX > 0 && sg1_snake.direction !== 'left') { sg1_snake.direction = 'right'; }
      else if (diffX < 0 && sg1_snake.direction !== 'right') { sg1_snake.direction = 'left'; }
    } else {
      if (diffY > 0 && sg1_snake.direction !== 'up') { sg1_snake.direction = 'down'; }
      else if (diffY < 0 && sg1_snake.direction !== 'down') { sg1_snake.direction = 'up'; }
    }
  }, { passive: false });
}

//////////////////////////////////////////
// Дополнительные утилиты
//////////////////////////////////////////
function getRandomSnakeColor() {
  const colors = ['#0f0', '#f0f', '#ff0', '#0ff', '#39ff14', '#32cd32'];
  return colors[Math.floor(Math.random() * colors.length)];
}
