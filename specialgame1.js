// ====== specialgame1.js ======
/**
 * PvP-змейка в стиле "Матрицы" с реалтайм синхронизацией через Firebase.
 *
 * Что нового:
 * 1) Интервал отправки данных о змейке уменьшен до 80мс (чаще -> меньше лагов).
 * 2) Во время поиска внизу показывается ссылка ?gameId=XXX для приглашения друга.
 *    Если открыть её на другом устройстве, тот игрок станет player2 именно в этой игре.
 * 3) Остальной функционал: wrap-around, столкновения, анимации, 2-минутный таймер, 
 *    отключение прокрутки свайпами и т.д.
 */

// ---------------------------------------
// ПАРАМЕТРЫ И ГЛОБАЛЬНЫЕ ПЕРЕМЕННЫЕ
// ---------------------------------------
const GAME_DURATION = 120;   // 2 минуты
const SG1_COLS = 20;         // ширина поля в клетках
const SG1_ROWS = 20;         // высота поля в клетках
const SG1_CELL_SIZE = 20;    // размер клетки (px)

// Состояния игры
// "searching" -> "foundAnimation" -> "showOpponent" -> "countdown" -> "playing" -> "finished"
let sg1_gameState = 'searching';

let sg1_canvas       = null;
let sg1_ctx          = null;
let sg1_gameRef      = null;   // Ссылка на Firebase
let sg1_gameId       = null;   // ID матча
let sg1_localPlayer  = null;   // 'player1' или 'player2'

// Интервалы
let sg1_countdownInterval = null;
let sg1_mainTimerInterval = null;
let sg1_gameLoopInterval  = null;
let sg1_sendDataInterval  = null;
let fadeInterval          = null;

// Для анимации "Соперник найден"
let foundTextAlpha = 0; // 0..1
let fadeMode = 'in';    // 'in' | 'out' | 'pause'

// Остаток времени (после countdown) — рисуется в полоске
let timeLeft = GAME_DURATION;

// Змейка локального игрока
let sg1_snake = {
  segments: [],
  direction: 'right',
  color: '#0f0',
  username: '',
  score: 0
};

// Змейка противника
let sg1_enemySnake = {
  segments: [],
  direction: 'right',
  color: '#f0f',
  username: 'Opponent',
  score: 0
};

// Яблоко
let sg1_apple = { x: 10, y: 10 };

// ---------------------------------------
// 1. ИНИЦИАЛИЗАЦИЯ
// ---------------------------------------
function initSpecialGame1() {
  sg1_canvas = document.getElementById('specialGameCanvas');
  sg1_ctx    = sg1_canvas.getContext('2d');

  // Стили
  sg1_canvas.style.display = 'block';
  sg1_canvas.style.margin  = '0 auto';

  sg1_ctx.fillStyle   = '#0f0';
  sg1_ctx.font        = '14px "Press Start 2P", monospace';
  sg1_ctx.textAlign   = 'center';

  // Имя игрока из Telegram (если есть)
  if (typeof currentUser !== 'undefined' && currentUser?.username) {
    sg1_snake.username = '@' + currentUser.username;
  } else {
    sg1_snake.username = 'Me';
  }

  // Отключить прокрутку + свайпы
  setupSwipeControls(sg1_canvas);

  // Сначала покажем "Поиск соперника..."
  drawSearchingScreen();

  // Проверим, есть ли в URL ?gameId=...
  const urlParams = new URLSearchParams(window.location.search);
  const customGameId = urlParams.get('gameId');

  if (customGameId) {
    // Попробуем присоединиться к конкретной игре
    joinSpecifiedGame(customGameId);
  } else {
    // Иначе обычный поиск/создание
    matchMakeSnakeGame();
  }
}

