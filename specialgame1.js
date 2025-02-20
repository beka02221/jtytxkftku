// ====== specialgame1.js ======
/**
 * PvP-змейка в стиле "Матрицы" с реалтайм синхронизацией через Firebase.
 *
 * Основные отличия:
 * 1. Поиск соперника (searching). Когда найден второй игрок:
 *    - Плавно появляется текст "Соперник найден" (fade in), затем исчезает (fade out).
 *    - На 2 секунды отображается имя соперника.
 *    - Запускается плавный отсчёт 10 секунд.
 * 2. При выходе за границы сетки змейка телепортируется на противоположную сторону (wrap-around).
 * 3. Игра длится GAME_DURATION (например, 60 секунд). Вверху канвы рисуется полоска (topbar),
 *    которая уменьшается по мере истечения времени.
 * 4. Побеждает тот, кто собрал больше яблок.
 * 5. В конце игрокам показывается модал: "Вы победили!" или "Вы проиграли!".
 * 6. Отключена прокрутка сайта при свайпе (e.preventDefault() на touchmove).
 * 7. У игроков разные цвета змейки и разные стартовые позиции.
 */

//////////////////////////////////////////
// Глобальные настройки и переменные
//////////////////////////////////////////

// Общая длительность матча (в секундах)
const GAME_DURATION = 60;

// Размер поля (в клетках)
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

// Интервалы для цикла игры и синхронизации
let sg1_gameLoopInterval = null;
let sg1_sendDataInterval = null;

// Чтобы отрисовать "fade in / fade out" текста "Соперник найден"
let foundTextAlpha = 0;  // от 0 до 1
let fadeMode = 'in';     // 'in' или 'out'
let fadeInterval = null; // для анимации

// Данные змейки локального игрока
let sg1_snake = {
  segments: [],
  direction: 'right',
  color: '#0f0',
  username: '',
  score: 0    // сколько яблок съел
};

// Данные змейки соперника
let sg1_enemySnake = {
  segments: [],
  direction: 'right',
  color: '#f0f', // другой цвет (или выбирайте рандомно, но главное, чтобы не совпадал)
  username: 'Opponent',
  score: 0
};

// Позиция яблока
let sg1_apple = { x: 10, y: 10 };

// Остаток игрового времени (после countdown) - для topbar
let timeLeft = GAME_DURATION;  

//////////////////////////////////////////
// Функция инициализации (вызывается из main.js при старте игры)
//////////////////////////////////////////
function initSpecialGame1() {
  sg1_canvas = document.getElementById('specialGameCanvas');
  sg1_ctx    = sg1_canvas.getContext('2d');
  
  // Стили для канвы. Внешний CSS может быть таким:
  // canvas {
  //   display: block;
  //   margin: 0 auto;   // выравнивание по центру
  //   touch-action: none;  // отключить жесты прокрутки
  // }
  // Но здесь для наглядности (минимально):
  sg1_canvas.style.display = 'block';
  sg1_canvas.style.margin = '0 auto';

  // "Матрица": чёрный фон, зелёный текст
  sg1_ctx.fillStyle = '#0f0';
  sg1_ctx.font = '14px "Press Start 2P", monospace';
  sg1_ctx.textAlign = 'center';

  // Имя игрока (если есть Telegram.WebApp.initDataUnsafe.user)
  if (typeof currentUser !== 'undefined' && currentUser?.username) {
    sg1_snake.username = '@' + currentUser.username;
  } else {
    sg1_snake.username = 'Me';
  }

  // Для разнообразия: player1 = зелёная, player2 = желто-розовая 
  // (или любой другой цвет). 
  // Пока не знаем, кто мы — player1 или player2, назначим color потом.

  // Начальные сегменты (Player1 начнёт сверху слева, Player2 — снизу справа)
  // Мы зададим это позже, когда определим, player1 или player2.

  // Отключаем прокрутку при свайпе, но даём возможность управлять.
  setupSwipeControls(sg1_canvas);

  drawSearchingScreen();  // Показать "Поиск соперника..."

  // Поиск / создание матча
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
      // Мы — player2
      sg1_gameId      = foundGame.id;
      sg1_localPlayer = 'player2';
      sg1_gameRef     = db.ref('snakeGames/' + sg1_gameId);

      // Назначим цвет player2
      sg1_snake.color = '#f0f';
      // Стартовая позиция (например, с другой стороны)
      sg1_snake.segments = [{x: SG1_COLS - 3, y: SG1_ROWS - 3}, {x: SG1_COLS - 2, y: SG1_ROWS - 3}];
      sg1_snake.direction = 'left';

      // Записываем player2
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

      // Цвет player1
      sg1_snake.color = '#0f0';
      // Стартовая позиция
      sg1_snake.segments = [{x: 2, y: 2}, {x: 1, y:2}];
      sg1_snake.direction = 'right';

      // Создаём новую игру
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

    // Подписка на изменения
    listenSnakeGameChanges();
  });
}

