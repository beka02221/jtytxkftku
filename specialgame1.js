// ====== specialgame1.js ======
/**
 * Игра "Змейка" в стиле "Матрицы" с:
 *  - Поиском соперника
 *  - Плавным сообщением "Соперник найден" + имя
 *  - 10-секундным отсчётом перед стартом
 *  - Телепортом змеи при выходе за границы (обёртка)
 *  - Основным таймером на игру (например, 60 сек), сверху — progress bar
 *  - Побеждает тот, кто собрал больше яблок
 *  - Разные цвета змей и разные стартовые позиции
 */

// ---------- Константы / Глобальные переменные ----------
const SG1_COLS = 20;
const SG1_ROWS = 20;
const SG1_CELL_SIZE = 20;

// Сколько длится игра (в миллисекундах)
const GAME_DURATION_MS = 60_000; // 60 секунд

let sg1_canvas   = null;
let sg1_ctx      = null;
let sg1_gameRef  = null; // Ссылка на Firebase
let sg1_gameId   = null; // ID матча
let sg1_localPlayer  = null; // 'player1' или 'player2'
let sg1_gameState    = 'searching'; // Этапы: searching -> found -> showOppName -> countdown -> playing -> finished

// Краткие переменные состояния
let sg1_snake = {
  segments: [],
  direction: 'right',
  color: '#0f0',
  username: '',
  applesCollected: 0, // сколько собрал яблок
};

let sg1_enemySnake = {
  segments: [],
  direction: 'right',
  color: '#0f0',
  username: '',
  applesCollected: 0,
};

let sg1_apple = { x: 10, y: 10 };

// Интервалы
let sg1_gameLoopInterval    = null;
let sg1_sendDataInterval    = null;
let sg1_countdownInterval   = null;
let sg1_mainTimerInterval   = null;

// Сколько секунд идёт countdown перед игрой
const PRE_GAME_COUNTDOWN = 10;
// Сколько осталось секунд до начала (используется в countdown)
let sg1_countdownValue = 0;

// Время старта игры (или null, если не началась)
let sg1_gameStartTime = null;

// =========== ИНИЦИАЛИЗАЦИЯ ===========
function initSpecialGame1() {
  sg1_canvas = document.getElementById('specialGameCanvas');
  sg1_ctx    = sg1_canvas.getContext('2d');

  // Стили
  sg1_canvas.style.backgroundColor = '#000'; 
  sg1_ctx.font      = '10px "Press Start 2P", monospace';
  sg1_ctx.fillStyle = '#0f0';
  sg1_ctx.textAlign = 'center';

  // Предотвращаем скролл при свайпе
  sg1_canvas.addEventListener('touchmove', (e) => {
    e.preventDefault();
  }, { passive: false });

  // Задаём имя из Telegram (если есть глобальный currentUser)
  if (typeof currentUser !== 'undefined' && currentUser.username) {
    sg1_snake.username = '@' + currentUser.username;
  } else {
    sg1_snake.username = 'Me';
  }

  // Случайный цвет
  sg1_snake.color = getRandomSnakeColor();

  // Разные стартовые позиции
  // Player1 — слева, Player2 — справа (для наглядности)
  // (Если мы ещё не знаем, кто мы, пропишем в момент matchMake)
  sg1_snake.segments = []; // пока пусто, установим после определения player1/player2

  // Свайпы
  setupSwipeControls(sg1_canvas);

  // Отрисуем «Поиск соперника»
  sg1_gameState = 'searching';
  drawSearchingScreen();

  // Подключаемся к Firebase / ищем/создаём матч
  matchMakeSnakeGame();
}