// ---------------------------------------
// 2. ПОДКЛЮЧЕНИЕ К УКАЗАННОЙ ИГРЕ
//    (если в URL есть ?gameId=xxx)
// ---------------------------------------
function joinSpecifiedGame(gameIdFromURL) {
  const gamesRef = db.ref('snakeGames/' + gameIdFromURL);
  gamesRef.once('value', snapshot => {
    const data = snapshot.val();
    if (!data) {
      // Игры с таким gameId нет -> создаём новую
      matchMakeSnakeGame();
      return;
    }
    // Проверяем, свободно ли место (нет player2)
    if (!data.player2 && !data.winner) {
      // Присоединяемся как player2
      sg1_gameId      = gameIdFromURL;
      sg1_localPlayer = 'player2';
      sg1_gameRef     = db.ref('snakeGames/' + sg1_gameId);

      // Цвет player2
      sg1_snake.color = '#f0f';
      sg1_snake.segments = [{x: SG1_COLS - 3, y: SG1_ROWS - 3}, {x: SG1_COLS - 2, y: SG1_ROWS - 3}];
      sg1_snake.direction = 'left';

      sg1_gameRef.update({
        player2: {
          username: sg1_snake.username,
          color: sg1_snake.color,
          score: 0
        }
      });

      listenSnakeGameChanges();
    } else {
      // Игра уже занята или закончена -> создаём новую
      matchMakeSnakeGame();
    }
  });
}