//////////////////////////////////////////
// Слушаем изменения в матче (Firebase)
//////////////////////////////////////////
function listenSnakeGameChanges() {
  if (!sg1_gameRef) return;

  sg1_gameRef.on('value', snapshot => {
    let data = snapshot.val();
    if (!data) return;

    sg1_gameState = data.state || 'searching';

    // Считаем позиции яблока
    if (data.apple) {
      sg1_apple.x = data.apple.x;
      sg1_apple.y = data.apple.y;
    }

    // Считаем очки
    // (score1, score2 в БД)
    sg1_snake.score       = (sg1_localPlayer === 'player1') ? (data.score1 || 0) : (data.score2 || 0);
    sg1_enemySnake.score  = (sg1_localPlayer === 'player1') ? (data.score2 || 0) : (data.score1 || 0);

    // Считываем змейки
    if (sg1_localPlayer === 'player1') {
      // Противник = player2
      if (data.player2) {
        sg1_enemySnake.username = data.player2.username || 'Opponent';
        sg1_enemySnake.color    = data.player2.color || '#f0f';
      }
      if (data.snake2) {
        sg1_enemySnake.segments = data.snake2;
      }
    } else {
      // Мы player2, противник = player1
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
      // Если уже пришёл второй игрок, запускаем анимацию "Соперник найден"
      if (data.player1 && data.player2 && !fadeInterval) {
        startFoundAnimation();
      } else {
        drawSearchingScreen();
      }
      return;
    }
    else if (sg1_gameState === 'foundAnimation') {
      // Идёт анимация "Соперник найден" (fade in/out).
      // Всё отрисовывается из foundAnimationTick().
      return;
    }
    else if (sg1_gameState === 'showOpponent') {
      // Показ имени соперника 2 секунды
      // Отрисовка из showOpponentNameTick()
      return;
    }
    else if (sg1_gameState === 'countdown') {
      // Идёт обратный отсчёт 10 секунд
      drawCountdown(data.countdown);
      return;
    }
    else if (sg1_gameState === 'playing') {
      // Игра. Запускаем цикл, если не запущен
      if (!sg1_gameLoopInterval) {
        startSnakeGameLoop();
      }
    }

    // Если winner != null => state = "finished"
    if (data.winner && sg1_gameState !== 'finished') {
      sg1_gameState = 'finished';
      showWinnerModal(data.winner);
    }
  });

  // Также слушаем изменения, чтобы перехватить countdown/score
  sg1_gameRef.on('child_changed', snap => {
    // Можно выцепить 'countdown' или что-то ещё,
    // но основная логика выше (on('value')) уже всё обрабатывает.
  });
}

//////////////////////////////////////////
// 1) Экран "Поиск соперника..."
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
// 2) Анимация "Соперник найден" (fade in/out)
//////////////////////////////////////////
function startFoundAnimation() {
  // Устанавливаем state
  sg1_gameRef.update({ state: 'foundAnimation' });
  sg1_gameState = 'foundAnimation';

  foundTextAlpha = 0;
  fadeMode       = 'in';

  // Каждые 50мс будем менять alpha
  fadeInterval = setInterval(foundAnimationTick, 50);
}