/** Поиск/Создание матча */
function matchMakeSnakeGame() {
  const gamesRef = db.ref('snakeGames');
  gamesRef.once('value', (snapshot) => {
    const gamesData = snapshot.val() || {};
    let foundGame   = null;

    // Ищем игру, где ещё нет player2 и нет winner
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

      // Проверяем цвет player1, если совпал — меняем
      const p1Color = foundGame.data.player1.color || '#0f0';
      if (p1Color === sg1_snake.color) {
        // Если цвет совпал, меняем на другой
        sg1_snake.color = getAnotherColor(p1Color);
      }

      // Начальная позиция player2 (справа)
      // Пример: x=SG1_COLS-3, y=2
      sg1_snake.segments = [
        {x: SG1_COLS-3, y:2},
        {x: SG1_COLS-4, y:2},
        {x: SG1_COLS-5, y:2},
      ];

      // Записываем player2
      sg1_gameRef.update({
        player2: {
          username: sg1_snake.username,
          color: sg1_snake.color,
        },
        // state остаётся 'searching' пока
      });
    } else {
      // Мы — player1, создаём новую игру
      sg1_gameId      = db.ref().child('snakeGames').push().key;
      sg1_localPlayer = 'player1';
      sg1_gameRef     = db.ref('snakeGames/' + sg1_gameId);

      // Начальная позиция player1 (слева)
      sg1_snake.segments = [
        {x:2, y:2},
        {x:1, y:2},
        {x:0, y:2},
      ];

      sg1_gameRef.set({
        player1: {
          username: sg1_snake.username,
          color: sg1_snake.color,
        },
        player2: null,
        state: 'searching',
        winner: null,
        // Сегменты
        snake1: sg1_snake.segments,
        snake2: [],
        // Количество собранных яблок каждым
        player1Apples: 0,
        player2Apples: 0,
        // Яблоко
        apple: { x: sg1_apple.x, y: sg1_apple.y },
      });
    }

    listenGameChanges();
  });
}

/** Подписываемся на изменения в БД */
function listenGameChanges() {
  if (!sg1_gameRef) return;

  sg1_gameRef.on('value', (snap) => {
    const data = snap.val();
    if (!data) return;

    sg1_gameState = data.state || 'searching';

    // Считываем яблоко
    if (data.apple) {
      sg1_apple.x = data.apple.x;
      sg1_apple.y = data.apple.y;
    }

    // Счёт яблок (из БД, чтобы в конце сравнить)
    let p1Apples = data.player1Apples || 0;
    let p2Apples = data.player2Apples || 0;

    // Если мы p1 — enemy = p2
    if (sg1_localPlayer === 'player1') {
      if (data.player2) {
        sg1_enemySnake.username = data.player2.username || 'Opponent';
        sg1_enemySnake.color    = data.player2.color    || '#0f0';
      }
      if (data.snake2) {
        sg1_enemySnake.segments = data.snake2;
      }
      sg1_snake.applesCollected = p1Apples;
      sg1_enemySnake.applesCollected = p2Apples;
    } else {
      if (data.player1) {
        sg1_enemySnake.username = data.player1.username || 'Opponent';
        sg1_enemySnake.color    = data.player1.color    || '#0f0';
      }
      if (data.snake1) {
        sg1_enemySnake.segments = data.snake1;
      }
      sg1_snake.applesCollected = p2Apples;
      sg1_enemySnake.applesCollected = p1Apples;
    }

    // Логика переходов
    if (sg1_gameState === 'searching') {
      // Рисуем "Поиск соперника"
      drawSearchingScreen();

      // Если data.player1 и data.player2 уже есть — переходим в state='found'
      if (data.player1 && data.player2) {
        if (sg1_localPlayer === 'player1') {
          // ТОЛЬКО player1 ставит state = 'found'
          sg1_gameRef.update({ state: 'found' });
        }
      }
      return;
    }

    if (sg1_gameState === 'found') {
      // Плавно показываем "Соперник найден"
      // Затем, когда закончим анимацию, ставим state='showOppName'
      showOpponentFoundAnimation(() => {
        // когда закончим анимацию:
        if (sg1_localPlayer === 'player1') {
          sg1_gameRef.update({ state: 'showOppName' });
        }
      });
      return;
    }

    if (sg1_gameState === 'showOppName') {
      // 2 секунды показываем имя оппонента
      drawOpponentNameFor2Sec(sg1_enemySnake.username, () => {
        if (sg1_localPlayer === 'player1') {
          sg1_gameRef.update({ state: 'countdown' });
        }
      });
      return;
    }

    if (sg1_gameState === 'countdown') {
      // 10 секундный отсчёт до старта
      // Запускаем только 1 раз
      startPreGameCountdown();
      return;
    }

    if (sg1_gameState === 'playing') {
      // Запускаем игровой цикл (если ещё нет)
      if (!sg1_gameLoopInterval) {
        startSnakeGameLoop();
        // Запускаем основной таймер (60 сек)
        sg1_gameStartTime = Date.now();
        startMainGameTimer();
      }
    }

    if (data.winner && sg1_gameState !== 'finished') {
      // Игра закончена, показываем финал
      sg1_gameState = 'finished';
      showWinnerModal(data.winner);
    }
  });
}