// ---------------------------------------
// 3. СТАНДАРТНЫЙ ПОИСК/СОЗДАНИЕ
// ---------------------------------------
function matchMakeSnakeGame() {
  const gamesRef = db.ref('snakeGames');
  gamesRef.once('value', snapshot => {
    const gamesData = snapshot.val() || {};
    let foundGame   = null;

    // Ищем, где нет player2
    for (let gId in gamesData) {
      let g = gamesData[gId];
      if (!g.player2 && !g.winner) {
        foundGame = { id: gId, data: g };
        break;
      }
    }

    if (foundGame) {
      // Становимся player2
      sg1_gameId      = foundGame.id;
      sg1_localPlayer = 'player2';
      sg1_gameRef     = db.ref('snakeGames/' + sg1_gameId);

      sg1_snake.color = '#f0f';
      sg1_snake.segments = [{x: SG1_COLS - 3, y: SG1_ROWS - 3}, {x: SG1_COLS - 2, y: SG1_ROWS - 3}];
      sg1_snake.direction = 'left';

      sg1_gameRef.update({
        player2: {
          username: sg1_snake.username,
          color: sg1_snake.color,
          score: 0
        }
      });
    } else {
      // Создаём новую игру -> player1
      sg1_gameId      = db.ref().child('snakeGames').push().key;
      sg1_localPlayer = 'player1';
      sg1_gameRef     = db.ref('snakeGames/' + sg1_gameId);

      sg1_snake.color = '#0f0';
      sg1_snake.segments = [{x: 2, y: 2}, {x:1, y:2}];
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

    listenSnakeGameChanges();
  });
}

// ---------------------------------------
// 4. ПОДПИСКА НА ИЗМЕНЕНИЯ МАТЧА (Firebase)
// ---------------------------------------
function listenSnakeGameChanges() {
  if (!sg1_gameRef) return;

  sg1_gameRef.on('value', snapshot => {
    const data = snapshot.val();
    if (!data) return;

    sg1_gameState = data.state || 'searching';

    // Яблоко
    if (data.apple) {
      sg1_apple.x = data.apple.x;
      sg1_apple.y = data.apple.y;
    }

    // Очки
    sg1_snake.score       = (sg1_localPlayer === 'player1') ? (data.score1 || 0) : (data.score2 || 0);
    sg1_enemySnake.score  = (sg1_localPlayer === 'player1') ? (data.score2 || 0) : (data.score1 || 0);

    // Противник
    if (sg1_localPlayer === 'player1') {
      if (data.player2) {
        sg1_enemySnake.username = data.player2.username || 'Opponent';
        sg1_enemySnake.color    = data.player2.color    || '#f0f';
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
      // Рисуем "Поиск соперника..."
      drawSearchingScreen();
      // Показываем/обновляем invite-link (если мы player1)
      showInviteLinkIfPlayer1();
      // Если уже есть оба игрока => анимация "Соперник найден"
      if (data.player1 && data.player2 && !fadeInterval) {
        startFoundAnimation();
      }
      return;
    }
    else if (sg1_gameState === 'foundAnimation') {
      // Отрисовывается в foundAnimationTick()
      hideInviteLink(); 
      return;
    }
    else if (sg1_gameState === 'showOpponent') {
      // 2 секунды имя соперника
      hideInviteLink();
      return;
    }
    else if (sg1_gameState === 'countdown') {
      hideInviteLink();
      drawCountdown(data.countdown);
      return;
    }
    else if (sg1_gameState === 'playing') {
      hideInviteLink();
      if (!sg1_gameLoopInterval) {
        startSnakeGameLoop();
      }
    }

    // Если победитель
    if (data.winner && sg1_gameState !== 'finished') {
      sg1_gameState = 'finished';
      showWinnerModal(data.winner);
    }
  });
}

// ---------------------------------------
// 4.1 - Показ/скрытие ссылки приглашения
// ---------------------------------------
function showInviteLinkIfPlayer1() {
  const inviteBlock = document.getElementById('inviteLinkBlock');
  if (!inviteBlock) return; // элемент не существует в HTML
  // Показываем ссылку, если мы player1 и ещё нет player2
  if (sg1_localPlayer === 'player1' && sg1_gameId) {
    const link = window.location.origin + window.location.pathname + '?gameId=' + sg1_gameId;
    inviteBlock.style.display = 'block';
    inviteBlock.innerHTML = `
      Пригласить друга: 
      <a href="${link}" target="_blank" style="color:#0f0; text-decoration: underline;">
        ${link}
      </a>
    `;
  }
}

function hideInviteLink() {
  const inviteBlock = document.getElementById('inviteLinkBlock');
  if (inviteBlock) {
    inviteBlock.style.display = 'none';
  }
}

// ---------------------------------------
// 5. ЭКРАН "ПОИСК СОПЕРНИКА..."
// ---------------------------------------
function drawSearchingScreen() {
  sg1_ctx.clearRect(0, 0, sg1_canvas.width, sg1_canvas.height);
  sg1_ctx.fillStyle = '#000';
  sg1_ctx.fillRect(0, 0, sg1_canvas.width, sg1_canvas.height);

  sg1_ctx.fillStyle = '#0f0';
  sg1_ctx.font = '16px "Press Start 2P", monospace';
  sg1_ctx.fillText('Поиск соперника...', sg1_canvas.width/2, sg1_canvas.height/2);
}

// ---------------------------------------
// 6. АНИМАЦИЯ "СОПЕРНИК НАЙДЕН"
// ---------------------------------------
function startFoundAnimation() {
  sg1_gameRef.update({ state: 'foundAnimation' });
  sg1_gameState  = 'foundAnimation';
  foundTextAlpha = 0;
  fadeMode       = 'in';
  fadeInterval   = setInterval(foundAnimationTick, 50);
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

// ---------------------------------------
// 7. ПОКАЗ ИМЕНИ СОПЕРНИКА (2 СЕКУНДЫ)
// ---------------------------------------
function startShowOpponentNamePhase() {
  drawShowOpponentName();
  setTimeout(() => {
    // только player1 запускает отсчёт
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

// ---------------------------------------
// 8. ОТСЧЁТ 10 СЕКУНД (COUNTDOWN)
// ---------------------------------------
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

// ---------------------------------------
// 9. ЗАПУСК ИГРЫ (PLAYING)
// ---------------------------------------
function startSnakeGameLoop() {
  if (sg1_gameLoopInterval) return;
  timeLeft = GAME_DURATION;

  // Быстрее отправляем данные (80мс) для минимизации "лага"
  sg1_gameLoopInterval = setInterval(gameTick, 80);
  sg1_sendDataInterval = setInterval(sendLocalSnakeData, 80);

  sg1_mainTimerInterval = setInterval(() => {
    timeLeft--;
    if (timeLeft <= 0) {
      clearInterval(sg1_mainTimerInterval);
      sg1_mainTimerInterval = null;
      // По истечении 2 минут -> сравниваем score
      if (sg1_localPlayer === 'player1') {
        finishGameByTime();
      }
    }
  }, 1000);
}

// Когда время вышло, определяем победителя
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
    else winner = 'player1'; // в случае ничьей выберем player1

    sg1_gameRef.update({
      winner: winner,
      state: 'finished'
    });
  });
}

// Каждый тик ~80мс
function gameTick() {
  updateSnake(sg1_snake);
  if (checkCollisions(sg1_snake, sg1_enemySnake)) {
    // столкновение => объявлен победитель
    return;
  }
  drawGame();
}

// ---------------------------------------
// 10. СТОЛКНОВЕНИЯ: С СВОИМ ХВОСТОМ И ЗМЕЁЙ ОППОНЕНТА
// ---------------------------------------
function checkCollisions(snake, enemy) {
  const head = snake.segments[0];
  // Столкновение с собственным хвостом (начиная со 2-го сегмента)
  for (let i = 1; i < snake.segments.length; i++) {
    if (head.x === snake.segments[i].x && head.y === snake.segments[i].y) {
      // Проигрыш
      declareWinner(opponentOf(sg1_localPlayer));
      return true;
    }
  }
  // Столкновение с любым сегментом противника
  for (let seg of enemy.segments) {
    if (head.x === seg.x && head.y === seg.y) {
      declareWinner(opponentOf(sg1_localPlayer));
      return true;
    }
  }
  return false;
}

function declareWinner(winnerPlayer) {
  if (!sg1_gameRef) return;
  sg1_gameRef.update({
    winner: winnerPlayer,
    state: 'finished'
  });
}

function opponentOf(player) {
  return (player === 'player1') ? 'player2' : 'player1';
}

// ---------------------------------------
// 11. ДВИЖЕНИЕ С ЗАВЕРТЫВАНИЕМ (WRAP-AROUND)
// ---------------------------------------
function updateSnake(snake) {
  const head = { ...snake.segments[0] };
  switch (snake.direction) {
    case 'up':    head.y--; break;
    case 'down':  head.y++; break;
    case 'left':  head.x--; break;
    case 'right': head.x++; break;
  }
  // Проверка выхода за границы
  if (head.x < 0) head.x = SG1_COLS - 1;
  if (head.x >= SG1_COLS) head.x = 0;
  if (head.y < 0) head.y = SG1_ROWS - 1;
  if (head.y >= SG1_ROWS) head.y = 0;

  snake.segments.unshift(head);

  // Яблоко?
  if (head.x === sg1_apple.x && head.y === sg1_apple.y) {
    // Увеличиваем score
    if (sg1_localPlayer === 'player1') {
      sg1_gameRef.transaction(curr => {
        if (curr) {
          curr.score1 = (curr.score1 || 0) + 1;
          curr.apple  = randomApple();
        }
        return curr;
      });
    } else {
      sg1_gameRef.transaction(curr => {
        if (curr) {
          curr.score2 = (curr.score2 || 0) + 1;
          curr.apple  = randomApple();
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

// ---------------------------------------
// 12. ОТРИСОВКА (полоска + поле + змейки + яблоко)
// ---------------------------------------
function drawGame() {
  sg1_ctx.clearRect(0, 0, sg1_canvas.width, sg1_canvas.height);

  // Сначала полоска времени
  sg1_ctx.save();
  drawTimeBar();
  sg1_ctx.restore();

  // Сдвигаем поле на 8 пикселей вниз
  sg1_ctx.save();
  sg1_ctx.translate(0, 8);

  // Заливка поля
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

  // Ники
  drawUsernameAboveHead(sg1_snake);
  drawUsernameAboveHead(sg1_enemySnake);

  sg1_ctx.restore();
}

// Полоска времени (topbar)
function drawTimeBar() {
  const barWidth  = sg1_canvas.width;
  const barHeight = 8;
  const fraction  = timeLeft / GAME_DURATION;
  const filledWidth = fraction * barWidth;

  sg1_ctx.fillStyle = '#444';
  sg1_ctx.fillRect(0, 0, barWidth, barHeight);

  sg1_ctx.fillStyle = '#0f0';
  sg1_ctx.fillRect(0, 0, filledWidth, barHeight);
}

// Рисуем змейку
function drawSnake(snakeObj) {
  sg1_ctx.fillStyle = snakeObj.color;
  for (let seg of snakeObj.segments) {
    sg1_ctx.fillRect(
      seg.x * SG1_CELL_SIZE,
      seg.y * SG1_CELL_SIZE,
      SG1_CELL_SIZE,
      SG1_CELL_SIZE
    );
  }
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

// ---------------------------------------
// 13. СИНХРОНИЗАЦИЯ (отправка данных змейки)
// ---------------------------------------
function sendLocalSnakeData() {
  if (!sg1_gameRef) return;
  if (sg1_localPlayer === 'player1') {
    sg1_gameRef.update({ snake1: sg1_snake.segments });
  } else {
    sg1_gameRef.update({ snake2: sg1_snake.segments });
  }
}

// ---------------------------------------
// 14. ПОБЕДА / ПРОИГРЫШ (модальное окно)
// ---------------------------------------
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
  // Эта функция должна быть определена в main.js
  showEndGameModal(title, message);
}

// ---------------------------------------
// 15. СБРОС ИГРЫ
// ---------------------------------------
function resetSpecialGame1() {
  clearIntervals();
  if (sg1_gameRef) sg1_gameRef.off();
  sg1_gameRef     = null;
  sg1_gameId      = null;
  sg1_localPlayer = null;
  sg1_gameState   = 'searching';
}

// Очищаем интервалы
function clearIntervals() {
  if (sg1_countdownInterval)  { clearInterval(sg1_countdownInterval);  sg1_countdownInterval = null; }
  if (sg1_mainTimerInterval)  { clearInterval(sg1_mainTimerInterval);  sg1_mainTimerInterval = null; }
  if (sg1_gameLoopInterval)   { clearInterval(sg1_gameLoopInterval);   sg1_gameLoopInterval = null; }
  if (sg1_sendDataInterval)   { clearInterval(sg1_sendDataInterval);   sg1_sendDataInterval = null; }
  if (fadeInterval)           { clearInterval(fadeInterval);           fadeInterval = null; }
}

// ---------------------------------------
// 16. СВАЙПЫ + ОТКЛЮЧЕНИЕ ПРОКРУТКИ
// ---------------------------------------
function setupSwipeControls(canvas) {
  let startX = 0, startY = 0;
  let endX   = 0, endY   = 0;

  canvas.addEventListener('touchstart', (e) => {
    const t = e.touches[0];
    startX = t.clientX;
    startY = t.clientY;
    e.preventDefault();
  }, { passive: false });

  canvas.addEventListener('touchmove', (e) => {
    const t = e.touches[0];
    endX = t.clientX;
    endY = t.clientY;
    e.preventDefault();
  }, { passive: false });

  canvas.addEventListener('touchend', (e) => {
    e.preventDefault();
    const diffX = endX - startX;
    const diffY = endY - startY;

    if (Math.abs(diffX) > Math.abs(diffY)) {
      // Горизонталь
      if (diffX > 0 && sg1_snake.direction !== 'left') {
        sg1_snake.direction = 'right';
      } else if (diffX < 0 && sg1_snake.direction !== 'right') {
        sg1_snake.direction = 'left';
      }
    } else {
      // Вертикаль
      if (diffY > 0 && sg1_snake.direction !== 'up') {
        sg1_snake.direction = 'down';
      } else if (diffY < 0 && sg1_snake.direction !== 'down') {
        sg1_snake.direction = 'up';
      }
    }
  }, { passive: false });
}

// ---------------------------------------
// Доп. утилита (если хотите случайный цвет)
// ---------------------------------------
function getRandomSnakeColor() {
  const colors = ['#0f0', '#f0f', '#ff0', '#0ff', '#39ff14', '#32cd32'];
  return colors[Math.floor(Math.random() * colors.length)];
}