// Кадры анимации
function foundAnimationTick() {
  if (fadeMode === 'in') {
    foundTextAlpha += 0.05;
    if (foundTextAlpha >= 1) {
      foundTextAlpha = 1;
      // Небольшая пауза 500 мс на 100% прозрачности
      fadeMode = 'pause';
      setTimeout(() => {
        fadeMode = 'out';
      }, 500);
    }
  }
  else if (fadeMode === 'out') {
    foundTextAlpha -= 0.05;
    if (foundTextAlpha <= 0) {
      foundTextAlpha = 0;
      clearInterval(fadeInterval);
      fadeInterval = null;

      // Переходим к "showOpponent"
      sg1_gameRef.update({ state: 'showOpponent' });
      sg1_gameState = 'showOpponent';

      // Запускаем показ имени соперника
      startShowOpponentNamePhase();
    }
  }

  drawFoundAnimation(); 
}

function drawFoundAnimation() {
  sg1_ctx.clearRect(0, 0, sg1_canvas.width, sg1_canvas.height);
  
  // Фон
  sg1_ctx.fillStyle = '#000';
  sg1_ctx.fillRect(0, 0, sg1_canvas.width, sg1_canvas.height);

  // Рисуем текст с альфой
  sg1_ctx.save();
  sg1_ctx.globalAlpha = foundTextAlpha;
  sg1_ctx.fillStyle = '#0f0';
  sg1_ctx.font = '20px "Press Start 2P", monospace';
  sg1_ctx.fillText('Соперник найден', sg1_canvas.width/2, sg1_canvas.height/2);
  sg1_ctx.restore();
}

//////////////////////////////////////////
// 3) Показываем имя соперника 2 секунды
//////////////////////////////////////////
function startShowOpponentNamePhase() {
  // 2 секунды показываем имя
  // С помощью setTimeout, а пока — рисуем в showOpponentNameTick
  drawShowOpponentName();
  setTimeout(() => {
    // Переходим к отсчёту 10 секунд
    // Инициирует player1
    if (sg1_localPlayer === 'player1') {
      startCountdown(10);
    }
  }, 2000);
}

function drawShowOpponentName() {
  sg1_ctx.clearRect(0, 0, sg1_canvas.width, sg1_canvas.height);
  sg1_ctx.fillStyle = '#000';
  sg1_ctx.fillRect(0, 0, sg1_canvas.width, sg1_canvas.height);

  // имя соперника
  const oppName = sg1_enemySnake.username || 'Opponent';

  sg1_ctx.fillStyle = '#0f0';
  sg1_ctx.font = '20px "Press Start 2P", monospace';
  sg1_ctx.fillText(oppName, sg1_canvas.width/2, sg1_canvas.height/2);
}

//////////////////////////////////////////
// 4) Отсчёт 10 секунд
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
      // Сбрасываем
      clearInterval(sg1_countdownInterval);
      sg1_countdownInterval = null;

      // Переходим в playing
      // Устанавливаем общий таймер игры (60 секунд)
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
  sg1_ctx.fillText(num.toString(), sg1_canvas.width/2, sg1_canvas.height/2);
}

//////////////////////////////////////////
// 5) Основной игровой цикл (playing)
//////////////////////////////////////////
function startSnakeGameLoop() {
  if (sg1_gameLoopInterval) return; // уже запущено

  // Инициируем локальный таймер игры (timeLeft = GAME_DURATION)
  timeLeft = GAME_DURATION;

  // Запускаем интервалы
  sg1_gameLoopInterval = setInterval(gameTick, 150);
  sg1_sendDataInterval = setInterval(sendLocalSnakeData, 150);

  // Запускаем основной таймер (1с), уменьшаем timeLeft, рисуем topbar
  sg1_mainTimerInterval = setInterval(() => {
    timeLeft--;
    if (timeLeft <= 0) {
      // время вышло — определяем победителя
      clearInterval(sg1_mainTimerInterval);
      sg1_mainTimerInterval = null;
      if (sg1_localPlayer === 'player1') {
        finishGameByTime();
      }
    }
  }, 1000);
}

// Локально объявляем победителя, сравнив score1/score2 (чтобы синхронизировать результат в БД)
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
    else {
      // Если хотите ничью
      // winner = 'draw';
      // Для простоты выберем player1 или player2. Допустим ничья = player1 :)
      winner = 'player1';
    }

    sg1_gameRef.update({
      winner: winner,
      state: 'finished'
    });
  });
}

// Каждый "тик" ~150мс
function gameTick() {
  updateSnake(sg1_snake);
  drawGame();
}