/** Плавное появление/исчезновение "Соперник найден" (упрощённо) */
function showOpponentFoundAnimation(onComplete) {
  // Можно сделать через анимацию alpha, но здесь — просто покажем текст 2 сек.
  let duration = 2000; // 2 сек
  let start = Date.now();

  let animInterval = setInterval(() => {
    let now = Date.now();
    let elapsed = now - start;
    
    drawBasicScreen(); // чёрный фон
    // Надпись
    sg1_ctx.fillStyle = '#0f0';
    sg1_ctx.font = '20px "Press Start 2P", monospace';
    sg1_ctx.fillText('СОПЕРНИК НАЙДЕН', sg1_canvas.width/2, sg1_canvas.height/2);

    if (elapsed >= duration) {
      clearInterval(animInterval);
      // Выполняем колбэк
      onComplete?.();
    }
  }, 100);
}

/** 2 секунды показываем имя оппонента */
function drawOpponentNameFor2Sec(opponentName, onComplete) {
  let duration = 2000;
  let start = Date.now();

  let animInterval = setInterval(() => {
    let now = Date.now();
    let elapsed = now - start;

    drawBasicScreen();
    sg1_ctx.fillStyle = '#0f0';
    sg1_ctx.font = '18px "Press Start 2P", monospace';
    sg1_ctx.fillText(opponentName, sg1_canvas.width/2, sg1_canvas.height/2);

    if (elapsed >= duration) {
      clearInterval(animInterval);
      onComplete?.();
    }
  }, 100);
}

/** Запуск 10-секундного отсчёта */
function startPreGameCountdown() {
  // Чтобы не запускать много раз
  if (sg1_countdownValue > 0) return;

  sg1_countdownValue = PRE_GAME_COUNTDOWN; // 10
  drawCountdown(sg1_countdownValue);

  sg1_countdownInterval = setInterval(() => {
    sg1_countdownValue--;
    if (sg1_countdownValue < 0) {
      clearInterval(sg1_countdownInterval);
      sg1_gameRef.update({ state: 'playing' });
    } else {
      drawCountdown(sg1_countdownValue);
    }
  }, 1000);
}

/** Рисуем "Поиск соперника" */
function drawSearchingScreen() {
  drawBasicScreen();
  sg1_ctx.fillStyle = '#0f0';
  sg1_ctx.font = '16px "Press Start 2P", monospace';
  sg1_ctx.fillText('Поиск соперника...', sg1_canvas.width/2, sg1_canvas.height/2);
}

/** Очищаем и заливаем чёрным */
function drawBasicScreen() {
  sg1_ctx.clearRect(0, 0, sg1_canvas.width, sg1_canvas.height);
  sg1_ctx.fillStyle = '#000';
  sg1_ctx.fillRect(0, 0, sg1_canvas.width, sg1_canvas.height);
}

/** Рисуем крупно оставшиеся секунды до старта */
function drawCountdown(seconds) {
  drawBasicScreen();
  sg1_ctx.fillStyle = '#0f0';
  sg1_ctx.font = '40px "Press Start 2P", monospace';
  sg1_ctx.fillText(seconds.toString(), sg1_canvas.width/2, sg1_canvas.height/2);
}

// ============== СТАРТ ОСНОВНОЙ ИГРЫ (PLAYING) =============

function startSnakeGameLoop() {
  if (sg1_gameLoopInterval) return; // уже идёт

  // Каждые 150 мс двигаем змейку
  sg1_gameLoopInterval = setInterval(gameTick, 150);
  // И каждые 150 мс отправляем положение в БД
  sg1_sendDataInterval = setInterval(sendLocalSnakeData, 150);
}