//////////////////////////////////////////
// Логика движения с wrap-around
//////////////////////////////////////////
function updateSnake(snake) {
  const head = {...snake.segments[0]};
  switch (snake.direction) {
    case 'up':    head.y -= 1; break;
    case 'down':  head.y += 1; break;
    case 'left':  head.x -= 1; break;
    case 'right': head.x += 1; break;
  }

  // Если вышли за границу — телепорт на другую сторону
  if (head.x < 0) head.x = SG1_COLS - 1;
  if (head.x >= SG1_COLS) head.x = 0;
  if (head.y < 0) head.y = SG1_ROWS - 1;
  if (head.y >= SG1_ROWS) head.y = 0;

  snake.segments.unshift(head);

  // Проверяем, не съели ли яблоко
  if (head.x === sg1_apple.x && head.y === sg1_apple.y) {
    // Увеличиваем счёт
    if (sg1_localPlayer === 'player1') {
      // score1++
      sg1_gameRef.transaction((currentData) => {
        if (currentData) {
          currentData.score1 = (currentData.score1 || 0) + 1;
          // генерируем новое яблоко
          currentData.apple = randomApple();
        }
        return currentData;
      });
    } else {
      // score2++
      sg1_gameRef.transaction((currentData) => {
        if (currentData) {
          currentData.score2 = (currentData.score2 || 0) + 1;
          currentData.apple = randomApple();
        }
        return currentData;
      });
    }
  } else {
    // двигаемся, убираем хвост
    snake.segments.pop();
  }
}

// Генерация нового яблока
function randomApple() {
  return {
    x: Math.floor(Math.random() * SG1_COLS),
    y: Math.floor(Math.random() * SG1_ROWS),
  };
}

//////////////////////////////////////////
// Отрисовка (сетка, змейки, яблоко, topbar)
//////////////////////////////////////////
function drawGame() {
  sg1_ctx.clearRect(0, 0, sg1_canvas.width, sg1_canvas.height);

  // Фон
  sg1_ctx.fillStyle = '#000';
  sg1_ctx.fillRect(0, 0, sg1_canvas.width, sg1_canvas.height);

  // Рисуем полоску времени (topbar)
  drawTimeBar();

  // Сетка
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

  // Яблоко (красный)
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

// Полоска прогресса времени (topbar)
function drawTimeBar() {
  // Полная ширина = ширина канвы
  // Высота = 8 пикселей (например)
  const barWidth = sg1_canvas.width;
  const barHeight = 8;

  const fraction = timeLeft / GAME_DURATION;
  const filledWidth = fraction * barWidth;

  // Фон бар
  sg1_ctx.fillStyle = '#444';
  sg1_ctx.fillRect(0, 0, barWidth, barHeight);

  // Заполненная часть (зелёная)
  sg1_ctx.fillStyle = '#0f0';
  sg1_ctx.fillRect(0, 0, filledWidth, barHeight);

  // Сдвигаем "остальную" часть игры вниз на barHeight
  sg1_ctx.translate(0, barHeight);
}

// Рисуем змейку
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

// Никнейм над головой
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

// Каждый тик отправляем данные о своей змейке
function sendLocalSnakeData() {
  if (!sg1_gameRef) return;
  if (sg1_localPlayer === 'player1') {
    sg1_gameRef.update({ snake1: sg1_snake.segments });
  } else {
    sg1_gameRef.update({ snake2: sg1_snake.segments });
  }
}

//////////////////////////////////////////
// Победа / Поражение
//////////////////////////////////////////
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

  // Глобальная функция из main.js: showEndGameModal(title, message)
  showEndGameModal(title, message);
}

//////////////////////////////////////////
// Сброс игры (закрытие модалки)
//////////////////////////////////////////
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

//////////////////////////////////////////
// Свайпы + отключение прокрутки
//////////////////////////////////////////
function setupSwipeControls(canvas) {
  let startX = 0, startY = 0;
  let endX   = 0, endY   = 0;

  // Отключаем прокрутку (preventDefault)
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
  }, { passive: false });
}

//////////////////////////////////////////
// Случайный цвет (если нужно)
// Но здесь мы прямо назначаем player1/player2 свои цвета
//////////////////////////////////////////
function getRandomSnakeColor() {
  const colors = ['#0f0', '#ff0', '#0ff', '#f0f', '#39ff14', '#32cd32'];
  return colors[Math.floor(Math.random() * colors.length)];
}