/** Основной игровой цикл */
function gameTick() {
  updateSnake(sg1_snake);

  // Не убиваем при выходе за границы, а телепортируем:
  wrapSnakeHead(sg1_snake);

  // Проверка на "сам себя" — для данной задачи сказано, что с собой не умираем?
  // Или умираем? (В условии не сказано про самопересечение, но обычно змейка умирает.)
  // Если нужно, можно оставить самопересечение. Тут пропустим для упрощения.

  // Проверяем, съели ли яблоко
  const head = sg1_snake.segments[0];
  if (head.x === sg1_apple.x && head.y === sg1_apple.y) {
    // Увеличиваем локальный счёт
    sg1_snake.applesCollected++;
    // Обновляем в БД
    if (sg1_localPlayer === 'player1') {
      sg1_gameRef.update({
        player1Apples: sg1_snake.applesCollected,
      });
    } else {
      sg1_gameRef.update({
        player2Apples: sg1_snake.applesCollected,
      });
    }
    // Генерируем новое яблоко
    generateNewApple();
  } else {
    // Если не съели, убираем хвост
    sg1_snake.segments.pop();
  }

  drawGame();
}

/** "Обёртка" для змейки: если вышла за границу, переходит на противоположную */
function wrapSnakeHead(snake) {
  let head = snake.segments[0];
  if (head.x < 0) head.x = SG1_COLS - 1;
  else if (head.x >= SG1_COLS) head.x = 0;
  if (head.y < 0) head.y = SG1_ROWS - 1;
  else if (head.y >= SG1_ROWS) head.y = 0;
}

/** Основной таймер — 60 секунд (GAME_DURATION_MS) + progress bar */
function startMainGameTimer() {
  let start = Date.now();
  sg1_mainTimerInterval = setInterval(() => {
    let now = Date.now();
    let elapsed = now - start;
    if (elapsed >= GAME_DURATION_MS) {
      clearInterval(sg1_mainTimerInterval);
      endGameByTime();
    }
  }, 200); // ~5 раз в секунду можно проверять

}

/** Когда время истекло, сравниваем счёт и объявляем победителя */
function endGameByTime() {
  // Сравниваем apples
  let localApples  = sg1_snake.applesCollected;
  let enemyApples  = sg1_enemySnake.applesCollected;
  let winnerPlayer = null;

  if (localApples > enemyApples) {
    winnerPlayer = sg1_localPlayer;
  } else if (localApples < enemyApples) {
    winnerPlayer = (sg1_localPlayer === 'player1' ? 'player2' : 'player1');
  } else {
    // Возможна ничья — решите, как обрабатывать (можно объявить null)
    // Для примера пусть ничья => никого не объявляем?
    // Или winnerPlayer = 'tie' (надо доработать отображение).
    winnerPlayer = 'tie';
  }

  sg1_gameRef.update({
    state: 'finished',
    winner: winnerPlayer,
  });
}

/** Рисуем поле, сетку, яблоко, змейки, а также progress bar вверху */
function drawGame() {
  sg1_ctx.clearRect(0, 0, sg1_canvas.width, sg1_canvas.height);

  // Фон
  sg1_ctx.fillStyle = '#000';
  sg1_ctx.fillRect(0, 0, sg1_canvas.width, sg1_canvas.height);

  // Прорисовка сетки
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

  // Полоска времени (progress bar) сверху
  let timePassed = (Date.now() - sg1_gameStartTime);
  if (timePassed < 0) timePassed = 0;
  if (timePassed > GAME_DURATION_MS) timePassed = GAME_DURATION_MS;

  const barWidth = sg1_canvas.width;
  const barHeight = 8;
  let fraction = 1 - (timePassed / GAME_DURATION_MS); 
  let currentWidth = fraction * barWidth;

  sg1_ctx.fillStyle = '#0f0';
  sg1_ctx.fillRect(0, 0, currentWidth, barHeight);

  // Яблоко (красный)
  sg1_ctx.fillStyle = '#f00';
  sg1_ctx.fillRect(
    sg1_apple.x * SG1_CELL_SIZE,
    sg1_apple.y * SG1_CELL_SIZE,
    SG1_CELL_SIZE,
    SG1_CELL_SIZE
  );

  // Рисуем нашу змейку
  drawSnake(sg1_snake);
  // Наша статистика
  drawUsernameAboveHead(sg1_snake);

  // Рисуем змейку противника
  drawSnake(sg1_enemySnake);
  drawUsernameAboveHead(sg1_enemySnake);
}

function drawSnake(snakeObj) {
  sg1_ctx.fillStyle = snakeObj.color;
  snakeObj.segments.forEach((seg) => {
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

  // Пишем "Username (x яблок)"
  let text = snakeObj.username + ' (' + snakeObj.applesCollected + ')';

  sg1_ctx.fillStyle = '#0f0'; 
  sg1_ctx.font = '10px "Press Start 2P", monospace';
  sg1_ctx.textAlign = 'center';

  let px = head.x * SG1_CELL_SIZE + SG1_CELL_SIZE/2;
  let py = head.y * SG1_CELL_SIZE - 5;
  sg1_ctx.fillText(text, px, py);
}

/** Генерация нового яблока (и запись в БД) */
function generateNewApple() {
  sg1_apple.x = Math.floor(Math.random() * SG1_COLS);
  sg1_apple.y = Math.floor(Math.random() * SG1_ROWS);
  sg1_gameRef.update({
    apple: { x: sg1_apple.x, y: sg1_apple.y },
  });
}

/** Отправка данных о локальной змейке */
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

/** Завершение игры, показ победителя */
function showWinnerModal(winnerPlayer) {
  clearIntervals();

  // Если была ничья (например 'tie'), нужно это тоже отобразить
  let title   = 'Итоги';
  let message = '';
  if (winnerPlayer === sg1_localPlayer) {
    message = 'Вы выиграли!';
  } else if (winnerPlayer === null) {
    message = 'Ничья?';
  } else if (winnerPlayer === 'tie') {
    message = 'Ничья!';
  } else {
    message = 'Вы проиграли...';
  }

  // Глобальная функция из main.js
  showEndGameModal(title, message);
}

/** Сброс игры */
function resetSpecialGame1() {
  clearIntervals();
  if (sg1_gameRef) sg1_gameRef.off();
  sg1_gameRef = null;
  sg1_gameId  = null;
  sg1_localPlayer = null;
  sg1_gameState   = 'searching';
  sg1_snake.applesCollected      = 0;
  sg1_enemySnake.applesCollected = 0;
}

/** Очищаем интервалы */
function clearIntervals() {
  if (sg1_gameLoopInterval) clearInterval(sg1_gameLoopInterval);
  sg1_gameLoopInterval = null;

  if (sg1_sendDataInterval) clearInterval(sg1_sendDataInterval);
  sg1_sendDataInterval = null;

  if (sg1_countdownInterval) clearInterval(sg1_countdownInterval);
  sg1_countdownInterval = null;

  if (sg1_mainTimerInterval) clearInterval(sg1_mainTimerInterval);
  sg1_mainTimerInterval = null;
}

/** Свайпы: управление */
function setupSwipeControls(canvas) {
  let startX, startY, endX, endY;
  canvas.addEventListener('touchstart', (e) => {
    const t = e.touches[0];
    startX = t.clientX;
    startY = t.clientY;
  }, { passive: false });

  canvas.addEventListener('touchmove', (e) => {
    const t = e.touches[0];
    endX = t.clientX;
    endY = t.clientY;
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
  }, { passive: false });
}

/** Возвращает случайный цвет (зелёно-неоновые) */
function getRandomSnakeColor() {
  const colors = ['#0f0', '#0ff', '#7fff00', '#39ff14', '#32cd32'];
  return colors[Math.floor(Math.random() * colors.length)];
}

/** Если цвет совпал, берём другой из списка */
function getAnotherColor(usedColor) {
  const colors = ['#0f0', '#0ff', '#7fff00', '#39ff14', '#32cd32'];
  let newColor = usedColor;
  while (newColor === usedColor) {
    newColor = colors[Math.floor(Math.random() * colors.length)];
  }
  return newColor;
}
